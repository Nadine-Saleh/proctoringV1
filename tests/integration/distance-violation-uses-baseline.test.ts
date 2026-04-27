import { describe, it, expect, beforeEach } from 'vitest';
import { getTestSupabaseClient, seedTestUser } from '../setup';

/**
 * T053b: record_violation_batch uses the session's calibrated distance baseline.
 * Out-of-band face_too_close events ARE accepted; in-band handling is
 * implementation-defined per the contract (scored as zero or filtered).
 */
describe('record_violation_batch — distance baseline (FR-013a)', () => {
  let client: ReturnType<typeof getTestSupabaseClient>;
  let sessionId: string;

  // optimal=45, tolerance=15 → band [30, 60]
  const OPTIMAL_CM = 45;
  const TOLERANCE_CM = 15;

  beforeEach(async () => {
    client = getTestSupabaseClient();
    const instructor = await seedTestUser('instructor');
    const student = await seedTestUser('student');

    const { data: exam } = await client
      .from('exams')
      .insert({
        instructor_id: instructor!.id,
        title: 'Distance Baseline Test Exam',
        starts_at: new Date(Date.now() - 60000).toISOString(),
        duration_minutes: 120,
        status: 'draft',
        proctoring_policy: {
          visual_evidence_allowed: false,
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

    // Start session with explicit calibration baseline
    await client.rpc('start_exam_session', {
      p_session_id: sessionId,
      p_calibration: {
        calibration_skipped: false,
        optimal_distance_cm: OPTIMAL_CM,
        distance_tolerance_cm: TOLERANCE_CM,
      },
    });
  });

  it('accepts face_too_close event with estimated_distance_cm below the lower band boundary', async () => {
    // Lower boundary = 45 - 15 = 30. estimated = 25 is out-of-band (too close).
    const event = {
      client_event_id: 'dist-oob-close-001',
      type: 'face_too_close',
      severity: 5,
      client_captured_at: new Date().toISOString(),
      metadata: {
        estimated_distance_cm: 25,
        baseline_cm: OPTIMAL_CM,
        tolerance_cm: TOLERANCE_CM,
      },
    };

    const { data, error } = await client.rpc('record_violation_batch', {
      p_session_id: sessionId,
      p_events: [event],
    });

    expect(error).toBeNull();
    expect((data as any).accepted).toBe(1);
  });

  it('session calibration columns are readable and correct after start_exam_session', async () => {
    const { data: row } = await client
      .from('exam_sessions')
      .select('optimal_distance_cm, distance_tolerance_cm, calibration_skipped')
      .eq('id', sessionId)
      .single();

    expect(row?.optimal_distance_cm).toBe(OPTIMAL_CM);
    expect(row?.distance_tolerance_cm).toBe(TOLERANCE_CM);
    expect(row?.calibration_skipped).toBe(false);
  });
});
