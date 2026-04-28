import { describe, it, expect, beforeEach } from 'vitest';
import { getTestSupabaseClient, seedTestUser } from '../setup';

/**
 * T034b: start_exam_session with calibration_skipped=true writes server-side
 * defaults 50/20 and flags the session (FR-013b).
 */
describe('start_exam_session — calibration_skipped fallback (FR-013b)', () => {
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
        title: 'Calibration Fallback Test Exam',
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

    const { data: examRow } = await client.from('exams').select('access_code').eq('id', exam.id).single();
    const { data: joinData } = await client.rpc('join_exam', { p_access_code: examRow?.access_code });
    sessionId = (joinData as any).session_id;

    await client.rpc('verify_student_identity', {
      p_session_id: sessionId,
      p_embedding: mockEmbedding,
    });
  });

  it('writes conservative defaults when calibration_skipped = true', async () => {
    const { data, error } = await client.rpc('start_exam_session', {
      p_session_id: sessionId,
      p_calibration: { calibration_skipped: true },
    });

    expect(error).toBeNull();
    const session = (data as any).session;
    expect(session.status).toBe('in_progress');
    expect(session.optimal_distance_cm).toBe(50);
    expect(session.distance_tolerance_cm).toBe(20);
    expect(session.calibration_skipped).toBe(true);
  });

  it('persists conservative defaults to exam_sessions row', async () => {
    await client.rpc('start_exam_session', {
      p_session_id: sessionId,
      p_calibration: { calibration_skipped: true },
    });

    const { data: row } = await client
      .from('exam_sessions')
      .select('optimal_distance_cm, distance_tolerance_cm, calibration_skipped')
      .eq('id', sessionId)
      .single();

    expect(row?.optimal_distance_cm).toBe(50);
    expect(row?.distance_tolerance_cm).toBe(20);
    expect(row?.calibration_skipped).toBe(true);
  });
});
