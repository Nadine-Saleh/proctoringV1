import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { mockQuestions } from '../../data/mockData';
import {
  Clock,
  Video,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export const Exam = () => {
  const navigate = useNavigate();
  const { currentExam } = useApp();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: number }>({});
  const [timeRemaining, setTimeRemaining] = useState(5400);
  const [proctoringStatus, setProctoringStatus] = useState({
    camera: true,
    faceDetected: true,
    tabActive: true
  });

  useEffect(() => {
    if (!currentExam) {
      navigate('/');
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const statusInterval = setInterval(() => {
      setProctoringStatus({
        camera: Math.random() > 0.1,
        faceDetected: Math.random() > 0.15,
        tabActive: Math.random() > 0.05
      });
    }, 3000);

    return () => {
      clearInterval(timer);
      clearInterval(statusInterval);
    };
  }, [currentExam, navigate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (questionId: number, answerIndex: number) => {
    setAnswers({ ...answers, [questionId]: answerIndex });
  };

  const handleSubmit = () => {
    navigate('/results');
  };

  if (!currentExam) return null;

  const question = mockQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / mockQuestions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{currentExam.title}</h1>
              <p className="text-sm text-gray-500">
                Question {currentQuestion + 1} of {mockQuestions.length}
              </p>
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2 text-gray-700">
                <Clock className="w-5 h-5" />
                <span className="text-lg font-mono font-semibold">
                  {formatTime(timeRemaining)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                  {question.question}
                </h2>

                <div className="space-y-3">
                  {question.options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(question.id, index)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        answers[question.id] === index
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center">
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-3 ${
                            answers[question.id] === index
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-300'
                          }`}
                        >
                          {answers[question.id] === index && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                        <span className="text-gray-700">{option}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                disabled={currentQuestion === 0}
                className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="font-medium">Previous</span>
              </button>

              {currentQuestion === mockQuestions.length - 1 ? (
                <button
                  onClick={handleSubmit}
                  className="flex items-center space-x-2 px-8 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 font-semibold transition-colors"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Submit Exam</span>
                </button>
              ) : (
                <button
                  onClick={() =>
                    setCurrentQuestion(Math.min(mockQuestions.length - 1, currentQuestion + 1))
                  }
                  className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold transition-colors"
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
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Proctoring Monitor</h3>

          <div className="bg-gray-900 rounded-lg aspect-video mb-4 flex items-center justify-center relative overflow-hidden">
            <Video className="w-12 h-12 text-gray-600" />
            <div className="absolute top-2 right-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  proctoringStatus.camera ? 'bg-green-500' : 'bg-red-500'
                } animate-pulse`}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div
              className={`flex items-center justify-between p-3 rounded-lg ${
                proctoringStatus.camera ? 'bg-green-50' : 'bg-red-50'
              }`}
            >
              <span
                className={`text-sm font-medium ${
                  proctoringStatus.camera ? 'text-green-700' : 'text-red-700'
                }`}
              >
                Camera Status
              </span>
              {proctoringStatus.camera ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              )}
            </div>

            <div
              className={`flex items-center justify-between p-3 rounded-lg ${
                proctoringStatus.faceDetected ? 'bg-green-50' : 'bg-red-50'
              }`}
            >
              <span
                className={`text-sm font-medium ${
                  proctoringStatus.faceDetected ? 'text-green-700' : 'text-red-700'
                }`}
              >
                Face Detection
              </span>
              {proctoringStatus.faceDetected ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              )}
            </div>

            <div
              className={`flex items-center justify-between p-3 rounded-lg ${
                proctoringStatus.tabActive ? 'bg-green-50' : 'bg-red-50'
              }`}
            >
              <span
                className={`text-sm font-medium ${
                  proctoringStatus.tabActive ? 'text-green-700' : 'text-red-700'
                }`}
              >
                Tab Status
              </span>
              {proctoringStatus.tabActive ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              )}
            </div>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-auto">
          <h4 className="font-semibold text-gray-900 mb-4">Question Navigator</h4>
          <div className="grid grid-cols-5 gap-2">
            {mockQuestions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuestion(index)}
                className={`aspect-square rounded-lg border-2 font-semibold text-sm transition-colors ${
                  currentQuestion === index
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : answers[index + 1] !== undefined
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
