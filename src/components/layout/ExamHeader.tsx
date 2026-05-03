import { Clock } from 'lucide-react';

interface ExamHeaderProps {
  title: string;
  currentQuestion: number;
  totalQuestions: number;
  timeRemaining: number;
  answeredCount: number;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const ExamHeader = ({ title, currentQuestion, totalQuestions, timeRemaining, answeredCount }: ExamHeaderProps) => (
  <div className="bg-white border-b border-gray-200 px-6 py-4">
    <div className="max-w-5xl mx-auto flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500">Question {currentQuestion + 1} of {totalQuestions}</p>
      </div>
      <div className="flex items-center space-x-6">
        <Clock className="w-5 h-5 text-gray-700" />
        <span className={`text-lg font-mono font-semibold ${timeRemaining < 300 ? 'text-red-600' : 'text-gray-700'}`}>
          {formatTime(timeRemaining)}
        </span>
        <span className="text-sm text-gray-500">{answeredCount}/{totalQuestions} answered</span>
      </div>
    </div>
  </div>
);
