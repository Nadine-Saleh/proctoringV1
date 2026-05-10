import { CameraOff, Video, AlertOctagon, RefreshCw } from 'lucide-react';
import type { ReactNode, RefCallback } from 'react';
import type { ProctoringStatus } from '../../hooks/useProctoring';

interface CameraFeedProps {
  status: ProctoringStatus;
  videoRef: RefCallback<HTMLVideoElement>;
  onRetry: () => void;
  overlay?: ReactNode;
}

export const CameraFeed = ({ status, videoRef, onRetry, overlay }: CameraFeedProps) => (
  <div className="relative aspect-video rounded-xl overflow-hidden bg-ink-950 ring-1 ring-ink-900/40 shadow-card">
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${
        status.camera ? 'opacity-100' : 'opacity-0'
      }`}
    />

    {/* Vignette */}
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/15" />

    {overlay && <div className="absolute inset-0 z-10 pointer-events-none">{overlay}</div>}

    {/* Loading state */}
    {status.loading && !status.errorMessage && (
      <div className="absolute inset-0 flex items-center justify-center bg-ink-950/80 backdrop-blur-sm">
        <div className="text-center text-white">
          <div className="relative w-12 h-12 mx-auto mb-3">
            <div className="absolute inset-0 rounded-full border-2 border-white/15" />
            <div className="absolute inset-0 rounded-full border-2 border-t-brand-300 animate-spin" />
            <Video className="absolute inset-0 m-auto w-5 h-5 text-brand-300" />
          </div>
          <p className="text-xs font-medium tracking-wide uppercase text-white/80">Initializing</p>
        </div>
      </div>
    )}

    {/* Error state */}
    {status.errorMessage && (
      <div className="absolute inset-0 flex items-center justify-center bg-ink-950/90 backdrop-blur-sm">
        <div className="text-center text-white p-5 max-w-[260px]">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-danger-500/15 ring-1 ring-danger-500/40 flex items-center justify-center">
            <CameraOff className="w-5 h-5 text-danger-300" />
          </div>
          <p className="text-sm mb-4 text-white/90">{status.errorMessage}</p>
          <button
            onClick={onRetry}
            className="btn btn-sm btn-primary"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry camera
          </button>
        </div>
      </div>
    )}

    {/* Idle state */}
    {!status.camera && !status.loading && !status.errorMessage && (
      <div className="absolute inset-0 flex items-center justify-center text-white/40">
        <CameraOff className="w-10 h-10" />
      </div>
    )}

    {/* Multiple faces alert overlay */}
    {status.multipleFaces && (
      <div className="absolute inset-0 z-20 ring-2 ring-inset ring-danger-500 animate-pulse-soft pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-danger-600/95 text-white px-3.5 py-2 rounded-lg shadow-lg flex items-center gap-2 backdrop-blur">
          <AlertOctagon className="w-4 h-4" />
          <span className="text-xs font-semibold tracking-wide uppercase">Multiple faces</span>
        </div>
      </div>
    )}

    {/* Top bar overlays */}
    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-[5]">
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm text-white/90 text-2xs font-semibold tracking-wider uppercase">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            status.camera ? 'bg-danger-500 animate-pulse-soft' : 'bg-ink-500'
          }`}
        />
        {status.camera ? 'Live' : 'Off'}
      </div>
      <div className="text-2xs font-mono tracking-wider px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm text-white/80">
        CAM&nbsp;01
      </div>
    </div>
  </div>
);
