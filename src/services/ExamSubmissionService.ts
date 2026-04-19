// ============================================
// Phase 2: Exam Submission Service
// ============================================
// Handles exam submission, grading, and report generation
// Responsibility: Submission workflow, answer grading, score calculation

import { supabase } from '../lib/supabase/client';
import { ensureUuid } from '../utils/uuid';
import { ExamSessionService } from './examSessionService';
import { StudentAnswerService } from './StudentAnswerService';
import type {
  ExamSubmission,
  ExamSubmissionResult,
  QuestionForGrading,
  GradedAnswer,
  ExamGrade,
} from '../types/examSession';

export class ExamSubmissionService {
  /**
   * Submit an exam with all answers
   * This is the main submission entry point
   */
  static async submit(submission: ExamSubmission): Promise<ExamSubmissionResult> {
    try {
      console.log('[ExamSubmissionService] Starting submission for session:', submission.session_id);

      // Step 1: Save all answers in batch
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
        return {
          success: false,
          error: `Failed to save answers: ${batchResult.error}`,
        };
      }

      // Step 2: Grade the exam
      const gradeResult = await this.gradeExam(
        submission.session_id,
        submission.exam_id,
        submission.answers
      );

      if (!gradeResult.success) {
        return {
          success: false,
          error: `Failed to grade exam: ${gradeResult.error}`,
        };
      }

      // Step 3: Mark session as submitted
      const submitResult = await ExamSessionService.submit(
        submission.session_id,
        submission.duration_taken_seconds
      );

      if (!submitResult.success) {
        console.error('[ExamSubmissionService] Failed to update session status:', submitResult.error);
        // Continue anyway - answers are saved
      }

      console.log('[ExamSubmissionService] Submission complete');
      return {
        success: true,
        exam_score: gradeResult.grade?.total_score ?? 0,
        exam_percentage: gradeResult.grade?.percentage ?? 0,
        total_questions: gradeResult.grade?.total_questions ?? 0,
        correct_answers: gradeResult.grade?.correct_answers ?? 0,
        session_id: submission.session_id,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ExamSubmissionService] Unexpected error during submission:', err);
      return { success: false, error: message };
    }
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
        .from('questions')
        .select('id, exam_id, question_text, question_type, correct_answer, points')
        .eq('exam_id', examUuid)
        .order('sort_order', { ascending: true });

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
          questions!student_answers_question_id_fkey (
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
        const question = answerRow.questions as QuestionForGrading;
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
        exam_id: answers[0]?.questions?.exam_id ?? '',
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
