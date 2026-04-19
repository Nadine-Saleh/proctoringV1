import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase/client';
import { ViolationEventService, ExamSessionService } from '../../examSession';
import type { ViolationEvent, ViolationSummary, ExamSessionSummary } from '../../types/examSession';
import {
  AlertTriangle,
  AlertCircle,
  XCircle,
  Filter,
  Calendar,
  User,
  Eye,
  Loader2,
  CheckCircle,
  Clock,
  Bell,
  Zap,
  Activity
} from 'lucide-react';

interface LiveAlert {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  violationScore: number;
  riskLevel: string;
  events: Array<{
    type: string;
    severity: string;
    description: string;
    timestamp: string;
  }>;
  timestamp: string;
  acknowledged: boolean;
}

export const ProctoringReport = () => {
  const { user } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [examId, setExamId] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Real-time monitoring state
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);
  const [showLiveMonitoring, setShowLiveMonitoring] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Data state
  const [exams, setExams] = useState<Array<{ id: string; title: string }>>([]);
  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const [summaries, setSummaries] = useState<Record<string, ViolationSummary[]>>({});
  const [sessions, setSessions] = useState<ExamSessionSummary[]>([]);

  // Initialize WebSocket for real-time alerts
  useEffect(() => {
    if (!user) return;

    try {
      const wsUrl = `ws://localhost:4000/instructor/${user.id}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[ProctoringReport] Connected to real-time monitoring');
        setIsConnected(true);
        (window as any).instructorSocket = ws;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'critical_alert') {
            const alert: LiveAlert = {
              id: `alert_${Date.now()}`,
              examId: data.payload.examId,
              studentId: data.payload.studentId,
              studentName: '',
              violationScore: data.payload.violationScore,
              riskLevel: data.payload.violationScore >= 75 ? 'critical' : 'high',
              events: data.payload.events.map((e: any) => ({
                type: e.type,
                severity: e.severity,
                description: e.description,
                timestamp: e.timestamp
              })),
              timestamp: data.payload.timestamp,
              acknowledged: false
            };

            setLiveAlerts(prev => [alert, ...prev].slice(0, 20));
            
            // Play alert sound
            if (audioRef.current) {
              audioRef.current.play().catch(() => {});
            }

            // Show browser notification
            if (Notification.permission === 'granted') {
              new Notification('🚨 Cheating Alert', {
                body: `Student risk level: ${alert.riskLevel.toUpperCase()}`,
                icon: '/alert-icon.png'
              });
            }
          }
        } catch (err) {
          console.error('[ProctoringReport] Error processing alert:', err);
        }
      };

      ws.onclose = () => {
        console.log('[ProctoringReport] Disconnected from real-time monitoring');
        setIsConnected(false);
      };

      ws.onerror = (error) => {
        console.error('[ProctoringReport] WebSocket error:', error);
        setIsConnected(false);
      };

      // Request notification permission
      if (Notification.permission !== 'granted') {
        Notification.requestPermission();
      }

      return () => {
        if (wsRef.current) {
          wsRef.current.close();
        }
      };
    } catch (err) {
      console.error('[ProctoringReport] Failed to connect to WebSocket:', err);
    }
  }, [user]);

  // Load instructor's exams
  useEffect(() => {
    if (!user) return;

    async function loadExams() {
      try {
        const { data, error } = await supabase
          .from('exams')
          .select('id, title')
          .eq('instructor_id', user!.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[ProctoringReport] Failed to load exams:', error);
          return;
        }

        setExams(data || []);
      } catch (err) {
        console.error('[ProctoringReport] Error loading exams:', err);
      }
    }

    loadExams();
  }, [user]);

  // Load violations when exam is selected
  useEffect(() => {
    if (examId === 'all') {
      setViolations([]);
      setSummaries({});
      setSessions([]);
      setIsLoading(false);
      return;
    }

    async function loadData() {
      setIsLoading(true);

      try {
        // Load violations
        const violationsResult = await ViolationEventService.getByExam(examId);
        if (violationsResult.success) {
          setViolations(violationsResult.events || []);
        }

        // Load sessions with student info
        const sessionsResult = await ExamSessionService.getByExam(examId);
        if (sessionsResult.success) {
          setSessions(sessionsResult.summaries || []);
        }

        // Load summaries for each session
        const sessionIds = sessionsResult.summaries?.map(s => s.session_id) || [];
        const newSummaries: Record<string, ViolationSummary[]> = {};

        for (const sessionId of sessionIds) {
          const summaryResult = await ViolationEventService.getSummaryBySession(sessionId);
          if (summaryResult.success && summaryResult.summaries) {
            newSummaries[sessionId] = summaryResult.summaries;
          }
        }

        setSummaries(newSummaries);
      } catch (err) {
        console.error('[ProctoringReport] Error loading data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [examId]);

  // Filter violations
  const filteredViolations = violations.filter(v => {
    if (severityFilter !== 'all' && getSeverityLabel(v.severity) !== severityFilter) return false;
    if (typeFilter !== 'all' && v.violation_type !== typeFilter) return false;
    return true;
  });

  // Calculate stats
  const criticalCount = violations.filter(v => v.severity >= 20).length;
  const highCount = violations.filter(v => v.severity >= 15 && v.severity < 20).length;
  const totalUniqueStudents = new Set(violations.map(v => v.session_id)).size;

  // Get unique violation types
  const violationTypes = [...new Set(violations.map(v => v.violation_type))];

  const getSeverityLabel = (severity: number): string =>
    severity >= 20 ? 'critical' : severity >= 15 ? 'high' : severity >= 10 ? 'medium' : 'low';

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'high': return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'medium': return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      default: return <AlertCircle className="w-5 h-5 text-blue-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const formatViolationType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} mins ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
  };

  const getStudentName = (studentId: string) => {
    const session = sessions.find(s => s.student_id === studentId);
    return session?.student_name || 'Unknown Student';
  };

  const acknowledgeAlert = (alertId: string) => {
    setLiveAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, acknowledged: true } : a
    ));
  };

  if (isLoading && examId !== 'all') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading violation data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Hidden audio for alert sounds */}
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU" preload="auto" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Proctoring Report</h1>
              <p className="text-lg text-gray-600">Monitor flagged events and suspicious activities</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                <Activity className={`w-5 h-5 ${isConnected ? 'animate-pulse' : ''}`} />
                <span className="font-medium">{isConnected ? 'Live Monitoring Active' : 'Disconnected'}</span>
              </div>
              <button
                onClick={() => setShowLiveMonitoring(!showLiveMonitoring)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium ${
                  showLiveMonitoring ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                <Bell className="w-5 h-5" />
                <span>Live Alerts ({liveAlerts.filter(a => !a.acknowledged).length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Alerts Panel */}
        {showLiveMonitoring && liveAlerts.length > 0 && (
          <div className="mb-8 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Zap className="w-6 h-6 text-red-600 animate-pulse" />
                <h2 className="text-xl font-bold text-red-800">Live Cheating Alerts</h2>
                <span className="px-3 py-1 bg-red-600 text-white text-sm font-bold rounded-full">
                  {liveAlerts.filter(a => !a.acknowledged).length} New
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {liveAlerts.slice(0, 5).map(alert => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    alert.acknowledged 
                      ? 'bg-gray-100 border-gray-300 opacity-60' 
                      : 'bg-white border-red-300 shadow-lg'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                        alert.riskLevel === 'critical' ? 'bg-red-600' : 'bg-orange-600'
                      }`}>
                        {alert.studentName?.charAt(0) || 'S'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-bold text-gray-900">
                            {alert.studentName || `Student ${alert.studentId.slice(0, 8)}`}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            alert.riskLevel === 'critical' 
                              ? 'bg-red-600 text-white' 
                              : 'bg-orange-600 text-white'
                          }`}>
                            {alert.riskLevel.toUpperCase()} RISK
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-sm text-gray-600">
                            Score: <span className="font-bold text-red-600">{alert.violationScore}/100</span>
                          </span>
                          <span className="text-sm text-gray-600">{formatTimeAgo(alert.timestamp)}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {alert.events.slice(0, 3).map((event, idx) => (
                            <span key={idx} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                              {event.type.replace('_', ' ').toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      disabled={alert.acknowledged}
                      className={`px-4 py-2 rounded-lg font-medium ${
                        alert.acknowledged
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {alert.acknowledged ? 'Acknowledged' : 'Acknowledge'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exam Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Exam</label>
          <select
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            className="w-full max-w-md px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Exams</option>
            {exams.map(exam => (
              <option key={exam.id} value={exam.id}>{exam.title}</option>
            ))}
          </select>
        </div>

        {examId === 'all' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Select an Exam</h3>
            <p className="text-gray-600">Choose an exam to view violation data and proctoring reports.</p>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">Total Violations</span>
                  <AlertCircle className="w-4 h-4 text-gray-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{violations.length}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">Critical</span>
                  <XCircle className="w-4 h-4 text-red-600" />
                </div>
                <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">High</span>
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                </div>
                <div className="text-2xl font-bold text-orange-600">{highCount}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">Students Flagged</span>
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-blue-600">{totalUniqueStudents}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">Active Sessions</span>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {sessions.filter(s => s.status === 'in_progress').length}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">Live Alerts</span>
                  <Bell className="w-4 h-4 text-red-600" />
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {liveAlerts.filter(a => !a.acknowledged).length}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
              <div className="flex items-center space-x-4">
                <div className="relative flex-1">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="w-full pl-11 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                  >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="relative flex-1">
                  <Eye className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full pl-11 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                  >
                    <option value="all">All Types</option>
                    {violationTypes.map(type => (
                      <option key={type} value={type}>{formatViolationType(type)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Session Summaries */}
            {sessions.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Student Sessions</h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {sessions.map(session => {
                    const sessionViolations = violations.filter(v => v.session_id === session.session_id);
                    const sessionSummary = summaries[session.session_id];

                    return (
                      <div key={session.session_id} className="px-6 py-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                              {session.student_name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{session.student_name}</h3>
                              <p className="text-sm text-gray-500">{session.student_email}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                              session.status === 'in_progress' ? 'bg-green-100 text-green-700 border-green-200' :
                              session.status === 'submitted' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                              session.status === 'terminated' ? 'bg-red-100 text-red-700 border-red-200' :
                              'bg-gray-100 text-gray-700 border-gray-200'
                            }`}>
                              {session.status.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className="text-sm font-semibold text-gray-900">
                              {sessionViolations.length} violations
                            </span>
                          </div>
                        </div>

                        {/* Violation breakdown for this session */}
                        {sessionSummary && sessionSummary.length > 0 && (
                          <div className="ml-13 pl-13">
                            <div className="flex flex-wrap gap-2">
                              {sessionSummary.map(summary => (
                                <span
                                  key={summary.violation_type}
                                  className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(getSeverityLabel(summary.severity as unknown as number))}`}
                                >
                                  {formatViolationType(summary.violation_type)}: {summary.count}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Violation Timeline */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Violation Timeline</h2>
              </div>

              {filteredViolations.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No violations match the selected filters</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredViolations.slice(0, 50).map((violation) => (
                    <div key={violation.id} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-start space-x-4">
                        <div className="flex flex-col items-center space-y-2 mt-1">
                          {getSeverityIcon(getSeverityLabel(violation.severity))}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-1">
                            <h3 className="text-sm font-semibold text-gray-900">
                              {formatViolationType(violation.violation_type)}
                            </h3>
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${getSeverityColor(getSeverityLabel(violation.severity))}`}>
                              {getSeverityLabel(violation.severity)}
                            </span>
                            {violation.duration_ms && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                <Clock className="w-3 h-3 mr-1" />
                                {Math.round(violation.duration_ms / 1000)}s
                              </span>
                            )}
                          </div>

                          {violation.description && (
                            <p className="text-sm text-gray-600 mb-2">{violation.description}</p>
                          )}

                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <div className="flex items-center space-x-1">
                              <User className="w-3 h-3" />
                              <span>{getStudentName(violation.student_id ?? '')}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatTimestamp(violation.occurred_at)}</span>
                            </div>
                            {violation.is_reviewed && (
                              <span className="flex items-center space-x-1 text-green-600">
                                <CheckCircle className="w-3 h-3" />
                                <span>Reviewed</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filteredViolations.length > 50 && (
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-center">
                  <p className="text-sm text-gray-600">
                    Showing 50 of {filteredViolations.length} violations
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
