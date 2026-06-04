# Visual Evidence Capture Implementation

## Overview
Added visual evidence capture functionality to record camera snapshots when high-severity violations occur during proctored exams.

## Changes Made

### 1. Enhanced Snapshot Capture (`src/hooks/useProctoring.ts`)
- **Updated** `captureViolationSnapshot()` function with configurable options
- **Added** parameters for `maxWidth`, `maxHeight`, and `quality` for better compression control
- **Improved** aspect ratio preservation when resizing frames
- **Enhanced** logging to capture dimensions, file size, and quality metrics
- **Default settings**: 320x240 resolution, 0.6 JPEG quality (optimized for storage)

### 2. Integrated Evidence Artifacts via Supabase Storage
- **Created** `EvidenceSnippetService` to handle uploading snapshots to private `evidence-snippets` bucket
- **Updated** `useExamFlow.ts` to asynchronously upload snapshots on high-severity violations
- **Uses** signed PUT URLs for secure client-side uploads
- **Links** snapshots to the `evidence_artifacts` table for automated retention management

### 3. Updated Violation RPC (`supabase/migrations/014_rpc_evidence_artifacts.sql`)
- **Enhanced** `record_violation_batch` to support the `evidence` object payload
- **Automated linkage**: The RPC now automatically inserts rows into `evidence_artifacts` and links them to `violation_events`
- **Policy enforcement**: Rejects evidence if `visual_evidence_allowed` is false in the exam policy

### 4. Updated Violation Tracker (`src/hooks/useViolationTracker.ts`)
- **Modified** local event creation to include binary `evidence` metadata
- **Ensures** storage paths and metadata are tracked alongside the violation

### 5. Updated Domain Types (`src/types/examSession.ts`)
- **Added** `evidence` object to `ViolationEvent` and `CreateViolationEventInput` interfaces
- **Consistent schema**: Matches the database and RPC expectations

## How It Works

### Violation Detection Flow
1. **Violation occurs** (gaze tracking, face detection, tab switch, etc.)
2. **Severity evaluated** - if 'high' or 'critical' (severity >= 15), snapshot is triggered
3. **Snapshot captured** - current video frame captured as compressed JPEG
4. **Snapshot uploaded** - uploaded to Supabase Storage via `EvidenceSnippetService.upload`
5. **Violation recorded** - recorded with `evidence` metadata (bucket path, content type, etc.)
6. **Batched to server** - sent to Supabase via `record_violation_batch` RPC
7. **Server linkage** - RPC inserts into `evidence_artifacts` and links to `violation_events`

### Snapshot Specifications
- **Format**: JPEG
- **Storage**: Supabase Object Storage (private bucket)
- **Database Link**: `evidence_artifact_id` column in `violation_events`
- **Retention**: 14-day default window (managed via `expires_at` column)

## Future Enhancements

- [x] Consider storing images in Supabase Storage instead of database
- [ ] Add snapshot preview in instructor dashboard
- [ ] Implement snapshot compression options per violation severity
- [ ] Add snapshot gallery in violation reports
- [ ] Add snapshot timestamp verification
- [ ] Implement snapshot deduplication for rapid violations

## Files Modified

1. `src/hooks/useProctoring.ts` - Enhanced snapshot capture
2. `src/services/ViolationEventService.ts` - Added evidence_image to inserts
3. `src/hooks/useViolationTracker.ts` - Added evidence_image to local events
4. `src/pages/student/Exam.tsx` - Updated violation recording to use top-level field

## Backward Compatibility

- ✅ Existing violations without images still work (null values)
- ✅ Mock data already includes evidenceImage field
- ✅ No breaking changes to existing APIs
- ✅ Graceful degradation if snapshot capture fails
