# Quick Reference: Phase 1 Setup

## 🚀 Quick Start (5 minutes)

```bash
# 1. Create .env file
cp .env.example .env
# Edit .env with your Supabase credentials

# 2. Install & run
npm install
npm run dev
```

## 📋 Setup Checklist

### Supabase Dashboard
- [ ] Create project at https://supabase.com/dashboard
- [ ] Copy URL and anon key from Settings > API
- [ ] Paste into `.env` file

### Database Setup
- [ ] SQL Editor > Run `supabase/migrations/001_initial_schema.sql`
- [ ] SQL Editor > Run `supabase/migrations/002_rls_policies.sql`

### Create Test Users
- [ ] Auth > Users > Create `student@test.com` / `password123`
- [ ] Auth > Users > Create `instructor@test.com` / `password123`
- [ ] Copy both UUIDs

### Create User Profiles
```sql
-- Replace UUIDs with actual IDs
INSERT INTO users (id, email, full_name, role)
VALUES 
  ('STUDENT_UUID_HERE', 'student@test.com', 'Test Student', 'student'),
  ('INSTRUCTOR_UUID_HERE', 'instructor@test.com', 'Test Instructor', 'instructor');
```

### Test
- [ ] Open http://localhost:5173
- [ ] Login with student credentials
- [ ] See student dashboard
- [ ] Logout and signup work

## 🔑 Test Credentials

```
Student:
Email: student@test.com
Password: password123

Instructor:
Email: instructor@test.com
Password: password123
```

## 📁 Key Files

```
.env                          # Your Supabase credentials
src/lib/supabase/client.ts   # Supabase client
src/services/authService.ts  # Auth functions
src/hooks/useAuth.ts         # Auth hook
src/pages/auth/Login.tsx     # Login page
src/pages/auth/Signup.tsx    # Signup page
```

## 🐛 Troubleshooting

**"Missing Supabase environment variables"**
- Check `.env` file exists and has correct values
- Restart dev server

**Can't login**
- Verify user exists in Supabase Auth
- Verify profile exists in `users` table
- Check password is correct

**TypeScript errors**
```bash
npm run typecheck
```

## 📊 What's Working

✅ Database schema (9 tables)  
✅ Row-Level Security  
✅ Email/password authentication  
✅ Protected routes  
✅ Role-based access  
✅ User profiles  
✅ Sign out  

## ⏭️ Next: Phase 2

After testing Phase 1, we'll build:
- Exam session management
- Real-time violation tracking
- Cheating score calculation
- Instructor alerts
- Exam submission

---

**Full Setup Guide**: `docs/PHASE1_SETUP.md`  
**Completion Report**: `docs/PHASE1_COMPLETE.md`
