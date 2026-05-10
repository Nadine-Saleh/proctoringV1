import type { ExamQuestion } from '../../types/exam';

interface QuestionNavigatorProps {
  questions: ExamQuestion[];
  currentIndex: number;
  answers: Map<string, number>;
  onSelect: (index: number) => void;
}

export const QuestionNavigator = ({ questions, currentIndex, answers, onSelect }: QuestionNavigatorProps) => (
  <div className="p-6 flex-1 overflow-auto">
    <h4 className="font-semibold text-gray-900 mb-4">Question Navigator</h4>
    <div className="grid grid-cols-5 gap-2">
      {questions.map((q, index) => (
        <button
          key={q.id}
          onClick={() => onSelect(index)}
          className={`p-3 rounded-lg text-sm font-medium transition-all ${
            currentIndex === index
              ? 'bg-blue-600 text-white'
              : answers.has(q.id)
              ? 'bg-green-100 text-green-700 border border-green-300'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {index + 1}
        </button>
      ))}
    </div>

    <div className="mt-4 space-y-2 text-xs text-gray-500">
      <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-blue-600 rounded" /><span>Current</span></div>
      <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-green-100 border border-green-300 rounded" /><span>Answered</span></div>
      <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-gray-100 rounded" /><span>Not Answered</span></div>
    </div>
  </div>
);
