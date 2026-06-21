
import { useEffect, useRef } from 'react';

interface AudioWarningBannerProps {
  softWarning: boolean;
  strongWarning: boolean;
}

export function AudioWarningBanner({ softWarning, strongWarning }: AudioWarningBannerProps) {
  const softTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const strongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss is controlled by the parent hook; the banner simply animates.
  // We trigger a visual re-enter on each new `true` edge by using a key derived
  // from a counter, but here we keep it simple — visibility drives max-height.

  useEffect(() => {
    return () => {
      if (softTimerRef.current) clearTimeout(softTimerRef.current);
      if (strongTimerRef.current) clearTimeout(strongTimerRef.current);
    };
  }, []);

  return (
    <div className="pointer-events-none select-none" aria-live="polite">
      {/* Strong warning — orange, shown on top */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: strongWarning ? '80px' : '0px', opacity: strongWarning ? 1 : 0 }}
        role={strongWarning ? 'alert' : undefined}
      >
        <div className="bg-orange-500 text-white px-4 py-2.5 text-sm font-medium flex items-center gap-2 pointer-events-auto">
          <span className="flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </span>
          Audio activity detected. Please remain silent during the exam.
        </div>
      </div>

      {/* Soft warning — amber */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: softWarning && !strongWarning ? '80px' : '0px', opacity: softWarning && !strongWarning ? 1 : 0 }}
        role={softWarning && !strongWarning ? 'alert' : undefined}
      >
        <div className="bg-amber-400 text-amber-950 px-4 py-2.5 text-sm font-medium flex items-center gap-2 pointer-events-auto">
          <span className="flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 9v3m0 0v3m0-3h3m-3 0H9" />
            </svg>
          </span>
          Voice activity detected. Please remain silent.
        </div>
      </div>
    </div>
  );
}
