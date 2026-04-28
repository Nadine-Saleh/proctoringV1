-- ============================================================================
-- Supabase Storage Policies for Evidence Snippets
-- ============================================================================
-- Note: Supabase Storage policies cannot be created via SQL migrations.
-- These policies must be created manually via the Supabase dashboard or API.
--
-- Steps:
-- 1. Create private bucket named "evidence-snippets" in Storage
-- 2. Apply the policies below via the Policies UI or using the Supabase CLI
--
-- Reference: https://supabase.com/docs/guides/storage/security/access-control
-- ============================================================================

-- Policy 1: Student can INSERT evidence artifacts during their exam session
-- INSERT on evidence-snippets bucket for the student's own session files
INSERT INTO storage.objects (bucket_id, name, owner_id, metadata)
  SELECT 'evidence-snippets'::text, name, owner_id, metadata
  FROM storage.objects
  WHERE bucket_id = 'evidence-snippets'
    AND owner_id = auth.uid();

-- Policy 2: Student can GET (download) their own evidence artifacts
-- SELECT on storage.objects
SELECT storage.objects.id, storage.objects.name
FROM storage.objects
WHERE storage.objects.bucket_id = 'evidence-snippets'
  AND storage.objects.owner_id = auth.uid();

-- Policy 3: Instructor can GET (download) evidence artifacts for their exams
-- SELECT on storage.objects for instructor's exam sessions
SELECT storage.objects.id, storage.objects.name
FROM storage.objects
WHERE storage.objects.bucket_id = 'evidence-snippets'
  AND EXISTS (
    SELECT 1 FROM public.evidence_artifacts ea
    JOIN public.exam_sessions es ON ea.session_id = es.id
    JOIN public.exams e ON es.exam_id = e.id
    WHERE e.instructor_id = auth.uid()
      AND ea.bucket_path = storage.objects.name
  );

-- ============================================================================
-- Dashboard Configuration
-- ============================================================================
-- After bucket creation, configure via Supabase Dashboard:
--
-- 1. Go to Storage → evidence-snippets → Policies
-- 2. Add the following policies:
--
--   a) "Student INSERT":
--      Operation: INSERT
--      For: Authenticated users
--      Using expression: auth.uid() = (SELECT student_id FROM public.exam_sessions WHERE id = current_setting('app.session_id')::uuid)
--
--   b) "Student SELECT":
--      Operation: SELECT
--      For: Authenticated users
--      Using expression: auth.uid() IN (SELECT student_id FROM public.evidence_artifacts ea JOIN public.exam_sessions es ON ea.session_id = es.id WHERE bucket_path = storage.objects.name)
--
--   c) "Instructor SELECT":
--      Operation: SELECT
--      For: Authenticated users
--      Using expression: EXISTS (SELECT 1 FROM public.evidence_artifacts ea JOIN public.exam_sessions es ON ea.session_id = es.id JOIN public.exams e ON es.exam_id = e.id WHERE e.instructor_id = auth.uid() AND ea.bucket_path = storage.objects.name)
-- ============================================================================
