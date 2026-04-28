import { describe, it, expect, beforeEach } from 'vitest';
import { getTestSupabaseClient, seedTestUser } from '../setup';

/**
 * Integration test for exam publish access code generation.
 * Tests that access codes are:
 * - 8 characters long
 * - Using Crockford Base32 alphabet (0-9, A-Z except I, L, O, U)
 * - Unique across concurrently published exams
 */
describe('Exam Publish Access Code', () => {
  let client: ReturnType<typeof getTestSupabaseClient>;
  let instructorId: string;

  beforeEach(async () => {
    client = getTestSupabaseClient();
    const user = await seedTestUser('instructor');
    instructorId = user.id;
  });

  it('should generate an 8-character access code on publish', async () => {
    // Create exam
    const { data: exam } = await client
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
      })
      .select()
      .single();

    if (!exam) throw new Error('Failed to create exam');

    // Add a question so publish is allowed
    await client.from('exam_questions').insert({
      exam_id: exam.id,
      position: 1,
      type: 'multiple_choice_single',
      prompt: 'What is 2+2?',
      options: JSON.stringify([
        { id: '1', text: '3' },
        { id: '2', text: '4' },
        { id: '3', text: '5' },
      ]),
      correct_answer: JSON.stringify({ option_id: '2' }),
      points: 1,
    });

    // Publish the exam
    const { data: result } = await client.rpc('publish_exam', {
      p_exam_id: exam.id,
    });

    // Verify access code format
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result).toHaveLength(8);

    // Verify Crockford Base32 alphabet (0-9, A-Z except I/L/O/U)
    const crockfordAlphabet = /^[0-9A-HJ-NPR-Z]{8}$/;
    expect(result).toMatch(crockfordAlphabet);
  });

  it('should generate unique access codes for concurrent publishes', async () => {
    const codes = new Set<string>();

    // Create and publish 5 exams concurrently
    const examPromises = Array.from({ length: 5 }, async () => {
      const { data: exam } = await client
        .from('exams')
        .insert({
          instructor_id: instructorId,
          title: `Concurrent Test Exam ${Math.random()}`,
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

      // Add question
      await client.from('exam_questions').insert({
        exam_id: exam.id,
        position: 1,
        type: 'true_false',
        prompt: 'True or false?',
        correct_answer: JSON.stringify({ value: true }),
        points: 1,
      });

      // Publish
      const { data: code } = await client.rpc('publish_exam', {
        p_exam_id: exam.id,
      });

      return code;
    });

    const publishedCodes = await Promise.all(examPromises);
    publishedCodes.forEach((code) => {
      expect(codes.has(code as string)).toBe(false);
      codes.add(code as string);
    });

    expect(codes.size).toBe(5);
  });
});
