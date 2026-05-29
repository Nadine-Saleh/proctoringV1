import { CheckCircle2, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import type { ExamQuestion } from '../../types/exam';

interface QuestionPanelProps {
  question: ExamQuestion;
  selectedAnswer: number | undefined;
  currentIndex: number;
  totalQuestions: number;
  progress: number;
  onSelectAnswer: (questionId: string, answerIndex: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const QuestionPanel = ({
  question,
  selectedAnswer,
  currentIndex,
  totalQuestions,
  progress,
  onSelectAnswer,
  onPrevious,
  onNext,
  onSubmit,
}: QuestionPanelProps) => {
  const isLast = currentIndex === totalQuestions - 1;
  const isFirst = currentIndex === 0;

  return (
    <>
      <div className="flex-1 overflow-auto grid-spotlight">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="card overflow-hidden animate-fade-in-up">
            {/* Question header strip */}
            <div className="px-7 py-3.5 border-b border-ink-100 bg-ink-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-brand-gradient text-white text-xs font-semibold shadow-sm tabular-nums">
                  {currentIndex + 1}
                </span>
                <span className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
                  Question {currentIndex + 1} of {totalQuestions}
                </span>
              </div>
              {selectedAnswer !== undefined && (
                <span className="pill pill-success">
                  <CheckCircle2 className="w-3 h-3" />
                  Answered
                </span>
              )}
            </div>

            <div className="px-7 py-7">
              <h2 className="text-xl md:text-[22px] font-semibold tracking-tightish text-ink-900 leading-relaxed text-balance mb-7">
                {question.prompt}
              </h2>

              <div role="radiogroup" aria-label="Answer options" className="space-y-2.5">
                {question.options.map((option, index) => {
                  const selected = selectedAnswer === index;
                  const letter = OPTION_LETTERS[index] ?? `${index + 1}`;
                  return (
                    <button
                      key={index}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onSelectAnswer(question.id, index)}
                      className={`
                        group w-full text-left relative overflow-hidden
                        rounded-xl border transition-all duration-200 ease-out
                        focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2
                        ${
                          selected
                            ? 'border-brand-600 bg-brand-50/70 shadow-soft ring-1 ring-brand-600/20'
                            : 'border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/30'
                        }
                      `}
                    >
                      <div className="flex items-center gap-4 px-5 py-4">
                        <span
                          className={`
                            flex-shrink-0 inline-flex items-center justify-center
                            w-9 h-9 rounded-lg text-sm font-semibold
                            transition-colors duration-150
                            ${
                              selected
                                ? 'bg-brand-700 text-white shadow-sm'
                                : 'bg-ink-100 text-ink-600 group-hover:bg-brand-100 group-hover:text-brand-700'
                            }
                          `}
                        >
                          {letter}
                        </span>
                        <span
                          className={`flex-1 text-base leading-relaxed ${
                            selected ? 'text-ink-900 font-medium' : 'text-ink-700'
                          }`}
                        >
                          {option}
                        </span>
                        <span
                          className={`
                            flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center
                            transition-all duration-150
                            ${
                              selected
                                ? 'border-brand-700 bg-brand-700'
                                : 'border-ink-300 group-hover:border-brand-400'
                            }
                          `}
                        >
                          {selected && (
                            <span className="w-2 h-2 rounded-full bg-white animate-scale-in" />
                          )}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={onPrevious}
              disabled={isFirst}
              className="btn btn-md btn-secondary"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {isLast ? (
              <button
                onClick={onSubmit}
                className="btn btn-lg bg-success-600 text-white shadow-soft hover:bg-success-700 hover:shadow-card font-semibold"
              >
                <Send className="w-4 h-4" />
                <span>Submit Exam</span>
              </button>
            ) : (
              <button
                onClick={onNext}
                className="btn btn-md btn-primary"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress footer */}
      <div className="bg-white/95 backdrop-blur-md border-t border-ink-100 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <div className="flex-1 h-1.5 bg-ink-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-gradient rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-mono tabular-nums text-ink-500 flex-shrink-0">
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    </>
  );
};
