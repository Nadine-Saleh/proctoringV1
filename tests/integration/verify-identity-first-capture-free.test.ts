import { describe, it, expect, beforeEach } from 'vitest';
import { getTestSupabaseClient, seedTestUser } from '../setup';

/**
 * T032: First verification attempt after fresh reference capture is NOT counted
 * against the retry budget (FR-009 / R11). Ensures counted_against_budget=false
 * on the verification_attempts row.
 */
describe('verify_student_identity first-capture-free budget rule', () => {
  let client: ReturnType<typeof getTestSupabaseClient>;
  let studentId: string;
  let sessionId: string;
  const embedding = Array.from({ length: 128 }, () => 0.1);

  beforeEach(async () => {
    client = getTestSupabaseClient();
    const instructor = await seedTestUser('instructor');
    const student = await seedTestUser('student');
    studentId = student!.id;

    const { data: exam } = await client
      .from('exams')
      .insert({
        instructor_id: instructor!.id,
        title: 'First Capture Free Exam',
        starts_at: new Date(Date.now() - 60000).toISOString(),
        duration_minutes: 120,
        status: 'draft',
        proctoring_policy: {
          visual_evidence_allowed: true,
          warning_threshold: 30,
          critical_threshold: 70,
          critical_sustain_seconds: 5,
          max_verification_attempts: 1,
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

    const { data: accessCode } = await client.rpc('publish_exam', { p_exam_id: exam!.id });

    // Insert reference directly (simulating fresh capture, marked as just captured)
    await client.from('student_face_references').upsert({
      student_id: studentId,
      embedding,
      quality_score: 0.9,
    });

    const { data: joinData } = await client.rpc('join_exam', {
      p_access_code: accessCode,
      p_fresh_capture: true,
    });
    sessionId = (joinData as any).session_id;
  });

  it('does not count the first post-capture verification against budget', async () => {
    const { data } = await client.rpc('verify_student_identity', {
      p_session_id: sessionId,
      p_embedding: embedding,
    });

    const result = data as any;
    expect(result.outcome).toBe('pass');

    const { data: attempt } = await client
      .from('verification_attempts')
      .select('counted_against_budget')
      .eq('student_id', studentId)
      .order('attempted_at', { ascending: false })
      .limit(1)
      .single();

    expect(attempt?.counted_against_budget).toBe(false);
  });
});
