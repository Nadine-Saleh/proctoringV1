import { CheckCircle2 } from 'lucide-react';
import type { ExamQuestion } from '../../types/exam';

interface QuestionNavigatorProps {
  questions: ExamQuestion[];
  currentIndex: number;
  answers: Map<string, number>;
  onSelect: (index: number) => void;
}

export const QuestionNavigator = ({
  questions,
  currentIndex,
  answers,
  onSelect,
}: QuestionNavigatorProps) => {
  const answeredCount = questions.filter((q) => answers.has(q.id)).length;
  const total = questions.length;

  return (
    <div className="p-5 flex-1 overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
          Questions
        </h4>
        <span className="text-2xs font-mono tabular-nums text-ink-500">
          {answeredCount}/{total}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {questions.map((q, index) => {
          const isCurrent = currentIndex === index;
          const isAnswered = answers.has(q.id);
          return (
            <button
              key={q.id}
              onClick={() => onSelect(index)}
              aria-label={`Go to question ${index + 1}${isAnswered ? ' (answered)' : ''}`}
              aria-current={isCurrent ? 'true' : undefined}
              className={`
                relative aspect-square rounded-lg text-xs font-semibold tabular-nums
                transition-all duration-150 ease-out
                focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-1
                ${
                  isCurrent
                    ? 'bg-brand-gradient text-white shadow-md ring-1 ring-brand-800/30 -translate-y-px'
                    : isAnswered
                    ? 'bg-success-50 text-success-700 ring-1 ring-success-200 hover:bg-success-100'
                    : 'bg-ink-50 text-ink-500 ring-1 ring-ink-100 hover:bg-ink-100 hover:text-ink-700'
                }
              `}
            >
              {index + 1}
              {isAnswered && !isCurrent && (
                <CheckCircle2 className="absolute -top-1 -right-1 w-3.5 h-3.5 text-success-600 bg-white rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-2xs text-ink-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-brand-gradient" />
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-success-100 ring-1 ring-success-200" />
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-ink-100" />
          <span>Unanswered</span>
        </div>
      </div>
    </div>
  );
};
