// ============================================
// Phase 2: Exam Submission Service
// ============================================
// Handles exam submission, grading, and report generation
// Responsibility: Submission workflow, answer grading, score calculation

import { supabase } from '../lib/supabase/client';
import { ensureUuid } from '../utils/uuid';
import { StudentAnswerService } from './StudentAnswerService';
import type {
  ExamSubmission,
  ExamSubmissionResult,
  GradeStatus,
  QuestionForGrading,
  GradedAnswer,
  ExamGrade,
} from '../types/examSession';

export interface EdgeSubmissionResult {
  submission_id: string;
  idempotent_hit: boolean;
  grade_status: string;
  auto_graded_score: number;
  auto_graded_max: number;
  final_grade: number | null;
  final_cheating_score: number;
  evidence_package_id: string | null;
  submitted_at: string;
}

export class ExamSubmissionService {
  /**
   * Submit an exam. Persists answers first, then delegates to the submit-exam
   * Edge Function for atomic grading + evidence assembly (T079).
   */
  static async submit(submission: ExamSubmission): Promise<ExamSubmissionResult & { edgeResult?: EdgeSubmissionResult }> {
    try {
      // Step 1: Persist answers so the grader can read them.
      const answerInputs = submission.answers.map((answer, index) => ({
        session_id: submission.session_id,
        question_id: answer.question_id,
        answer: { selected_answer: answer.selected_answer ?? null },
        selected_answer: answer.selected_answer,
        time_spent_seconds: answer.time_spent_seconds,
        answer_order: index + 1,
      }));

      const batchResult = await StudentAnswerService.upsertBatch(answerInputs);
      if (!batchResult.success) {
        return { success: false, error: `Failed to save answers: ${batchResult.error}` };
      }

      // Step 2: Try the Edge Function first (authoritative path).
      const edgeAttempt = await this.submitViaEdgeFunction(submission.session_id);
      if (edgeAttempt.outcome === 'success') {
        return edgeAttempt.result;
      }
      if (edgeAttempt.outcome === 'fatal') {
        return { success: false, error: edgeAttempt.error };
      }

      // Step 3: Edge Function unreachable/errored — fall back to a direct
      // client-side submission. RLS allows the student to insert their own
      // submissions row, so this writes the same data the function would have.
      console.warn(
        '[ExamSubmissionService] Edge Function unavailable, falling back to direct submit',
        edgeAttempt.detail,
      );
      return await this.submitDirect(submission);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ExamSubmissionService] Unexpected error during submission:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Try the submit-exam Edge Function. Returns a tagged outcome so the caller
   * can decide whether to fall back (network/5xx/404) or surface the error
   * (4xx like session_not_eligible — the function is reachable, the request
   * is genuinely invalid, and a fallback would mask a real bug).
   */
  private static async submitViaEdgeFunction(
    sessionId: string,
  ): Promise<
    | { outcome: 'success'; result: ExamSubmissionResult & { edgeResult: EdgeSubmissionResult } }
    | { outcome: 'fatal'; error: string }
    | { outcome: 'fallback'; detail: unknown }
  > {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;

      const resp = await fetch(`${supabaseUrl}/functions/v1/submit-exam`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          session_id: sessionId,
          submit_reason: 'manual',
          client_submitted_at: new Date().toISOString(),
        }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        const code = body?.error ?? 'submission_failed';
        console.error('[ExamSubmissionService] submit-exam non-OK', {
          status: resp.status,
          code,
          body,
        });

        if (code === 'session_not_eligible') {
          return { outcome: 'fatal', error: 'This session cannot be submitted right now.' };
        }
        if (code === 'session_not_found_or_not_owned') {
          return { outcome: 'fatal', error: 'Session not found.' };
        }

        // 404 (function not deployed), 401 (auth), 5xx (function crash) → fall back.
        return { outcome: 'fallback', detail: { status: resp.status, code } };
      }

      const edgeResult: EdgeSubmissionResult = await resp.json();
      return {
        outcome: 'success',
        result: {
          success: true,
          exam_score: edgeResult.auto_graded_score,
          exam_percentage: edgeResult.auto_graded_max > 0
            ? Math.round((edgeResult.auto_graded_score / edgeResult.auto_graded_max) * 100)
            : 0,
          total_questions: edgeResult.auto_graded_max,
          correct_answers: edgeResult.auto_graded_score,
          session_id: sessionId,
          submission_id: edgeResult.submission_id,
          grade_status: edgeResult.grade_status as GradeStatus,
          idempotent_hit: edgeResult.idempotent_hit,
          edgeResult,
        },
      };
    } catch (err) {
      // Network failure / DNS / CORS — fall back rather than surface a raw error.
      return { outcome: 'fallback', detail: err };
    }
  }

  /**
   * Direct client-side submission used when the Edge Function is unreachable.
   * Mirrors the function's grading logic and writes the same submissions row.
   * Skips the evidence_packages insert (instructor-only RLS) — that step is
   * recoverable later by the Edge Function via idempotent re-run.
   */
  private static async submitDirect(
    submission: ExamSubmission,
  ): Promise<ExamSubmissionResult> {
    const { session_id } = submission;

    // Idempotency: if a submission already exists, return it.
    const { data: existing } = await supabase
      .from('submissions')
      .select('*')
      .eq('session_id', session_id)
      .maybeSingle();

    if (existing) {
      return this.formatDirectResult(existing as Record<string, unknown>, true, session_id);
    }

    // Load session for exam_id / student_id.
    const { data: sessionRow, error: sessionErr } = await supabase
      .from('exam_sessions')
      .select('id, exam_id, student_id, status, live_cheating_score')
      .eq('id', session_id)
      .single();

    if (sessionErr || !sessionRow) {
      return { success: false, error: 'Could not load session for direct submission' };
    }

    const sessionData = sessionRow as {
      id: string;
      exam_id: string;
      student_id: string;
      status: string;
      live_cheating_score: number | null;
    };

    // Grade against the database (auto-gradable types only).
    const questionsResult = await this.getExamQuestions(sessionData.exam_id);
    if (!questionsResult.success || !questionsResult.questions) {
      return { success: false, error: questionsResult.error ?? 'Failed to load questions' };
    }

    const { data: persistedAnswers } = await supabase
      .from('student_answers')
      .select('question_id, selected_answer')
      .eq('session_id', session_id);

    let autoGradedScore = 0;
    let autoGradedMax = 0;
    let hasManual = false;
    const autoGradableTypes = new Set([
      'multiple_choice',
      'multiple_choice_single',
      'multiple_choice_multi',
      'true_false',
      'short_answer_exact',
    ]);

    for (const q of questionsResult.questions) {
      autoGradedMax += q.points ?? 0;
      if (!autoGradableTypes.has(q.question_type)) {
        hasManual = true;
        continue;
      }
      const ans = (persistedAnswers ?? []).find(a => a.question_id === q.id);
      if (ans?.selected_answer != null && ans.selected_answer === q.correct_answer) {
        autoGradedScore += q.points ?? 0;
      }
    }

    const allAutoGradable = !hasManual;
    const gradeStatus: GradeStatus = allAutoGradable
      ? 'auto_final'
      : (autoGradedMax > 0 ? 'partial_pending_review' : 'fully_pending_review');
    const finalGrade = allAutoGradable ? autoGradedScore : null;
    const finalCheatingScore = sessionData.live_cheating_score ?? 0;
    const now = new Date().toISOString();

    // Freeze answers (RLS lets the student update their own).
    await supabase
      .from('student_answers')
      .update({ frozen_at: now } as never)
      .eq('session_id', session_id)
      .is('frozen_at', null);

    // Insert the submissions row.
    const { data: inserted, error: insertErr } = await supabase
      .from('submissions')
      .insert({
        session_id,
        exam_id: sessionData.exam_id,
        student_id: sessionData.student_id,
        submitted_at: now,
        submit_reason: 'manual',
        grade_status: gradeStatus,
        auto_graded_score: autoGradedScore,
        auto_graded_max: autoGradedMax,
        final_grade: finalGrade,
        final_cheating_score: finalCheatingScore,
      } as never)
      .select()
      .single();

    if (insertErr) {
      // Race: another path inserted concurrently. Re-read.
      const { data: race } = await supabase
        .from('submissions')
        .select('*')
        .eq('session_id', session_id)
        .maybeSingle();
      if (race) return this.formatDirectResult(race as Record<string, unknown>, true, session_id);
      console.error('[ExamSubmissionService] Direct submission insert failed:', insertErr);
      return { success: false, error: insertErr.message };
    }

    // Flip session status so Home stops showing "Continue Exam".
    await supabase
      .from('exam_sessions')
      .update({
        status: 'submitted',
        submitted_at: now,
        submit_reason: 'manual',
        updated_at: now,
      } as never)
      .eq('id', session_id);

    return this.formatDirectResult(inserted as Record<string, unknown>, false, session_id);
  }

  private static formatDirectResult(
    row: Record<string, unknown>,
    idempotentHit: boolean,
    sessionId: string,
  ): ExamSubmissionResult {
    const autoGradedScore = Number(row.auto_graded_score ?? 0);
    const autoGradedMax = Number(row.auto_graded_max ?? 0);
    return {
      success: true,
      exam_score: autoGradedScore,
      exam_percentage: autoGradedMax > 0
        ? Math.round((autoGradedScore / autoGradedMax) * 100)
        : 0,
      total_questions: autoGradedMax,
      correct_answers: autoGradedScore,
      session_id: sessionId,
      submission_id: String(row.id ?? ''),
      grade_status: row.grade_status as GradeStatus,
      idempotent_hit: idempotentHit,
    };
  }

  /**
   * Grade an exam by comparing answers to correct answers
   */
  static async gradeExam(
    sessionId: string,
    examId: string,
    submittedAnswers: ExamSubmission['answers']
  ): Promise<{ success: boolean; grade?: ExamGrade; error?: string }> {
    try {
      // Step 1: Fetch all questions for this exam
      const questionsResult = await this.getExamQuestions(examId);
      if (!questionsResult.success) {
        return { success: false, error: questionsResult.error };
      }

      const questions = questionsResult.questions!;
      const gradedAnswers: GradedAnswer[] = [];
      let totalScore = 0;
      let maxScore = 0;
      let correctCount = 0;

      // Step 2: Grade each question
      for (const question of questions) {
        const submittedAnswer = submittedAnswers.find(a => a.question_id === question.id);
        const gradedAnswer = this.gradeAnswer(question, submittedAnswer ?? null);
        gradedAnswers.push(gradedAnswer);

        totalScore += gradedAnswer.points_earned;
        maxScore += gradedAnswer.points_possible;
        if (gradedAnswer.is_correct) {
          correctCount++;
        }
      }

      // Step 3: Calculate percentage
      const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

      // Step 4: Update answers with correctness
      await this.updateAnswerCorrectness(sessionId, gradedAnswers);

      const grade: ExamGrade = {
        session_id: sessionId,
        exam_id: examId,
        student_id: '', // Will be populated from session
        total_score: totalScore,
        percentage,
        total_questions: questions.length,
        correct_answers: correctCount,
        graded_answers: gradedAnswers,
        graded_at: new Date().toISOString(),
      };

      return { success: true, grade };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ExamSubmissionService] Error grading exam:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Grade a single answer
   */
  private static gradeAnswer(
    question: QuestionForGrading,
    submittedAnswer: ExamSubmission['answers'][0] | null
  ): GradedAnswer {
    // Handle null/missing answer
    if (!submittedAnswer || submittedAnswer.selected_answer === null) {
      return {
        question_id: question.id,
        question_text: question.question_text,
        selected_answer: null,
        correct_answer: question.correct_answer,
        is_correct: false,
        points_earned: 0,
        points_possible: question.points,
      };
    }

    // Grade based on question type
    let isCorrect = false;

    if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
      isCorrect = submittedAnswer.selected_answer === question.correct_answer;
    } else if (question.question_type === 'essay') {
      // Essays can't be auto-graded; mark as pending
      isCorrect = false;
    }

    return {
      question_id: question.id,
      question_text: question.question_text,
      selected_answer: submittedAnswer.selected_answer,
      correct_answer: question.correct_answer,
      is_correct: isCorrect,
      points_earned: isCorrect ? question.points : 0,
      points_possible: question.points,
    };
  }

  /**
   * Update student_answers with is_correct flags
   */
  private static async updateAnswerCorrectness(
    sessionId: string,
    gradedAnswers: GradedAnswer[]
  ): Promise<void> {
    try {
      const updates = gradedAnswers.map(graded => ({
        id: graded.question_id,
        session_id: sessionId,
        question_id: graded.question_id,
        is_correct: graded.is_correct,
      }));

      // Update each answer individually (no bulk update for is_correct)
      for (const update of updates) {
        await supabase
          .from('student_answers')
          .update({ is_correct: update.is_correct } as any)
          .eq('session_id', update.session_id)
          .eq('question_id', update.question_id);
      }
    } catch (error) {
      console.error('[ExamSubmissionService] Error updating answer correctness:', error);
      // Don't throw - this is non-critical
    }
  }

  /**
   * Fetch all questions for an exam
   */
  private static async getExamQuestions(examId: string): Promise<{ success: boolean; questions?: QuestionForGrading[]; error?: string }> {
    try {
      const examUuid = ensureUuid(examId, 'exam');
      const { data, error } = await supabase
        .from('exam_questions')
        .select('id, exam_id, question_text, question_type, correct_answer, points')
        .eq('exam_id', examUuid)
        .order('position', { ascending: true });

      if (error) {
        console.error('[ExamSubmissionService] Failed to fetch questions:', error);
        return { success: false, error: error.message };
      }

      return { success: true, questions: data as QuestionForGrading[] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ExamSubmissionService] Unexpected error fetching questions:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Fetch grade for a session
   */
  static async getSessionGrade(sessionId: string): Promise<{ success: boolean; grade?: ExamGrade; error?: string }> {
    try {
      // Fetch all answers for this session with question data
      const { data: answers, error: answerError } = await supabase
        .from('student_answers')
        .select(`
          *,
          question:exam_questions!student_answers_question_id_fkey (
            id, exam_id, question_text, question_type, correct_answer, points
          )
        `)
        .eq('session_id', sessionId);

      if (answerError) {
        console.error('[ExamSubmissionService] Failed to fetch answers for grading:', answerError);
        return { success: false, error: answerError.message };
      }

      if (!answers || answers.length === 0) {
        return { success: false, error: 'No answers found for this session' };
      }

      // Calculate grade
      let totalScore = 0;
      let maxScore = 0;
      let correctCount = 0;
      const gradedAnswers: GradedAnswer[] = [];

      for (const answerRow of answers as any[]) {
        const question = answerRow.question as QuestionForGrading;
        if (!question) continue;

        const submittedAnswer = {
          question_id: question.id,
          selected_answer: answerRow.selected_answer,
          time_spent_seconds: answerRow.time_spent_seconds,
        };

        const graded = this.gradeAnswer(question, submittedAnswer);
        gradedAnswers.push(graded);

        totalScore += graded.points_earned;
        maxScore += graded.points_possible;
        if (graded.is_correct) {
          correctCount++;
        }
      }

      const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

      const grade: ExamGrade = {
        session_id: sessionId,
        exam_id: answers[0]?.question?.exam_id ?? '',
        student_id: '',
        total_score: totalScore,
        percentage,
        total_questions: answers.length,
        correct_answers: correctCount,
        graded_answers: gradedAnswers,
        graded_at: new Date().toISOString(),
      };

      return { success: true, grade };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ExamSubmissionService] Error fetching session grade:', err);
      return { success: false, error: message };
    }
  }
}
