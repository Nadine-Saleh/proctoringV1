import { describe, it, expect, beforeEach } from 'vitest';
import { getTestSupabaseClient, seedTestUser } from '../setup';

/**
 * T048: Replaying the same client_event_id inserts exactly one row;
 * deduplicated counter in response equals 1.
 */
describe('record_violation_batch idempotency', () => {
  let client: ReturnType<typeof getTestSupabaseClient>;
  let sessionId: string;

  const CLIENT_EVENT_ID = 'idem-test-event-001';

  beforeEach(async () => {
    client = getTestSupabaseClient();
    const instructor = await seedTestUser('instructor');
    const student = await seedTestUser('student');

    const { data: exam } = await client
      .from('exams')
      .insert({
        instructor_id: instructor!.id,
        title: 'Idempotency Test Exam',
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

  it('inserts exactly one row when same client_event_id is sent twice', async () => {
    const event = {
      client_event_id: CLIENT_EVENT_ID,
      type: 'tab_focus_lost',
      severity: 10,
      client_captured_at: new Date().toISOString(),
      metadata: {},
    };

    const { data: first, error: err1 } = await client.rpc('record_violation_batch', {
      p_session_id: sessionId,
      p_events: [event],
    });
    expect(err1).toBeNull();
    expect((first as any).accepted).toBe(1);
    expect((first as any).deduplicated).toBe(0);

    const { data: second, error: err2 } = await client.rpc('record_violation_batch', {
      p_session_id: sessionId,
      p_events: [event],
    });
    expect(err2).toBeNull();
    expect((second as any).accepted).toBe(0);
    expect((second as any).deduplicated).toBe(1);

    const { count } = await client
      .from('violation_events')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('client_event_id', CLIENT_EVENT_ID);

    expect(count).toBe(1);
  });
});
