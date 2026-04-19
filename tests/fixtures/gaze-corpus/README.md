# Gaze Corpus Fixtures (T065)

This directory holds short recorded-frame clips and annotations used to validate
the gaze-tracking detection pipeline (Constitution Principle II).

## Required contents (minimum before release)

- 30 clips covering each canonical violation type:
  - `gaze_off_screen` — gaze yaw/pitch outside threshold
  - `gaze_sustained_away` — off-screen for duration gate
  - `face_not_visible` — no face in frame
  - `multiple_persons` — more than one face
  - `tab_focus_lost` — focus outside exam tab
  - `camera_unavailable` — stream dropped

## Format

Each clip: `<id>-<violation_type>[-true|false].webm` + sidecar `<id>.json`:

```json
{
  "id": "gc-001",
  "violation_type": "gaze_off_screen",
  "ground_truth": true,
  "duration_ms": 3200,
  "notes": "student looks left for 3.2s"
}
```

## Status

**PLACEHOLDER** — clips to be recorded in the lab session scheduled for v1.1.
The inline fixture set in `scored-sessions/benchmark.test.ts` covers the
statistical gate until real clips land here.
