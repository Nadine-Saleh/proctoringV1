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
    pct >= 90 ? 'text-green-600' : pct >= 80 ? 'text-blue-600' : pct >= 70 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Exam Results</h1>
          <p className="text-lg text-gray-600">Review student submissions and grades</p>
        </div>

        {/* Exam selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Exam</label>
          <select
            value={selectedExam}
            onChange={e => setSelectedExam(e.target.value)}
            className="w-full max-w-md px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Choose an exam…</option>
            {exams.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.title}</option>
            ))}
          </select>
        </div>

        {selectedExam && (
          <>
            {/* Stats */}
            {filtered.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 mb-1">Submissions</p>
                  <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-500">Avg Score</p>
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{avgScore}%</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 mb-1">Passing (≥70%)</p>
                  <p className="text-2xl font-bold text-green-600">
                    {filtered.filter(s => scorePercent(s) >= 70).length}
                  </p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 mb-1">Flagged (Score≥40)</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {filtered.filter(s => s.final_cheating_score >= 40).length}
                  </p>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full pl-11 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Loading submissions…</div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
                No submissions yet for this exam.
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Student</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Score</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Risk</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Submitted</th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(sub => {
                      const pct = scorePercent(sub);
                      return (
                        <tr key={sub.submission_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm">
                                {sub.student_name?.charAt(0) ?? '?'}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{sub.student_name ?? 'Unknown'}</p>
                                <p className="text-xs text-gray-500">{sub.student_email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`text-lg font-bold ${getScoreColor(pct)}`}>{pct}%</span>
                            <p className="text-xs text-gray-400">{sub.auto_graded_score}/{sub.auto_graded_max}</p>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`text-sm font-semibold ${sub.final_cheating_score >= 70 ? 'text-red-600' : sub.final_cheating_score >= 40 ? 'text-amber-600' : 'text-green-600'}`}>
                              {Math.round(sub.final_cheating_score)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${pct >= 70 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {pct >= 70 ? 'Passed' : 'Failed'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center text-xs text-gray-500">
                            <div className="flex items-center justify-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(sub.submitted_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => navigate(`/instructor/exams/${selectedExam}/results/${sub.session_id}`)}
                              className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
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
