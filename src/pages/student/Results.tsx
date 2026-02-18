import { mockResults } from '../../data/mockData';
import { Award, Calendar, CheckCircle, TrendingUp, BarChart } from 'lucide-react';

export const StudentResults = () => {
  const calculateAverage = () => {
    const total = mockResults.reduce((sum, result) => sum + result.score, 0);
    return Math.round(total / mockResults.length);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-700 border-green-200';
    if (score >= 80) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (score >= 70) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  const average = calculateAverage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Your Results</h1>
          <p className="text-lg text-gray-600">Track your exam performance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Average Score</span>
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-bold text-gray-900">{average}</span>
              <span className="text-xl text-gray-500">%</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Exams Completed</span>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-bold text-gray-900">{mockResults.length}</span>
              <span className="text-xl text-gray-500">exams</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Highest Score</span>
              <Award className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-bold text-gray-900">
                {Math.max(...mockResults.map((r) => r.score))}
              </span>
              <span className="text-xl text-gray-500">%</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Exam History</h2>
          </div>

          <div className="divide-y divide-gray-200">
            {mockResults.map((result) => (
              <div
                key={result.id}
                className="px-6 py-5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {result.examTitle}
                      </h3>
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${getScoreBadgeColor(
                          result.score
                        )}`}
                      >
                        {result.status === 'passed' ? 'Passed' : 'Failed'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-6 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(result.completedAt)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <BarChart className="w-4 h-4" />
                        <span>
                          {result.correctAnswers} / {result.totalQuestions} correct
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <div className={`text-4xl font-bold ${getScoreColor(result.score)}`}>
                        {result.score}
                        <span className="text-2xl">%</span>
                      </div>
                    </div>

                    <div className="w-24 h-24">
                      <svg className="transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="8"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke={
                            result.score >= 90
                              ? '#10b981'
                              : result.score >= 80
                              ? '#3b82f6'
                              : result.score >= 70
                              ? '#f59e0b'
                              : '#ef4444'
                          }
                          strokeWidth="8"
                          strokeDasharray={`${result.score * 2.51} 251.2`}
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
