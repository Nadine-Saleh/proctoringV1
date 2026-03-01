import { Eye, AlertTriangle, CheckCircle, EyeOff } from 'lucide-react';
import type { EyeGazeData, SuspiciousGazeEvent } from '../hooks/useEyeGazeDetection';

interface EyeGazeMonitorProps {
  gazeData: EyeGazeData | null;
  isDetecting: boolean;
  modelsLoaded: boolean;
  loading: boolean;
  error: string | null;
  suspiciousEvents: SuspiciousGazeEvent[];
  onStartDetection: () => void;
  onStopDetection: () => void;
  onClearEvents: () => void;
}

export const EyeGazeMonitor: React.FC<EyeGazeMonitorProps> = ({
  gazeData,
  isDetecting,
  modelsLoaded,
  loading,
  error,
  suspiciousEvents,
  onStartDetection,
  onStopDetection,
  onClearEvents
}) => {
  const getGazeDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'left':
        return '←';
      case 'right':
        return '→';
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'looking-away':
        return '↗';
      default:
        return '●';
    }
  };

  const getGazeStatusColor = (direction: string) => {
    if (direction === 'center') return 'text-green-600 bg-green-50';
    if (direction === 'looking-away') return 'text-red-600 bg-red-50';
    return 'text-yellow-600 bg-yellow-50';
  };

  const getEyeOpennessColor = (ear: number) => {
    if (ear > 0.25) return 'bg-green-500';
    if (ear > 0.2) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getEventTypeLabel = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Eye className="w-5 h-5 mr-2 text-blue-600" />
            Eye Gaze Monitor
          </h3>
          <div className="flex items-center space-x-2">
            {loading && (
              <span className="text-xs text-gray-500">Loading models...</span>
            )}
            {error && (
              <span className="text-xs text-red-500" title={error}>⚠️ Error</span>
            )}
            {isDetecting ? (
              <button
                onClick={onStopDetection}
                className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={onStartDetection}
                disabled={!modelsLoaded || loading}
                className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {modelsLoaded ? 'Start Detection' : 'Loading...'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Status */}
        <div className="mb-6">
          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
              <span className="ml-3 text-sm text-gray-600">Loading eye tracking models...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-2 gap-4">
              <div
                className={`p-4 rounded-lg border ${
                  modelsLoaded
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Models</span>
                  {modelsLoaded ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <p
                  className={`text-sm font-semibold ${
                    modelsLoaded ? 'text-green-700' : 'text-gray-500'
                  }`}
                >
                  {modelsLoaded ? 'Ready' : 'Not Loaded'}
                </p>
              </div>

              <div
                className={`p-4 rounded-lg border ${
                  isDetecting ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Detection</span>
                  {isDetecting ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <p
                  className={`text-sm font-semibold ${
                    isDetecting ? 'text-green-700' : 'text-gray-500'
                  }`}
                >
                  {isDetecting ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Real-time Gaze Data */}
        {gazeData && isDetecting && (
          <div className="mb-6 space-y-4">
            <h4 className="text-sm font-semibold text-gray-700">Real-time Gaze Data</h4>

            {/* Gaze Direction */}
            <div className={`p-4 rounded-lg ${getGazeStatusColor(gazeData.gazeDirection)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Gaze Direction</p>
                  <p className="text-2xl font-bold mt-1">
                    {getGazeDirectionIcon(gazeData.gazeDirection)}{' '}
                    {gazeData.gazeDirection.charAt(0).toUpperCase() + gazeData.gazeDirection.slice(1)}
                  </p>
                </div>
                {gazeData.isLookingAway && (
                  <AlertTriangle className="w-8 h-8 text-red-600 animate-pulse" />
                )}
              </div>
              {/* Debug: Pupil positions */}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500 font-mono">
                  Left: ({gazeData.leftPupilPosition?.x.toFixed(4)}, {gazeData.leftPupilPosition?.y.toFixed(4)}) | 
                  Right: ({gazeData.rightPupilPosition?.x.toFixed(4)}, {gazeData.rightPupilPosition?.y.toFixed(4)})
                </p>
              </div>
            </div>

            {/* Eye Openness Bars */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-600 mb-2">Left Eye</p>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${getEyeOpennessColor(
                        gazeData.leftEyeOpen
                      )}`}
                      style={{ width: `${Math.min(100, gazeData.leftEyeOpen * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-gray-700">
                    {gazeData.leftEyeOpen.toFixed(2)}
                  </span>
                </div>
                {gazeData.isBlinking && (
                  <p className="text-xs text-yellow-600 mt-1">Blinking</p>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-600 mb-2">Right Eye</p>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${getEyeOpennessColor(
                        gazeData.rightEyeOpen
                      )}`}
                      style={{ width: `${Math.min(100, gazeData.rightEyeOpen * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-gray-700">
                    {gazeData.rightEyeOpen.toFixed(2)}
                  </span>
                </div>
                {gazeData.isBlinking && (
                  <p className="text-xs text-yellow-600 mt-1">Blinking</p>
                )}
              </div>
            </div>

            {/* Pupil Position */}
            {gazeData.leftPupilPosition && gazeData.rightPupilPosition && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-600 mb-2">Pupil Position</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Left:</span>
                    <span className="font-mono text-gray-700">
                      ({gazeData.leftPupilPosition.x.toFixed(3)},{' '}
                      {gazeData.leftPupilPosition.y.toFixed(3)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Right:</span>
                    <span className="font-mono text-gray-700">
                      ({gazeData.rightPupilPosition.x.toFixed(3)},{' '}
                      {gazeData.rightPupilPosition.y.toFixed(3)})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Suspicious Events */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">
              Suspicious Events ({suspiciousEvents.length})
            </h4>
            {suspiciousEvents.length > 0 && (
              <button
                onClick={onClearEvents}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-64 overflow-auto">
            {suspiciousEvents.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p>No suspicious events detected</p>
              </div>
            ) : (
              suspiciousEvents.slice().reverse().map((event, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border text-sm ${getSeverityColor(event.severity)}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{getEventTypeLabel(event.type)}</span>
                    <span className="text-xs opacity-75">{formatTimestamp(event.timestamp)}</span>
                  </div>
                  <p className="text-xs opacity-90">{event.description}</p>
                  {event.duration && (
                    <p className="text-xs opacity-75 mt-1">Duration: {Math.round(event.duration / 1000)}s</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
