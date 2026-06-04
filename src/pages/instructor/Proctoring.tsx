import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase/client';
import { ViolationEventService, ExamSessionService } from '../../examSession';
import { EvidenceSnippetService } from '../../services/EvidenceSnippetService';
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
  Activity,
  ArrowLeftRight,
  Camera
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

interface GroupedTimelineEvent {
  id: string;
  type: string;
  severity: number;
  startTime: string;
  endTime: string;
  durationMs: number;
  description: string;
  is_reviewed: boolean;
  instructor_note: string | null;
  evidence_image: string | null;
  evidence?: ViolationEvent['evidence'];
  eventIds: string[];
  session_id: string;
  student_id?: string;
}

const groupViolationsAcrossStudents = (events: ViolationEvent[]): GroupedTimelineEvent[] => {
  if (events.length === 0) return [];

  // Sort by time ascending
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurred_at || a.client_captured_at).getTime() - 
              new Date(b.occurred_at || b.client_captured_at).getTime()
  );

  const groups: GroupedTimelineEvent[] = [];
  // Track last group per session_id and type
  const lastGroupPerStudentType: Record<string, GroupedTimelineEvent> = {};

  for (const ev of sorted) {
    const evTime = new Date(ev.occurred_at || ev.client_captured_at).getTime();
    const evType = ev.violation_type || ev.type;
    const key = `${ev.session_id}:${evType}`;
    
    const currentGroup = lastGroupPerStudentType[key];

    if (
      currentGroup &&
      evTime - new Date(currentGroup.endTime).getTime() < 30000 // 30 second threshold
    ) {
      // Merge into current group
      currentGroup.endTime = ev.occurred_at || ev.client_captured_at;
      currentGroup.durationMs =
        new Date(currentGroup.endTime).getTime() - new Date(currentGroup.startTime).getTime();
      currentGroup.eventIds.push(ev.id);
      
      if (!currentGroup.evidence_image && ev.evidence_image) {
        currentGroup.evidence_image = ev.evidence_image;
        currentGroup.id = ev.id;
      }
      if (!currentGroup.evidence && ev.evidence) {
        currentGroup.evidence = ev.evidence;
        currentGroup.id = ev.id;
      }
      if (ev.is_reviewed) currentGroup.is_reviewed = true;
    } else {
      // Start new group
      const newGroup: GroupedTimelineEvent = {
        id: ev.id,
        type: evType,
        severity: ev.severity,
        startTime: ev.occurred_at || ev.client_captured_at,
        endTime: ev.occurred_at || ev.client_captured_at,
        durationMs: ev.duration_ms || 0,
        description: ev.description || '',
        is_reviewed: ev.is_reviewed,
        instructor_note: ev.instructor_note || null,
        evidence_image: ev.evidence_image || null,
        evidence: ev.evidence,
        eventIds: [ev.id],
        session_id: ev.session_id,
        student_id: ev.student_id,
      };
      groups.push(newGroup);
      lastGroupPerStudentType[key] = newGroup;
    }
  }

  // Sort back to descending for timeline
  return groups.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
};

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
  const [sessionScores, setSessionScores] = useState<Record<string, number>>({});
  // FR-020a: instructor-invoked termination confirmation (null = no dialog open)
  const [confirmTerminateId, setConfirmTerminateId] = useState<string | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Data state
  const [exams, setExams] = useState<Array<{ id: string; title: string }>>([]);
  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const [evidenceUrls, setEvidenceUrls] = useState<Record<string, string>>({});
  const [summaries, setSummaries] = useState<Record<string, ViolationSummary[]>>({});
  const [sessions, setSessions] = useState<ExamSessionSummary[]>([]);
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [isGroupedByStudent, setIsGroupedByStudent] = useState(false);
  const sessionsRef = useRef<ExamSessionSummary[]>([]);
  const sessionScoresRef = useRef<Record<string, number>>({});
  const violationsRef = useRef<ViolationEvent[]>([]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    sessionScoresRef.current = sessionScores;
  }, [sessionScores]);

  useEffect(() => {
    violationsRef.current = violations;
  }, [violations]);

  // T063: Subscribe to Supabase Realtime oversight channel for the selected exam
  useEffect(() => {
    // Clean up previous channel
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
      setIsConnected(false);
    }

    if (!user || examId === 'all') return;

    const channelName = `oversight:exam:${examId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'exam_sessions', filter: `exam_id=eq.${examId}` },
        (payload) => {
          const row = payload.new as { id: string; live_cheating_score: number; status: string; student_id: string };
          setSessionScores(prev => ({ ...prev, [row.id]: row.live_cheating_score }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'violation_events' },
        (payload) => {
          const newEvent = payload.new as ViolationEvent;
          // Only add if it belongs to one of our active sessions for this exam
          const isOurSession = sessionsRef.current.some(s => s.session_id === newEvent.session_id);
          if (isOurSession) {
            setViolations(prev => {
              // Deduplicate just in case
              if (prev.some(v => v.id === newEvent.id || v.client_event_id === newEvent.client_event_id)) {
                return prev;
              }
              return [newEvent, ...prev].slice(0, 1000);
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'instructor_alerts', filter: `exam_id=eq.${examId}` },
        (payload) => {
          const row = payload.new as {
            id: string;
            session_id: string;
            reason: string;
            raised_at: string;
          };

          const session = sessionsRef.current.find(s => s.session_id === row.session_id);
          const alert: LiveAlert = {
            id: row.id,
            examId: examId,
            studentId: session?.student_id ?? '',
            studentName: session?.student_name ?? 'Unknown Student',
            violationScore: sessionScoresRef.current[row.session_id] ?? 0,
            riskLevel: row.reason === 'critical_score_sustained' ? 'critical' : 'high',
            events: [{ type: row.reason, severity: 'high', description: row.reason.replace(/_/g, ' '), timestamp: row.raised_at }],
            timestamp: row.raised_at,
            acknowledged: false,
          };

          setLiveAlerts(prev => [alert, ...prev].slice(0, 20));

          if (audioRef.current) audioRef.current.play().catch(() => {});
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Proctoring Alert', {
              body: `${alert.studentName}: ${row.reason.replace(/_/g, ' ')}`,
            });
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    realtimeChannelRef.current = channel;

    // Request notification permission
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    // Reconciliation on (re)connect: fetch current session scores
    supabase
      .from('exam_sessions')
      .select('id, live_cheating_score')
      .eq('exam_id', examId)
      .then(({ data }) => {
        if (data) {
          const scores: Record<string, number> = {};
          for (const s of data) scores[s.id] = s.live_cheating_score ?? 0;
          setSessionScores(scores);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      realtimeChannelRef.current = null;
      setIsConnected(false);
    };
  }, [user, examId]);

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

  const getSeverityLabel = (severity: number): string =>
    severity >= 20 ? 'critical' : severity >= 15 ? 'high' : severity >= 10 ? 'medium' : 'low';

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-5 h-5 text-danger-600" />;
      case 'high': return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'medium': return <AlertCircle className="w-5 h-5 text-warning-600" />;
      default: return <AlertCircle className="w-5 h-5 text-brand-700" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-danger-100 text-danger-700 border-danger-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-warning-100 text-warning-700 border-warning-200';
      default: return 'bg-brand-100 text-brand-800 border-brand-200';
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

  const getViolationType = (violation: ViolationEvent) => violation.violation_type ?? violation.type;

  const getViolationTimestamp = (violation: ViolationEvent) =>
    violation.occurred_at ?? violation.client_captured_at;

  const getViolationStudentName = (violation: ViolationEvent | GroupedTimelineEvent) => {
    const session = sessions.find(s => s.session_id === violation.session_id);
    if (session) return session.student_name;
    return violation.student_id ? getStudentName(violation.student_id) : 'Unknown Student';
  };

  const renderViolationRow = (violation: GroupedTimelineEvent) => (
    <div key={violation.id} className="px-6 py-4 hover:bg-ink-50">
      <div className="flex items-start space-x-4">
        <div className="flex flex-col items-center space-y-2 mt-1">
          {getSeverityIcon(getSeverityLabel(violation.severity))}
        </div>

        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-1 flex-wrap gap-y-1">
            <h3 className="text-sm font-semibold text-ink-900">
              {formatViolationType(violation.type)}
            </h3>
            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${getSeverityColor(getSeverityLabel(violation.severity))}`}>
              {getSeverityLabel(violation.severity)}
            </span>
            {violation.durationMs > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-ink-100 text-ink-700 uppercase tracking-tight">
                <Clock className="w-3 h-3 mr-1" />
                {Math.round(violation.durationMs / 1000)}s
              </span>
            )}
            {violation.eventIds.length > 1 && (
              <span className="text-[10px] px-2 py-0.5 bg-brand-50 text-brand-700 border border-brand-100 rounded font-bold uppercase tracking-tight">
                {violation.eventIds.length} Alerts Merged
              </span>
            )}
          </div>

          {violation.description && (
            <p className="text-sm text-ink-600 mb-2">
              {violation.description}
            </p>
          )}

          <div className="flex items-center space-x-4 text-xs text-ink-500">
            <div className="flex items-center space-x-1">
              <User className="w-3 h-3" />
              <span>{getViolationStudentName(violation)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="w-3 h-3" />
              <span>
                {formatTimestamp(violation.startTime)}
                {violation.durationMs > 0 && ` — ${new Date(violation.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </span>
            </div>
            {violation.is_reviewed && (
              <span className="flex items-center space-x-1 text-success-600 font-medium">
                <CheckCircle className="w-3 h-3" />
                <span>Reviewed</span>
              </span>
            )}
          </div>

          {/* Evidence preview */}
          {expandedEvidence === violation.id && (evidenceUrls[violation.id] || violation.evidence_image) && (
            <div className="mt-3 inline-block animate-fade-in">
              <img
                src={evidenceUrls[violation.id] || violation.evidence_image!}
                alt="Violation evidence snapshot"
                className="max-w-xs rounded-lg border border-ink-200 shadow-sm"
              />
              {evidenceUrls[violation.id] && (
                <p className="text-[10px] text-ink-400 mt-1 uppercase tracking-tight">Secure Storage Artifact</p>
              )}
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          {(evidenceUrls[violation.id] || violation.evidence_image) && (
            <button
              onClick={() => setExpandedEvidence(prev => (prev === violation.id ? null : violation.id))}
              className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-100 transition-colors"
              title={expandedEvidence === violation.id ? 'Hide evidence' : 'View evidence snapshot'}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{expandedEvidence === violation.id ? 'Hide' : 'Evidence'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Group all violations first (anti-spam)
  const groupedTimelineEvents = useMemo(() => {
    return groupViolationsAcrossStudents(violations);
  }, [violations]);

  // Filter grouped violations
  const filteredGroupedEvents = useMemo(() => {
    return groupedTimelineEvents.filter(v => {
      if (severityFilter !== 'all' && getSeverityLabel(v.severity) !== severityFilter) return false;
      if (typeFilter !== 'all' && v.type !== typeFilter) return false;
      if (studentSearch.trim() !== '') {
        const name = getViolationStudentName(v)?.toLowerCase() || '';
        if (!name.includes(studentSearch.toLowerCase())) return false;
      }
      return true;
    });
  }, [groupedTimelineEvents, severityFilter, typeFilter, studentSearch, sessions]);

  // Group by student if enabled
  const studentBuckets = useMemo(() => {
    if (!isGroupedByStudent) return null;
    return filteredGroupedEvents.reduce((acc, v) => {
      const studentName = getViolationStudentName(v) || 'Unknown Student';
      if (!acc[studentName]) acc[studentName] = [];
      acc[studentName].push(v);
      return acc;
    }, {} as Record<string, GroupedTimelineEvent[]>);
  }, [filteredGroupedEvents, isGroupedByStudent, sessions]);

  // Calculate stats
  const criticalCount = violations.filter(v => v.severity >= 20).length;
  const highCount = violations.filter(v => v.severity >= 15 && v.severity < 20).length;
  const totalUniqueStudents = new Set(violations.map(v => v.session_id)).size;

  // Get unique violation types
  const violationTypes = [...new Set(violations.map(getViolationType))];

  const acknowledgeAlert = (alertId: string) => {
    setLiveAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, acknowledged: true } : a
    ));
  };

  // FR-020a: confirm then terminate session via instructor-invoked control
  const handleTerminateConfirmed = async () => {
    if (!confirmTerminateId) return;
    const sessionId = confirmTerminateId;
    setConfirmTerminateId(null);
    const result = await ExamSessionService.terminateByInstructor(sessionId);
    if (result.success) {
      setSessions(prev =>
        prev.map(s => s.session_id === sessionId ? { ...s, status: 'terminated' } : s)
      );
    }
  };

  if (isLoading && examId !== 'all') {
    return (
      <div className="min-h-screen bg-ink-50 grid-spotlight flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-700 mx-auto mb-4" />
          <p className="text-ink-600">Loading violation data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50 grid-spotlight">
      {/* Hidden audio for alert sounds */}
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU" preload="auto" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-ink-900 mb-2">Proctoring Report</h1>
              <p className="text-lg text-ink-600">Monitor flagged events and suspicious activities</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                isConnected ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-700'
              }`}>
                <Activity className={`w-5 h-5 ${isConnected ? 'animate-pulse' : ''}`} />
                <span className="font-medium">{isConnected ? 'Live Monitoring Active' : 'Disconnected'}</span>
              </div>
              <button
                onClick={() => setShowLiveMonitoring(!showLiveMonitoring)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium ${
                  showLiveMonitoring ? 'bg-brand-700 text-white' : 'bg-ink-200 text-ink-700'
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
          <div className="mb-8 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-danger-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Zap className="w-6 h-6 text-danger-600 animate-pulse" />
                <h2 className="text-xl font-bold text-danger-800">Live Cheating Alerts</h2>
                <span className="px-3 py-1 bg-danger-600 text-white text-sm font-bold rounded-full">
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
                      ? 'bg-ink-100 border-ink-200 opacity-60' 
                      : 'bg-white border-danger-200 shadow-lg'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                        alert.riskLevel === 'critical' ? 'bg-danger-600' : 'bg-orange-600'
                      }`}>
                        {alert.studentName?.charAt(0) || 'S'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-bold text-ink-900">
                            {alert.studentName || `Student ${alert.studentId.slice(0, 8)}`}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            alert.riskLevel === 'critical' 
                              ? 'bg-danger-600 text-white' 
                              : 'bg-orange-600 text-white'
                          }`}>
                            {alert.riskLevel.toUpperCase()} RISK
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-sm text-ink-600">
                            Score: <span className="font-bold text-danger-600">{alert.violationScore}/100</span>
                          </span>
                          <span className="text-sm text-ink-600">{formatTimeAgo(alert.timestamp)}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {alert.events.slice(0, 3).map((event, idx) => (
                            <span key={idx} className="text-xs px-2 py-1 bg-danger-100 text-danger-700 rounded">
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
                          ? 'bg-ink-200 text-ink-500 cursor-not-allowed'
                          : 'bg-success-600 text-white hover:bg-success-700'
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
          <label className="block text-sm font-medium text-ink-700 mb-2">Select Exam</label>
          <select
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            className="w-full max-w-md px-4 py-3 border border-ink-200 rounded-lg focus:ring-2 focus:ring-brand-700/30 focus:border-transparent"
          >
            <option value="all">All Exams</option>
            {exams.map(exam => (
              <option key={exam.id} value={exam.id}>{exam.title}</option>
            ))}
          </select>
        </div>

        {examId === 'all' ? (
          <div className="bg-white rounded-xl shadow-sm border border-ink-100 p-12 text-center">
            <Filter className="w-12 h-12 text-ink-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-ink-900 mb-2">Select an Exam</h3>
            <p className="text-ink-600">Choose an exam to view violation data and proctoring reports.</p>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-ink-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-ink-600">Total Violations</span>
                  <AlertCircle className="w-4 h-4 text-ink-600" />
                </div>
                <div className="text-2xl font-bold text-ink-900">{violations.length}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-ink-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-ink-600">Critical</span>
                  <XCircle className="w-4 h-4 text-danger-600" />
                </div>
                <div className="text-2xl font-bold text-danger-600">{criticalCount}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-ink-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-ink-600">High</span>
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                </div>
                <div className="text-2xl font-bold text-orange-600">{highCount}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-ink-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-ink-600">Students Flagged</span>
                  <User className="w-4 h-4 text-brand-700" />
                </div>
                <div className="text-2xl font-bold text-brand-700">{totalUniqueStudents}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-ink-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-ink-600">Active Sessions</span>
                  <CheckCircle className="w-4 h-4 text-success-600" />
                </div>
                <div className="text-2xl font-bold text-success-600">
                  {sessions.filter(s => s.status === 'in_progress').length}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-ink-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-ink-600">Live Alerts</span>
                  <Bell className="w-4 h-4 text-danger-600" />
                </div>
                <div className="text-2xl font-bold text-danger-600">
                  {liveAlerts.filter(a => !a.acknowledged).length}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-ink-100 p-4 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-400" />
                  <input
                    type="text"
                    placeholder="Search student name..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-2 border border-ink-200 rounded-lg focus:ring-2 focus:ring-brand-700/30 focus:border-transparent"
                  />
                </div>
                <div className="relative w-full md:w-48">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-400" />
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="w-full pl-11 pr-4 py-2 border border-ink-200 rounded-lg focus:ring-2 focus:ring-brand-700/30 focus:border-transparent appearance-none bg-white"
                  >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="relative w-full md:w-48">
                  <Eye className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-400" />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full pl-11 pr-4 py-2 border border-ink-200 rounded-lg focus:ring-2 focus:ring-brand-700/30 focus:border-transparent appearance-none bg-white"
                  >
                    <option value="all">All Types</option>
                    {violationTypes.map(type => (
                      <option key={type} value={type}>{formatViolationType(type)}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setIsGroupedByStudent(!isGroupedByStudent)}
                  className={`px-4 py-2 rounded-lg font-medium border transition-all ${
                    isGroupedByStudent 
                      ? 'bg-brand-50 border-brand-200 text-brand-700' 
                      : 'bg-white border-ink-200 text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  {isGroupedByStudent ? 'Ungroup' : 'Group by Student'}
                </button>
              </div>
            </div>

            {/* Session Summaries */}
            {sessions.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-ink-100 overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-ink-100">
                  <h2 className="text-xl font-semibold text-ink-900">Student Sessions</h2>
                </div>
                <div className="divide-y divide-ink-100">
                  {sessions.map(session => {
                    const sessionViolations = violations.filter(v => v.session_id === session.session_id);
                    const sessionSummary = summaries[session.session_id];

                    return (
                      <div key={session.session_id} className="px-6 py-4 hover:bg-ink-50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-600 to-brand-700 flex items-center justify-center text-white font-semibold">
                              {session.student_name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-ink-900">{session.student_name}</h3>
                                {session.calibration_skipped && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200"
                                    title="Distance calibration was skipped — violations measured against 50 cm ± 20 cm default"
                                  >
                                    <ArrowLeftRight className="w-3 h-3" />
                                    Calibration skipped
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-ink-500">
                                {session.student_email}
                                {!session.calibration_skipped && session.optimal_distance_cm != null && (
                                  <span className="ml-2 text-xs text-ink-400">
                                    Baseline: {session.optimal_distance_cm} cm
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            {/* T063: Live score tile updated via Realtime */}
                            {session.status === 'in_progress' && (
                              <div className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                                (sessionScores[session.session_id] ?? 0) >= 70
                                  ? 'bg-danger-100 text-danger-700 border-danger-200'
                                  : (sessionScores[session.session_id] ?? 0) >= 40
                                  ? 'bg-warning-100 text-warning-700 border-warning-200'
                                  : 'bg-success-100 text-success-700 border-success-200'
                              }`}>
                                <span>Score: </span>
                                <span data-testid="student-score">
                                  {Math.round(sessionScores[session.session_id] ?? 0)}
                                </span>
                              </div>
                            )}
                            {/* FR-020a: Explicit instructor-invoked termination control */}
                            {session.status === 'in_progress' && (
                              <button
                                onClick={() => setConfirmTerminateId(session.session_id)}
                                className="flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-semibold bg-danger-600 text-white hover:bg-danger-700 border border-red-700"
                                title="Terminate this session"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Terminate</span>
                              </button>
                            )}
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                              session.status === 'in_progress' ? 'bg-success-100 text-success-700 border-success-200' :
                              session.status === 'submitted' ? 'bg-brand-100 text-brand-800 border-brand-200' :
                              session.status === 'terminated' ? 'bg-danger-100 text-danger-700 border-danger-200' :
                              'bg-ink-100 text-ink-700 border-ink-100'
                            }`}>
                              {session.status.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className="text-sm font-semibold text-ink-900">
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
            <div className="bg-white rounded-xl shadow-sm border border-ink-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-ink-900">Violation Timeline</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink-500">{filteredGroupedEvents.length} grouped events</span>
                  <span className="text-[10px] text-ink-300 font-medium">({violations.length} total raw)</span>
                </div>
              </div>

              {filteredGroupedEvents.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <AlertCircle className="w-12 h-12 text-ink-400 mx-auto mb-4" />
                  <p className="text-ink-600">No violations match the selected filters</p>
                </div>
              ) : isGroupedByStudent ? (
                <div className="divide-y divide-ink-100">
                  {Object.entries(studentBuckets || {}).map(([studentName, studentEvents]) => (
                    <div key={studentName} className="group">
                      <div className="px-6 py-3 bg-ink-50 border-y border-ink-100 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-ink-500" />
                          <span className="font-bold text-ink-900">{studentName}</span>
                        </div>
                        <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
                          {studentEvents.length} events
                        </span>
                      </div>
                      <div className="divide-y divide-ink-100">
                        {studentEvents.map(event => renderViolationRow(event))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-ink-100">
                  {filteredGroupedEvents.slice(0, 50).map((event) => renderViolationRow(event))}
                </div>
              )}

              {!isGroupedByStudent && filteredGroupedEvents.length > 50 && (
                <div className="px-6 py-3 bg-ink-50 border-t border-ink-100 text-center">
                  <p className="text-sm text-ink-600">
                    Showing 50 of {filteredGroupedEvents.length} grouped violations
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* FR-020a: Termination confirmation modal */}
      {confirmTerminateId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <XCircle className="w-7 h-7 text-danger-600 flex-shrink-0" />
              <h2 className="text-lg font-semibold text-ink-900">Terminate Session?</h2>
            </div>
            <p className="text-sm text-ink-600 mb-6">
              This will immediately end the student's exam session. The student will be unable to continue.
              This action cannot be undone.
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setConfirmTerminateId(null)}
                className="px-4 py-2 rounded-lg font-medium bg-ink-100 text-ink-700 hover:bg-ink-200"
              >
                Cancel
              </button>
              <button
                onClick={handleTerminateConfirmed}
                className="px-4 py-2 rounded-lg font-medium bg-danger-600 text-white hover:bg-danger-700"
              >
                Terminate Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
