import React from 'react';
import { type ViolationEvent } from '../utils/violationScorer';
import {
  AlertTriangle,
  Eye,
  UserX,
  MonitorOff,
  Smartphone,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

interface ViolationExplanationProps {
  events: ViolationEvent[];
  score: number;
}

const TYPE_META: Record<
  string,
  { label: (count: number) => string; Icon: React.FC<{ className?: string }>; tone: 'warning' | 'danger' }
> = {
  gaze_sustained_away: {
    label: (n) => `Looked away ${n}× for >3s`,
    Icon: Eye,
    tone: 'danger',
  },
  gaze_looking_away: {
    label: (n) => `Brief look away ${n}×`,
    Icon: Eye,
    tone: 'warning',
  },
  head_pose_extreme: {
    label: (n) => `Head turned away ${n}×`,
    Icon: RotateCcw,
    tone: 'warning',
  },
  multiple_faces: {
    label: (n) => `Multiple people detected ${n}×`,
    Icon: UserX,
    tone: 'danger',
  },
  tab_switch: {
    label: (n) => `Tab switching detected ${n}×`,
    Icon: MonitorOff,
    tone: 'warning',
  },
  phone_detection: {
    label: (n) => `Possible phone use ${n}×`,
    Icon: Smartphone,
    tone: 'danger',
  },
  excessive_blinking: {
    label: (n) => `Excessive blinking ${n}×`,
    Icon: Eye,
    tone: 'warning',
  },
};

export const ViolationExplanation: React.FC<ViolationExplanationProps> = ({ events, score }) => {
  if (score < 30) return null;

  const recentHighSeverity = events.filter((e) => e.severity >= 10).slice(-10);

  if (recentHighSeverity.length === 0) return null;

  const eventCounts = recentHighSeverity.reduce<
    Record<string, { count: number; latest: ViolationEvent }>
  >((acc, event) => {
    if (!acc[event.type]) {
      acc[event.type] = { count: 0, latest: event };
    }
    acc[event.type].count++;
    acc[event.type].latest = event;
    return acc;
  }, {});

  return (
    <div className="card p-5 mt-4 animate-fade-in-up">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-warning-50 text-warning-700 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-ink-900 tracking-tight2">
            Violation summary
          </h4>
          <p className="text-2xs uppercase tracking-wider text-ink-500">
            Recent high-severity events
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {Object.entries(eventCounts).map(([type, { count, latest }]) => {
          const meta = TYPE_META[type];
          const Icon = meta?.Icon ?? AlertTriangle;
          const tone = meta?.tone ?? 'warning';
          const label = meta?.label(count) ?? latest.description;

          return (
            <div
              key={type}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-white border border-ink-100"
            >
              <div
                className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                  tone === 'danger'
                    ? 'bg-danger-50 text-danger-700'
                    : 'bg-warning-50 text-warning-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-800">{label}</p>
                {latest.duration_ms && (
                  <p className="text-2xs text-ink-500 mt-0.5 tabular-nums">
                    Latest: {Math.round(latest.duration_ms / 1000)}s
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {score >= 80 && (
        <div className="mt-4 p-3 rounded-lg bg-danger-50 border border-danger-200 flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-danger-700 flex-shrink-0" />
          <p className="text-xs font-semibold text-danger-900">
            Critical risk level — instructor has been notified
          </p>
        </div>
      )}
    </div>
  );
};
