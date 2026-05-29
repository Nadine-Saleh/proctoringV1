import { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, ListChecks, Send, X } from 'lucide-react';

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
  const [acknowledged, setAcknowledged] = useState(false);

  const unansweredCount = totalQuestions - answeredCount;
  const hasUnanswered = unansweredCount > 0;
  const completionPercentage =
    totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (!isOpen) return null;

  const barTone =
    completionPercentage >= 80
      ? 'from-success-500 to-success-600'
      : completionPercentage >= 50
      ? 'from-warning-400 to-warning-500'
      : 'from-danger-500 to-danger-600';

  const canSubmit = !hasUnanswered || acknowledged;

  return (
    <div className="modal-backdrop !z-50">
      <div className="modal-card max-w-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink-900 tracking-tight2">
                Submit exam
              </h2>
              <p className="text-2xs text-ink-500 uppercase tracking-wider">
                Review before final submission
              </p>
            </div>
          </div>
          {!isSubmitting && (
            <button
              onClick={onCancel}
              className="p-1.5 hover:bg-ink-100 rounded-md transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-ink-500" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="panel p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-ink-500" />
                <span className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
                  Time elapsed
                </span>
              </div>
              <p className="text-lg font-semibold text-ink-900 tabular-nums tracking-tight2">
                {formatTime(timeElapsed)}
              </p>
            </div>
            <div className="panel p-4">
              <div className="flex items-center gap-2 mb-1">
                <ListChecks className="w-4 h-4 text-ink-500" />
                <span className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
                  Answered
                </span>
              </div>
              <p className="text-lg font-semibold text-ink-900 tabular-nums tracking-tight2">
                {answeredCount}
                <span className="text-sm text-ink-400 font-normal"> / {totalQuestions}</span>
              </p>
            </div>
          </div>

          {/* Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-ink-700">Progress</span>
              <span className="text-sm font-semibold text-ink-900 tabular-nums">
                {completionPercentage.toFixed(0)}%
              </span>
            </div>
            <div className="relative h-2 bg-ink-100 rounded-full overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${barTone} transition-all duration-500 ease-out`}
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          {/* Warning */}
          {hasUnanswered && (
            <div className="p-4 bg-warning-50 border border-warning-200 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-warning-100 text-warning-700 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-warning-900 mb-0.5">
                    {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}
                  </h4>
                  <p className="text-xs text-warning-800 leading-relaxed">
                    Unanswered questions will receive zero points. You won't be able to change
                    your answers after submission.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Acknowledgment */}
          {hasUnanswered && (
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-brand-700 border-ink-300 rounded focus:ring-2 focus:ring-brand-700/30"
              />
              <span className="text-sm text-ink-700 select-none group-hover:text-ink-900">
                I understand that unanswered questions receive zero points and that submission
                is final.
              </span>
            </label>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-ink-50/50 border-t border-ink-100 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="btn btn-md btn-secondary"
          >
            Go back
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting || !canSubmit}
            className="btn btn-md bg-success-600 text-white shadow-soft hover:bg-success-700 disabled:bg-ink-300"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Submitting…</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Submit exam</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
