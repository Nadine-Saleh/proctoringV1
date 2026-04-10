import React from 'react';
import { ViolationEvent } from '../utils/violationScorer';
import { AlertTriangle, Eye, UserX, MonitorOff, Smartphone, RotateCcw } from 'lucide-react';

interface ViolationExplanationProps {
  events: ViolationEvent[];
  score: number;
}

export const ViolationExplanation: React.FC<ViolationExplanationProps> = ({ events, score }) => {
  if (score < 30) return null;

  // Get recent high-severity events (last 10)
  const recentHighSeverity = events
    .filter((e) => e.severity === 'high' || e.severity === 'medium')
    .slice(-10);

  if (recentHighSeverity.length === 0) return null;

  // Group events by type and count
  const eventCounts = recentHighSeverity.reduce<Record<string, { count: number; latest: ViolationEvent }>>(
    (acc, event) => {
      if (!acc[event.type]) {
        acc[event.type] = { count: 0, latest: event };
      }
      acc[event.type].count++;
      acc[event.type].latest = event;
      return acc;
    },
    {}
  );

  // Map event types to human-readable explanations
  const getEventExplanation = (type: string, count: number, latestEvent: ViolationEvent): string => {
    switch (type) {
      case 'gaze_sustained_away':
        return `⚠️ Looked away ${count}x for >3 seconds`;
      case 'gaze_looking_away':
        return `👀 Brief look away ${count}x`;
      case 'head_pose_extreme':
        return `🔄 Head turned away ${count}x`;
      case 'multiple_faces':
        return `👥 Multiple people detected ${count}x`;
      case 'tab_switch':
        return `🖥️ Tab switching detected ${count}x`;
      case 'phone_detection':
        return `📱 Possible phone use ${count}x`;
      case 'excessive_blinking':
        return `👁️ Excessive blinking ${count}x`;
      default:
        return latestEvent.description;
    }
  };

  // Get icon for event type
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'gaze_sustained_away':
      case 'gaze_looking_away':
        return <Eye className="w-4 h-4 text-red-600" />;
      case 'head_pose_extreme':
        return <RotateCcw className="w-4 h-4 text-orange-600" />;
      case 'multiple_faces':
        return <UserX className="w-4 h-4 text-red-600" />;
      case 'tab_switch':
        return <MonitorOff className="w-4 h-4 text-orange-600" />;
      case 'phone_detection':
        return <Smartphone className="w-4 h-4 text-red-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    }
  };

  return (
    <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center space-x-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <h4 className="font-semibold text-gray-900">Violation Summary</h4>
      </div>

      <div className="space-y-2">
        {Object.entries(eventCounts).map(([type, { count, latest }]) => (
          <div key={type} className="flex items-start space-x-3 text-sm">
            <div className="flex-shrink-0 mt-0.5">{getEventIcon(type)}</div>
            <div className="flex-1">
              <p className="text-gray-800 font-medium">
                {getEventExplanation(type, count, latest)}
              </p>
              {latest.duration && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Latest: {Math.round(latest.duration / 1000)}s
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {score >= 80 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-xs text-red-800 font-semibold">
            🚨 Critical Risk Level - Instructor has been notified
          </p>
        </div>
      )}
    </div>
  );
};
