# Project Context Blueprint

## Project

`ProctoringV2` is a React + TypeScript web app for online exam delivery with identity verification, live proctoring, cheating-score tracking, and instructor review workflows. The frontend is Vite-based, Supabase-backed, and split into student and instructor experiences.

## Current Stack

- Frontend: React 18, TypeScript, React Router, Tailwind, Vite
- Backend integration: Supabase auth, database RPCs, storage
- Proctoring and vision: `face-api.js`, `@mediapipe/tasks-vision`
- Testing: Vitest, Playwright

## Entry Points

- App bootstrap: `src/main.tsx`
- Routing and role-gated app shell: `src/App.tsx`
- Global auth and app state: `src/context/AppContext.tsx`
- Supabase client: `src/lib/supabase/client.ts`

## Primary User Flows

### Student

`login -> join exam -> verify identity -> readiness/distance setup -> active exam -> submit -> results`

### Instructor

`login -> dashboard -> create/manage exams -> inspect submissions/results -> review proctoring`

## Route Map

- Auth: `/login`, `/signup`
- Student: `/`, `/exam/join`, `/exam/:sessionId/verify`, `/exam/:sessionId/ready`, `/exam/:sessionId`, `/exam/:sessionId/results`
- Instructor: `/instructor`, `/instructor/exams/new`, `/instructor/exams/:examId`, `/instructor/results`, `/instructor/exams/:examId/results/:sessionId`, `/instructor/proctoring`

## Core Domain Modules

- Auth and profile: `src/hooks/useAuth.ts`, `src/services/authService.ts`
- Exam CRUD: `src/services/ExamService.ts`
- Session lifecycle: `src/services/examSessionService.ts`
- Identity verification and join/start RPCs: `src/services/IdentityVerificationService.ts`
- Proctoring runtime: `src/hooks/useProctoring.ts`, `src/hooks/useGazeTracking.ts`
- Exam orchestration: `src/hooks/useExamFlow.ts`
- Violations and score sync: `src/hooks/useViolationTracker.ts`, `src/services/ViolationEventService.ts`, `src/services/CheatingScoreService.ts`
- Canonical types, policy, and taxonomy: `src/types/examSession.ts`

## Important Architecture Facts

- Auth is real, not mock-only: Supabase session plus `users` table profile.
- Exam and session actions depend heavily on Supabase RPC functions rather than pure client logic.
- The cheating score is authoritative on the server; the client mirrors RPC responses and must not compute its own score.
- Violation events support offline queueing in IndexedDB and replay on reconnect.
- The main active development area is the proctoring and session flow stack.

## Backend Shape

- Supabase migrations live under `supabase/migrations/001..010`
- Edge/server functions:
  - `supabase/functions/submit-exam`
  - `supabase/functions/auto-submit-expired`
  - `supabase/functions/purge-expired-evidence`

## Key Entities

- `users`
- `exams`
- `exam_questions`
- `exam_sessions`
- `violation_events`
- `student_answers`
- `submissions`
- evidence artifacts and evidence packages
- instructor alerts

## Repository Layout

- UI and components: `src/components`
- Pages: `src/pages`
- Hooks and orchestration: `src/hooks`
- Business services: `src/services`
- Shared types: `src/types`
- Supabase schema and functions: `supabase`
- Tests: `tests`

## Run Commands

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`

## Current Caveat

`PROJECT_STRUCTURE.md` is partially outdated. The live codebase now includes auth pages, richer student and instructor routes, `features` and `shared` folders, and Supabase-backed session and proctoring flows that are not fully reflected there.
