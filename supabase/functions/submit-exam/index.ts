import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface SubmitRequest {
  session_id: string;
  submit_reason: 'manual' | 'auto_window_close' | 'auto_disconnect';
  client_submitted_at?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Determine caller identity
    const authHeader = req.headers.get('Authorization');
    let callerId: string | null = null;
    const isServiceRole = authHeader?.includes(serviceRoleKey);

    if (!isServiceRole && authHeader) {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      callerId = user?.id ?? null;
    }

    const body: SubmitRequest = await req.json();
    const { session_id, submit_reason } = body;

    if (!session_id) {
      return new Response(JSON.stringify({ error: 'session_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load session
    const { data: session, error: sessionErr } = await adminClient
      .from('exam_sessions')
      .select('*, exams!exam_sessions_exam_id_fkey(*)')
      .eq('id', session_id)
      .single();

    if (sessionErr || !session) {
      return new Response(JSON.stringify({ error: 'session_not_found_or_not_owned' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ownership check (skip for service role)
    if (!isServiceRole && callerId && session.student_id !== callerId) {
      return new Response(JSON.stringify({ error: 'session_not_found_or_not_owned' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const eligibleStatuses = submit_reason === 'manual'
      ? ['in_progress']
      : ['in_progress', 'verified'];

    if (!eligibleStatuses.includes(session.status)) {
      return new Response(JSON.stringify({ error: 'session_not_eligible' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Idempotency check
    const { data: existing } = await adminClient
      .from('submissions')
      .select('*')
      .eq('session_id', session_id)
      .maybeSingle();

    if (existing) {
      const { data: ep } = await adminClient
        .from('evidence_packages')
        .select('id')
        .eq('session_id', session_id)
        .maybeSingle();

      return new Response(JSON.stringify({
        submission_id: existing.id,
        idempotent_hit: true,
        grade_status: existing.grade_status,
        auto_graded_score: existing.auto_graded_score,
        auto_graded_max: existing.auto_graded_max,
        final_grade: existing.final_grade,
        final_cheating_score: existing.final_cheating_score,
        evidence_package_id: ep?.id ?? null,
        submitted_at: existing.submitted_at,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Freeze answers
    const now = new Date().toISOString();
    await adminClient
      .from('student_answers')
      .update({ frozen_at: now })
      .eq('session_id', session_id)
      .is('frozen_at', null);

    // Load questions and answers for grading
    const { data: questions } = await adminClient
      .from('exam_questions')
      .select('id, question_type, correct_answer, points')
      .eq('exam_id', session.exam_id);

    const { data: answers } = await adminClient
      .from('student_answers')
      .select('question_id, selected_answer')
      .eq('session_id', session_id);

    // Auto-grade
    let autoGradedScore = 0;
    let autoGradedMax = 0;
    let hasManual = false;

    for (const q of questions ?? []) {
      autoGradedMax += q.points ?? 0;
      const ans = answers?.find(a => a.question_id === q.id);
      const autoGradable = ['multiple_choice', 'multiple_choice_single', 'multiple_choice_multi', 'true_false', 'short_answer_exact'].includes(q.question_type);

      if (!autoGradable) {
        hasManual = true;
        continue;
      }

      if (ans && ans.selected_answer != null && ans.selected_answer === q.correct_answer) {
        autoGradedScore += q.points ?? 0;
      }
    }

    const allAutoGradable = !hasManual;
    const gradeStatus = allAutoGradable ? 'auto_final' : (autoGradedMax > 0 ? 'partial_pending_review' : 'fully_pending_review');
    const finalGrade = allAutoGradable ? autoGradedScore : null;

    // Snapshot cheating score
    const finalCheatingScore = session.live_cheating_score ?? 0;

    // Insert submission
    const { data: submission, error: subErr } = await adminClient
      .from('submissions')
      .insert({
        session_id,
        exam_id: session.exam_id,
        student_id: session.student_id,
        submitted_at: now,
        submit_reason,
        grade_status: gradeStatus,
        auto_graded_score: autoGradedScore,
        auto_graded_max: autoGradedMax,
        final_grade: finalGrade,
        final_cheating_score: finalCheatingScore,
      })
      .select()
      .single();

    if (subErr) {
      // Conflict — another concurrent submission beat us; re-select
      const { data: raceResult } = await adminClient
        .from('submissions')
        .select('*')
        .eq('session_id', session_id)
        .single();
      if (raceResult) {
        return new Response(JSON.stringify({
          submission_id: raceResult.id,
          idempotent_hit: true,
          grade_status: raceResult.grade_status,
          auto_graded_score: raceResult.auto_graded_score,
          auto_graded_max: raceResult.auto_graded_max,
          final_grade: raceResult.final_grade,
          final_cheating_score: raceResult.final_cheating_score,
          evidence_package_id: null,
          submitted_at: raceResult.submitted_at,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw subErr;
    }

    // Assemble evidence package
    const { data: violationEvents } = await adminClient
      .from('violation_events')
      .select('violation_type, severity, count:id')
      .eq('session_id', session_id);

    const violationSummary = (violationEvents ?? []).reduce((acc: Record<string, unknown>, ev: any) => {
      const t = ev.violation_type ?? ev.type;
      if (!acc[t]) acc[t] = { count: 0, severity: ev.severity };
      (acc[t] as any).count++;
      return acc;
    }, {});

    const { data: ep } = await adminClient
      .from('evidence_packages')
      .insert({
        session_id,
        exam_id: session.exam_id,
        student_id: session.student_id,
        violation_summary: violationSummary,
        assembled_at: now,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();

    // Transition session status
    const newStatus = submit_reason === 'manual' ? 'submitted' : 'auto_submitted';
    await adminClient
      .from('exam_sessions')
      .update({ status: newStatus, submitted_at: now, submit_reason, updated_at: now })
      .eq('id', session_id);

    return new Response(JSON.stringify({
      submission_id: submission!.id,
      idempotent_hit: false,
      grade_status: gradeStatus,
      auto_graded_score: autoGradedScore,
      auto_graded_max: autoGradedMax,
      final_grade: finalGrade,
      final_cheating_score: finalCheatingScore,
      evidence_package_id: ep?.id ?? null,
      submitted_at: now,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[submit-exam]', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
