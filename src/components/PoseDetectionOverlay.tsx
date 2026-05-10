import { useEffect, useRef } from 'react';

interface PoseDetectionOverlayProps {
  videoElement: HTMLVideoElement | null;
  isDetecting: boolean;
  frameStatus: 'valid' | 'invalid' | 'idle';
  statusMessage: string;
  isModelLoaded: boolean;
}

export const PoseDetectionOverlay: React.FC<PoseDetectionOverlayProps> = ({
  videoElement,
  isDetecting,
  frameStatus,
  statusMessage,
  isModelLoaded
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draw the inner frame and status indicator
  useEffect(() => {
    if (!videoElement || !canvasRef.current || !isDetecting) return;

    const canvas = canvasRef.current;
    const containerWidth = canvas.parentElement?.clientWidth || videoElement.clientWidth || videoElement.videoWidth;
    const containerHeight = canvas.parentElement?.clientHeight || videoElement.clientHeight || videoElement.videoHeight;
    if (!containerWidth || !containerHeight) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(containerWidth * dpr);
    canvas.height = Math.round(containerHeight * dpr);
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, containerWidth, containerHeight);

    const frameColor =
      frameStatus === 'valid'
        ? 'rgba(34, 197, 94, 0.3)' // Green
        : frameStatus === 'invalid'
          ? 'rgba(239, 68, 68, 0.3)' // Red
          : 'rgba(107, 114, 128, 0.3)'; // Gray

    const borderColor =
      frameStatus === 'valid'
        ? '#22c55e' // Green border
        : frameStatus === 'invalid'
          ? '#ef4444' // Red border
          : '#6b7280'; // Gray border

    // Draw inner frame (95% of container)
    const frameWidth = containerWidth * 0.95;
    const frameHeight = containerHeight * 0.95;
    const frameX = (containerWidth - frameWidth) / 2;
    const frameY = (containerHeight - frameHeight) / 2;

    // Fill the inner frame with semi-transparent color
    ctx.fillStyle = frameColor;
    ctx.fillRect(frameX, frameY, frameWidth, frameHeight);

    // Draw border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(frameX, frameY, frameWidth, frameHeight);

    // Draw corner indicators
    const cornerLength = Math.min(containerWidth, containerHeight) * 0.05;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(frameX, frameY + cornerLength);
    ctx.lineTo(frameX, frameY);
    ctx.lineTo(frameX + cornerLength, frameY);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(frameX + frameWidth - cornerLength, frameY);
    ctx.lineTo(frameX + frameWidth, frameY);
    ctx.lineTo(frameX + frameWidth, frameY + cornerLength);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(frameX, frameY + frameHeight - cornerLength);
    ctx.lineTo(frameX, frameY + frameHeight);
    ctx.lineTo(frameX + cornerLength, frameY + frameHeight);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(frameX + frameWidth - cornerLength, frameY + frameHeight);
    ctx.lineTo(frameX + frameWidth, frameY + frameHeight);
    ctx.lineTo(frameX + frameWidth, frameY + frameHeight - cornerLength);
    ctx.stroke();
  }, [videoElement, isDetecting, frameStatus]);

  if (!isDetecting || !isModelLoaded) {
    return null;
  }

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-10"
        style={{ pointerEvents: 'none', width: '100%', height: '100%' }}
      />

      {frameStatus === 'invalid' && statusMessage && (
        <div
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 px-6 py-3 rounded-lg backdrop-blur-sm bg-red-500/80 text-white text-center max-w-xs"
        >
          <p className="font-medium text-sm">{statusMessage}</p>
        </div>
      )}
    </div>
  );
};
