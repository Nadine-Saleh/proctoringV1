import { describe, it, expect, beforeEach } from 'vitest';
import { getTestSupabaseClient, seedTestUser } from '../setup';

/**
 * Integration test for exam publish validation.
 * Tests that publish_exam RPC rejects exams that don't meet requirements:
 * - Must have at least one question
 * - Duration must be > 0 minutes
 */
describe('Exam Publish Validation Guards', () => {
  let client: ReturnType<typeof getTestSupabaseClient>;
  let instructorId: string;

  beforeEach(async () => {
    client = getTestSupabaseClient();
    const user = await seedTestUser('instructor');
    instructorId = user.id;
  });

  it('should reject publish if exam has no questions', async () => {
    const { data: exam } = await client
      .from('exams')
      .insert({
        instructor_id: instructorId,
        title: 'No Questions Exam',
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
      })
      .select()
      .single();

    if (!exam) throw new Error('Failed to create exam');

    // Try to publish without adding any questions
    const { error } = await client.rpc('publish_exam', {
      p_exam_id: exam.id,
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('question');
  });

  it('should reject publish if duration is 0 or negative', async () => {
    const { data: exam } = await client
      .from('exams')
      .insert({
        instructor_id: instructorId,
        title: 'Invalid Duration Exam',
        starts_at: new Date(Date.now() + 3600000).toISOString(),
        duration_minutes: 0,
        status: 'draft',
        proctoring_policy: {
          visual_evidence_allowed: true,
          warning_threshold: 30,
          critical_threshold: 70,
          critical_sustain_seconds: 5,
          max_verification_attempts: 3,
        },
      })
      .select()
      .single();

    if (!exam) throw new Error('Failed to create exam');

    // Add a question so only duration is invalid
    await client.from('exam_questions').insert({
      exam_id: exam.id,
      position: 1,
      type: 'true_false',
      prompt: 'True or false?',
      correct_answer: JSON.stringify({ value: true }),
      points: 1,
    });

    // Try to publish with invalid duration
    const { error } = await client.rpc('publish_exam', {
      p_exam_id: exam.id,
    });

    expect(error).toBeDefined();
  });
});
