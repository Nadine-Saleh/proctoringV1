-- ============================================
-- Seed Data for Testing
-- ============================================
-- Run this AFTER setting up Supabase and creating auth users
-- This file assumes you've manually created the following auth users:
-- 
-- 1. student@test.com / password123
-- 2. instructor@test.com / password123
--
-- After creating auth users in Supabase Dashboard (Authentication > Users),
-- run this script to create their profiles.

-- NOTE: Replace the UUIDs below with the actual user IDs from Supabase Auth
-- You can find these in the Authentication > Users table

-- Student User Profile
-- INSERT INTO users (id, email, full_name, role)
-- VALUES (
--   'REPLACE_WITH_STUDENT_AUTH_ID',
--   'student@test.com',
--   'Test Student',
--   'student'
-- );

-- Instructor User Profile
-- INSERT INTO users (id, email, full_name, role)
-- VALUES (
--   'REPLACE_WITH_INSTRUCTOR_AUTH_ID',
--   'instructor@test.com',
--   'Test Instructor',
--   'instructor'
-- );

-- ============================================
-- Sample Exams (run after creating user profiles)
-- ============================================

-- INSERT INTO exams (id, instructor_id, title, subject, description, duration_minutes, passing_score, status, published_at)
-- VALUES (
--   gen_random_uuid(),
--   (SELECT id FROM users WHERE email = 'instructor@test.com'),
--   'Data Structures Midterm',
--   'Computer Science',
--   'Comprehensive exam covering data structures including arrays, linked lists, trees, and graphs.',
--   90,
--   70.00,
--   'published',
--   NOW()
-- );

-- INSERT INTO exams (id, instructor_id, title, subject, description, duration_minutes, passing_score, status, published_at)
-- VALUES (
--   gen_random_uuid(),
--   (SELECT id FROM users WHERE email = 'instructor@test.com'),
--   'Calculus Final Exam',
--   'Mathematics',
--   'Final exam covering differential and integral calculus.',
--   120,
--   65.00,
--   'published',
--   NOW()
-- );

-- ============================================
-- Sample Questions (run after creating exams)
-- ============================================

-- INSERT INTO questions (exam_id, question_text, question_type, options, correct_answer, points, sort_order)
-- VALUES (
--   (SELECT id FROM exams WHERE title = 'Data Structures Midterm' LIMIT 1),
--   'What is the time complexity of binary search?',
--   'multiple_choice',
--   '[{"id": "a", "text": "O(n)"}, {"id": "b", "text": "O(log n)"}, {"id": "c", "text": "O(n^2)"}, {"id": "d", "text": "O(1)"}]',
--   'b',
--   1,
--   0
-- );

-- INSERT INTO questions (exam_id, question_text, question_type, options, correct_answer, points, sort_order)
-- VALUES (
--   (SELECT id FROM exams WHERE title = 'Data Structures Midterm' LIMIT 1),
--   'Which data structure uses LIFO principle?',
--   'multiple_choice',
--   '[{"id": "a", "text": "Queue"}, {"id": "b", "text": "Stack"}, {"id": "c", "text": "Tree"}, {"id": "d", "text": "Graph"}]',
--   'b',
--   1,
--   1
-- );

-- INSERT INTO questions (exam_id, question_text, question_type, options, correct_answer, points, sort_order)
-- VALUES (
--   (SELECT id FROM exams WHERE title = 'Data Structures Midterm' LIMIT 1),
--   'What does SQL stand for?',
--   'multiple_choice',
--   '[{"id": "a", "text": "Structured Query Language"}, {"id": "b", "text": "Simple Question Language"}, {"id": "c", "text": "System Query Logic"}, {"id": "d", "text": "Standard Question Logic"}]',
--   'a',
--   1,
--   2
-- );
