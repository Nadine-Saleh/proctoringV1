import { useNavigate } from 'react-router-dom';
import { mockExams } from '../../data/mockData';
import { Clock, FileText, Calendar, ChevronRight, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const StudentHome = () => {
  const navigate = useNavigate();
  const { setCurrentExam } = useApp();

  const handleStartExam = (exam: any) => {
    setCurrentExam(exam);
    navigate('/exam');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'upcoming':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'completed':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome back!</h1>
          <p className="text-lg text-gray-600">Here are your scheduled exams</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Proctoring Information</h3>
            <p className="text-sm text-blue-700">
              All exams are monitored using AI proctoring. Please ensure your camera and microphone
              are enabled, and you're in a quiet, well-lit environment before starting.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockExams.map((exam) => (
            <div
              key={exam.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <span
                      className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border mb-3 ${getStatusColor(
                        exam.status
                      )}`}
                    >
                      {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
                    </span>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{exam.title}</h3>
                    <p className="text-sm text-gray-500">{exam.subject}</p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                    {formatDate(exam.startDate)}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="w-4 h-4 mr-2 text-gray-400" />
                    {exam.duration} minutes
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <FileText className="w-4 h-4 mr-2 text-gray-400" />
                    {exam.questions} questions
                  </div>
                </div>

                <button
                  onClick={() => handleStartExam(exam)}
                  disabled={exam.status !== 'available'}
                  className={`w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors ${
                    exam.status === 'available'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <span>{exam.status === 'completed' ? 'Completed' : 'Start Exam'}</span>
                  {exam.status === 'available' && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
