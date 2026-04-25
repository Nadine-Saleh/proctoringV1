-- ============================================
-- Complete Fix: RLS Recursion in Users Table
-- ============================================
-- Run this ENTIRE script in your Supabase SQL Editor
-- This will fix all RLS issues at once

-- Step 1: Drop ALL existing users policies to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Instructors can view all users" ON users;

-- Step 2: Drop existing helper functions (if they exist)
DROP FUNCTION IF EXISTS is_current_user_instructor_or_admin() CASCADE;
DROP FUNCTION IF EXISTS get_current_user_role() CASCADE;
DROP FUNCTION IF EXISTS is_instructor_or_admin() CASCADE;

-- Step 3: Create new helper function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION is_current_user_instructor_or_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('instructor', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Step 4: Create clean, non-recursive policies

-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Policy 3: Users can insert their own profile (fixes signup 403 error)
CREATE POLICY "Users can insert own profile"
ON users FOR INSERT
WITH CHECK (auth.uid() = id);

-- Policy 4: Instructors/Admins can view ALL users (uses SECURITY DEFINER function)
CREATE POLICY "Instructors can view all users"
ON users FOR SELECT
USING (
  is_current_user_instructor_or_admin() = true
  OR auth.uid() = id
);

-- ============================================
-- Verification
-- ============================================
-- After running this script:
-- 1. Try signing up again - it should work now
-- 2. Check your users table to see the new profile created
-- 3. The 500 and 403 errors should be gone
