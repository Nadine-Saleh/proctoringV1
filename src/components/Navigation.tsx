import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  Home,
  FileText,
  BarChart3,
  Shield,
  LogOut,
  Crown,
} from 'lucide-react';

interface NavigationProps {
  onSignOut?: () => void;
  userName?: string;
}

interface NavLink {
  to: string;
  label: string;
  icon: typeof Home;
}

export const Navigation = ({
  onSignOut,
  userName,
}: NavigationProps) => {
  const { role } = useApp();
  const location = useLocation();

  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  const studentLinks: NavLink[] = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/results', label: 'Results', icon: BarChart3 },
  ];

  const instructorLinks: NavLink[] = [
    { to: '/instructor', label: 'Dashboard', icon: Home },
    { to: '/instructor/exams/new', label: 'Create exam', icon: FileText },
    { to: '/instructor/results', label: 'Results', icon: BarChart3 },
    { to: '/instructor/proctoring', label: 'Proctoring', icon: Shield },
  ];

  const adminLinks: NavLink[] = [
    { to: '/admin', label: 'Admin Dashboard', icon: Crown },
  ];

  const links = isAdmin
    ? adminLinks
    : role === 'student'
    ? studentLinks
    : instructorLinks;

  const getInitials = () => {
    if (isAdmin) return 'AD';

    if (userName) {
      return userName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }

    return role === 'student' ? 'S' : 'I';
  };

  const handleLogout = () => {
    // admin logout
    if (isAdmin) {
      localStorage.removeItem('isAdmin');
      window.location.href = '/login';
      return;
    }

    // normal user logout
    if (onSignOut) {
      onSignOut();
    }
  };

  return (
    <nav className="bg-white/85 backdrop-blur-md border-b border-ink-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link
              to={
                isAdmin
                  ? '/admin'
                  : role === 'student'
                  ? '/'
                  : '/instructor'
              }
              className="flex items-center gap-2.5"
            >
              <div className="relative w-9 h-9 rounded-lg bg-brand-gradient flex items-center justify-center shadow-soft">
                {isAdmin ? (
                  <Crown className="w-4.5 h-4.5 text-white" />
                ) : (
                  <Shield className="w-4.5 h-4.5 text-white" />
                )}
              </div>

              <div className="leading-tight">
                <div className="text-base font-semibold text-ink-900 tracking-tight2">
                  Examify
                </div>

                <div className="text-2xs uppercase tracking-wider text-brand-700 font-semibold -mt-0.5">
                  {isAdmin
                    ? 'Admin Panel'
                    : role === 'student'
                    ? 'Student'
                    : 'Instructor'}
                </div>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-1 bg-ink-50 p-1 rounded-lg border border-ink-100">
              {links.map((link) => {
                const Icon = link.icon;

                const isActive =
                  link.to === '/' ||
                  link.to === '/instructor' ||
                  link.to === '/admin' ||
                  link.to === '/results'
                    ? location.pathname === link.to
                    : location.pathname.startsWith(link.to);

                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`
                      relative flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-medium
                      transition-all duration-150
                      ${
                        isActive
                          ? 'bg-white text-brand-800 shadow-soft'
                          : 'text-ink-600 hover:text-ink-900'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {userName && !isAdmin && (
              <div className="hidden sm:block text-right leading-tight mr-1">
                <div className="text-sm font-medium text-ink-900 truncate max-w-[140px]">
                  {userName}
                </div>

                <div className="text-2xs text-ink-500 capitalize">
                  {role}
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="hidden sm:block text-right leading-tight mr-1">
                <div className="text-sm font-medium text-red-600">
                  System Admin
                </div>

                <div className="text-2xs text-ink-500">
                  Full Access
                </div>
              </div>
            )}

            <div className="w-9 h-9 rounded-full bg-brand-gradient flex items-center justify-center text-white font-semibold text-sm shadow-soft ring-2 ring-white">
              {getInitials()}
            </div>

            {(onSignOut || isAdmin) && (
              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-ink-500 hover:text-danger-700 hover:bg-danger-50 transition-colors"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};