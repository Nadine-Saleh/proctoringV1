import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Users,
  FileText,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Clock,
  BarChart,
  Loader
} from 'lucide-react';
import { ExamService } from '../../services/ExamService';

interface Exam {
  id: string;
  title: string;
  description: string | null;
  status: string;
  starts_at: string;
  duration_minutes: number;
  access_code: string | null;
  joined_count: number;
  in_progress_count: number;
  submitted_count: number;
}

export const InstructorDashboard = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExams = async () => {
      try {
        const result = await ExamService.listMyExams();
        if (result.success && result.exams) {
          setExams(result.exams as Exam[]);
        } else {
          setError(result.error || 'Failed to load exams');
        }
      } catch (err) {
        setError('Failed to load exams');
      } finally {
        setLoading(false);
      }
    };

    loadExams();
  }, []);

  const publishedExams = exams.filter(e => e.status === 'published');
  const totalStudents = exams.reduce((sum, e) => sum + e.joined_count, 0);
  const activeExams = publishedExams.length;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'draft':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'closed':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-lg text-gray-600">Monitor your exams and student performance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Total Students Joined</span>
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{totalStudents}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Published Exams</span>
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{activeExams}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Total Exams</span>
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{exams.length}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">In Progress</span>
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {exams.reduce((sum, e) => sum + e.in_progress_count, 0)}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">My Exams</h2>
            <Link
              to="/instructor/exams/new"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Create New
            </Link>
          </div>

          {loading ? (
            <div className="px-6 py-12 flex items-center justify-center">
              <Loader className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : exams.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500">No exams yet. Create your first exam to get started!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {exams.map((exam) => (
                <Link
                  key={exam.id}
                  to={`/instructor/exams/${exam.id}`}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors block"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{exam.title}</h3>
                      {exam.description && <p className="text-sm text-gray-500">{exam.description}</p>}
                    </div>
                    <span
                      className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                        exam.status
                      )}`}
                    >
                      {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-4 text-xs text-gray-500 flex-wrap gap-2">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(exam.starts_at)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{exam.duration_minutes} min</span>
                    </div>
                    {exam.access_code && (
                      <div className="flex items-center space-x-1 font-mono bg-blue-50 px-2 py-1 rounded">
                        <span className="text-blue-600 font-semibold">{exam.access_code}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1">
                      <Users className="w-3 h-3" />
                      <span>{exam.joined_count} joined</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <FileText className="w-3 h-3" />
                      <span>{exam.in_progress_count} in progress</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <BarChart className="w-3 h-3" />
                      <span>{exam.submitted_count} submitted</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
