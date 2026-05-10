import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * T078: Nightly Edge Function that purges expired evidence_artifacts rows
 * (where expires_at < now AND retained_for_case = false) and their bucket objects.
 */
Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const now = new Date().toISOString();

  // Find expired, non-retained artifacts
  const { data: artifacts, error: fetchErr } = await adminClient
    .from('evidence_artifacts')
    .select('id, storage_path')
    .lt('expires_at', now)
    .eq('retained_for_case', false);

  if (fetchErr) {
    console.error('[purge-expired-evidence] Failed to fetch artifacts:', fetchErr.message);
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }

  if (!artifacts || artifacts.length === 0) {
    return new Response(JSON.stringify({ purged: 0, errors: 0 }), { status: 200 });
  }

  let purged = 0;
  let errors = 0;

  for (const artifact of artifacts) {
    try {
      // Remove bucket object
      if (artifact.storage_path) {
        const { error: storageErr } = await adminClient.storage
          .from('evidence-snippets')
          .remove([artifact.storage_path]);
        if (storageErr) {
          console.warn('[purge-expired-evidence] Storage remove failed for', artifact.id, storageErr.message);
        }
      }

      // Delete DB row
      const { error: delErr } = await adminClient
        .from('evidence_artifacts')
        .delete()
        .eq('id', artifact.id);

      if (delErr) {
        errors++;
        console.error('[purge-expired-evidence] Delete failed for', artifact.id, delErr.message);
      } else {
        purged++;
      }
    } catch (err) {
      errors++;
      console.error('[purge-expired-evidence] Unexpected error for', artifact.id, err);
    }
  }

  console.log(`[purge-expired-evidence] purged=${purged} errors=${errors} total=${artifacts.length}`);
  return new Response(JSON.stringify({ purged, errors, total: artifacts.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
