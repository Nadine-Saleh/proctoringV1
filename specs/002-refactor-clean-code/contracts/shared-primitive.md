# Contract: Shared Primitive

A "shared primitive" is any reusable building block (component, hook, utility) under `src/shared/`. This contract defines when something is allowed to live there and what shape it must take.

## Promotion rule (feature → shared)

A primitive MAY move from `features/<x>/` into `shared/` when **either**:

1. **Two or more features** already import it (or would import it after a planned refactor), OR
2. The primitive is **inherently feature-agnostic** (e.g., a generic `Modal` shell, `StatusBadge`) and the team agrees it belongs in `shared/` even if only one feature consumes it today, with the second consumer named in the PR description.

Promotions MUST be a separate PR from the rename / move that creates the second consumer — never bundled.

## Demotion rule (shared → feature)

If a primitive's consumers drop to one feature (e.g., other consumer was deleted), the next refactor PR touching it SHOULD demote it back into that feature. `shared/` is for things that earn their keep.

## Required shape

| Aspect | Rule |
|---|---|
| **Location** | `src/shared/components/<Name>.tsx`, `src/shared/hooks/use<Name>.ts`, `src/shared/ui/<name>.ts` (Tailwind class compositions / tokens) |
| **Naming** | Component: `PascalCase`. Hook: `useThing`. Utility: `camelCase`. |
| **Imports** | MAY import from `lib/`. MUST NOT import from `features/` or `app/`. MUST NOT import from another `shared/` primitive that imports it (no cycles). |
| **Props / Signature** | Documented via TypeScript types only. No JSDoc duplication. Names self-explanatory; if a comment is needed, the name is wrong. |
| **Side effects** | None at module scope. Hooks may have effects scoped to their lifecycle. |
| **Feature awareness** | A shared primitive MUST NOT know about feature-specific concepts (no `violationScore` props, no `examSession` types). If it needs them, it's not shared — it's a feature component being passed data. |
| **Size budget** | Same budget as feature files (research.md §R2): soft 250 / hard 400 lines. |

## Public surface

`src/shared/` does NOT use a barrel. Each consumer imports the specific file:

```ts
// ✅ ok
import { Modal } from '@/shared/components/Modal';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';

// ❌ no shared/index.ts — encourages drive-by additions and hides the surface
```

## Examples — initial inhabitants

| File | Origin | Shape |
|---|---|---|
| `shared/components/Modal.tsx` | dedup of LivenessCheck/DistanceSetup/Calibration/ExamSubmission modals | `<Modal isOpen onClose title>{children}</Modal>` |
| `shared/components/StatusBadge.tsx` | dedup of inline Tailwind badge classes across instructor pages | `<StatusBadge tone="success\|warn\|danger\|neutral">{label}</StatusBadge>` |
| `shared/components/StatCard.tsx` | dedup of dashboard / results / proctoring stat cards | `<StatCard label value icon trend?>` |
| `shared/components/Navigation.tsx` | moved verbatim from `src/components/Navigation.tsx` | unchanged |

## Anti-examples

```tsx
// ❌ Knows too much — belongs in features/scoring
export function ViolationScoreBar({ score }: { score: number }) {
  return <div>{score >= 80 ? 'Critical' : 'OK'}</div>;
}

// ❌ Side effect at import — forbidden
import { supabase } from '@/lib/supabase';
supabase.auth.onAuthStateChange(...); // top-level work in a shared module
export const useAuthState = () => { ... };
```

## Validation

The cleanup PR (final in the migration sequence) MUST:

- Run `grep -r "from '@/features/" src/shared/` and confirm zero matches.
- Confirm every primitive in `shared/` has ≥2 import sites (or a documented exception).
- Run `import/no-cycle` ESLint rule with zero errors.
