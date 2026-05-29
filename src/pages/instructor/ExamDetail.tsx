import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Copy, Check, Calendar, Clock, Users, FileText, RefreshCw } from 'lucide-react';
import { ExamService } from '../../services/ExamService';
import type { ProctoringPolicy } from '../../types/examSession';

interface Exam {
  id: string;
  instructor_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  duration_minutes: number;
  status: 'draft' | 'published' | 'closed';
  access_code: string | null;
  proctoring_policy: ProctoringPolicy;
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
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

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
      } catch (_err) {
        setError('Failed to load exam');
      } finally {
        setLoading(false);
      }
    };

    loadExam();
  }, [examId]);

  const handleResetWindow = async () => {
    if (!exam) return;
    setResetting(true);
    setResetError(null);
    const result = await ExamService.updateExam(exam.id, {
      starts_at: new Date().toISOString(),
    });
    if (!result.success) {
      setResetError(result.error || 'Failed to reset window');
    } else {
      const refreshed = await ExamService.getExamById(exam.id);
      if (refreshed.success && refreshed.exam) setExam(refreshed.exam);
    }
    setResetting(false);
  };

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
      <div className="min-h-screen bg-ink-50 grid-spotlight flex items-center justify-center">
        <div className="text-sm text-ink-500">Loading exam details…</div>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen bg-ink-50 grid-spotlight p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-brand-700 hover:text-brand-800 mb-6 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 text-sm text-danger-800">
            {error || 'Exam not found'}
          </div>
        </div>
      </div>
    );
  }

  const statusPill =
    exam.status === 'published'
      ? 'pill pill-success'
      : exam.status === 'draft'
      ? 'pill pill-brand'
      : 'pill pill-neutral';

  return (
    <div className="min-h-screen bg-ink-50 grid-spotlight">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-brand-700 hover:text-brand-800 mb-6 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to dashboard</span>
        </button>

        <div className="card p-8 mb-6 animate-fade-in-up">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold text-ink-900 tracking-tight2 mb-1">
                {exam.title}
              </h1>
              {exam.description && (
                <p className="text-ink-600">{exam.description}</p>
              )}
            </div>
            <span className={statusPill}>
              {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <div className="flex items-center gap-2 text-ink-500 mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-2xs font-semibold uppercase tracking-wider">
                  Starts at
                </span>
              </div>
              <p className="text-base font-medium text-ink-900">{formatDate(exam.starts_at)}</p>
              {exam.status === 'published' && (() => {
                const now = Date.now();
                const start = new Date(exam.starts_at).getTime();
                const end = start + exam.duration_minutes * 60_000;
                const isOpen = now >= start && now <= end;
                const label =
                  now < start ? (
                    <span className="text-warning-700 font-medium">Window not yet open</span>
                  ) : now > end ? (
                    <span className="text-danger-700 font-medium">Window has closed</span>
                  ) : (
                    <span className="text-success-700 font-medium">
                      Window is open — students can join
                    </span>
                  );
                return (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm">{label}</p>
                      {!isOpen && (
                        <button
                          onClick={handleResetWindow}
                          disabled={resetting}
                          className="inline-flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800 disabled:opacity-50 font-medium"
                        >
                          <RefreshCw className={`w-3 h-3 ${resetting ? 'animate-spin' : ''}`} />
                          {resetting ? 'Resetting…' : 'Reset to now'}
                        </button>
                      )}
                    </div>
                    {resetError && (
                      <p className="text-xs text-danger-700 mt-1">{resetError}</p>
                    )}
                  </div>
                );
              })()}
            </div>

            <div>
              <div className="flex items-center gap-2 text-ink-500 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-2xs font-semibold uppercase tracking-wider">
                  Duration
                </span>
              </div>
              <p className="text-base font-medium text-ink-900 tabular-nums">
                {exam.duration_minutes} minutes
              </p>
            </div>
          </div>

          {exam.status === 'published' && exam.access_code && (
            <div className="rounded-xl bg-brand-50/60 border border-brand-100 p-5">
              <h2 className="text-2xs font-semibold uppercase tracking-wider text-brand-700 mb-3">
                Access code
              </h2>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-ink-600 mb-2">Share this code with your students.</p>
                  <div className="bg-white border border-brand-200 rounded-lg p-4 font-mono text-center text-2xl font-semibold text-brand-700 tracking-[0.4em]">
                    {exam.access_code}
                  </div>
                </div>
                <button
                  onClick={handleCopyAccessCode}
                  className={`btn btn-md ${
                    copied
                      ? 'bg-success-50 text-success-700 ring-1 ring-success-200'
                      : 'btn-primary'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy code</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Students joined', Icon: Users, tone: 'bg-brand-50 text-brand-700' },
            { label: 'Submissions', Icon: FileText, tone: 'bg-success-50 text-success-700' },
            { label: 'In progress', Icon: Clock, tone: 'bg-info-50 text-info-700' },
          ].map(({ label, Icon, tone }) => (
            <div key={label} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
                  {label}
                </span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-semibold text-ink-900 tabular-nums tracking-tight2">0</p>
            </div>
          ))}
        </div>

        {exam.status === 'draft' && (
          <div className="mt-6 p-4 rounded-xl bg-warning-50 border border-warning-200">
            <p className="text-sm text-warning-900">
              This exam is still a draft. Publish it to generate an access code for students.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
