## Summary

<!-- 1–3 bullets: what this PR does and why -->
-
-

## Principles Touched

<!-- Which Constitution principles apply to this change? -->

- [ ] **Principle I (Code Quality)**: typecheck + lint + build pass (`npm run typecheck && npm run lint && npm run build`)
- [ ] **Principle II (Test Coverage)**: integrity-critical paths (scoring, session lifecycle, submission, persistence) have integration test coverage hitting the real Supabase test project
- [ ] **Principle III (Accessibility & Style)**: new UI components have keyboard reachability, color-plus-icon redundancy, text alternatives; no inline `style={}` beyond dynamic widths; all icons from `lucide-react`
- [ ] **Principle IV (Performance)**: bundle ≤ 500 KB gzipped; detection loop measured; long-session memory bounded

## How Principle II Was Satisfied

<!-- Describe what tests were written, which RPCs / services they cover, and where to find them.
     Note any paths that are skipped and why (e.g. "requires Edge Function deployment"). -->

## Performance Evidence (Principle IV)

<!-- Link to or inline the relevant measurements: bundle size, fps, p95 latency, memory graph.
     Required for any change that touches the detection loop, submission pipeline, or adds a new route. -->

## Test Plan

<!-- Checklist of what to verify manually before merging -->
- [ ] `npm run typecheck && npm run lint && npm run build` passes
- [ ] `npm test` passes (or note skipped tests with justification)
- [ ] Migrations apply cleanly to the test Supabase project (`supabase db push --db-url $TEST_DB_URL`)
- [ ] Quickstart smoke test: instructor publishes → student joins/verifies/submits → instructor sees grade within 60 s

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
