import { Clock, ListChecks } from 'lucide-react';

interface ExamHeaderProps {
  title: string;
  currentQuestion: number;
  totalQuestions: number;
  timeRemaining: number;
  answeredCount: number;
}

const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const ExamHeader = ({
  title,
  currentQuestion,
  totalQuestions,
  timeRemaining,
  answeredCount,
}: ExamHeaderProps) => {
  const isCritical = timeRemaining < 60;
  const isLow = timeRemaining < 300;

  const timeTone = isCritical
    ? { wrap: 'bg-danger-50 border-danger-200 text-danger-700 animate-pulse-soft', label: 'Time critical' }
    : isLow
    ? { wrap: 'bg-warning-50 border-warning-200 text-warning-700', label: 'Time running low' }
    : { wrap: 'bg-white border-ink-200 text-ink-800', label: 'Time remaining' };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-ink-100 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-brand-700 mb-0.5">
              <span className="inline-block w-1 h-1 rounded-full bg-brand-700" />
              In Session
            </div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight2 text-ink-900 truncate">
              {title}
            </h1>
            <p className="text-sm text-ink-500 mt-0.5">
              Question{' '}
              <span className="font-semibold text-ink-700 tabular-nums">
                {currentQuestion + 1}
              </span>{' '}
              of <span className="tabular-nums">{totalQuestions}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-ink-50 border border-ink-100">
              <ListChecks className="w-4 h-4 text-ink-500" />
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-semibold text-ink-800 tabular-nums">
                  {answeredCount}
                </span>
                <span className="text-xs text-ink-500 tabular-nums">/ {totalQuestions}</span>
              </div>
              <span className="text-2xs text-ink-500 ml-1">answered</span>
            </div>

            <div
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border shadow-soft transition-colors ${timeTone.wrap}`}
              role="timer"
              aria-live="polite"
            >
              <Clock className={`w-5 h-5 ${isCritical ? 'animate-pulse' : ''}`} />
              <div className="flex flex-col items-end leading-none">
                <span className="text-2xs font-semibold uppercase tracking-wider opacity-70">
                  {timeTone.label}
                </span>
                <span className="text-lg font-mono font-semibold tabular-nums mt-0.5">
                  {formatTime(timeRemaining)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
