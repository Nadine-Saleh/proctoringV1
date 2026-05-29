import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import {
  Search,
  Clock,
  TrendingUp,
  ExternalLink
} from 'lucide-react';

interface ExamOption {
  id: string;
  title: string;
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
      .select('id, title')
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
        <div className="mb-8 animate-fade-in-up">
          <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-brand-700 mb-1">
            Reports
          </div>
          <h1 className="text-3xl font-semibold text-ink-900 tracking-tight2">Exam results</h1>
          <p className="text-ink-600 mt-1">Review student submissions and grades.</p>
        </div>

        <div className="mb-6">
          <label className="field-label">Select exam</label>
          <select
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
            className="field-input max-w-md"
          >
            <option value="">Choose an exam…</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </select>
        </div>

        {selectedExam && (
          <>
            {filtered.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Submissions', value: filtered.length, tone: 'text-ink-900' },
                  { label: 'Average score', value: `${avgScore}%`, tone: 'text-ink-900' },
                  {
                    label: 'Passing (≥70%)',
                    value: filtered.filter((s) => scorePercent(s) >= 70).length,
                    tone: 'text-success-700',
                  },
                  {
                    label: 'Flagged (≥40)',
                    value: filtered.filter((s) => s.final_cheating_score >= 40).length,
                    tone: 'text-warning-700',
                  },
                ].map(({ label, value, tone }) => (
                  <div key={label} className="card p-5">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
                        {label}
                      </p>
                      {label === 'Average score' && (
                        <TrendingUp className="w-4 h-4 text-brand-700" />
                      )}
                    </div>
                    <p
                      className={`text-2xl font-semibold tabular-nums tracking-tight2 ${tone}`}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="card p-3 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full pl-10 pr-4 py-2 bg-transparent text-sm placeholder:text-ink-400 outline-none"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-sm text-ink-500">Loading submissions…</div>
            ) : error ? (
              <div className="card p-4 ring-1 ring-danger-200 text-sm text-danger-800 bg-danger-50">
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="card p-12 text-center text-sm text-ink-500">
                No submissions yet for this exam.
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-ink-50/60 border-b border-ink-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-2xs font-semibold tracking-wider text-ink-500 uppercase">
                        Student
                      </th>
                      <th className="px-6 py-3 text-center text-2xs font-semibold tracking-wider text-ink-500 uppercase">
                        Score
                      </th>
                      <th className="px-6 py-3 text-center text-2xs font-semibold tracking-wider text-ink-500 uppercase">
                        Risk
                      </th>
                      <th className="px-6 py-3 text-center text-2xs font-semibold tracking-wider text-ink-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-center text-2xs font-semibold tracking-wider text-ink-500 uppercase">
                        Submitted
                      </th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {filtered.map((sub) => {
                      const pct = scorePercent(sub);
                      const riskTone =
                        sub.final_cheating_score >= 70
                          ? 'text-danger-700'
                          : sub.final_cheating_score >= 40
                          ? 'text-warning-700'
                          : 'text-success-700';
                      return (
                        <tr key={sub.submission_id} className="hover:bg-ink-50/40 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-brand-gradient text-white flex items-center justify-center font-semibold text-sm shadow-sm">
                                {sub.student_name?.charAt(0).toUpperCase() ?? '?'}
                              </div>
                              <div>
                                <p className="font-medium text-ink-900 text-sm">
                                  {sub.student_name ?? 'Unknown'}
                                </p>
                                <p className="text-xs text-ink-500">{sub.student_email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`text-lg font-semibold tabular-nums ${getScoreColor(pct)}`}
                            >
                              {pct}%
                            </span>
                            <p className="text-2xs text-ink-400 tabular-nums">
                              {sub.auto_graded_score}/{sub.auto_graded_max}
                            </p>
                          </td>
                          <td className={`px-6 py-4 text-center text-sm font-semibold tabular-nums ${riskTone}`}>
                            {Math.round(sub.final_cheating_score)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={pct >= 70 ? 'pill pill-success' : 'pill pill-danger'}>
                              {pct >= 70 ? 'Passed' : 'Failed'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center text-xs text-ink-500">
                            <div className="flex items-center justify-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(sub.submitted_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() =>
                                navigate(
                                  `/instructor/exams/${selectedExam}/results/${sub.session_id}`
                                )
                              }
                              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
