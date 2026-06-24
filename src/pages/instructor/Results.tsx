import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { CustomDropdown } from '../../components/ui/CustomDropdown';
import {
  Search,
  Clock,
  TrendingUp,
  Users,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Filter,
  ArrowRight
} from 'lucide-react';

interface ExamOption {
  id: string;
  title: string;
  created_at?: string;
}

interface SubmissionRow {
  submission_id: string;
  session_id: string;
  student_name: string | null;
  student_email: string | null;
  submitted_at: string;
  grade_status: string;
  auto_graded_score: number;
  auto_graded_max: number;
  final_cheating_score: number;
}

export const InstructorResults = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('exams')
      .select('id, title, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setExams(data as ExamOption[]);
      });
  }, []);

  useEffect(() => {
    if (!selectedExam) return;
    setIsLoading(true);
    setError(null);
    (async () => {
      const { data, error: rpcErr } = await supabase
        .rpc('list_exam_submissions', { p_exam_id: selectedExam });
      if (rpcErr) { setError(rpcErr.message); }
      else { setSubmissions((data as SubmissionRow[] | null) ?? []); }
      setIsLoading(false);
    })();
  }, [selectedExam]);

  const filtered = submissions.filter(s =>
    !searchTerm ||
    (s.student_name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.student_email ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const scorePercent = (s: SubmissionRow) =>
    s.auto_graded_max > 0 ? Math.round((s.auto_graded_score / s.auto_graded_max) * 100) : 0;

  const avgScore = filtered.length > 0
    ? Math.round(filtered.reduce((a, s) => a + scorePercent(s), 0) / filtered.length)
    : 0;

  const examOptions = useMemo(() => 
    exams.map(ex => ({
      id: ex.id,
      label: ex.title,
      description: ex.created_at ? `Created ${new Date(ex.created_at).toLocaleDateString()}` : undefined,
      icon: <FileText className="w-4 h-4" />
    })), [exams]
  );

  const getScoreColor = (pct: number) =>
    pct >= 90
      ? 'text-success-700'
      : pct >= 80
      ? 'text-brand-700'
      : pct >= 70
      ? 'text-warning-700'
      : 'text-danger-700';

  return (
    <div className="min-h-screen bg-ink-50 grid-spotlight">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-10 animate-fade-in-up relative z-30">
          <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-brand-700 mb-1">
            Reports
          </div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-semibold text-ink-900 tracking-tight2">Exam results</h1>
              <p className="text-ink-600 mt-1">Review student submissions, grades, and proctoring logs.</p>
            </div>
            
            <div className="w-full max-w-sm">
              <CustomDropdown
                label="Select exam to view results"
                options={examOptions}
                value={selectedExam}
                onChange={setSelectedExam}
                placeholder="Choose an exam..."
              />
            </div>
          </div>
        </div>

        {!selectedExam ? (
          <div className="card p-16 text-center bg-white/50 backdrop-blur-sm border-dashed border-2 border-ink-200">
            <div className="w-16 h-16 bg-brand-50 text-brand-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-ink-900">No exam selected</h3>
            <p className="text-ink-500 max-w-xs mx-auto mt-2">
              Please select an exam from the dropdown above to view its results and submissions.
            </p>
          </div>
        ) : (
          <div className="animate-fade-in">
            {filtered.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { 
                    label: 'Submissions', 
                    value: filtered.length, 
                    tone: 'text-ink-900',
                    icon: <Users className="w-4 h-4 text-ink-400" />,
                    bg: 'bg-white'
                  },
                  { 
                    label: 'Average score', 
                    value: `${avgScore}%`, 
                    tone: 'text-brand-700',
                    icon: <TrendingUp className="w-4 h-4 text-brand-700" />,
                    bg: 'bg-brand-50/30'
                  },
                  {
                    label: 'Passing (≥70%)',
                    value: filtered.filter((s) => scorePercent(s) >= 70).length,
                    tone: 'text-success-700',
                    icon: <CheckCircle2 className="w-4 h-4 text-success-600" />,
                    bg: 'bg-success-50/30'
                  },
                  {
                    label: 'Flagged (Risk ≥40)',
                    value: filtered.filter((s) => s.final_cheating_score >= 40).length,
                    tone: 'text-warning-700',
                    icon: <AlertTriangle className="w-4 h-4 text-warning-600" />,
                    bg: 'bg-warning-50/30'
                  },
                ].map(({ label, value, tone, icon, bg }) => (
                  <div key={label} className={`card p-5 ${bg} border-ink-100/50`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
                        {label}
                      </p>
                      {icon}
                    </div>
                    <p className={`text-3xl font-semibold tabular-nums tracking-tight2 ${tone}`}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="card p-2 flex-1 shadow-sm">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by student name or email..."
                    className="w-full pl-10 pr-4 py-2.5 bg-transparent text-sm placeholder:text-ink-400 outline-none"
                  />
                </div>
              </div>
              <button className="btn btn-secondary px-5 gap-2 h-[52px]">
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </button>
            </div>

            {isLoading ? (
              <div className="card p-20 text-center">
                <div className="relative w-10 h-10 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-2 border-brand-100" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-brand-700 animate-spin" />
                </div>
                <p className="text-sm font-medium text-ink-600">Loading submissions...</p>
              </div>
            ) : error ? (
              <div className="card p-6 border-danger-200 text-sm text-danger-800 bg-danger-50 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-danger-600 flex-shrink-0" />
                <p>{error}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="card p-20 text-center">
                <div className="w-12 h-12 bg-ink-100 text-ink-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6" />
                </div>
                <p className="text-ink-600 font-medium">No submissions found</p>
                <p className="text-sm text-ink-400 mt-1">Try adjusting your search or filters.</p>
              </div>
            ) : (
              <div className="card overflow-hidden border-ink-100/60 shadow-lg shadow-ink-200/20">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-ink-50/80 border-b border-ink-100">
                        <th className="px-6 py-4 text-left text-2xs font-bold tracking-widest text-ink-500 uppercase">
                          Student Information
                        </th>
                        <th className="px-6 py-4 text-center text-2xs font-bold tracking-widest text-ink-500 uppercase">
                          Academic Score
                        </th>
                        <th className="px-6 py-4 text-center text-2xs font-bold tracking-widest text-ink-500 uppercase">
                          Risk Index
                        </th>
                        <th className="px-6 py-4 text-center text-2xs font-bold tracking-widest text-ink-500 uppercase">
                          Result
                        </th>
                        <th className="px-6 py-4 text-center text-2xs font-bold tracking-widest text-ink-500 uppercase">
                          Date & Time
                        </th>
                        <th className="px-6 py-4" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 bg-white">
                      {filtered.map((sub) => {
                        const pct = scorePercent(sub);
                        const riskTone =
                          sub.final_cheating_score >= 70
                            ? 'text-danger-700 bg-danger-50'
                            : sub.final_cheating_score >= 40
                            ? 'text-warning-700 bg-warning-50'
                            : 'text-success-700 bg-success-50';
                        
                        return (
                          <tr key={sub.submission_id} className="group hover:bg-brand-50/20 transition-all duration-200">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm shadow-sm border border-brand-200/50 group-hover:scale-105 transition-transform">
                                  {sub.student_name?.charAt(0).toUpperCase() ?? '?'}
                                </div>
                                <div>
                                  <p className="font-semibold text-ink-900 text-sm group-hover:text-brand-800 transition-colors">
                                    {sub.student_name ?? 'Unknown Student'}
                                  </p>
                                  <p className="text-xs text-ink-500">{sub.student_email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="inline-flex flex-col">
                                <span className={`text-xl font-bold tabular-nums tracking-tight ${getScoreColor(pct)}`}>
                                  {pct}%
                                </span>
                                <span className="text-[10px] font-medium text-ink-400 uppercase tracking-tighter tabular-nums">
                                  {sub.auto_graded_score} / {sub.auto_graded_max} PTS
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold tabular-nums min-w-[3rem] ${riskTone}`}>
                                {Math.round(sub.final_cheating_score)}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={pct >= 70 ? 'pill pill-success' : 'pill pill-danger'}>
                                {pct >= 70 ? 'Passed' : 'Failed'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="inline-flex flex-col text-xs text-ink-500">
                                <div className="flex items-center justify-center gap-1.5 font-medium text-ink-700">
                                  <Clock className="w-3.5 h-3.5 text-ink-400" />
                                  {new Date(sub.submitted_at).toLocaleDateString()}
                                </div>
                                <span className="mt-0.5 text-[10px] text-ink-400">
                                  {new Date(sub.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() =>
                                  navigate(
                                    `/instructor/exams/${selectedExam}/results/${sub.session_id}`
                                  )
                                }
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-700 hover:text-white transition-all group/btn"
                              >
                                <span>View Report</span>
                                <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-6 py-4 bg-ink-50/40 border-t border-ink-100 flex items-center justify-between">
                  <p className="text-xs text-ink-500">
                    Showing <span className="font-semibold text-ink-700">{filtered.length}</span> submissions
                  </p>
                  <div className="flex gap-2">
                    <button disabled className="btn btn-secondary py-1 text-xs opacity-50 cursor-not-allowed">Previous</button>
                    <button disabled className="btn btn-secondary py-1 text-xs opacity-50 cursor-not-allowed">Next</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

