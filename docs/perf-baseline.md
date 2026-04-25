# Performance Baseline — Detection Loop (T067)

Constitution Principle IV requires measurement, not guessing.
This document records detection-loop timing on the reference hardware so
regressions surface before they reach production.

## Baseline Hardware

| Field | Value |
|-------|-------|
| Device | Intel Core i5-12th Gen, 16 GB RAM, integrated GPU |
| Browser | Chrome 124 |
| OS | Windows 11 |
| Camera | 720p 30fps laptop webcam |
| Screen | 1920×1080 |

## Methodology

Measurements taken with Chrome DevTools Performance panel (Timeline recording)
during a 60-second active exam session with:
- face-api.js TinyFaceDetector running at 2-second intervals
- GazeTrackingEngine processing each animation frame
- ViolationEventService batching every 2 seconds
- Supabase Realtime channel subscribed

## Results (to be filled after live measurement)

| Metric | Target | Measured | Status |
|--------|--------|----------|--------|
| Detection loop p50 latency | < 100 ms | _TBD_ | PENDING |
| Detection loop p95 latency | < 200 ms | _TBD_ | PENDING |
| Main thread p95 blocking time | < 50 ms | _TBD_ | PENDING |
| Gaze tracking fps (average) | ≥ 15 fps | _TBD_ | PENDING |
| Memory growth over 60 min | < 50 MB | _TBD_ | PENDING |

## How to reproduce

```bash
# 1. Start the dev server
npm run dev

# 2. Open Chrome, navigate to /exam/<active-session>
# 3. Open DevTools → Performance → Record 60s
# 4. Stop recording, inspect:
#    - Main thread "Long Tasks" (target: none > 50ms)
#    - GPU frame timing
#    - JavaScript heap (Memory panel)
# 5. Export trace to docs/traces/perf-<date>.json
```

## Previous baselines

_None yet — first measurement to be recorded after T065/T066 fixture collection._
