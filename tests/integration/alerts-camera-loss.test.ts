import { describe, it, expect, beforeEach } from 'vitest';
import { getTestSupabaseClient, seedTestUser } from '../setup';

/**
 * T051: Any camera_unavailable event raises an instructor_alerts row
 * with reason='camera_lost' regardless of the current cheating score.
 */
describe('instructor_alerts: camera_lost', () => {
  let client: ReturnType<typeof getTestSupabaseClient>;
  let sessionId: string;

  beforeEach(async () => {
    client = getTestSupabaseClient();
    const instructor = await seedTestUser('instructor');
    const student = await seedTestUser('student');

    const { data: exam } = await client
      .from('exams')
      .insert({
        instructor_id: instructor!.id,
        title: 'Camera Loss Alert Test Exam',
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

    await client.rpc('start_exam_session', { p_session_id: sessionId, p_calibration: { calibration_skipped: true } });
  });

  it('raises camera_lost alert when camera_unavailable event is in batch (score = 0)', async () => {
    const { data, error } = await client.rpc('record_violation_batch', {
      p_session_id: sessionId,
      p_events: [
        {
          client_event_id: 'cam-lost-001',
          type: 'camera_unavailable',
          severity: 25,
          client_captured_at: new Date().toISOString(),
          metadata: {},
        },
      ],
    });

    expect(error).toBeNull();
    expect((data as any).instructor_alert_raised).toBe(true);

    const { data: alerts } = await client
      .from('instructor_alerts')
      .select('reason')
      .eq('session_id', sessionId)
      .eq('reason', 'camera_lost');

    expect(alerts).toBeDefined();
    expect(alerts!.length).toBe(1);
  });

  it('does NOT raise camera_lost alert for non-camera events', async () => {
    const { error } = await client.rpc('record_violation_batch', {
      p_session_id: sessionId,
      p_events: [
        {
          client_event_id: 'no-cam-event-001',
          type: 'tab_focus_lost',
          severity: 10,
          client_captured_at: new Date().toISOString(),
          metadata: {},
        },
      ],
    });

    expect(error).toBeNull();

    const { count } = await client
      .from('instructor_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('reason', 'camera_lost');

    expect(count).toBe(0);
  });
});
