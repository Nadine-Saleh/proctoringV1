import { describe, it, expect, beforeEach } from 'vitest';
import { getTestSupabaseClient, seedTestUser } from '../setup';

/**
 * T049: Submitting an evidence-attached event under visual_evidence_allowed=false
 * rejects the entire batch with evidence_policy_violation.
 */
describe('record_violation_batch policy guard', () => {
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
        title: 'Policy Guard Test Exam',
        starts_at: new Date(Date.now() - 60000).toISOString(),
        duration_minutes: 120,
        status: 'draft',
        proctoring_policy: {
          visual_evidence_allowed: false,
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

    await client.rpc('start_exam_session', { p_session_id: sessionId });
  });

  it('rejects entire batch when evidence is attached under disallowing policy', async () => {
    const events = [
      {
        client_event_id: 'policy-evt-001',
        type: 'gaze_off_screen',
        severity: 15,
        client_captured_at: new Date().toISOString(),
        metadata: {},
        evidence: {
          captured: true,
          bucket_path: 'sessions/test/clip.webm',
          content_type: 'video/webm',
          byte_length: 4096,
        },
      },
    ];

    const { error } = await client.rpc('record_violation_batch', {
      p_session_id: sessionId,
      p_events: events,
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain('evidence_policy_violation');

    // No rows should have been inserted
    const { count } = await client
      .from('violation_events')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    expect(count).toBe(0);
  });

  it('accepts events without evidence under disallowing policy', async () => {
    const events = [
      {
        client_event_id: 'policy-no-evidence-001',
        type: 'tab_focus_lost',
        severity: 10,
        client_captured_at: new Date().toISOString(),
        metadata: {},
      },
    ];

    const { data, error } = await client.rpc('record_violation_batch', {
      p_session_id: sessionId,
      p_events: events,
    });

    expect(error).toBeNull();
    expect((data as any).accepted).toBe(1);
  });
});
