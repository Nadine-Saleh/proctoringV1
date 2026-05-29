import { useState, useCallback, useRef } from 'react';
import { IdentityVerificationService } from '../services/IdentityVerificationService';

type CaptureStatus = 'idle' | 'capturing' | 'processing' | 'success' | 'error';

interface UseReferenceCaptureReturn {
  status: CaptureStatus;
  error: string | null;
  qualityScore: number | null;
  captureReference: (videoEl: HTMLVideoElement) => Promise<boolean>;
  reset: () => void;
}

const CAPTURE_FRAMES = 3;
const MIN_PAIRWISE_SIMILARITY = 0.7;

function euclideanDistance(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

function medianEmbedding(embeddings: Float32Array[]): Float32Array {
  const len = embeddings[0].length;
  const result = new Float32Array(len);
  const mid = Math.floor(embeddings.length / 2);
  const sorted = [...embeddings].sort((a, b) => {
    const sumA = a.reduce((s, v) => s + v, 0);
    const sumB = b.reduce((s, v) => s + v, 0);
    return sumA - sumB;
  });
  for (let i = 0; i < len; i++) {
    result[i] = sorted[mid][i];
  }
  return result;
}

export function useReferenceCapture(): UseReferenceCaptureReturn {
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const abortRef = useRef(false);

  const captureReference = useCallback(async (videoEl: HTMLVideoElement): Promise<boolean> => {
    setStatus('capturing');
    setError(null);
    abortRef.current = false;

    try {
      const embeddings: Float32Array[] = [];

      for (let i = 0; i < CAPTURE_FRAMES; i++) {
        if (abortRef.current) return false;

        const embedding = await IdentityVerificationService.extractEmbedding(videoEl);
        if (!embedding) {
          setStatus('error');
         setError('Please make sure exactly one clear face is visible, and stay close to the camera.');
          return false;
        }
        embeddings.push(embedding);

        // Small delay between frames for diversity
        if (i < CAPTURE_FRAMES - 1) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      // Validate pairwise similarity to ensure consistent face across frames
      for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
          const dist = euclideanDistance(embeddings[i], embeddings[j]);
          const similarity = 1 - dist / 2;
          if (similarity < MIN_PAIRWISE_SIMILARITY) {
            setStatus('error');
            setError('Face consistency too low. Please stay still and retry.');
            return false;
          }
        }
      }

      setStatus('processing');

      const median = medianEmbedding(embeddings);
      const avgPairDist =
        embeddings.reduce((acc, e, i) => {
          if (i === 0) return acc;
          return acc + euclideanDistance(e, embeddings[i - 1]);
        }, 0) / Math.max(1, embeddings.length - 1);

      const quality = Math.max(0, Math.min(1, 1 - avgPairDist / 2));

      const result = await IdentityVerificationService.saveReferenceEmbedding(median, quality);
      if (!result.success) {
        setStatus('error');
        setError(result.error ?? 'Failed to save reference.');
        return false;
      }

      setQualityScore(quality);
      setStatus('success');
      return true;
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Capture failed');
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current = true;
    setStatus('idle');
    setError(null);
    setQualityScore(null);
  }, []);

  return { status, error, qualityScore, captureReference, reset };
}
