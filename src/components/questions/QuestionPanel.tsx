import { CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
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

  return (
    <>
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">{question.prompt}</h2>
            <div className="space-y-3">
              {question.options.map((option, index) => {
                const selected = selectedAnswer === index;
                return (
                  <button
                    key={index}
                    onClick={() => onSelectAnswer(question.id, index)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-3 ${
                        selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`}>
                        {selected && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <span className="text-gray-700">{option}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={onPrevious}
              disabled={currentIndex === 0}
              className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {isLast ? (
              <button
                onClick={onSubmit}
                className="flex items-center space-x-2 px-8 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 font-semibold"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Submit Exam</span>
              </button>
            ) : (
              <button
                onClick={onNext}
                className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border-t border-gray-200 px-6 py-3">
        <div className="max-w-5xl mx-auto">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </>
  );
};
