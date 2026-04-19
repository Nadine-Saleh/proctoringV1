import { describe, it, expect, beforeEach } from 'vitest';
import { getTestSupabaseClient, seedTestUser } from '../setup';

/**
 * T031: Exhausting max_verification_attempts moves session to verification_blocked
 * and raises an instructor_alerts row with reason='verification_failed_hard'.
 */
describe('verify_student_identity budget exhaustion', () => {
  let client: ReturnType<typeof getTestSupabaseClient>;
  let studentId: string;
  let instructorId: string;
  let examId: string;
  let sessionId: string;
  const maxAttempts = 2;

  const referenceEmbedding = Array.from({ length: 128 }, () => 0.1);
  const wrongEmbedding = Array.from({ length: 128 }, () => 1.0);

  beforeEach(async () => {
    client = getTestSupabaseClient();
    const instructor = await seedTestUser('instructor');
    const student = await seedTestUser('student');
    instructorId = instructor!.id;
    studentId = student!.id;

    const { data: exam } = await client
      .from('exams')
      .insert({
        instructor_id: instructorId,
        title: 'Budget Test Exam',
        starts_at: new Date(Date.now() - 60000).toISOString(),
        duration_minutes: 120,
        status: 'draft',
        proctoring_policy: {
          visual_evidence_allowed: true,
          warning_threshold: 30,
          critical_threshold: 70,
          critical_sustain_seconds: 5,
          max_verification_attempts: maxAttempts,
        },
      })
      .select()
      .single();
    examId = exam!.id;

    await client.from('exam_questions').insert({
      exam_id: examId,
      position: 1,
      type: 'true_false',
      prompt: 'Budget test?',
      correct_answer: JSON.stringify({ value: true }),
      points: 1,
    });

    const { data: accessCode } = await client.rpc('publish_exam', { p_exam_id: examId });

    await client.from('student_face_references').upsert({
      student_id: studentId,
      embedding: referenceEmbedding,
      quality_score: 0.9,
    });

    const { data: joinData } = await client.rpc('join_exam', { p_access_code: accessCode });
    sessionId = (joinData as any).session_id;
  });

  it('blocks session after max failed attempts', async () => {
    for (let i = 0; i < maxAttempts; i++) {
      await client.rpc('verify_student_identity', {
        p_session_id: sessionId,
        p_embedding: wrongEmbedding,
      });
    }

    const { data: session } = await client
      .from('exam_sessions')
      .select('status')
      .eq('id', sessionId)
      .single();

    expect(session?.status).toBe('verification_blocked');
  });

  it('raises instructor_alerts with reason=verification_failed_hard', async () => {
    for (let i = 0; i < maxAttempts; i++) {
      await client.rpc('verify_student_identity', {
        p_session_id: sessionId,
        p_embedding: wrongEmbedding,
      });
    }

    const { data: alerts } = await client
      .from('instructor_alerts')
      .select('*')
      .eq('session_id', sessionId)
      .eq('reason', 'verification_failed_hard');

    expect(alerts).toBeDefined();
    expect(alerts!.length).toBe(1);
  });

  it('returns blocked=true after budget exhaustion', async () => {
    for (let i = 0; i < maxAttempts - 1; i++) {
      await client.rpc('verify_student_identity', {
        p_session_id: sessionId,
        p_embedding: wrongEmbedding,
      });
    }

    const { data } = await client.rpc('verify_student_identity', {
      p_session_id: sessionId,
      p_embedding: wrongEmbedding,
    });

    const result = data as any;
    expect(result.blocked).toBe(true);
    expect(result.attempts_remaining).toBe(0);
  });
});
