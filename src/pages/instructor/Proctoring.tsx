import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase/client';
import { ViolationEventService, ExamSessionService } from '../../examSession';
import { CustomDropdown, DropdownOption } from '../../components/ui/CustomDropdown';
import type { ViolationEvent, ViolationSummary, ExamSessionSummary } from '../../types/examSession';
import {
  AlertTriangle,
  AlertCircle,
  XCircle,
  Filter,
  Calendar,
  User,
  Loader2,
  CheckCircle,
  Clock,
  Bell,
  Zap,
  Activity,
  Camera,
  LayoutGrid,
  List,
  Search,
  ShieldAlert,
  History,
  Info,
  Users
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

  const isDistanceType = (t: string) => t === 'face_too_close' || t === 'face_too_far' || t === 'distance_issue';

  for (const ev of sorted) {
    const evTime = new Date(ev.occurred_at || ev.client_captured_at).getTime();
    const evType = ev.violation_type || ev.type;
    
    // Check if we can merge with a previous group for this student
    // We search for a group of the same type OR a distance group if this is a distance event
    const studentSessionId = ev.session_id;
    let currentGroup: GroupedTimelineEvent | undefined;

    if (isDistanceType(evType)) {
      currentGroup = lastGroupPerStudentType[`${studentSessionId}:distance`] || 
                     lastGroupPerStudentType[`${studentSessionId}:${evType}`];
    } else {
      currentGroup = lastGroupPerStudentType[`${studentSessionId}:${evType}`];
    }

    if (
      currentGroup &&
      evTime - new Date(currentGroup.endTime).getTime() < 30000 // 30 second threshold
    ) {
      // Merge into current group
      if (currentGroup.type !== evType && isDistanceType(currentGroup.type)) {
        currentGroup.type = 'distance_issue';
        // Update key to ensure future distance events find this group
        lastGroupPerStudentType[`${studentSessionId}:distance`] = currentGroup;
      }

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

      // ESCALATION LOGIC: If 3 or more sequential events and low risk, escalate to Medium
      if (currentGroup.eventIds.length >= 3 && currentGroup.severity < 10) {
        currentGroup.severity = 10;
      }
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
        is_reviewed: !!ev.is_reviewed,
        instructor_note: (ev as any).instructor_note || null,
        evidence_image: ev.evidence_image || null,
        evidence: ev.evidence,
        eventIds: [ev.id],
        session_id: ev.session_id,
        student_id: ev.student_id,
      };
      groups.push(newGroup);
      
      const key = isDistanceType(evType) ? `${studentSessionId}:distance` : `${studentSessionId}:${evType}`;
      lastGroupPerStudentType[key] = newGroup;
    }
  }

  // Sort back to descending for timeline
  return groups.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
};

export const ProctoringReport = () => {
  const { user } = useApp();
  const navigate = useNavigate();
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
  const [exams, setExams] = useState<Array<{ id: string; title: string; created_at?: string }>>([]);
  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const [evidenceUrls] = useState<Record<string, string>>({});
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
          .select('id, title, created_at')
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

  const getViolationStudentName = (violation: ViolationEvent | GroupedTimelineEvent) => {
    const session = sessions.find(s => s.session_id === violation.session_id);
    if (session) return session.student_name;
    return violation.student_id ? getStudentName(violation.student_id) : 'Unknown Student';
  };

  const renderViolationRow = (violation: GroupedTimelineEvent) => (
    <div key={violation.id} className="px-6 py-5 hover:bg-ink-50/50 transition-all">
      <div className="flex items-start space-x-5">
        <div className="flex flex-col items-center mt-1">
          <div className={`p-2 rounded-xl border ${getSeverityColor(getSeverityLabel(violation.severity))}`}>
            {getSeverityIcon(getSeverityLabel(violation.severity))}
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-1.5 flex-wrap gap-y-1">
            <h3 className="text-sm font-bold text-ink-900 tracking-tight">
              {formatViolationType(violation.type)}
            </h3>
            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getSeverityColor(getSeverityLabel(violation.severity))}`}>
              {getSeverityLabel(violation.severity)}
            </span>
            {violation.durationMs > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-ink-100 text-ink-700 uppercase tracking-tight">
                <Clock className="w-3 h-3 mr-1 text-ink-400" />
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
            <p className="text-sm text-ink-600 mb-3 leading-relaxed">
              {violation.description}
            </p>
          )}

          <div className="flex items-center space-x-4 text-xs text-ink-400">
            <div className="flex items-center space-x-1.5 font-medium text-ink-600">
              <User className="w-3.5 h-3.5" />
              <span>{getViolationStudentName(violation)}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {formatTimestamp(violation.startTime)}
                {violation.durationMs > 0 && ` — ${new Date(violation.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </span>
            </div>
            {violation.is_reviewed && (
              <span className="flex items-center space-x-1 text-success-600 font-bold uppercase tracking-tighter">
                <CheckCircle className="w-3 h-3" />
                <span>Reviewed</span>
              </span>
            )}
          </div>

          {/* Evidence preview */}
          {expandedEvidence === violation.id && (evidenceUrls[violation.id] || violation.evidence_image) && (
            <div className="mt-4 inline-block animate-fade-in origin-top">
              <div className="relative group">
                <img
                  src={evidenceUrls[violation.id] || violation.evidence_image!}
                  alt="Violation evidence snapshot"
                  className="max-w-md rounded-xl border-2 border-ink-100 shadow-xl"
                />
                <div className="absolute inset-0 rounded-xl bg-ink-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                <p className="text-[10px] text-ink-400 font-bold uppercase tracking-widest">
                  Secure Artifact: {violation.id.slice(0, 8)}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          {(evidenceUrls[violation.id] || violation.evidence_image) && (
            <button
              onClick={() => setExpandedEvidence(prev => (prev === violation.id ? null : violation.id))}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                expandedEvidence === violation.id 
                  ? 'bg-brand-700 text-white border-brand-800' 
                  : 'bg-brand-50 text-brand-700 border-brand-100 hover:bg-brand-100'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{expandedEvidence === violation.id ? 'Hide' : 'View Evidence'}</span>
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

  // Get unique violation types
  const violationTypes = [...new Set(violations.map(getViolationType))];

  const examOptions = useMemo((): DropdownOption[] => [
    { id: 'all', label: 'All Exams', icon: <LayoutGrid className="w-4 h-4" /> },
    ...exams.map(e => ({
      id: e.id,
      label: e.title,
      description: e.created_at ? `Created ${new Date(e.created_at).toLocaleDateString()}` : undefined,
      icon: <Activity className="w-4 h-4" />
    }))
  ], [exams]);

  const severityOptions: DropdownOption[] = [
    { id: 'all', label: 'All Severities', icon: <Filter className="w-4 h-4" /> },
    { id: 'critical', label: 'Critical Only', icon: <XCircle className="w-4 h-4 text-danger-600" /> },
    { id: 'high', label: 'High & Above', icon: <AlertTriangle className="w-4 h-4 text-orange-600" /> },
    { id: 'medium', label: 'Medium & Above', icon: <AlertCircle className="w-4 h-4 text-warning-600" /> },
    { id: 'low', label: 'Low Severity', icon: <Info className="w-4 h-4 text-brand-600" /> },
  ];

  const typeOptions: DropdownOption[] = [
    { id: 'all', label: 'All Violation Types', icon: <ShieldAlert className="w-4 h-4" /> },
    ...violationTypes.map(t => ({
      id: t,
      label: formatViolationType(t),
      icon: <AlertCircle className="w-4 h-4" />
    }))
  ];

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
          <p className="text-ink-600 font-medium">Analyzing proctoring data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50 grid-spotlight">
      {/* Hidden audio for alert sounds */}
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU" preload="auto" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10 animate-fade-in-up">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="text-2xs font-bold uppercase tracking-[0.2em] text-brand-700 mb-1">
                Real-time Oversight
              </div>
              <h1 className="text-4xl font-bold text-ink-900 tracking-tight">Proctoring Report</h1>
              <p className="text-lg text-ink-500 mt-1">Intelligent monitoring and forensic violation timeline.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl border shadow-sm transition-all ${
                isConnected ? 'bg-success-50 text-success-700 border-success-200' : 'bg-danger-50 text-danger-700 border-danger-200'
              }`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success-500 animate-pulse' : 'bg-danger-500'}`} />
                <span className="font-bold text-sm tracking-tight">{isConnected ? 'LIVE FEED ACTIVE' : 'SYSTEM DISCONNECTED'}</span>
              </div>
              <button
                onClick={() => setShowLiveMonitoring(!showLiveMonitoring)}
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
                  showLiveMonitoring 
                    ? 'bg-brand-700 text-white border border-brand-800 shadow-brand-700/20' 
                    : 'bg-white text-ink-700 border border-ink-200 hover:bg-ink-50'
                }`}
              >
                <Bell className={`w-4 h-4 ${liveAlerts.some(a => !a.acknowledged) ? 'animate-bounce' : ''}`} />
                <span>Alerts ({liveAlerts.filter(a => !a.acknowledged).length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Alerts Panel */}
        {showLiveMonitoring && liveAlerts.length > 0 && (
          <div className="mb-10 bg-gradient-to-br from-red-50 to-orange-50/30 border-2 border-danger-200/50 rounded-2xl p-6 shadow-xl shadow-danger-900/5 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-danger-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-danger-600/30">
                  <Zap className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-danger-950">Critical Live Alerts</h2>
                  <p className="text-sm text-danger-800/70 font-medium">Suspicious activity detected in current sessions</p>
                </div>
              </div>
              <div className="px-4 py-1.5 bg-danger-600 text-white text-xs font-bold rounded-full shadow-sm tracking-widest">
                {liveAlerts.filter(a => !a.acknowledged).length} NEW
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {liveAlerts.slice(0, 5).map(alert => (
                <div
                  key={alert.id}
                  className={`p-5 rounded-xl border-2 transition-all duration-300 ${
                    alert.acknowledged 
                      ? 'bg-white/40 border-ink-100 opacity-60 grayscale' 
                      : 'bg-white border-danger-100 shadow-lg shadow-danger-900/5 hover:border-danger-200'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center space-x-5 flex-1">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-md ${
                        alert.riskLevel === 'critical' ? 'bg-danger-600' : 'bg-orange-600'
                      }`}>
                        {alert.studentName?.charAt(0) || 'S'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-1">
                          <h3 className="font-bold text-ink-900 text-lg tracking-tight">
                            {alert.studentName || `Student ${alert.studentId.slice(0, 8)}`}
                          </h3>
                          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                            alert.riskLevel === 'critical' 
                              ? 'bg-danger-600 text-white' 
                              : 'bg-orange-600 text-white'
                          }`}>
                            {alert.riskLevel}
                          </span>
                        </div>
                        <div className="flex items-center space-x-5 text-sm">
                          <div className="flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-danger-600" />
                            <span className="text-ink-600">Risk Score: <span className="font-black text-danger-600 tabular-nums">{alert.violationScore}</span></span>
                          </div>
                          <div className="flex items-center gap-1.5 text-ink-400">
                            <Clock className="w-4 h-4" />
                            <span>{formatTimeAgo(alert.timestamp)}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {alert.events.slice(0, 3).map((event, idx) => (
                            <span key={idx} className="text-[10px] px-2 py-1 bg-danger-50 text-danger-700 border border-danger-100 rounded-md font-bold uppercase tracking-tight">
                              {event.type.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      disabled={alert.acknowledged}
                      className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                        alert.acknowledged
                          ? 'bg-ink-100 text-ink-400 cursor-not-allowed'
                          : 'bg-success-600 text-white hover:bg-success-700 shadow-lg shadow-success-600/20'
                      }`}
                    >
                      {alert.acknowledged ? 'Resolved' : 'Review Now'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Controls */}
          <div className="lg:col-span-1 space-y-6 relative z-30">
            <div className="card p-6 bg-white shadow-xl shadow-ink-200/20">
              <h2 className="text-sm font-bold text-ink-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Filter className="w-4 h-4 text-brand-700" />
                Data Controls
              </h2>
              
              <div className="space-y-6">
                <CustomDropdown
                  label="Context"
                  options={examOptions}
                  value={examId}
                  onChange={setExamId}
                  placeholder="Filter by exam"
                />

                <CustomDropdown
                  label="Severity"
                  options={severityOptions}
                  value={severityFilter}
                  onChange={setSeverityFilter}
                  disabled={examId === 'all'}
                />

                <CustomDropdown
                  label="Category"
                  options={typeOptions}
                  value={typeFilter}
                  onChange={setTypeFilter}
                  disabled={examId === 'all'}
                />

                <div className="pt-2">
                  <label className="field-label">Student Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                    <input
                      type="text"
                      placeholder="Search by name..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="field-input pl-10"
                      disabled={examId === 'all'}
                    />
                  </div>
                </div>

                <button
                  onClick={() => setIsGroupedByStudent(!isGroupedByStudent)}
                  disabled={examId === 'all'}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border ${
                    isGroupedByStudent 
                      ? 'bg-brand-700 text-white border-brand-800 shadow-lg shadow-brand-700/20' 
                      : 'bg-white border-ink-200 text-ink-600 hover:bg-ink-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isGroupedByStudent ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
                  <span>{isGroupedByStudent ? 'Show Timeline' : 'Group by Student'}</span>
                </button>
              </div>
            </div>

            {/* Stats Sidebar */}
            {examId !== 'all' && (
              <div className="space-y-3">
                {[
                  { label: 'Total Alerts', value: violations.length, icon: <AlertCircle className="w-4 h-4" />, color: 'text-ink-600' },
                  { label: 'Critical Risk', value: criticalCount, icon: <XCircle className="w-4 h-4" />, color: 'text-danger-600' },
                  { label: 'High Priority', value: highCount, icon: <AlertTriangle className="w-4 h-4" />, color: 'text-orange-600' },
                  { label: 'Active sessions', value: sessions.filter(s => s.status === 'in_progress').length, icon: <Activity className="w-4 h-4" />, color: 'text-success-600' },
                ].map((stat) => (
                  <div key={stat.label} className="card p-4 flex items-center justify-between bg-white border-ink-100 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-ink-50 ${stat.color}`}>
                        {stat.icon}
                      </div>
                      <span className="text-xs font-bold text-ink-500 uppercase tracking-tight">{stat.label}</span>
                    </div>
                    <span className={`text-xl font-black tabular-nums ${stat.color}`}>{stat.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {examId === 'all' ? (
              <div className="card p-24 text-center bg-white/50 border-dashed border-2 border-ink-200">
                <div className="w-20 h-20 bg-brand-50 text-brand-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-700/5">
                  <LayoutGrid className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-ink-900 tracking-tight">Intelligence Dashboard</h3>
                <p className="text-ink-500 max-w-sm mx-auto mt-2">
                  Please select a specific exam context from the sidebar to initialize live monitoring and historical analytics.
                </p>
              </div>
            ) : (
              <div className="space-y-8 animate-fade-in">
                {/* Session Overviews */}
                {sessions.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-5 h-5 text-brand-700" />
                      <h2 className="text-lg font-bold text-ink-900 tracking-tight">Active & Recent Sessions</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {sessions.map(session => {
                        const sessionViolations = violations.filter(v => v.session_id === session.session_id);
                        const sessionSummary = summaries[session.session_id];
                        const score = sessionScores[session.session_id] ?? 0;

                        return (
                          <div key={session.session_id} className="card p-6 bg-white hover:shadow-xl hover:shadow-ink-200/20 transition-all border-ink-100/50">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                              <div className="flex items-center space-x-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-brand-700/20">
                                  {session.student_name?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-ink-900 text-lg tracking-tight">{session.student_name}</h3>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                                      session.status === 'in_progress' ? 'bg-success-50 text-success-700 border-success-100' :
                                      session.status === 'submitted' ? 'bg-brand-50 text-brand-800 border-brand-100' :
                                      'bg-ink-50 text-ink-600 border-ink-100'
                                    }`}>
                                      {session.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-ink-500 font-medium">
                                    {session.student_email}
                                    {session.calibration_skipped && (
                                      <span className="ml-2 text-orange-600 font-bold uppercase tracking-tighter bg-orange-50 px-1.5 py-0.5 rounded">
                                        No Calibration
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-6">
                                {session.status === 'in_progress' && (
                                  <div className="text-center px-4 py-2 bg-ink-50 rounded-xl border border-ink-100">
                                    <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-0.5">Live Score</p>
                                    <span className={`text-xl font-black tabular-nums ${
                                      score >= 70 ? 'text-danger-600' : score >= 40 ? 'text-warning-600' : 'text-success-600'
                                    }`}>
                                      {Math.round(score)}
                                    </span>
                                  </div>
                                )}
                                
                                <div className="text-center">
                                  <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-0.5">Alerts</p>
                                  <span className="text-xl font-black tabular-nums text-ink-900">{sessionViolations.length}</span>
                                </div>

                                <div className="flex flex-col gap-2">
                                  {session.status === 'in_progress' && (
                                    <button
                                      onClick={() => setConfirmTerminateId(session.session_id)}
                                      className="btn btn-danger btn-sm text-[10px] font-black uppercase tracking-widest px-4"
                                    >
                                      Terminate
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => navigate(`/instructor/exams/${examId}/results/${session.session_id}`)}
                                    className="btn btn-secondary btn-sm text-[10px] font-black uppercase tracking-widest px-4"
                                  >
                                    View Full
                                  </button>
                                </div>
                              </div>
                            </div>

                            {sessionSummary && sessionSummary.length > 0 && (
                              <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-ink-50">
                                {sessionSummary.map(summary => (
                                  <span
                                    key={summary.violation_type}
                                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight border ${getSeverityColor(getSeverityLabel(summary.severity as unknown as number))}`}
                                  >
                                    {formatViolationType(summary.violation_type)}: {summary.count}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Violation Feed */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <History className="w-5 h-5 text-brand-700" />
                      <h2 className="text-lg font-bold text-ink-900 tracking-tight">Violation Timeline Feed</h2>
                    </div>
                    <div className="text-xs font-bold text-ink-400 uppercase tracking-widest bg-ink-100 px-3 py-1 rounded-full">
                      {filteredGroupedEvents.length} Grouped Events
                    </div>
                  </div>

                  <div className="card bg-white shadow-xl shadow-ink-200/20 overflow-hidden border-ink-100/60">
                    {filteredGroupedEvents.length === 0 ? (
                      <div className="px-6 py-20 text-center">
                        <ShieldAlert className="w-12 h-12 text-ink-200 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-ink-900">No Data Detected</h3>
                        <p className="text-sm text-ink-500 mt-1">Adjust filters or select a different exam context.</p>
                      </div>
                    ) : isGroupedByStudent ? (
                      <div className="divide-y divide-ink-100">
                        {Object.entries(studentBuckets || {}).map(([studentName, studentEvents]) => (
                          <div key={studentName} className="group">
                            <div className="px-6 py-4 bg-ink-50/50 border-y border-ink-100 flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-lg bg-brand-700 flex items-center justify-center text-white font-black text-xs">
                                  {studentName.charAt(0)}
                                </div>
                                <span className="font-black text-ink-900 tracking-tight">{studentName}</span>
                              </div>
                              <span className="text-[10px] font-black text-ink-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-ink-100">
                                {studentEvents.length} Sequential Events
                              </span>
                            </div>
                            <div className="divide-y divide-ink-100/50">
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
                      <div className="px-6 py-4 bg-ink-50/30 border-t border-ink-100 text-center">
                        <p className="text-xs font-bold text-ink-400 uppercase tracking-widest">
                          Truncated to 50 of {filteredGroupedEvents.length} signals
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FR-020a: Termination confirmation modal */}
      {confirmTerminateId && (
        <div className="modal-backdrop">
          <div className="modal-card max-w-md p-8">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-14 h-14 bg-danger-100 rounded-2xl flex items-center justify-center text-danger-600">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-black text-ink-900 tracking-tight uppercase">Terminate Session?</h2>
                <p className="text-xs text-ink-500 font-medium">This action is irreversible and immediate.</p>
              </div>
            </div>
            <p className="text-sm text-ink-600 mb-8 leading-relaxed">
              The student's active exam session will be force-closed. All pending inputs will be discarded and the student will be evicted from the exam environment.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setConfirmTerminateId(null)}
                className="btn btn-secondary flex-1 font-bold uppercase text-xs tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleTerminateConfirmed}
                className="btn btn-danger flex-1 font-bold uppercase text-xs tracking-widest shadow-lg shadow-danger-600/20"
              >
                Confirm Termination
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

