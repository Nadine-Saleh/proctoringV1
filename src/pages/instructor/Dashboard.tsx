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
          setExams(result.exams as unknown as Exam[]);
        } else {
          setError(result.error || 'Failed to load exams');
        }
      } catch (_err) {
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

  const getStatusPill = (status: string) => {
    switch (status) {
      case 'published':
        return 'pill pill-success';
      case 'draft':
        return 'pill pill-brand';
      case 'closed':
        return 'pill pill-neutral';
      default:
        return 'pill pill-neutral';
    }
  };

  const stats = [
    {
      label: 'Students joined',
      value: totalStudents,
      Icon: Users,
      tone: 'bg-brand-50 text-brand-700',
    },
    {
      label: 'Published exams',
      value: activeExams,
      Icon: FileText,
      tone: 'bg-success-50 text-success-700',
    },
    {
      label: 'Total exams',
      value: exams.length,
      Icon: TrendingUp,
      tone: 'bg-info-50 text-info-700',
    },
    {
      label: 'In progress',
      value: exams.reduce((sum, e) => sum + e.in_progress_count, 0),
      Icon: AlertTriangle,
      tone: 'bg-warning-50 text-warning-700',
    },
  ];

  return (
    <div className="min-h-screen bg-ink-50 grid-spotlight">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 animate-fade-in-up">
          <div>
            <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-brand-700 mb-1">
              Instructor
            </div>
            <h1 className="text-3xl font-semibold text-ink-900 tracking-tight2">Dashboard</h1>
            <p className="text-ink-600 mt-1">Monitor your exams and student performance.</p>
          </div>
          <Link to="/instructor/exams/new" className="btn btn-md btn-primary">
            <FileText className="w-4 h-4" />
            Create exam
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(({ label, value, Icon, tone }) => (
            <div key={label} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
                  {label}
                </span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-semibold text-ink-900 tabular-nums tracking-tight2">
                {value}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-xl text-sm text-danger-800">
            {error}
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink-900 tracking-tight2">My exams</h2>
              <p className="text-2xs uppercase tracking-wider text-ink-500 mt-0.5">
                {exams.length} total
              </p>
            </div>
            <Link
              to="/instructor/exams/new"
              className="text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Create new →
            </Link>
          </div>

          {loading ? (
            <div className="px-6 py-12 flex items-center justify-center">
              <Loader className="w-6 h-6 text-brand-700 animate-spin" />
            </div>
          ) : exams.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-ink-700 mb-1">No exams yet</p>
              <p className="text-sm text-ink-500 mb-4">Create your first exam to get started.</p>
              <Link to="/instructor/exams/new" className="btn btn-sm btn-primary">
                <FileText className="w-3.5 h-3.5" />
                Create exam
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {exams.map((exam) => (
                <Link
                  key={exam.id}
                  to={`/instructor/exams/${exam.id}`}
                  className="block px-6 py-4 hover:bg-ink-50/50 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-2 gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-ink-900 mb-0.5 group-hover:text-brand-800 transition-colors">
                        {exam.title}
                      </h3>
                      {exam.description && (
                        <p className="text-sm text-ink-500 truncate">{exam.description}</p>
                      )}
                    </div>
                    <span className={getStatusPill(exam.status)}>
                      {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
                    </span>
                  </div>

                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-2xs text-ink-500 mt-2">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span className="tabular-nums">{formatDate(exam.starts_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span className="tabular-nums">{exam.duration_minutes} min</span>
                    </div>
                    {exam.access_code && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-2xs font-semibold bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                        {exam.access_code}
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span className="tabular-nums">{exam.joined_count} joined</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      <span className="tabular-nums">
                        {exam.in_progress_count} in progress
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BarChart className="w-3 h-3" />
                      <span className="tabular-nums">{exam.submitted_count} submitted</span>
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
