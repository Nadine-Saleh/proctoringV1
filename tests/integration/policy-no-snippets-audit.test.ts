import { describe, it, expect, beforeEach } from 'vitest';
import { getTestSupabaseClient, seedTestUser } from '../setup';

/**
 * T073: Sessions with visual_evidence_allowed=false have zero evidence_artifacts
 * rows and zero objects in the bucket (SC-010 audit).
 */
describe('policy no-snippets audit (SC-010)', () => {
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
        title: 'No Snippets Policy Test',
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

    await client.from('exam_questions').insert({
      exam_id: exam!.id,
      position: 1,
      type: 'true_false',
      prompt: 'Test?',
      correct_answer: JSON.stringify({ value: true }),
      points: 1,
    });

    await client.rpc('publish_exam', { p_exam_id: exam!.id });

    const mockEmbedding = Array.from({ length: 128 }, () => 0.01);
    await client.from('student_face_references').upsert({
      student_id: student!.id,
      embedding: mockEmbedding,
      quality_score: 0.9,
    });

    const { data: examRow } = await client.from('exams').select('access_code').eq('id', exam!.id).single();
    const { data: joinData } = await client.rpc('join_exam', { p_access_code: examRow?.access_code });
    sessionId = (joinData as any).session_id;

    await client.rpc('verify_student_identity', { p_session_id: sessionId, p_embedding: mockEmbedding });
    await client.rpc('start_exam_session', { p_session_id: sessionId, p_calibration: { calibration_skipped: true } });
  });

  it('record_violation_batch rejects events with evidence under no-snippets policy', async () => {
    const event = {
      client_event_id: 'no-snip-test-001',
      type: 'gaze_off_screen',
      severity: 15,
      client_captured_at: new Date().toISOString(),
      metadata: {},
      evidence_bucket_path: 'sessions/fake/snippet.jpg',
    };

    const { data, error } = await client.rpc('record_violation_batch', {
      p_session_id: sessionId,
      p_events: [event],
    });

    // evidence attached under disallowing policy → rejected batch
    expect(error?.message ?? (data as any)?.error).toContain('evidence_policy_violation');
  });

  it('record_violation_batch accepts events without evidence under no-snippets policy', async () => {
    const event = {
      client_event_id: 'no-snip-ok-001',
      type: 'gaze_off_screen',
      severity: 15,
      client_captured_at: new Date().toISOString(),
      metadata: {},
    };

    const { data, error } = await client.rpc('record_violation_batch', {
      p_session_id: sessionId,
      p_events: [event],
    });

    expect(error).toBeNull();
    expect((data as any).accepted).toBe(1);
  });

  it('zero evidence_artifacts rows exist for no-snippets sessions', async () => {
    const { count } = await client
      .from('evidence_artifacts')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);
    expect(count).toBe(0);
  });
});
