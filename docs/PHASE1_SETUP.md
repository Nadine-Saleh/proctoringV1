# Phase 1 Setup Guide: Foundation & Authentication

This guide walks you through setting up Supabase and completing Phase 1 of the backend implementation.

---

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- A Supabase account (free tier is sufficient)

---

## Step 1: Create Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sign up or log in
3. Click **"New Project"**
4. Fill in:
   - **Organization**: Your organization name (or create one)
   - **Project name**: `ProctoringV2`
   - **Database Password**: Choose a strong password (save it securely)
   - **Region**: Choose the closest region to your users
5. Click **"Create new project"**
6. Wait 2-3 minutes for provisioning

---

## Step 2: Get API Credentials

1. In your Supabase dashboard, go to **Settings** (gear icon in left sidebar)
2. Click **API**
3. Copy these two values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: A long string starting with `eyJ...`

---

## Step 3: Configure Environment Variables

1. In your project root, create a `.env` file (or copy `.env.example`):
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and replace the placeholder values:
   ```env
   VITE_SUPABASE_URL=https://your-actual-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
   ```

---

## Step 4: Run Database Migrations

### Option A: Using Supabase Dashboard (Recommended for beginners)

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase/migrations/001_initial_schema.sql` in your code editor
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **Run** (or press Ctrl+Enter)
7. You should see "Success. No rows returned"
8. Repeat steps 2-7 for `supabase/migrations/002_rls_policies.sql`

### Option B: Using Supabase CLI (Advanced)

```bash
# Install Supabase CLI globally
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

---

## Step 5: Create Test Users

### Create Auth Users

1. In Supabase dashboard, go to **Authentication** > **Users**
2. Click **Add user** > **Create new user**
3. Create the following users:

#### Test Student
- **Email**: `student@test.com`
- **Password**: `password123`
- **Email verified**: ✅ Check this box
- Click **Create user**
- **Copy the user ID** (UUID) - you'll need it in Step 6

#### Test Instructor
- Click **Add user** > **Create new user** again
- **Email**: `instructor@test.com`
- **Password**: `password123`
- **Email verified**: ✅ Check this box
- Click **Create user**
- **Copy the user ID** (UUID) - you'll need it in Step 6

---

## Step 6: Create User Profiles

After creating auth users, you need to create their profiles in the `users` table:

1. Go to **SQL Editor** in Supabase
2. Run this SQL (replace the UUIDs with actual user IDs from Step 5):

```sql
-- Replace 'STUDENT_UUID_HERE' and 'INSTRUCTOR_UUID_HERE' with actual IDs

INSERT INTO users (id, email, full_name, role)
VALUES 
  (
    'STUDENT_UUID_HERE',  -- <-- Replace with student's auth user ID
    'student@test.com',
    'Test Student',
    'student'
  ),
  (
    'INSTRUCTOR_UUID_HERE',  -- <-- Replace with instructor's auth user ID
    'instructor@test.com',
    'Test Instructor',
    'instructor'
  );
```

3. Click **Run**
4. Verify in **Table Editor** > **users** table - you should see 2 rows

---

## Step 7: Install Dependencies & Run Dev Server

```bash
# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

The app should start on `http://localhost:5173`

---

## Step 8: Test Authentication Flow

### Test Login

1. Open `http://localhost:5173` in your browser
2. You should be redirected to `/login`
3. Enter credentials:
   - **Email**: `student@test.com`
   - **Password**: `password123`
4. Click **Sign In**
5. You should be redirected to the Student Home page

### Test Navigation

1. You should see the navigation bar with your initials
2. Click the **logout icon** (door icon) in the top right
3. You should be redirected back to `/login`

### Test Signup

1. Go to `/signup`
2. Fill in the form:
   - **Full Name**: Your Name
   - **Email**: `yourname@test.com`
   - **Password**: `testpassword123`
   - **Role**: Student or Instructor
3. Click **Create Account**
4. You should be redirected to the appropriate dashboard

---

## Step 9: Verify Database

1. Go to Supabase dashboard > **Table Editor**
2. Check the following tables:
   - ✅ `users` - Should have your test users
   - ✅ `exams` - Empty (will be populated in Phase 2)
   - ✅ `exam_sessions` - Empty
   - ✅ `violation_events` - Empty
   - ✅ `cheating_scores` - Empty
   - ✅ `student_answers` - Empty
   - ✅ `instructor_alerts` - Empty
   - ✅ `proctoring_reports` - Empty
   - ✅ `questions` - Empty

---

## Troubleshooting

### Error: "Missing Supabase environment variables"

- Make sure `.env` file exists in the project root
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly
- Restart the dev server after changing `.env`

### Error: "Failed to create user profile"

- Check that RLS policies are set up correctly (Step 4)
- Verify the `users` table exists in Supabase
- Check browser console for detailed error messages

### Can't login: "Invalid credentials"

- Double-check email and password
- Verify users exist in Supabase Authentication > Users
- Make sure user profiles exist in the `users` table

### TypeScript errors

Run the following to check for type errors:

```bash
npm run typecheck
```

If there are errors, check that:
- All imports are correct
- Supabase types match your database schema
- No unused variables or imports

### CORS errors

If you see CORS errors in the browser console:

1. Go to Supabase Dashboard > **Settings** > **API**
2. Scroll to **CORS** section
3. Add `http://localhost:5173` to allowed origins
4. Click **Save**

---

## What's Working After Phase 1

✅ Supabase project configured  
✅ Database schema with 9 tables  
✅ Row-Level Security policies  
✅ User authentication (login/logout/signup)  
✅ Protected routes based on authentication  
✅ Role-based access control (student/instructor)  
✅ User profile management  

---

## Next Steps: Phase 2 (Session Management)

Once Phase 1 is working, we'll implement:

- Exam session creation on exam start
- Session heartbeat endpoint
- Student answers storage
- Exam submission and grading
- Session duration tracking

**Ready to proceed?** Let me know once Phase 1 is tested and working!

---

## File Structure After Phase 1

```
ProctoringV2/
├── .env.example                    # Environment template
├── .env                            # Your actual env (gitignored)
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql  # Database schema
│   │   └── 002_rls_policies.sql    # Security policies
│   └── seed.sql                    # Test data template
└── src/
    ├── lib/
    │   └── supabase/
    │       └── client.ts           # Supabase client + types
    ├── services/
    │   └── authService.ts          # Authentication functions
    ├── hooks/
    │   └── useAuth.ts              # Auth state hook
    ├── components/
    │   └── ProtectedRoute.tsx      # Route guard
    ├── pages/
    │   └── auth/
    │       ├── Login.tsx           # Login page
    │       └── Signup.tsx          # Signup page
    ├── context/
    │   └── AppContext.tsx          # Updated with auth
    └── App.tsx                     # Updated with auth routes
```
