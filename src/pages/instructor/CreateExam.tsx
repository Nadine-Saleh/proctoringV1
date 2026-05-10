import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Clock, Save, Eye, AlertCircle, CheckCircle } from 'lucide-react';
import { ExamService } from '../../services/ExamService';
import type { ProctoringPolicy } from '../../types/examSession';

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

// `<input type="datetime-local">` reads/writes its value as **local time**
// (no timezone). `.toISOString()` returns UTC, so using it for the default
// would silently shift the stored `starts_at` by the user's UTC offset —
// e.g. for a UTC+3 user it lands ~3h in the past, immediately closing the
// exam window. This helper formats the local wall-clock components instead.
const toLocalDateTimeString = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const CreateExam = () => {
  const navigate = useNavigate();
  const [examTitle, setExamTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(() => toLocalDateTimeString(new Date()));
  const [duration, setDuration] = useState(60);
  const [visualEvidenceAllowed, setVisualEvidenceAllowed] = useState(true);
  const [warningThreshold, setWarningThreshold] = useState(30);
  const [criticalThreshold, setCriticalThreshold] = useState(70);
  const [criticalSustainSeconds, setCriticalSustainSeconds] = useState(5);
  const [maxVerificationAttempts, setMaxVerificationAttempts] = useState(3);
  const [peripheralMaxCumulativeMin, setPeripheralMaxCumulativeMin] = useState(30);
  const [awayMaxContinuousSeconds, setAwayMaxContinuousSeconds] = useState(3);
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: '1',
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: Date.now().toString(),
        question: '',
        options: ['', '', '', ''],
        correctAnswer: 0
      }
    ]);
  };

  const removeQuestion = (id: string) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((q) => q.id !== id));
    }
  };

  const updateQuestion = (id: string, field: string, value: any) => {
    setQuestions(
      questions.map((q) =>
        q.id === id
          ? {
              ...q,
              [field]: value
            }
          : q
      )
    );
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.map((opt, idx) => (idx === optionIndex ? value : opt))
            }
          : q
      )
    );
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (!examTitle.trim()) {
      setError('Exam title is required');
      return;
    }

    if (duration <= 0) {
      setError('Duration must be greater than 0');
      return;
    }

    setLoading(true);

    try {
      const proctoringPolicy: ProctoringPolicy = {
        visual_evidence_allowed: visualEvidenceAllowed,
        warning_threshold: warningThreshold,
        critical_threshold: criticalThreshold,
        critical_sustain_seconds: criticalSustainSeconds,
        max_verification_attempts: maxVerificationAttempts,
        gaze_config: {
          peripheral_max_cumulative_min: peripheralMaxCumulativeMin,
          away_max_continuous_s: awayMaxContinuousSeconds,
        },
      };

      const result = await ExamService.createExam({
        title: examTitle,
        description: description || undefined,
        starts_at: new Date(startsAt).toISOString(),
        duration_minutes: duration,
        proctoring_policy: proctoringPolicy,
      });

      if (!result.success || !result.examId) {
        setError(result.error || 'Failed to create exam');
        return;
      }

      setSuccess('Exam created successfully! Saving questions...');

      const validQuestions = questions.filter((q) => q.question.trim());
      if (validQuestions.length === 0) {
        setError('At least one question is required to publish');
        return;
      }

      const saveResult = await ExamService.saveQuestions(
        result.examId,
        validQuestions.map((q) => ({
          question_text: q.question,
          options: q.options,
          correct_answer_index: q.correctAnswer,
        }))
      );

      if (!saveResult.success) {
        setError('Exam created but failed to save questions: ' + saveResult.error);
        return;
      }

      setSuccess('Questions saved! Publishing...');

      const publishResult = await ExamService.publishExam(result.examId);
      if (publishResult.success) {
        setSuccess('Exam published with access code: ' + publishResult.accessCode);
        setTimeout(() => {
          navigate(`/instructor/exams/${result.examId}`);
        }, 2000);
      } else {
        setError('Exam created but failed to publish: ' + publishResult.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Create New Exam</h1>
          <p className="text-lg text-gray-600">Design your exam with questions and proctoring settings</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-red-900">Error</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-green-900">Success</h3>
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Exam Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Exam Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                placeholder="e.g., Data Structures Midterm"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional exam description"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Starts At <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (minutes) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Proctoring Policy</h3>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="visualEvidence"
                  checked={visualEvidenceAllowed}
                  onChange={(e) => setVisualEvidenceAllowed(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="visualEvidence" className="ml-3 text-sm font-medium text-gray-700">
                  Allow Visual Evidence Capture
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Warning Threshold (0-100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={warningThreshold}
                    onChange={(e) => setWarningThreshold(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Critical Threshold (0-100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={criticalThreshold}
                    onChange={(e) => setCriticalThreshold(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Critical Sustain Seconds
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={criticalSustainSeconds}
                    onChange={(e) => setCriticalSustainSeconds(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Verification Attempts
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={maxVerificationAttempts}
                    onChange={(e) => setMaxVerificationAttempts(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Peripheral Max / Minute (s)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={peripheralMaxCumulativeMin}
                    onChange={(e) => setPeripheralMaxCumulativeMin(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Away Max Continuous (s)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={awayMaxContinuousSeconds}
                    onChange={(e) => setAwayMaxContinuousSeconds(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {questions.map((question, qIndex) => (
            <div
              key={question.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
            >
              <div className="flex items-start justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Question {qIndex + 1}</h3>
                {questions.length > 1 && (
                  <button
                    onClick={() => removeQuestion(question.id)}
                    className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Text
                </label>
                <textarea
                  value={question.question}
                  onChange={(e) => updateQuestion(question.id, 'question', e.target.value)}
                  placeholder="Enter your question here..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Answer Options
                </label>
                {question.options.map((option, optIndex) => (
                  <div key={optIndex} className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name={`correct-${question.id}`}
                      checked={question.correctAnswer === optIndex}
                      onChange={() => updateQuestion(question.id, 'correctAnswer', optIndex)}
                      className="w-5 h-5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(question.id, optIndex, e.target.value)}
                      placeholder={`Option ${optIndex + 1}`}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                ))}
                <p className="text-xs text-gray-500 mt-2">
                  Select the radio button to mark the correct answer
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={addQuestion}
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Add Question</span>
          </button>

          <div className="flex items-center space-x-3">
            <button
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Eye className="w-5 h-5" />
              <span className="font-medium">Preview</span>
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center space-x-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              <span className="font-semibold">{loading ? 'Publishing...' : 'Create & Publish'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
