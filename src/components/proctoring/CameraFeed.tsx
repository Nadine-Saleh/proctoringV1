import { CameraOff, Video } from 'lucide-react';
import type { RefCallback } from 'react';
import type { ProctoringStatus } from '../../hooks/useProctoring';

interface CameraFeedProps {
  status: ProctoringStatus;
  videoRef: RefCallback<HTMLVideoElement>;
  onRetry: () => void;
}

export const CameraFeed = ({ status, videoRef, onRetry }: CameraFeedProps) => (
  <div className="rounded-lg aspect-video mb-4 bg-black relative overflow-hidden">
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity ${status.camera ? 'opacity-100' : 'opacity-0'}`}
    />

    {status.loading && !status.errorMessage && (
      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
        <div className="text-center text-white">
          <Video className="w-12 h-12 mx-auto mb-3 animate-pulse" />
          <p className="text-sm">Initializing camera...</p>
        </div>
      </div>
    )}

    {status.errorMessage && (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80">
        <div className="text-center text-white p-4">
          <CameraOff className="w-12 h-12 mx-auto mb-3 text-red-400" />
          <p className="text-sm mb-4">{status.errorMessage}</p>
          <button onClick={onRetry} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">Retry</button>
        </div>
      </div>
    )}

    {!status.camera && !status.loading && !status.errorMessage && (
      <div className="absolute inset-0 flex items-center justify-center">
        <CameraOff className="w-12 h-12 text-gray-400" />
      </div>
    )}

    {status.multipleFaces && (
      <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center animate-pulse">
        <div className="bg-red-600 text-white px-4 py-2 rounded font-bold">Multiple Faces!</div>
      </div>
    )}

    <div className="absolute top-2 right-2">
      <div className={`w-3 h-3 rounded-full ${status.camera ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
    </div>
  </div>
);
