import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { ViolationEventService } from '../../services/ViolationEventService';
import { EvidenceSnippetService } from '../../services/EvidenceSnippetService';
import type { ViolationEvent } from '../../types/examSession';
import {
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle,
  XCircle,
  Clock,
  Award,
  ShieldAlert,
  Edit2,
  RotateCcw,
  MessageSquare,
  Camera,
  Mail,
  Activity,
  ChevronRight,
  AlertTriangle,
  History,
  X
} from 'lucide-react';

interface SubmissionData {
  submission_id: string;
  session_id: string;
  student_name: string | null;
  student_email: string | null;
  submitted_at: string;
  submit_reason: string;
  grade_status: string;
  auto_graded_score: number;
  auto_graded_max: number;
  final_grade: number | null;
  final_cheating_score: number;
  instructor_override_score: number | null;
  instructor_note: string | null;
  calibration_skipped: boolean;
  optimal_distance_cm: number | null;
  distance_tolerance_cm: number | null;
  evidence_package_id: string | null;
  violation_summary: Record<string, { count: number; severity: number }> | null;
}

const formatViolationType = (t: string) =>
  t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const getSeverityColor = (sev: number) => {
  if (sev >= 20) return 'bg-danger-100 text-danger-700 border-danger-200';
  if (sev >= 15) return 'bg-orange-100 text-orange-700 border-orange-200';
  if (sev >= 10) return 'bg-warning-100 text-warning-700 border-warning-200';
  return 'bg-brand-100 text-brand-800 border-brand-200';
};

const getSeverityLabel = (sev: number) => {
  if (sev >= 20) return 'Critical';
  if (sev >= 15) return 'High';
  if (sev >= 10) return 'Medium';
  return 'Low';
};

interface GroupedViolation {
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
}

const groupViolations = (events: ViolationEvent[]): GroupedViolation[] => {
  if (events.length === 0) return [];

  // Sort by time ascending
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  const groups: GroupedViolation[] = [];
  let currentGroup: GroupedViolation | null = null;

  const isDistanceType = (t: string) => t === 'face_too_close' || t === 'face_too_far' || t === 'distance_issue';

  for (const ev of sorted) {
    const evTime = new Date(ev.occurred_at).getTime();
    const evType = ev.violation_type || ev.type;

    const canMerge = currentGroup && (
      currentGroup.type === evType || 
      (isDistanceType(currentGroup.type) && isDistanceType(evType))
    );

    if (
      currentGroup &&
      canMerge &&
      evTime - new Date(currentGroup.endTime).getTime() < 30000 // 30 second threshold for "consecutive"
    ) {
      // Merge into current group
      if (currentGroup.type !== evType && isDistanceType(currentGroup.type)) {
        currentGroup.type = 'distance_issue';
      }
      
      currentGroup.endTime = ev.occurred_at;
      currentGroup.durationMs =
        new Date(currentGroup.endTime).getTime() - new Date(currentGroup.startTime).getTime();
      currentGroup.eventIds.push(ev.id);
      
      // Prioritize evidence
      if (!currentGroup.evidence_image && ev.evidence_image) {
        currentGroup.evidence_image = ev.evidence_image;
        currentGroup.id = ev.id; // Update ID to match evidence for URL lookup
      }
      if (!currentGroup.evidence && ev.evidence) {
        currentGroup.evidence = ev.evidence;
        currentGroup.id = ev.id;
      }
      
      // If any in group is reviewed, mark group (or stay strict)
      if (ev.is_reviewed) currentGroup.is_reviewed = true;
      if (ev.instructor_note && !currentGroup.instructor_note) {
        currentGroup.instructor_note = ev.instructor_note;
      }

      // ESCALATION LOGIC: If we have 3 or more sequential events and it's currently low risk, escalate to Medium
      if (currentGroup.eventIds.length >= 3 && currentGroup.severity < 10) {
        currentGroup.severity = 10; // 10 is the threshold for 'Medium'
      }
    } else {
      // Start new group
      currentGroup = {
        id: ev.id,
        type: evType,
        severity: ev.severity,
        startTime: ev.occurred_at,
        endTime: ev.occurred_at,
        durationMs: ev.duration_ms || 0,
        description: ev.description || '',
        is_reviewed: !!ev.is_reviewed,
        instructor_note: ev.instructor_note || null,
        evidence_image: ev.evidence_image || null,
        evidence: ev.evidence,
        eventIds: [ev.id],
      };
      groups.push(currentGroup);
    }
  }

  // Sort back to descending for timeline
  return groups.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
};

export const SubmissionDetail = () => {
  const { examId, sessionId } = useParams<{ examId: string; sessionId: string }>();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const [evidenceUrls, setEvidenceUrls] = useState<Record<string, string>>({});
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Score override state
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // Per-violation review state: id → { saving, showNote, noteText }
  const [reviewStates, setReviewStates] = useState<
    Record<string, { saving: boolean; showNote: boolean; noteText: string }>
  >({});

  const groupedViolationsList = useMemo(() => groupViolations(violations), [violations]);

  // Calculate risk breakdown
  const riskBreakdown = useMemo(() => {
    return violations.reduce((acc, ev) => {
      const type = ev.violation_type || ev.type;
      if (!acc[type]) acc[type] = 0;
      acc[type] += ev.severity;
      return acc;
    }, {} as Record<string, number>);
  }, [violations]);

  useEffect(() => {
    if (!examId || !sessionId) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const { data: submissions, error: rpcErr } = await supabase.rpc('list_exam_submissions', {
          p_exam_id: examId,
        });
        if (rpcErr) throw new Error(rpcErr.message);

        const match = (submissions as SubmissionData[] | null)?.find(
          s => s.session_id === sessionId
        );
        if (!match) {
          setError('Submission not found.');
          return;
        }
        setSubmission(match);

        const result = await ViolationEventService.getBySession(sessionId!);
        if (!result.success) {
          throw new Error(result.error || 'Failed to load violations');
        }

        const evArr = result.events ?? [];
        setViolations(evArr);

        // Pre-fetch signed URLs for binary evidence artifacts
        const artifacts = evArr.filter(ev => ev.evidence?.bucket_path);
        if (artifacts.length > 0) {
          const paths = artifacts.map(ev => ev.evidence!.bucket_path);
          const urlMap = await EvidenceSnippetService.getPlaybackUrls(paths);
          
          const idToUrl: Record<string, string> = {};
          for (const ev of artifacts) {
            const url = urlMap.get(ev.evidence!.bucket_path);
            if (url) idToUrl[ev.id] = url;
          }
          setEvidenceUrls(idToUrl);
        }

        // Init per-violation review state
        const initStates: typeof reviewStates = {};
        for (const ev of evArr) {
          initStates[ev.id] = {
            saving: false,
            showNote: false,
            noteText: ev.instructor_note ?? '',
          };
        }
        setReviewStates(initStates);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load submission');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [examId, sessionId]);

  const handleToggleReview = async (evId: string) => {
    const ev = violations.find(v => v.id === evId);
    if (!ev) return;
    
    const newReviewed = !ev.is_reviewed;
    const note = reviewStates[ev.id]?.noteText || undefined;

    setReviewStates(prev => ({
      ...prev,
      [ev.id]: { ...prev[ev.id], saving: true },
    }));

    const result = await ViolationEventService.reviewViolation(ev.id, newReviewed, note);

    if (result.success) {
      setViolations(prev =>
        prev.map(v =>
          v.id === ev.id
            ? { ...v, is_reviewed: newReviewed, instructor_note: note ?? null }
            : v
        )
      );
    }

    setReviewStates(prev => ({
      ...prev,
      [ev.id]: { ...prev[ev.id], saving: false, showNote: false },
    }));
  };

  const handleSaveOverride = async () => {
    if (!sessionId) return;
    const score = overrideScore === '' ? null : parseFloat(overrideScore);
    if (score !== null && (isNaN(score) || score < 0 || score > 100)) {
      setOverrideError('Score must be between 0 and 100.');
      return;
    }

    setOverrideSaving(true);
    setOverrideError(null);

    const result = await ViolationEventService.overrideSubmissionScore(
      sessionId,
      score,
      overrideNote || undefined
    );

    if (result.success) {
      setSubmission(prev =>
        prev
          ? {
              ...prev,
              instructor_override_score: score,
              instructor_note: overrideNote || null,
            }
          : prev
      );
      setShowOverrideForm(false);
      setOverrideScore('');
      setOverrideNote('');
    } else {
      setOverrideError(result.error ?? 'Failed to save override.');
    }

    setOverrideSaving(false);
  };

  const handleRemoveOverride = async () => {
    if (!sessionId) return;
    setOverrideSaving(true);
    const result = await ViolationEventService.overrideSubmissionScore(sessionId, null);
    if (result.success) {
      setSubmission(prev =>
        prev ? { ...prev, instructor_override_score: null, instructor_note: null } : prev
      );
    }
    setOverrideSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-50 grid-spotlight flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-100 border-t-brand-700 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-ink-600 font-medium">Retrieving submission forensics...</p>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="min-h-screen bg-ink-50 grid-spotlight flex items-center justify-center">
        <div className="card p-12 text-center max-w-md mx-4">
          <XCircle className="w-16 h-16 text-danger-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-ink-900 mb-2">Forensic Data Unavailable</h2>
          <p className="text-ink-600 mb-8">{error ?? 'The requested submission record could not be located.'}</p>
          <button onClick={() => navigate(-1)} className="btn btn-primary w-full">
            Return to Results
          </button>
        </div>
      </div>
    );
  }

  const scorePercent =
    submission.auto_graded_max > 0
      ? Math.round((submission.auto_graded_score / submission.auto_graded_max) * 100)
      : 0;

  const effectiveRiskScore =
    submission.instructor_override_score ?? submission.final_cheating_score;
  const isOverridden = submission.instructor_override_score !== null;

  const reviewedCount = violations.filter(v => v.is_reviewed).length;

  return (
    <div className="min-h-screen bg-ink-50 grid-spotlight">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Navigation */}
        <button
          onClick={() => navigate(-1)}
          className="group inline-flex items-center gap-2 text-sm font-bold text-ink-500 hover:text-brand-700 transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Exam Results</span>
        </button>

        <div className="mb-10 animate-fade-in-up">
          <div className="text-2xs font-bold uppercase tracking-[0.2em] text-brand-700 mb-1">
            Forensic Analysis
          </div>
          <h1 className="text-4xl font-bold text-ink-900 tracking-tight">Submission Detail</h1>
        </div>

        {/* Student Profile & Performance Hero */}
        <div className="relative mb-8 p-8 rounded-3xl bg-white border border-ink-100 shadow-2xl shadow-ink-900/5 overflow-hidden animate-fade-in">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-50 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center text-white font-black text-3xl shadow-xl shadow-brand-700/20">
                {submission.student_name?.charAt(0).toUpperCase() ?? '?'}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-ink-900 tracking-tight">{submission.student_name ?? 'Unknown Student'}</h2>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-sm text-ink-500 font-medium">
                    <Mail className="w-4 h-4 text-ink-300" />
                    {submission.student_email}
                  </div>
                  <div className="w-1 h-1 rounded-full bg-ink-200" />
                  <div className="flex items-center gap-1.5 text-sm text-ink-500 font-medium uppercase tracking-widest">
                    <Clock className="w-4 h-4 text-ink-300" />
                    {new Date(submission.submitted_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[140px] p-5 rounded-2xl bg-ink-50 border border-ink-100 text-center group hover:bg-white hover:shadow-xl transition-all">
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-ink-400 mb-1.5">
                  <Award className="w-3 h-3" />
                  Score
                </div>
                <p className="text-3xl font-black text-ink-900 tabular-nums tracking-tighter">{scorePercent}%</p>
                <p className="text-[10px] text-ink-500 font-bold mt-1 uppercase tracking-tight">
                  {submission.auto_graded_score} / {submission.auto_graded_max} PTS
                </p>
              </div>

              <div className="flex-1 min-w-[140px] p-5 rounded-2xl bg-ink-50 border border-ink-100 text-center group hover:bg-white hover:shadow-xl transition-all">
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-ink-400 mb-1.5">
                  <ShieldAlert className="w-3 h-3" />
                  Risk Index
                </div>
                <p className={`text-3xl font-black tabular-nums tracking-tighter ${
                  effectiveRiskScore >= 70 ? 'text-danger-600' : effectiveRiskScore >= 40 ? 'text-warning-600' : 'text-success-600'
                }`}>
                  {Math.round(effectiveRiskScore)}
                </p>
                <p className="text-[10px] text-ink-500 font-bold mt-1 uppercase tracking-tight">
                  {isOverridden ? 'Instructor Override' : 'Final Peak Score'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar: Risk Breakdown & Overrides */}
          <div className="lg:col-span-1 space-y-6">
            {/* Risk Explanation */}
            {Object.keys(riskBreakdown).length > 0 && (
              <div className="card p-6 bg-white shadow-xl shadow-ink-200/20">
                <h3 className="text-xs font-black text-ink-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-brand-700" />
                  Signal breakdown
                </h3>
                <div className="space-y-4">
                  {Object.entries(riskBreakdown).map(([type, totalSeverity]) => (
                    <div key={type} className="group">
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="text-ink-600 font-medium">{formatViolationType(type)}</span>
                        <span className="font-bold text-ink-900 tabular-nums">+{totalSeverity}</span>
                      </div>
                      <div className="h-1.5 w-full bg-ink-50 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${totalSeverity >= 20 ? 'bg-danger-500' : totalSeverity >= 10 ? 'bg-orange-500' : 'bg-brand-500'}`} 
                          style={{ width: `${Math.min(100, (totalSeverity / (submission.final_cheating_score || 1)) * 100)}%` }} 
                        />
                      </div>
                    </div>
                  ))}
                  <div className="pt-6 border-t border-ink-100 flex items-center justify-between mt-4">
                    <span className="text-xs font-bold text-ink-900 uppercase tracking-widest">Accumulated Severity</span>
                    <span className="text-lg font-black text-ink-900">{Math.round(submission.final_cheating_score)}</span>
                  </div>
                  <p className="text-[10px] text-ink-400 italic leading-relaxed mt-2">
                    Note: Final score accounts for signal decay over the session duration.
                  </p>
                </div>
              </div>
            )}

            {/* Override Controls */}
            <div className="card p-6 bg-white shadow-xl shadow-ink-200/20">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black text-ink-900 uppercase tracking-widest flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-brand-700" />
                  Index Override
                </h3>
                {isOverridden && !showOverrideForm && (
                  <button
                    onClick={handleRemoveOverride}
                    disabled={overrideSaving}
                    className="p-1.5 rounded-lg text-ink-400 hover:text-danger-600 hover:bg-danger-50 transition-all"
                    title="Remove override"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {!showOverrideForm ? (
                <div>
                  {isOverridden ? (
                    <div className="p-4 rounded-xl bg-brand-50 border border-brand-100 mb-4">
                      <p className="text-xs text-brand-800 font-bold mb-1">Current Override: {Math.round(submission.instructor_override_score!)}</p>
                      {submission.instructor_note && (
                        <p className="text-xs text-brand-600 leading-relaxed italic">"{submission.instructor_note}"</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-ink-500 leading-relaxed mb-6">
                      You can manually adjust the final risk index if forensic evidence suggests signal noise or false positives.
                    </p>
                  )}
                  <button
                    onClick={() => {
                      setOverrideScore(submission.instructor_override_score != null ? String(Math.round(submission.instructor_override_score)) : '');
                      setOverrideNote(submission.instructor_note ?? '');
                      setShowOverrideForm(true);
                    }}
                    className="w-full btn btn-secondary btn-sm font-black uppercase text-[10px] tracking-widest py-3"
                  >
                    {isOverridden ? 'Modify Override' : 'Initialize Override'}
                  </button>
                </div>
              ) : (
                <div className="animate-fade-in space-y-4">
                  <div>
                    <label className="field-label !text-[10px] uppercase tracking-widest">Target Index (0-100)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={overrideScore}
                      onChange={e => setOverrideScore(e.target.value)}
                      placeholder="e.g. 25"
                      className="field-input"
                    />
                  </div>
                  <div>
                    <label className="field-label !text-[10px] uppercase tracking-widest">Forensic Justification</label>
                    <textarea
                      value={overrideNote}
                      onChange={e => setOverrideNote(e.target.value)}
                      placeholder="Reason for override..."
                      className="field-input min-h-[80px] resize-none"
                    />
                  </div>
                  {overrideError && (
                    <div className="p-3 rounded-lg bg-danger-50 border border-danger-100 text-[10px] text-danger-700 font-bold flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {overrideError}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveOverride}
                      disabled={overrideSaving}
                      className="flex-1 btn btn-primary btn-sm font-black uppercase text-[10px] tracking-widest py-3"
                    >
                      {overrideSaving ? 'Saving...' : 'Apply'}
                    </button>
                    <button
                      onClick={() => setShowOverrideForm(false)}
                      className="px-4 py-3 rounded-xl bg-ink-100 text-ink-700 font-black uppercase text-[10px] tracking-widest hover:bg-ink-200 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Context/Calibration */}
            <div className="card p-6 bg-white shadow-sm border-ink-100">
              <h3 className="text-xs font-black text-ink-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-ink-400" />
                Capture Context
              </h3>
              {submission.calibration_skipped ? (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-orange-50 border border-orange-100">
                  <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-orange-800 leading-relaxed">
                    <strong>Calibration Skipped</strong>. Measurements calculated against system defaults (50cm baseline).
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-500">Baseline Distance</span>
                    <span className="font-bold text-ink-900">{submission.optimal_distance_cm} cm</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-500">Tolerance Range</span>
                    <span className="font-bold text-ink-900">± {submission.distance_tolerance_cm ?? '20'} cm</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Area: Forensic Timeline */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-ink-900 flex items-center justify-center text-white shadow-lg">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-ink-900 tracking-tight">Forensic Timeline</h2>
                  <p className="text-xs text-ink-500 font-medium uppercase tracking-widest">{groupedViolationsList.length} Grouped Signals Detected</p>
                </div>
              </div>
              {violations.length > 0 && (
                <div className="px-3 py-1 rounded-full bg-ink-100 text-ink-500 text-[10px] font-black uppercase tracking-widest">
                  {reviewedCount} / {violations.length} Artifacts Reviewed
                </div>
              )}
            </div>

            <div className="card bg-white shadow-2xl shadow-ink-900/5 overflow-hidden border-ink-100/60 animate-fade-in" style={{ animationDelay: '100ms' }}>
              {groupedViolationsList.length === 0 ? (
                <div className="p-20 text-center">
                  <div className="w-16 h-16 bg-success-50 text-success-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-ink-900">Clean Session</h3>
                  <p className="text-ink-500 max-w-xs mx-auto mt-2">No suspicious activities or proctoring signals were recorded during this session.</p>
                </div>
              ) : (
                <div className="divide-y divide-ink-100">
                  {groupedViolationsList.map((ev) => {
                    const rs = reviewStates[ev.id] ?? {
                      saving: false,
                      showNote: false,
                      noteText: ev.instructor_note ?? '',
                    };
                    const durationSec = Math.round(ev.durationMs / 1000);
                    const severityLabel = getSeverityLabel(ev.severity);
                    const isEvidenceOpen = expandedEvidence === ev.id;

                    return (
                      <div
                        key={ev.id}
                        className={`group p-6 transition-all ${ev.is_reviewed ? 'bg-ink-50/40 opacity-80' : 'bg-white hover:bg-brand-50/10'}`}
                      >
                        <div className="flex items-start gap-5">
                          <div className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center shadow-sm ${getSeverityColor(ev.severity)}`}>
                            <ShieldAlert className="w-5 h-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                              <h4 className="font-bold text-ink-900 text-sm tracking-tight">{formatViolationType(ev.type)}</h4>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${getSeverityColor(ev.severity)}`}>
                                {severityLabel}
                              </span>
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-ink-400 uppercase tracking-tight">
                                <Clock className="w-3 h-3" />
                                {new Date(ev.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                {ev.durationMs > 0 && (
                                  <span className="flex items-center gap-1">
                                    <ChevronRight className="w-2.5 h-2.5" />
                                    {durationSec}s active
                                  </span>
                                )}
                              </div>
                              {ev.is_reviewed && (
                                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-success-600">
                                  <CheckCircle className="w-3 h-3" /> Reviewed
                                </span>
                              )}
                            </div>

                            <p className="text-sm text-ink-600 leading-relaxed mb-4">
                              {ev.description}
                              {ev.eventIds.length > 1 && (
                                <span className="inline-flex ml-2 text-[10px] font-bold text-ink-400 bg-ink-100 px-1.5 py-0.5 rounded">
                                  {ev.eventIds.length} Merged Events
                                </span>
                              )}
                            </p>

                            {/* Instructor Note Display */}
                            {ev.instructor_note && (
                              <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-white border border-brand-100 shadow-sm animate-scale-in">
                                <MessageSquare className="w-3.5 h-3.5 text-brand-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-brand-950 font-medium">{ev.instructor_note}</p>
                              </div>
                            )}

                            {/* Evidence Preview */}
                            {isEvidenceOpen && (evidenceUrls[ev.id] || ev.evidence_image) && (
                              <div className="mb-4 animate-fade-in origin-top">
                                <div className="relative inline-block group">
                                  <img
                                    src={evidenceUrls[ev.id] || ev.evidence_image!}
                                    alt="Forensic snapshot"
                                    className="max-w-md rounded-2xl border-2 border-ink-100 shadow-2xl"
                                  />
                                  <div className="absolute inset-0 rounded-2xl bg-ink-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                                  <p className="text-[10px] text-ink-400 font-bold uppercase tracking-widest">
                                    Artifact Hash: {ev.id.slice(0, 16).toUpperCase()}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Note Editor */}
                            {rs.showNote && (
                              <div className="mb-4 flex items-center gap-2 animate-scale-in">
                                <div className="relative flex-1 max-w-sm">
                                  <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
                                  <input
                                    type="text"
                                    value={rs.noteText}
                                    onChange={e => setReviewStates(prev => ({ ...prev, [ev.id]: { ...prev[ev.id], noteText: e.target.value } }))}
                                    placeholder="Annotate signal..."
                                    className="field-input !py-1.5 !pl-9 !text-xs"
                                    autoFocus
                                  />
                                </div>
                                <button 
                                  onClick={() => setReviewStates(prev => ({ ...prev, [ev.id]: { ...prev[ev.id], showNote: false } }))}
                                  className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}

                            {/* Actions Row */}
                            <div className="flex items-center gap-4">
                              {(evidenceUrls[ev.id] || ev.evidence_image) && (
                                <button
                                  onClick={() => setExpandedEvidence(isEvidenceOpen ? null : ev.id)}
                                  className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                                    isEvidenceOpen ? 'text-brand-700' : 'text-ink-400 hover:text-ink-900'
                                  }`}
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                  {isEvidenceOpen ? 'Hide Artifact' : 'Review Snapshot'}
                                </button>
                              )}

                              <button
                                onClick={() => setReviewStates(prev => ({ ...prev, [ev.id]: { ...prev[ev.id], showNote: !prev[ev.id]?.showNote } }))}
                                className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                                  rs.showNote ? 'text-brand-700' : 'text-ink-400 hover:text-ink-900'
                                }`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                {ev.instructor_note ? 'Edit Note' : 'Add Note'}
                              </button>

                              <button
                                onClick={() => handleToggleReview(ev.id)}
                                disabled={rs.saving}
                                className={`ml-auto px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${
                                  ev.is_reviewed
                                    ? 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                                    : 'bg-success-600 text-white hover:bg-success-700 shadow-success-600/20'
                                }`}
                              >
                                {rs.saving ? (
                                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                                ) : ev.is_reviewed ? (
                                  'Archived'
                                ) : (
                                  'Acknowledge'
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
