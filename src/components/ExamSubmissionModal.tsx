// ============================================
// Phase 2: Exam Submission Modal
// ============================================
// Shows submission confirmation and summary before final submit
// Responsibility: User confirmation, answer review, submission trigger

import { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, X } from 'lucide-react';

interface ExamSubmissionModalProps {
  isOpen: boolean;
  totalQuestions: number;
  answeredCount: number;
  timeElapsed: number;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExamSubmissionModal({
  isOpen,
  totalQuestions,
  answeredCount,
  timeElapsed,
  isSubmitting,
  onConfirm,
  onCancel,
}: ExamSubmissionModalProps) {
  const [showWarnings, setShowWarnings] = useState(true);

  const unansweredCount = totalQuestions - answeredCount;
  const hasUnanswered = unansweredCount > 0;
  const completionPercentage = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!isSubmitting ? onCancel : undefined}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Submit Exam</h2>
          {!isSubmitting && (
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Time Summary */}
          <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
            <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm text-blue-700">Time Elapsed</p>
              <p className="text-lg font-semibold text-blue-900">{formatTime(timeElapsed)}</p>
            </div>
          </div>

          {/* Answer Summary */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm text-gray-500">{answeredCount}/{totalQuestions} answered</span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  completionPercentage >= 80
                    ? 'bg-green-500'
                    : completionPercentage >= 50
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${completionPercentage}%` }}
              />
            </div>

            {/* Completion percentage */}
            <div className="text-center">
              <span className="text-2xl font-bold text-gray-900">
                {completionPercentage.toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Warnings */}
          {showWarnings && hasUnanswered && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-900 mb-1">Unanswered Questions</h4>
                  <p className="text-sm text-yellow-700">
                    You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}.
                    Unanswered questions will receive 0 points.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Checkbox */}
          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="confirmSubmit"
              checked={!hasUnanswered || !showWarnings}
              onChange={(e) => setShowWarnings(!e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="confirmSubmit" className="text-sm text-gray-700">
              I understand that unanswered questions will receive 0 points and I cannot change my
              answers after submission.
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            Go Back
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium flex items-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Submit Exam</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
