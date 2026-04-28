import { describe, it, expect, beforeEach } from 'vitest';
import { getTestSupabaseClient, seedTestUser } from '../setup';

/**
 * T030: Happy path — student with stored reference embedding passes verification.
 * Asserts: outcome='pass', session moves to 'verified', verification_attempts row recorded.
 */
describe('verify_student_identity happy path', () => {
  let client: ReturnType<typeof getTestSupabaseClient>;
  let studentId: string;
  let sessionId: string;

  const mockEmbedding128 = Array.from({ length: 128 }, () => Math.random() * 0.1);

  beforeEach(async () => {
    client = getTestSupabaseClient();
    const instructor = await seedTestUser('instructor');
    const student = await seedTestUser('student');
    studentId = student!.id;

    // Create and publish exam with window open
    const { data: exam } = await client
      .from('exams')
      .insert({
        instructor_id: instructor!.id,
        title: 'Verify Happy Path Exam',
        starts_at: new Date(Date.now() - 60000).toISOString(),
        duration_minutes: 120,
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

    await client.from('exam_questions').insert({
      exam_id: exam.id,
      position: 1,
      type: 'true_false',
      prompt: 'Test?',
      correct_answer: JSON.stringify({ value: true }),
      points: 1,
    });

    const { data: accessCode } = await client.rpc('publish_exam', { p_exam_id: exam.id });

    // Seed reference embedding for student
    await client.from('student_face_references').upsert({
      student_id: studentId,
      embedding: mockEmbedding128,
      quality_score: 0.95,
    });

    // Join exam to create session
    const { data: joinData } = await client.rpc('join_exam', {
      p_access_code: accessCode,
    });
    sessionId = (joinData as any).session_id;
  });

  it('passes verification and transitions session to verified', async () => {
    const { data, error } = await client.rpc('verify_student_identity', {
      p_session_id: sessionId,
      p_embedding: mockEmbedding128,
    });

    expect(error).toBeNull();
    const result = data as any;
    expect(result.outcome).toBe('pass');
    expect(result.session_status).toBe('verified');
  });

  it('records a verification_attempts row on pass', async () => {
    await client.rpc('verify_student_identity', {
      p_session_id: sessionId,
      p_embedding: mockEmbedding128,
    });

    const { data: attempts } = await client
      .from('verification_attempts')
      .select('*')
      .eq('student_id', studentId);

    expect(attempts).toBeDefined();
    expect(attempts!.length).toBeGreaterThan(0);
    expect(attempts![0].outcome).toBe('pass');
  });

  it('sets admitted_at on the session after pass', async () => {
    await client.rpc('verify_student_identity', {
      p_session_id: sessionId,
      p_embedding: mockEmbedding128,
    });

    const { data: session } = await client
      .from('exam_sessions')
      .select('admitted_at, status')
      .eq('id', sessionId)
      .single();

    expect(session?.admitted_at).not.toBeNull();
    expect(session?.status).toBe('verified');
  });
});
