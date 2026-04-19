import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Copy, Check, Calendar, Clock, Users, FileText } from 'lucide-react';
import { ExamService } from '../../services/ExamService';

interface Exam {
  id: string;
  instructor_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  duration_minutes: number;
  status: 'draft' | 'published' | 'closed';
  access_code: string | null;
  proctoring_policy: Record<string, unknown>;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const ExamDetail = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!examId) return;

    const loadExam = async () => {
      try {
        const result = await ExamService.getExamById(examId);
        if (result.success && result.exam) {
          setExam(result.exam);
        } else {
          setError(result.error || 'Failed to load exam');
        }
      } catch (err) {
        setError('Failed to load exam');
      } finally {
        setLoading(false);
      }
    };

    loadExam();
  }, [examId]);

  const handleCopyAccessCode = () => {
    if (exam?.access_code) {
      navigator.clipboard.writeText(exam.access_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-gray-500">Loading exam details...</div>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error || 'Exam not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Dashboard</span>
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">{exam.title}</h1>
              {exam.description && (
                <p className="text-lg text-gray-600">{exam.description}</p>
              )}
            </div>
            <span
              className={`inline-flex px-4 py-2 rounded-full text-sm font-semibold border ${
                exam.status === 'published'
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : exam.status === 'draft'
                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                  : 'bg-gray-100 text-gray-700 border-gray-200'
              }`}
            >
              {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <div className="flex items-center space-x-2 text-gray-600 mb-2">
                <Calendar className="w-5 h-5" />
                <span className="text-sm font-medium">Starts At</span>
              </div>
              <p className="text-lg text-gray-900">{formatDate(exam.starts_at)}</p>
            </div>

            <div>
              <div className="flex items-center space-x-2 text-gray-600 mb-2">
                <Clock className="w-5 h-5" />
                <span className="text-sm font-medium">Duration</span>
              </div>
              <p className="text-lg text-gray-900">{exam.duration_minutes} minutes</p>
            </div>
          </div>

          {exam.status === 'published' && exam.access_code && (
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Access Code</h2>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-2">Share this code with your students</p>
                  <div className="bg-white border-2 border-blue-300 rounded-lg p-4 font-mono text-center text-2xl font-bold text-blue-600">
                    {exam.access_code}
                  </div>
                </div>
                <button
                  onClick={handleCopyAccessCode}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${
                    copied
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Users className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Students Joined</h3>
            </div>
            <p className="text-3xl font-bold text-blue-600">0</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <FileText className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Submissions</h3>
            </div>
            <p className="text-3xl font-bold text-green-600">0</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Clock className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">In Progress</h3>
            </div>
            <p className="text-3xl font-bold text-purple-600">0</p>
          </div>
        </div>

        {exam.status === 'draft' && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800">
              This exam is still in draft. You need to publish it to generate an access code for students.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
