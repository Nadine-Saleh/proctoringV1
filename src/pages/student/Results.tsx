import { useEffect, useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { Award, Calendar, CheckCircle, TrendingUp, BarChart, Clock, AlertTriangle } from 'lucide-react';
import { ExamSubmissionService } from '../../services/ExamSubmissionService';
import type { ExamGrade } from '../../types/examSession';

interface SubmissionResult {
  success: boolean;
  exam_score?: number;
  exam_percentage?: number;
  total_questions?: number;
  correct_answers?: number;
  session_id?: string;
  submission_id?: string;
  grade_status?: 'auto_final' | 'partial_pending_review' | 'fully_pending_review';
}

export const StudentResults = () => {
  const location = useLocation();
  const [grade, setGrade] = useState<ExamGrade | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if we have a fresh submission result from Exam.tsx
  const submissionResult = location.state?.submissionResult as SubmissionResult | undefined;

  // Load grade for the submitted session
  useEffect(() => {
    async function loadGrade() {
      if (submissionResult?.session_id) {
        try {
          const result = await ExamSubmissionService.getSessionGrade(submissionResult.session_id);
          if (result.success && result.grade) {
            setGrade(result.grade);
          }
        } catch (err) {
          console.error('[Results] Failed to load grade:', err);
          setError('Could not load your exam results.');
        }
      }
      setIsLoading(false);
    }

    loadGrade();
  }, [submissionResult]);

  const displayScore = grade?.percentage ?? submissionResult?.exam_percentage ?? 0;
  const displayCorrect = grade?.correct_answers ?? submissionResult?.correct_answers ?? 0;
  const displayTotal = grade?.total_questions ?? submissionResult?.total_questions ?? 0;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-success-700';
    if (score >= 80) return 'text-brand-700';
    if (score >= 70) return 'text-warning-700';
    return 'text-danger-700';
  };

  // If no submission and no grade, redirect to home
  if (!submissionResult && !grade) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ink-50 grid-spotlight flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-brand-100" />
            <div className="absolute inset-0 rounded-full border-2 border-t-brand-700 animate-spin" />
          </div>
          <p className="text-sm font-medium text-ink-600">Loading your results…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50 grid-spotlight">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8 animate-fade-in-up">
          <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-brand-700 mb-1">
            Exam Results
          </div>
          <h1 className="text-3xl font-semibold text-ink-900 tracking-tight2">
            Performance summary
          </h1>
          <p className="text-ink-600 mt-1">A breakdown of how you did on this exam.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-danger-700 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-danger-900">Error</h3>
              <p className="text-sm text-danger-700">{error}</p>
            </div>
          </div>
        )}

        {/* Score Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
                Score
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-4xl font-semibold tabular-nums tracking-tight2 ${getScoreColor(displayScore)}`}>
                {displayScore}
              </span>
              <span className="text-xl text-ink-400">%</span>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
                Correct
              </span>
              <div className="w-8 h-8 rounded-lg bg-success-50 text-success-700 flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-semibold text-ink-900 tabular-nums tracking-tight2">
                {displayCorrect}
              </span>
              <span className="text-xl text-ink-400 tabular-nums">/ {displayTotal}</span>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
                Status
              </span>
              <div className="w-8 h-8 rounded-lg bg-warning-50 text-warning-700 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className={`text-2xl font-semibold tracking-tight2 ${getScoreColor(displayScore)}`}>
                {displayScore >= 70 ? 'Passed' : 'Needs review'}
              </span>
              {submissionResult?.grade_status === 'partial_pending_review' && (
                <span className="text-xs text-warning-700 font-medium">
                  Some answers pending instructor review
                </span>
              )}
              {submissionResult?.grade_status === 'fully_pending_review' && (
                <span className="text-xs text-warning-700 font-medium">
                  Grade pending instructor review
                </span>
              )}
              {submissionResult?.submission_id && (
                <span
                  className="text-2xs text-ink-400 font-mono truncate mt-0.5"
                  title={submissionResult.submission_id}
                >
                  ID: {submissionResult.submission_id.slice(0, 8)}…
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Results */}
        {grade && grade.graded_answers.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink-900 tracking-tight2">
                  Question breakdown
                </h2>
                <p className="text-2xs uppercase tracking-wider text-ink-500 mt-0.5">
                  Answer-by-answer summary
                </p>
              </div>
              <span className="text-xs text-ink-500 tabular-nums">
                {grade.graded_answers.length} questions
              </span>
            </div>
            <div className="divide-y divide-ink-100">
              {grade.graded_answers.map((answer, index) => (
                <div
                  key={answer.question_id}
                  className="px-6 py-5 hover:bg-ink-50/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md bg-ink-100 text-ink-700 text-xs font-semibold tabular-nums">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-2">
                        <span className={answer.is_correct ? 'pill pill-success' : 'pill pill-danger'}>
                          {answer.is_correct ? 'Correct' : 'Incorrect'}
                        </span>
                        <span className="text-2xs uppercase tracking-wider text-ink-500 font-mono tabular-nums">
                          {answer.points_earned}/{answer.points_possible} pts
                        </span>
                      </div>
                      <p className="text-sm font-medium text-ink-900 mb-2 leading-relaxed">
                        {answer.question_text}
                      </p>
                      <div className="text-sm text-ink-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-ink-500">Your answer:</span>
                          <span
                            className={`font-medium ${
                              answer.is_correct ? 'text-success-700' : 'text-danger-700'
                            }`}
                          >
                            {answer.selected_answer !== null
                              ? `Option ${String.fromCharCode(
                                  65 + parseInt(answer.selected_answer)
                                )}`
                              : 'Not answered'}
                          </span>
                        </div>
                        {!answer.is_correct && answer.correct_answer !== null && (
                          <div className="flex items-center gap-2">
                            <span className="text-ink-500">Correct answer:</span>
                            <span className="font-medium text-success-700">
                              Option {String.fromCharCode(65 + parseInt(answer.correct_answer))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legacy Fallback */}
        {!grade && submissionResult && (
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-ink-100">
              <h2 className="text-base font-semibold text-ink-900 tracking-tight2">Summary</h2>
            </div>
            <div className="px-6 py-10 text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-brand-50 ring-1 ring-brand-100 mb-4">
                <span className={`text-3xl font-semibold tracking-tight2 ${getScoreColor(displayScore)}`}>
                  {displayScore}%
                </span>
              </div>
              <p className="text-ink-600">
                You answered <span className="font-semibold text-ink-900">{displayCorrect}</span> out of{' '}
                <span className="font-semibold text-ink-900">{displayTotal}</span> questions correctly.
              </p>
              <div className="mt-4 flex items-center justify-center gap-6 text-sm text-ink-500">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(new Date().toISOString())}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>Submitted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BarChart className="w-4 h-4" />
                  <span>{displayCorrect} correct</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
