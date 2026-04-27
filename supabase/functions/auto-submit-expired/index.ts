import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * T077: Scheduled Edge Function (60 s cron) that auto-submits expired or
 * long-disconnected sessions. Calls the submit-exam function with service-role key.
 */
Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const now = new Date();

  // Sessions whose exam window has closed (starts_at + duration_minutes < now)
  const { data: expiredSessions, error } = await adminClient
    .from('exam_sessions')
    .select('id, status, last_heartbeat_at, exams!exam_sessions_exam_id_fkey(starts_at, duration_minutes)')
    .in('status', ['in_progress', 'verified'])
    .returns<Array<{
      id: string;
      status: string;
      last_heartbeat_at: string | null;
      exams: { starts_at: string; duration_minutes: number } | null;
    }>>();

  if (error) {
    console.error('[auto-submit-expired] Failed to load sessions:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const toSubmit: Array<{ id: string; reason: 'auto_window_close' | 'auto_disconnect' }> = [];

  for (const session of expiredSessions ?? []) {
    const exam = session.exams;
    if (!exam) continue;

    const windowEnd = new Date(
      new Date(exam.starts_at).getTime() + exam.duration_minutes * 60 * 1000
    );

    if (now > windowEnd) {
      toSubmit.push({ id: session.id, reason: 'auto_window_close' });
      continue;
    }

    // Long-disconnected: no heartbeat for > 5 minutes during in_progress
    if (
      session.status === 'in_progress' &&
      session.last_heartbeat_at &&
      now.getTime() - new Date(session.last_heartbeat_at).getTime() > 5 * 60 * 1000
    ) {
      toSubmit.push({ id: session.id, reason: 'auto_disconnect' });
    }
  }

  const results = await Promise.allSettled(
    toSubmit.map(({ id, reason }) =>
      fetch(`${supabaseUrl}/functions/v1/submit-exam`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          session_id: id,
          submit_reason: reason,
          client_submitted_at: now.toISOString(),
        }),
      })
    )
  );

  const submitted = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return new Response(JSON.stringify({ submitted, failed, candidates: toSubmit.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
