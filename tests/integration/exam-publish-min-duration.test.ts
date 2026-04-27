import { describe, it, expect, beforeEach } from 'vitest';
import { getTestSupabaseClient, seedTestUser } from '../setup';

/**
 * T018a: publish_exam duration guard (FR-002).
 * duration_minutes < 5 returns duration_below_minimum; = 5 succeeds.
 */
describe('publish_exam minimum duration guard', () => {
  let client: ReturnType<typeof getTestSupabaseClient>;
  let instructorId: string;

  const createExam = async (durationMinutes: number) => {
    const { data: exam, error } = await client
      .from('exams')
      .insert({
        instructor_id: instructorId,
        title: 'Duration Guard Exam',
        starts_at: new Date(Date.now() + 3600000).toISOString(),
        duration_minutes: durationMinutes,
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
    if (error || !exam) throw new Error(`Failed to create exam: ${error?.message}`);

    await client.from('exam_questions').insert({
      exam_id: exam.id,
      position: 1,
      type: 'true_false',
      prompt: 'Is this a test?',
      correct_answer: JSON.stringify({ value: true }),
      points: 1,
    });

    return exam.id as string;
  };

  beforeEach(async () => {
    client = getTestSupabaseClient();
    const instructor = await seedTestUser('instructor');
    instructorId = instructor!.id;
  });

  it('returns duration_below_minimum when duration_minutes < 5', async () => {
    const examId = await createExam(4);
    const { data, error } = await client.rpc('publish_exam', { p_exam_id: examId });
    expect(data).toBeNull();
    expect(error?.message).toContain('duration_below_minimum');
  });

  it('succeeds when duration_minutes = 5', async () => {
    const examId = await createExam(5);
    const { data, error } = await client.rpc('publish_exam', { p_exam_id: examId });
    expect(error).toBeNull();
    expect(typeof data).toBe('string');
    expect((data as string).length).toBe(8);
  });

  it('exam remains draft after a duration_below_minimum rejection', async () => {
    const examId = await createExam(3);
    await client.rpc('publish_exam', { p_exam_id: examId });
    const { data: exam } = await client
      .from('exams')
      .select('status')
      .eq('id', examId)
      .single();
    expect(exam?.status).toBe('draft');
  });
});
