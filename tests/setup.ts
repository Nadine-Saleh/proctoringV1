import { beforeEach, afterEach, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const testSupabaseUrl = process.env.VITE_SUPABASE_TEST_URL || '';
const testSupabaseKey = process.env.VITE_SUPABASE_TEST_ANON_KEY || '';

if (!testSupabaseUrl || !testSupabaseKey) {
  console.warn(
    'Test Supabase environment variables not set. Integration tests will fail. ' +
    'Set VITE_SUPABASE_TEST_URL and VITE_SUPABASE_TEST_ANON_KEY in .env.test'
  );
}

let testClient: ReturnType<typeof createClient> | null = null;

export const getTestSupabaseClient = () => {
  if (!testClient) {
    testClient = createClient(testSupabaseUrl, testSupabaseKey);
  }
  return testClient;
};

export const testUserFixtures = {
  instructor: {
    email: 'test-instructor-' + Date.now() + '@example.com',
    password: 'TestPassword123!',
  },
  student: {
    email: 'test-student-' + Date.now() + '@example.com',
    password: 'TestPassword123!',
  },
};

export const seedTestUser = async (role: 'instructor' | 'student') => {
  const client = getTestSupabaseClient();
  const user = testUserFixtures[role];

  const { data, error } = await client.auth.signUp({
    email: user.email,
    password: user.password,
  });

  if (error) {
    throw new Error(`Failed to seed test ${role}: ${error.message}`);
  }

  return data.user;
};

export const cleanupTestUser = async (userId: string) => {
  const client = getTestSupabaseClient();

  const { error } = await client.rpc('delete_test_user', {
    user_id: userId,
  });

  if (error) {
    console.warn(`Failed to cleanup test user ${userId}: ${error.message}`);
  }
};

beforeEach(() => {
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [],
        getVideoTracks: () => [],
        getAudioTracks: () => [],
      }),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
