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
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  // If no submission and no grade, redirect to home
  if (!submissionResult && !grade) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Exam Results</h1>
          <p className="text-lg text-gray-600">Your performance summary</p>
        </div>

        {/* Submission Error */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Score Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Your Score</span>
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-4xl font-bold ${getScoreColor(displayScore)}`}>{displayScore}</span>
              <span className="text-xl text-gray-500">%</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Correct Answers</span>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-bold text-gray-900">{displayCorrect}</span>
              <span className="text-xl text-gray-500">/ {displayTotal}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Status</span>
              <Award className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="flex items-baseline">
              <span className={`text-2xl font-bold ${getScoreColor(displayScore)}`}>
                {displayScore >= 70 ? 'Passed' : 'Needs Review'}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Results */}
        {grade && grade.graded_answers.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Question Breakdown</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {grade.graded_answers.map((answer, index) => (
                <div key={answer.question_id} className="px-6 py-5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-sm font-semibold text-gray-500">Q{index + 1}</span>
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${
                          answer.is_correct
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-red-100 text-red-700 border-red-200'
                        }`}>
                          {answer.is_correct ? 'Correct' : 'Incorrect'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {answer.points_earned}/{answer.points_possible} pts
                        </span>
                      </div>
                      <p className="text-gray-900 font-medium mb-2">{answer.question_text}</p>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-500">Your answer:</span>
                          <span className={answer.is_correct ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                            {answer.selected_answer !== null ? `Option ${String.fromCharCode(65 + parseInt(answer.selected_answer))}` : 'Not answered'}
                          </span>
                        </div>
                        {!answer.is_correct && answer.correct_answer !== null && (
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500">Correct answer:</span>
                            <span className="text-green-700 font-medium">
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

        {/* Legacy Fallback (for mock data) */}
        {!grade && submissionResult && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Summary</h2>
            </div>
            <div className="px-6 py-8 text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-blue-100 mb-4">
                <span className={`text-3xl font-bold ${getScoreColor(displayScore)}`}>{displayScore}%</span>
              </div>
              <p className="text-gray-600">
                You answered {displayCorrect} out of {displayTotal} questions correctly.
              </p>
              <div className="mt-4 flex items-center justify-center space-x-6 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(new Date().toISOString())}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4" />
                  <span>Submitted</span>
                </div>
                <div className="flex items-center space-x-1">
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
