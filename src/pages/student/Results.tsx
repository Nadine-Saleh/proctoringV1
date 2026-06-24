import { useEffect, useState } from 'react';
import { useLocation, Navigate, useNavigate } from 'react-router-dom';
import { 
  Award, 
  Calendar, 
  CheckCircle, 
  BarChart, 
  Clock, 
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  XCircle,
  FileText,
  Home
} from 'lucide-react';
import { ExamSubmissionService } from '../../services/ExamSubmissionService';
import type { ExamGrade } from '../../types/examSession';

interface SubmissionResult {
  success: boolean;
  exam_score?: number;
  exam_percentage?: number;
  total_questions?: number;
  correct_answers?: number;
  session_id?: string;
  submission_id?: string;
  grade_status?: 'auto_final' | 'partial_pending_review' | 'fully_pending_review';
}

export const StudentResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [grade, setGrade] = useState<ExamGrade | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if we have a fresh submission result from Exam.tsx
  const submissionResult = location.state?.submissionResult as SubmissionResult | undefined;

  // Load grade for the submitted session
  useEffect(() => {
    async function loadGrade() {
      if (submissionResult?.session_id) {
        try {
          const result = await ExamSubmissionService.getSessionGrade(submissionResult.session_id);
          if (result.success && result.grade) {
            setGrade(result.grade);
          }
        } catch (err) {
          console.error('[Results] Failed to load grade:', err);
          setError('Could not load your exam results.');
        }
      }
      setIsLoading(false);
    }

    loadGrade();
  }, [submissionResult]);

  const displayScore = grade?.percentage ?? submissionResult?.exam_percentage ?? 0;
  const displayCorrect = grade?.correct_answers ?? submissionResult?.correct_answers ?? 0;
  const displayTotal = grade?.total_questions ?? submissionResult?.total_questions ?? 0;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // If no submission and no grade, redirect to home
  if (!submissionResult && !grade) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ink-50 grid-spotlight flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-brand-100/50" />
            <div className="absolute inset-0 rounded-full border-4 border-t-brand-700 animate-spin" />
          </div>
          <p className="text-lg font-bold text-ink-900 tracking-tight">Generating Performance Report</p>
          <p className="text-sm text-ink-500 mt-1">Calculating scores and proctoring status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50 grid-spotlight">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Navigation */}
        <div className="mb-10 flex items-center justify-between animate-fade-in">
          <button
            onClick={() => navigate('/')}
            className="group flex items-center gap-2 text-sm font-bold text-ink-500 hover:text-brand-700 transition-colors"
          >
            <Home className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
            <span>Dashboard</span>
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-ink-300">Session Artifact</span>
            <div className="px-2 py-1 rounded bg-white border border-ink-100 text-[10px] font-mono text-ink-400">
              {submissionResult?.session_id?.slice(0, 12).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Header Hero */}
        <div className="relative mb-12 p-10 rounded-3xl bg-white border border-ink-100 shadow-2xl shadow-ink-900/5 overflow-hidden animate-fade-in-up">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-50 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-success-50 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl opacity-50" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-100 text-[10px] font-black uppercase tracking-widest mb-4">
                <Award className="w-3.5 h-3.5" />
                Performance Report
              </div>
              <h1 className="text-4xl font-black text-ink-900 tracking-tight leading-tight">
                Exam successfully submitted.
              </h1>
              <p className="text-lg text-ink-500 mt-2 max-w-lg">
                Your answers have been securely recorded and processed. Review your performance breakdown below.
              </p>
            </div>
            
            <div className="flex-shrink-0 flex flex-col items-center justify-center p-8 rounded-2xl bg-ink-900 text-white shadow-xl shadow-ink-900/20">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-ink-400 mb-2">Final Result</div>
              <div className="flex items-baseline gap-1">
                <span className="text-6xl font-black tabular-nums tracking-tighter">{displayScore}</span>
                <span className="text-2xl font-bold text-ink-400">%</span>
              </div>
              <div className={`mt-4 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${
                displayScore >= 70 ? 'bg-success-500/20 text-success-400' : 'bg-danger-500/20 text-danger-400'
              }`}>
                {displayScore >= 70 ? 'Passed' : 'Needs Review'}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-8 p-5 bg-danger-50 border-2 border-danger-100 rounded-2xl animate-scale-in flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-danger-100 flex items-center justify-center text-danger-600 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-danger-900">Information Unavailable</h3>
              <p className="text-sm text-danger-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {[
            { 
              label: 'Academic Accuracy', 
              value: `${displayCorrect}/${displayTotal}`, 
              sub: 'Questions Correct',
              icon: <CheckCircle2 className="w-4 h-4" />,
              color: 'text-success-600',
              bg: 'bg-success-50/50'
            },
            { 
              label: 'Submission Date', 
              value: formatDate(new Date().toISOString()), 
              sub: 'Date of completion',
              icon: <Calendar className="w-4 h-4" />,
              color: 'text-brand-600',
              bg: 'bg-brand-50/50'
            },
            { 
              label: 'Grade Status', 
              value: submissionResult?.grade_status === 'auto_final' ? 'Finalized' : 'Pending', 
              sub: submissionResult?.grade_status === 'auto_final' ? 'Auto-graded' : 'Needs review',
              icon: <FileText className="w-4 h-4" />,
              color: 'text-warning-600',
              bg: 'bg-warning-50/50'
            },
            { 
              label: 'Completion Time', 
              value: 'Recorded', 
              sub: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              icon: <Clock className="w-4 h-4" />,
              color: 'text-ink-600',
              bg: 'bg-ink-50'
            },
          ].map((stat) => (
            <div key={stat.label} className={`card p-6 bg-white border-ink-100 shadow-sm flex flex-col justify-between`}>
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                  {stat.icon}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-ink-300">Metrics</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-1">{stat.label}</p>
                <p className={`text-xl font-black text-ink-900 tracking-tight`}>{stat.value}</p>
                <p className="text-xs text-ink-500 font-medium mt-1">{stat.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Detailed Results */}
        {grade && grade.graded_answers.length > 0 && (
          <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-ink-900 flex items-center justify-center text-white shadow-lg">
                  <BarChart className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-ink-900 tracking-tight">Question Breakdown</h2>
                  <p className="text-xs text-ink-500 font-medium uppercase tracking-widest">In-depth accuracy analysis</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-success-500" />
                  <span className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Correct</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-danger-500" />
                  <span className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Incorrect</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {grade.graded_answers.map((answer, index) => (
                <div
                  key={answer.question_id}
                  className="group relative bg-white rounded-2xl border border-ink-100 p-6 hover:shadow-xl hover:shadow-ink-200/20 transition-all duration-300 overflow-hidden"
                >
                  {/* Status indicator bar */}
                  <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${answer.is_correct ? 'bg-success-500' : 'bg-danger-500'}`} />
                  
                  <div className="flex flex-col md:flex-row md:items-start gap-6">
                    <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-ink-50 text-ink-400 font-black text-lg tabular-nums border border-ink-100 group-hover:bg-ink-900 group-hover:text-white group-hover:border-ink-900 transition-all">
                      {(index + 1).toString().padStart(2, '0')}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-3 mb-3">
                        <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                          answer.is_correct ? 'bg-success-50 text-success-700 border-success-100' : 'bg-danger-50 text-danger-700 border-danger-100'
                        }`}>
                          {answer.is_correct ? 'Verified Correct' : 'Incorrect Response'}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-ink-300">
                          Credits: {answer.points_earned} / {answer.points_possible} PTS
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-ink-900 leading-snug mb-4">
                        {answer.question_text}
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className={`p-4 rounded-xl border transition-all ${
                          answer.is_correct ? 'bg-success-50/30 border-success-100' : 'bg-danger-50/30 border-danger-100'
                        }`}>
                          <p className="text-[9px] font-black uppercase tracking-widest text-ink-400 mb-1.5">Your Response</p>
                          <div className="flex items-center gap-2">
                            {answer.is_correct ? <CheckCircle2 className="w-4 h-4 text-success-600" /> : <XCircle className="w-4 h-4 text-danger-600" />}
                            <span className={`text-sm font-bold ${answer.is_correct ? 'text-success-800' : 'text-danger-800'}`}>
                              {answer.selected_answer !== null
                                ? `Option ${String.fromCharCode(65 + parseInt(answer.selected_answer))}`
                                : 'No input provided'}
                            </span>
                          </div>
                        </div>

                        {!answer.is_correct && answer.correct_answer !== null && (
                          <div className="p-4 rounded-xl border border-success-100 bg-success-50/30">
                            <p className="text-[9px] font-black uppercase tracking-widest text-success-600/60 mb-1.5">Correct Answer</p>
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-success-600" />
                              <span className="text-sm font-bold text-success-800">
                                Option {String.fromCharCode(65 + parseInt(answer.correct_answer))}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legacy Fallback / Summary */}
        {!grade && submissionResult && (
          <div className="card p-12 text-center bg-white shadow-xl shadow-ink-200/20 animate-fade-in">
            <div className="w-20 h-20 bg-brand-50 text-brand-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-700/5">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-ink-900 tracking-tight">Summary of Results</h3>
            <p className="text-ink-500 max-w-sm mx-auto mt-2">
              Detailed breakdown is being generated. You accurately responded to <span className="text-ink-900 font-bold">{displayCorrect}</span> out of <span className="text-ink-900 font-bold">{displayTotal}</span> questions.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <button onClick={() => navigate('/')} className="btn btn-primary px-8 py-3.5 gap-2 group">
                <Home className="w-4 h-4" />
                <span>Return to Dashboard</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {grade && (
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '400ms' }}>
            <button onClick={() => navigate('/')} className="w-full sm:w-auto btn btn-secondary px-8 py-3.5 gap-2">
              <Home className="w-4 h-4" />
              <span>Dashboard Home</span>
            </button>
            <button onClick={() => window.print()} className="w-full sm:w-auto btn btn-primary px-8 py-3.5 gap-2">
              <FileText className="w-4 h-4" />
              <span>Export as PDF</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
