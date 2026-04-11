/**
 * GazeTrackingOverlay - Visual overlay for gaze tracking feedback
 * 
 * Features:
 * - Real-time gaze zone indicator
 * - Progressive warning system
 * - Attention metrics display
 * - Violation history
 * - Calibration UI
 */

import { useState } from 'react';
import { 
  Eye, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle,
  Settings,
  TrendingUp,
  Clock,
  X,
  Shield,
  EyeOff
} from 'lucide-react';
import type { 
  GazeSample, 
  GazeViolation, 
  GazeWarning,
  AttentionMetrics 
} from '../lib/gaze/GazeTrackingEngine';

interface GazeTrackingOverlayProps {
  isRunning: boolean;
  isCalibrated: boolean;
  modelsLoaded: boolean;
  currentSample: GazeSample | null;
  currentZone: string;
  metrics: AttentionMetrics;
  violations: GazeViolation[];
  warnings: GazeWarning[];
  warningLevel: number;
  latestWarning: GazeWarning | null;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  onCalibrate: () => void;
  onClearViolations: () => void;
  onClearWarnings: () => void;
}

export const GazeTrackingOverlay: React.FC<GazeTrackingOverlayProps> = ({
  isRunning,
  isCalibrated,
  modelsLoaded,
  currentSample,
  currentZone,
  metrics,
  violations,
  warnings: _warnings,
  warningLevel,
  latestWarning,
  error,
  onStart,
  onStop,
  onCalibrate,
  onClearViolations,
  onClearWarnings
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showViolations, setShowViolations] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const getZoneColor = (zone: string) => {
    switch (zone) {
      case 'on-screen':
        return 'bg-green-500';
      case 'left':
      case 'right':
      case 'up':
      case 'down':
        return 'bg-yellow-500';
      case 'away':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getZoneIcon = (zone: string) => {
    switch (zone) {
      case 'on-screen':
        return <Eye className="w-4 h-4" />;
      case 'left':
        return '←';
      case 'right':
        return '→';
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'away':
        return <EyeOff className="w-4 h-4" />;
      default:
        return <Eye className="w-4 h-4" />;
    }
  };

  const getWarningColor = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-yellow-500 border-yellow-600 text-yellow-900';
      case 2:
        return 'bg-orange-500 border-orange-600 text-orange-900';
      case 3:
        return 'bg-red-500 border-red-600 text-red-900 animate-pulse';
      default:
        return 'bg-green-500 border-green-600 text-green-900';
    }
  };

  const getAttentionColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-yellow-600';
    if (percentage >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Warning banner
  if (warningLevel > 0 && latestWarning) {
    return (
      <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-4 rounded-lg border-2 shadow-lg ${getWarningColor(warningLevel)}`}>
        <div className="flex items-center space-x-3">
          {warningLevel === 1 && <AlertTriangle className="w-6 h-6" />}
          {warningLevel === 2 && <AlertCircle className="w-6 h-6" />}
          {warningLevel === 3 && <Shield className="w-6 h-6" />}
          <p className="font-semibold text-lg">{latestWarning.message}</p>
          <button
            onClick={onClearWarnings}
            className="ml-4 p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center">
          <Eye className="w-4 h-4 mr-2 text-blue-600" />
          Gaze Tracking
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            title="Toggle details"
          >
            <TrendingUp className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Status Indicator */}
      <div className={`p-3 rounded-lg border-2 ${
        isRunning 
          ? 'bg-green-50 border-green-200' 
          : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">Status</span>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500' : 'bg-gray-400'} animate-pulse`} />
            <span className="text-xs font-semibold">{isRunning ? 'Active' : 'Inactive'}</span>
          </div>
        </div>

        {/* Current Zone */}
        {currentSample && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`p-1.5 rounded ${getZoneColor(currentZone)}`}>
                <span className="text-white text-xs">
                  {getZoneIcon(currentZone)}
                </span>
              </div>
              <span className="text-xs font-medium capitalize">
                {currentZone.replace('-', ' ')}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {(currentSample.confidence * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* Attention Score */}
      {isRunning && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-blue-900">Attention Score</span>
            <span className={`text-lg font-bold ${getAttentionColor(metrics.attentionPercentage)}`}>
              {metrics.attentionPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                metrics.attentionPercentage >= 90 ? 'bg-green-500' :
                metrics.attentionPercentage >= 75 ? 'bg-yellow-500' :
                metrics.attentionPercentage >= 50 ? 'bg-orange-500' :
                'bg-red-500'
              }`}
              style={{ width: `${metrics.attentionPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Detailed Metrics */}
      {showDetails && isRunning && (
        <div className="space-y-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              Session Time
            </span>
            <span className="font-mono font-semibold">{formatTime(metrics.totalSessionTime)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">On-Screen Time</span>
            <span className="font-mono font-semibold text-green-600">{formatTime(metrics.onScreenTime)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Off-Screen Time</span>
            <span className="font-mono font-semibold text-red-600">{formatTime(metrics.offScreenTime)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Gaze Shifts</span>
            <span className="font-mono font-semibold">{metrics.gazeShifts}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Blink Rate</span>
            <span className="font-mono font-semibold">{metrics.blinkRate.toFixed(1)}/min</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Face Distance</span>
            <span className="font-mono font-semibold">{(metrics.averageFaceDistance * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Violations */}
      {violations.length > 0 && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-red-900 flex items-center">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Violations ({violations.length})
            </span>
            <button
              onClick={onClearViolations}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Clear
            </button>
          </div>
          <button
            onClick={() => setShowViolations(!showViolations)}
            className="text-xs text-red-700 hover:text-red-900"
          >
            {showViolations ? 'Hide' : 'Show'} recent violations
          </button>
          
          {showViolations && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {violations.slice(-5).reverse().map((violation, idx) => (
                <div key={idx} className="text-xs p-2 bg-red-100 rounded">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{violation.type}</span>
                    <span className="text-gray-500">
                      {new Date(violation.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-gray-700">{violation.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex space-x-2">
        {!isRunning ? (
          <button
            onClick={onStart}
            disabled={!modelsLoaded}
            className="flex-1 px-3 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {modelsLoaded ? 'Start Tracking' : 'Loading...'}
          </button>
        ) : (
          <button
            onClick={onStop}
            className="flex-1 px-3 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Stop Tracking
          </button>
        )}
        {!isCalibrated && modelsLoaded && (
          <button
            onClick={onCalibrate}
            className="px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Calibrate
          </button>
        )}
      </div>

      {/* Calibration Status */}
      {isCalibrated && (
        <div className="flex items-center justify-center space-x-1 text-xs text-green-600">
          <CheckCircle className="w-3 h-3" />
          <span>Calibrated</span>
        </div>
      )}
    </div>
  );
};
