import { describe, it, expect, beforeEach } from 'vitest';
import { getTestSupabaseClient, seedTestUser } from '../setup';

/**
 * T034a: start_exam_session with explicit calibration values persists them verbatim;
 * second call is idempotent (session_already_started, calibration unchanged).
 */
describe('start_exam_session — calibration write (FR-013a)', () => {
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
        title: 'Calibration Write Test Exam',
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

    await client.rpc('publish_exam', { p_exam_id: exam.id });

    const mockEmbedding = Array.from({ length: 128 }, () => 0.01);
    await client.from('student_face_references').upsert({
      student_id: student!.id,
      embedding: mockEmbedding,
      quality_score: 0.9,
    });

    const { data: joinData } = await client.rpc('join_exam', { p_access_code: await getExamCode(client, exam.id) });
    sessionId = (joinData as any).session_id;

    await client.rpc('verify_student_identity', {
      p_session_id: sessionId,
      p_embedding: mockEmbedding,
    });
  });

  it('persists calibration values verbatim and includes them in response', async () => {
    const calibration = {
      calibration_skipped: false,
      optimal_distance_cm: 47,
      distance_tolerance_cm: 15,
    };

    const { data, error } = await client.rpc('start_exam_session', {
      p_session_id: sessionId,
      p_calibration: calibration,
    });

    expect(error).toBeNull();
    const session = (data as any).session;
    expect(session.status).toBe('in_progress');
    expect(session.optimal_distance_cm).toBe(47);
    expect(session.distance_tolerance_cm).toBe(15);
    expect(session.calibration_skipped).toBe(false);
    expect((data as any).questions).toBeDefined();
  });

  it('second call returns in_progress with original calibration unchanged (idempotency)', async () => {
    const calibration = {
      calibration_skipped: false,
      optimal_distance_cm: 47,
      distance_tolerance_cm: 15,
    };

    await client.rpc('start_exam_session', { p_session_id: sessionId, p_calibration: calibration });

    // Second call with different values — should be ignored
    const { data: second, error: err2 } = await client.rpc('start_exam_session', {
      p_session_id: sessionId,
      p_calibration: { calibration_skipped: true },
    });

    expect(err2).toBeNull();
    const session = (second as any).session;
    expect(session.status).toBe('in_progress');
    // Original calibration must survive the second call
    expect(session.optimal_distance_cm).toBe(47);
    expect(session.distance_tolerance_cm).toBe(15);
    expect(session.calibration_skipped).toBe(false);
  });

  it('columns are written to exam_sessions row', async () => {
    await client.rpc('start_exam_session', {
      p_session_id: sessionId,
      p_calibration: { calibration_skipped: false, optimal_distance_cm: 47, distance_tolerance_cm: 15 },
    });

    const { data: row } = await client
      .from('exam_sessions')
      .select('optimal_distance_cm, distance_tolerance_cm, calibration_skipped')
      .eq('id', sessionId)
      .single();

    expect(row?.optimal_distance_cm).toBe(47);
    expect(row?.distance_tolerance_cm).toBe(15);
    expect(row?.calibration_skipped).toBe(false);
  });
});

async function getExamCode(client: ReturnType<typeof getTestSupabaseClient>, examId: string): Promise<string> {
  const { data } = await client.from('exams').select('access_code').eq('id', examId).single();
  return data?.access_code as string;
}
