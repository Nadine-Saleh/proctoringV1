import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Home, FileText, BarChart3, ClipboardList, Users, Shield } from 'lucide-react';

export const Navigation = () => {
  const { role, setRole } = useApp();
  const location = useLocation();

  const studentLinks = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/results', label: 'Results', icon: BarChart3 }
  ];

  const instructorLinks = [
    { to: '/instructor', label: 'Dashboard', icon: Home },
    { to: '/instructor/create', label: 'Create Exam', icon: FileText },
    { to: '/instructor/results', label: 'Results', icon: BarChart3 },
    { to: '/instructor/proctoring', label: 'Proctoring', icon: Shield }
  ];

  const links = role === 'student' ? studentLinks : instructorLinks;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <Shield className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">ProctorPro</span>
            </div>

            <div className="hidden md:flex space-x-1">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setRole(role === 'student' ? 'instructor' : 'student')}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">
                Switch to {role === 'student' ? 'Instructor' : 'Student'}
              </span>
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                {role === 'student' ? 'S' : 'I'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
