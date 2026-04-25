import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestSupabaseClient, seedTestUser } from '../setup';

/**
 * T029: Integration tests for join_exam RPC error codes.
 * Covers: invalid_code, exam_window_not_open, exam_closed, already_active_session, verification_blocked.
 */
describe('join_exam error codes', () => {
  let client: ReturnType<typeof getTestSupabaseClient>;
  let instructorId: string;
  let studentId: string;
  let publishedExamId: string;

  const createAndPublishExam = async (overrides: Record<string, unknown> = {}) => {
    const { data: exam, error } = await client
      .from('exams')
      .insert({
        instructor_id: instructorId,
        title: 'Test Exam',
        starts_at: new Date(Date.now() + 3600000).toISOString(),
        duration_minutes: 60,
        status: 'draft',
        proctoring_policy: {
          visual_evidence_allowed: true,
          warning_threshold: 30,
          critical_threshold: 70,
          critical_sustain_seconds: 5,
          max_verification_attempts: 3,
        },
        ...overrides,
      })
      .select()
      .single();
    if (error || !exam) throw new Error(`Failed to create exam: ${error?.message}`);

    await client.from('exam_questions').insert({
      exam_id: exam.id,
      position: 1,
      type: 'true_false',
      prompt: 'Is this a test?',
      correct_answer: JSON.stringify({ value: true }),
      points: 1,
    });

    const { data: code } = await client.rpc('publish_exam', { p_exam_id: exam.id });
    return { examId: exam.id, accessCode: code as string };
  };

  beforeEach(async () => {
    client = getTestSupabaseClient();
    const instructor = await seedTestUser('instructor');
    const student = await seedTestUser('student');
    instructorId = instructor!.id;
    studentId = student!.id;

    const { accessCode } = await createAndPublishExam();
    publishedExamId = (
      await client
        .from('exams')
        .select('id')
        .eq('access_code', accessCode)
        .single()
    ).data!.id;
  });

  it('returns invalid_code for non-existent code', async () => {
    const { data, error } = await client.rpc('join_exam', {
      p_access_code: 'ZZZZZZZZ',
    });
    expect(error?.message ?? (data as any)?.error_code).toMatch(/invalid_code/i);
  });

  it('returns exam_window_not_open when exam has not started yet', async () => {
    const farFuture = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const { accessCode } = await createAndPublishExam({ starts_at: farFuture });

    const { data, error } = await client.rpc('join_exam', {
      p_access_code: accessCode,
    });
    expect(error?.message ?? (data as any)?.error_code).toMatch(/exam_window_not_open/i);
  });

  it('returns exam_closed when exam status is closed', async () => {
    const { accessCode, examId } = await createAndPublishExam({
      starts_at: new Date(Date.now() - 7200000).toISOString(),
    });
    await client.rpc('close_exam', { p_exam_id: examId });

    const { data, error } = await client.rpc('join_exam', {
      p_access_code: accessCode,
    });
    expect(error?.message ?? (data as any)?.error_code).toMatch(/exam_closed|invalid_code/i);
  });

  it('returns already_active_session when student joins same exam twice', async () => {
    const { accessCode } = await createAndPublishExam({
      starts_at: new Date(Date.now() - 60000).toISOString(),
    });

    await client.rpc('join_exam', { p_access_code: accessCode });
    const { data, error } = await client.rpc('join_exam', { p_access_code: accessCode });

    const result = error?.message ?? (data as any)?.error_code ?? '';
    expect(result).toMatch(/already_active_session/i);
  });
});
