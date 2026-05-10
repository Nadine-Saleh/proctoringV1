import { describe, it, expect, beforeEach } from 'vitest';
import { getTestSupabaseClient, seedTestUser } from '../setup';

/**
 * T068: Calling submit-exam twice returns the same submission_id with
 * idempotent_hit=true on the second call; exactly one submissions row exists.
 *
 * NOTE: These tests hit the submit-exam Edge Function. The Supabase test project
 * must have the function deployed. Set VITE_SUPABASE_URL in .env.test.
 */
describe('submit-exam idempotency (FR-027)', () => {
  let client: ReturnType<typeof getTestSupabaseClient>;
  let sessionId: string;
  let examId: string;

  const submitExam = async (sid: string, serviceRoleKey: string) => {
    const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/submit-exam`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        session_id: sid,
        submit_reason: 'manual',
        client_submitted_at: new Date().toISOString(),
      }),
    });
    return resp.json();
  };

  beforeEach(async () => {
    client = getTestSupabaseClient();
    const instructor = await seedTestUser('instructor');
    const student = await seedTestUser('student');

    const { data: exam } = await client
      .from('exams')
      .insert({
        instructor_id: instructor!.id,
        title: 'Idempotent Submit Test',
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
    examId = exam!.id;

    await client.from('exam_questions').insert({
      exam_id: examId,
      position: 1,
      type: 'true_false',
      prompt: 'Is this a test?',
      correct_answer: JSON.stringify({ value: true }),
      points: 1,
    });

    await client.rpc('publish_exam', { p_exam_id: examId });

    const mockEmbedding = Array.from({ length: 128 }, () => 0.01);
    await client.from('student_face_references').upsert({
      student_id: student!.id,
      embedding: mockEmbedding,
      quality_score: 0.9,
    });

    const { data: examRow } = await client.from('exams').select('access_code').eq('id', examId).single();
    const { data: joinData } = await client.rpc('join_exam', { p_access_code: examRow?.access_code });
    sessionId = (joinData as any).session_id;

    await client.rpc('verify_student_identity', { p_session_id: sessionId, p_embedding: mockEmbedding });
    await client.rpc('start_exam_session', { p_session_id: sessionId, p_calibration: { calibration_skipped: true } });
  });

  it.skip('second call returns same submission_id with idempotent_hit=true', async () => {
    // Skipped: requires Edge Function to be deployed to test project.
    // Unskip when running against a deployed environment.
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const first = await submitExam(sessionId, serviceKey);
    expect(first.idempotent_hit).toBe(false);
    expect(first.submission_id).toBeDefined();

    const second = await submitExam(sessionId, serviceKey);
    expect(second.idempotent_hit).toBe(true);
    expect(second.submission_id).toBe(first.submission_id);

    const { count } = await client
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);
    expect(count).toBe(1);
  });
});
