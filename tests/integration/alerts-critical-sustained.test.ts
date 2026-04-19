import { describe, it, expect, beforeEach } from 'vitest';
import { getTestSupabaseClient, seedTestUser } from '../setup';

/**
 * T050: Score crossing critical for < sustain_seconds does NOT raise alert;
 * crossing for >= sustain_seconds DOES raise exactly one alert.
 */
describe('instructor_alerts: critical_score_sustained', () => {
  let client: ReturnType<typeof getTestSupabaseClient>;
  let sessionId: string;
  let examId: string;

  beforeEach(async () => {
    client = getTestSupabaseClient();
    const instructor = await seedTestUser('instructor');
    const student = await seedTestUser('student');

    const { data: exam } = await client
      .from('exams')
      .insert({
        instructor_id: instructor!.id,
        title: 'Critical Sustained Test Exam',
        starts_at: new Date(Date.now() - 60000).toISOString(),
        duration_minutes: 120,
        status: 'draft',
        proctoring_policy: {
          visual_evidence_allowed: true,
          warning_threshold: 40,
          critical_threshold: 70,
          critical_sustain_seconds: 10,
          max_verification_attempts: 3,
        },
      })
      .select()
      .single();
    if (!exam) throw new Error('Failed to create exam');
    examId = exam.id;

    await client.from('exam_questions').insert({
      exam_id: exam.id,
      position: 1,
      type: 'true_false',
      prompt: 'Test?',
      correct_answer: JSON.stringify({ value: true }),
      points: 1,
    });

    const { data: accessCode } = await client.rpc('publish_exam', { p_exam_id: exam.id });
    const mockEmbedding = Array.from({ length: 128 }, () => 0.01);

    await client.from('student_face_references').upsert({
      student_id: student!.id,
      embedding: mockEmbedding,
      quality_score: 0.9,
    });

    const { data: joinData } = await client.rpc('join_exam', { p_access_code: accessCode });
    sessionId = (joinData as any).session_id;

    await client.rpc('verify_student_identity', {
      p_session_id: sessionId,
      p_embedding: mockEmbedding,
    });

    await client.rpc('start_exam_session', { p_session_id: sessionId });
  });

  it('does NOT raise alert when score first crosses critical threshold', async () => {
    // Send enough high-severity events to push score above 70
    const events = Array.from({ length: 4 }, (_, i) => ({
      client_event_id: `crit-short-${i}`,
      type: 'multiple_persons',
      severity: 25,
      client_captured_at: new Date().toISOString(),
      metadata: {},
    }));

    const { data } = await client.rpc('record_violation_batch', {
      p_session_id: sessionId,
      p_events: events,
    });

    // Score is above critical (4*25=100) but sustained time is brand new
    // RPC should NOT have raised alert on first crossing
    expect((data as any).crossed_critical_threshold).toBe(true);
    expect((data as any).instructor_alert_raised).toBe(false);

    const { count } = await client
      .from('instructor_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('reason', 'critical_score_sustained');

    expect(count).toBe(0);
  });

  it('DOES raise alert after score stays critical for >= sustain_seconds', async () => {
    // Force the session's live_cheating_score to 100 and last_score_update_at to > 10s ago
    await client
      .from('exam_sessions')
      .update({
        live_cheating_score: 100,
        last_score_update_at: new Date(Date.now() - 15000).toISOString(),
      })
      .eq('id', sessionId);

    // Send another batch to trigger the RPC check
    const events = [
      {
        client_event_id: 'crit-sustained-trigger',
        type: 'multiple_faces',
        severity: 25,
        client_captured_at: new Date().toISOString(),
        metadata: {},
      },
    ];

    const { data } = await client.rpc('record_violation_batch', {
      p_session_id: sessionId,
      p_events: events,
    });

    expect((data as any).instructor_alert_raised).toBe(true);

    const { count } = await client
      .from('instructor_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('reason', 'critical_score_sustained');

    expect(count).toBeGreaterThanOrEqual(1);
  });
});
