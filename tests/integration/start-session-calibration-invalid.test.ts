import { describe, it, expect, beforeEach } from 'vitest';
import { getTestSupabaseClient, seedTestUser } from '../setup';

/**
 * T034c: start_exam_session with out-of-range calibration values returns
 * calibration_invalid and does not mutate the session row.
 */
describe('start_exam_session — calibration_invalid guard', () => {
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
        title: 'Calibration Invalid Test Exam',
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

  it('rejects optimal_distance_cm below minimum (< 20)', async () => {
    const { error } = await client.rpc('start_exam_session', {
      p_session_id: sessionId,
      p_calibration: {
        calibration_skipped: false,
        optimal_distance_cm: 5,
        distance_tolerance_cm: 15,
      },
    });
    expect(error?.message).toContain('calibration_invalid');
  });

  it('rejects distance_tolerance_cm above maximum (> 30)', async () => {
    const { error } = await client.rpc('start_exam_session', {
      p_session_id: sessionId,
      p_calibration: {
        calibration_skipped: false,
        optimal_distance_cm: 50,
        distance_tolerance_cm: 50,
      },
    });
    expect(error?.message).toContain('calibration_invalid');
  });

  it('rejects missing distance fields when calibration_skipped = false', async () => {
    const { error } = await client.rpc('start_exam_session', {
      p_session_id: sessionId,
      p_calibration: { calibration_skipped: false },
    });
    expect(error?.message).toContain('calibration_invalid');
  });

  it('does not mutate session status on calibration_invalid', async () => {
    await client.rpc('start_exam_session', {
      p_session_id: sessionId,
      p_calibration: {
        calibration_skipped: false,
        optimal_distance_cm: 5,
        distance_tolerance_cm: 15,
      },
    });

    const { data: row } = await client
      .from('exam_sessions')
      .select('status, optimal_distance_cm')
      .eq('id', sessionId)
      .single();

    expect(row?.status).toBe('verified');
    expect(row?.optimal_distance_cm).toBeNull();
  });
});
