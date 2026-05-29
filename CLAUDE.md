# ProctoringV2 Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-01

## Active Technologies
- Supabase (Postgres) for exams, sessions, events, submissions, alerts; Supabase Storage (private bucket, signed URLs) for visual evidence snippets; Supabase Realtime channels for live score + alert delivery (001-ai-proctoring-system)
- TypeScript 5.5 (strict), React 18.3, Node.js 18+ (tooling) + Vite 5.4, react-router-dom 7.13, Tailwind 3.4, @supabase/supabase-js 2.57, @mediapipe/tasks-vision 0.10, face-api.js 0.22, lucide-react 0.344 (002-refactor-clean-code)
- Supabase (Postgres) + Supabase Storage (private bucket / signed URLs) + Supabase Realtime — *no schema change in scope* (002-refactor-clean-code)

- TypeScript 5.5 (strict), React 18.3, Node.js 18+ for tooling + Vite 5, `react-router-dom` 7, Tailwind 3, `@supabase/supabase-js` 2.57, `@mediapipe/tasks-vision` 0.10, `face-api.js` 0.22, `lucide-react` (001-ai-proctoring-system)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.5 (strict), React 18.3, Node.js 18+ for tooling: Follow standard conventions

## Recent Changes
- 002-refactor-clean-code: Added TypeScript 5.5 (strict), React 18.3, Node.js 18+ (tooling) + Vite 5.4, react-router-dom 7.13, Tailwind 3.4, @supabase/supabase-js 2.57, @mediapipe/tasks-vision 0.10, face-api.js 0.22, lucide-react 0.344
- 001-ai-proctoring-system: Added TypeScript 5.5 (strict), React 18.3, Node.js 18+ for tooling + Vite 5, `react-router-dom` 7, Tailwind 3, `@supabase/supabase-js` 2.57, `@mediapipe/tasks-vision` 0.10, `face-api.js` 0.22, `lucide-react`

- 001-ai-proctoring-system: Added TypeScript 5.5 (strict), React 18.3, Node.js 18+ for tooling + Vite 5, `react-router-dom` 7, Tailwind 3, `@supabase/supabase-js` 2.57, `@mediapipe/tasks-vision` 0.10, `face-api.js` 0.22, `lucide-react`

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
