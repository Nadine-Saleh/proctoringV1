# Contract: Feature-Module Entry Point

Every directory under `src/features/<name>/` MUST expose a single `index.ts` barrel that defines the feature's public surface. This contract is enforced by ESLint `no-restricted-imports` (added in PR #1 of the refactor).

## Required shape

```ts
// src/features/<name>/index.ts

// 1. Public components — those rendered by other features or by app/router.tsx
export { ExamSubmissionModal } from './components/ExamSubmissionModal';

// 2. Public hooks — those consumed by other features
export { useExamSession } from './hooks/useExamSession';

// 3. Public services — only when another feature legitimately needs to invoke them
export { submitExam } from './services/ExamSubmissionService';

// 4. Public types — re-exported when other features hold values shaped by this feature
export type { ExamSession, ExamSessionStatus } from './types';

// 5. Public pages — only re-exported if app/router.tsx imports from the barrel
//    (alternative: app/router.tsx may import './pages/Exam' directly — pick one and stay consistent)
export { ExamPage } from './pages/Exam';
```

## Rules

| # | Rule | Enforcement |
|---|---|---|
| 1 | The barrel MUST contain only `export ... from './...'` statements. No logic, no instantiation, no side effects. | ESLint custom rule / code review |
| 2 | The barrel MUST NOT re-export `*` from internals. Every export is named. | Code review |
| 3 | Internal files (anything not in the barrel) MUST NOT be imported from outside the feature. | ESLint `no-restricted-imports` (`patterns: ['@/features/*/!(index)']` from outside the same feature) |
| 4 | The barrel MUST NOT import from another feature's barrel transitively in a way that creates a cycle. | ESLint `import/no-cycle` |
| 5 | The barrel MUST be the only `index.ts` inside the feature. Nested barrels (`components/index.ts`) are forbidden — they hide where things live. | Code review |
| 6 | A feature with no cross-feature consumers MAY have an empty barrel `export {}` and be referenced only by `app/router.tsx`. | Allowed |

## Forbidden patterns

```ts
// ❌ Re-exporting everything — hides the public surface
export * from './services/ExamSubmissionService';

// ❌ Side effects in the barrel
import './setup'; // initialises something
console.log('exam-session loaded');

// ❌ Logic in the barrel
const config = { foo: 1 };
export const examSessionConfig = config;

// ❌ Reaching past another feature's barrel
import { internalHelper } from '@/features/scoring/utils/internalHelper'; // forbidden
```

## Pages

Two acceptable patterns; pick one per feature and document at the top of the barrel:

- **A. Pages re-exported via barrel** — preferred when the feature has 1–2 pages and the names are unambiguous.
- **B. Router imports pages directly** — preferred when the feature has many pages (e.g., `instructor-dashboard`) and barrel re-export bloat would obscure the public surface.

## Validation

Before merging a feature-migration PR, the author MUST run:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

All MUST pass with zero new errors. The PR description MUST list the feature's public surface (what's exported) and confirm no external file reaches past the barrel (grep for `from '@/features/<name>/'` should match only `from '@/features/<name>'`).
