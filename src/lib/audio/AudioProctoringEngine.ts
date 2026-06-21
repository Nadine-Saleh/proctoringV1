const SIDECAR_URL = 'http://localhost:8000';
const CHUNK_DURATION_MS = 5_000;
const TIMEOUT_MS = 30_000;
const MAX_CONSECUTIVE_FAILURES = 5;

// Fix #5: scoped key prevents flag bleed across sessions/exams
const FLAG_COUNT_KEY = (sessionId: string, examId: string) =>
  `audio_proctoring_flag_count_${sessionId}_${examId}`;

export type AudioEvent =
  | { type: 'normal_speech'; flagId: string; transcript: string; confidence: number }
  | { type: 'suspicious_speech'; flagId: string; transcript: string; confidence: number }
  | { type: 'degraded' }
  | { type: 'recovered' }; // Fix #3

type Listener = (event: AudioEvent) => void;

export class AudioProctoringEngine {
  private sessionId: string;
  private examId: string;
  private stream: MediaStream | null = null;
  private ownsStream = false;
  private recorder: MediaRecorder | null = null;
  private chunkIndex = 0;
  private consecutiveFailures = 0;
  private degraded = false;
  private listeners = new Set<Listener>();
  private running = false;

  constructor(sessionId: string, examId: string) {
    this.sessionId = sessionId;
    this.examId = examId;
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: AudioEvent) {
    this.listeners.forEach(l => l(event));
  }

  // Fix #5: scoped to session + exam
  get flagCount(): number {
    return parseInt(localStorage.getItem(FLAG_COUNT_KEY(this.sessionId, this.examId)) ?? '0', 10);
  }

  private incrementFlag() {
    localStorage.setItem(FLAG_COUNT_KEY(this.sessionId, this.examId), String(this.flagCount + 1));
  }

  async start(existingStream?: MediaStream): Promise<void> {
    if (this.running) return;
    if (existingStream) {
      this.stream = existingStream;
      this.ownsStream = false;
    } else {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.ownsStream = true;
    }
    this.running = true;
    this.scheduleChunk();
  }

  // Fix #6: idempotent — safe to call twice
  stop(): void {
    if (!this.running && this.recorder === null && this.stream === null) return;
    this.running = false;
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
    if (this.ownsStream) {
      this.stream?.getTracks().forEach(t => t.stop());
    }
    this.recorder = null;
    this.stream = null;
  }

  private scheduleChunk(): void {
    if (!this.running || !this.stream) return;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const recorder = new MediaRecorder(this.stream, { mimeType });
    this.recorder = recorder;
    const chunks: Blob[] = [];

    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };

recorder.onstop = () => {
  if (!this.running) return;

  const blob = new Blob(chunks, { type: mimeType });

  console.log(
    `[Audio] Chunk ${this.chunkIndex}`,
    "Blob size:", blob.size,
    "Chunks:", chunks.length
  );

  this.sendChunk(blob, this.chunkIndex++)
    .finally(() => this.scheduleChunk());
};

    recorder.start();
    setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, CHUNK_DURATION_MS);
  }

  private async sendChunk(blob: Blob, index: number): Promise<void> {
    const pcmBuffer = await this.decodeToPcmF32(blob);
    // Fix #4: decode failure counts toward degraded, not silent skip
 if (!pcmBuffer) {
      console.log('[Audio] PCM decode failed for blob, skipping chunk');
      this.handleNetworkFailure();
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${SIDECAR_URL}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Session-Id': this.sessionId,
          'X-Exam-Id': this.examId,
          'X-Sample-Rate': '16000',
          'X-Chunk-Index': String(index),
        },
        body: pcmBuffer,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        this.handleNetworkFailure();
        return;
      }

      const data = await response.json() as {
        flag_id: string;
        classification: string;
        confidence: number;
        transcript: string;
      };

      this.consecutiveFailures = 0;

      // Fix #3: emit recovered so UI can return to green
      if (this.degraded) {
        this.degraded = false;
        this.emit({ type: 'recovered' });
      }

      if (data.classification === 'suspicious_speech') {
        this.incrementFlag();
        this.emit({
          type: 'suspicious_speech',
          flagId: data.flag_id,
          transcript: data.transcript,
          confidence: data.confidence,
        });
      } else {
        this.emit({
          type: 'normal_speech',
          flagId: data.flag_id,
          transcript: data.transcript,
          confidence: data.confidence,
        });
      }
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === 'AbortError') {
        // timeout — do not count as failure
        return;
      }
      this.handleNetworkFailure();
    }
  }

  private handleNetworkFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && !this.degraded) {
      this.degraded = true;
      this.emit({ type: 'degraded' });
    }
  }

  private async decodeToPcmF32(blob: Blob): Promise<ArrayBuffer | null> {
    try {
            console.log('[Audio] decoding blob size:', blob.size, 'type:', blob.type);
      const arrayBuffer = await blob.arrayBuffer();
      const ctx = new OfflineAudioContext(1, 1, 16000);
      const decoded = await ctx.decodeAudioData(arrayBuffer);

      // Resample to 16 kHz mono
      const offlineCtx = new OfflineAudioContext(
        1,
        Math.ceil(decoded.duration * 16000),
        16000,
      );
      const source = offlineCtx.createBufferSource();
      source.buffer = decoded;
      source.connect(offlineCtx.destination);
      source.start(0);
      const resampled = await offlineCtx.startRendering();
      return resampled.getChannelData(0).buffer;
    } catch {
      return null;
    }
  }
}
