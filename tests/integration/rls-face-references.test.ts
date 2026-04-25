import { describe, it, expect, beforeEach } from 'vitest';
import { getTestSupabaseClient, seedTestUser } from '../setup';

/**
 * T033: RLS tests for student_face_references.
 * Student A cannot SELECT student B's embedding.
 * Instructor cannot SELECT any student's embedding.
 */
describe('student_face_references RLS', () => {
  let client: ReturnType<typeof getTestSupabaseClient>;
  let studentAId: string;
  let studentBId: string;
  let instructorId: string;
  const embeddingA = Array.from({ length: 128 }, () => 0.1);
  const embeddingB = Array.from({ length: 128 }, () => 0.9);

  beforeEach(async () => {
    client = getTestSupabaseClient();
    const studentA = await seedTestUser('student');
    const studentB = await seedTestUser('student');
    const instructor = await seedTestUser('instructor');
    studentAId = studentA!.id;
    studentBId = studentB!.id;
    instructorId = instructor!.id;

    // Seed references for both students using service role (bypasses RLS)
    const serviceClient = getTestSupabaseClient();
    await serviceClient.from('student_face_references').upsert([
      { student_id: studentAId, embedding: embeddingA, quality_score: 0.9 },
      { student_id: studentBId, embedding: embeddingB, quality_score: 0.85 },
    ]);
  });

  it('student A can SELECT their own face reference', async () => {
    const studentAClient = getTestSupabaseClient();
    await studentAClient.auth.signInWithPassword({
      email: `test-student-${studentAId}@example.com`,
      password: 'TestPassword123!',
    });

    const { data } = await studentAClient
      .from('student_face_references')
      .select('student_id')
      .eq('student_id', studentAId);

    expect(data).toBeDefined();
    expect(data!.length).toBe(1);
    expect(data![0].student_id).toBe(studentAId);
  });

  it('student A cannot SELECT student B reference', async () => {
    const studentAClient = getTestSupabaseClient();
    await studentAClient.auth.signInWithPassword({
      email: `test-student-${studentAId}@example.com`,
      password: 'TestPassword123!',
    });

    const { data } = await studentAClient
      .from('student_face_references')
      .select('student_id')
      .eq('student_id', studentBId);

    expect(data?.length ?? 0).toBe(0);
  });

  it('instructor cannot SELECT any student face reference', async () => {
    const instructorClient = getTestSupabaseClient();
    await instructorClient.auth.signInWithPassword({
      email: `test-instructor-${instructorId}@example.com`,
      password: 'TestPassword123!',
    });

    const { data } = await instructorClient
      .from('student_face_references')
      .select('student_id');

    expect(data?.length ?? 0).toBe(0);
  });

  it('embedding column is never returned to the client', async () => {
    const studentAClient = getTestSupabaseClient();
    await studentAClient.auth.signInWithPassword({
      email: `test-student-${studentAId}@example.com`,
      password: 'TestPassword123!',
    });

    const { data } = await studentAClient
      .from('student_face_references')
      .select('embedding')
      .eq('student_id', studentAId);

    // RLS policy should block reading the embedding column directly
    const row = data?.[0] as any;
    expect(row?.embedding).toBeUndefined();
  });
});
