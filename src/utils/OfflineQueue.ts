// ============================================
// Phase 3: Offline Queue Utility
// ============================================
// Stores failed submissions in localStorage and retries them
// Responsibility: Reliable delivery of events even with poor connectivity

const QUEUE_KEY = 'proctoring_offline_queue';
const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 15000; // 15 seconds
const MAX_QUEUE_SIZE = 100; // Drop oldest if queue exceeds this

export interface QueuedItem<T = unknown> {
  id: string;
  data: T;
  timestamp: number;
  retries: number;
  lastAttempt: number | null;
}

type ProcessFn<T> = (data: T) => Promise<{ success: boolean; error?: string }>;

export class OfflineQueue<T = unknown> {
  private queue: QueuedItem<T>[] = [];
  private processor: ProcessFn<T>;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;

  constructor(processor: ProcessFn<T>) {
    this.processor = processor;
    this.loadFromStorage();
  }

  /**
   * Add an item to the queue
   */
  enqueue(data: T): string {
    const item: QueuedItem<T> = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      data,
      timestamp: Date.now(),
      retries: 0,
      lastAttempt: null,
    };

    this.queue.push(item);

    // Trim queue if it exceeds max size (drop oldest)
    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue = this.queue.slice(-MAX_QUEUE_SIZE);
    }

    this.saveToStorage();
    console.log(`[OfflineQueue] Enqueued item ${item.id}. Queue size: ${this.queue.length}`);

    return item.id;
  }

  /**
   * Start processing the queue at regular intervals
   */
  start(intervalMs = RETRY_INTERVAL_MS): void {
    if (this.intervalId) {
      console.warn('[OfflineQueue] Already running, stopping first');
      this.stop();
    }

    console.log(`[OfflineQueue] Starting processor (every ${intervalMs}ms)`);

    // Process immediately if there are items
    if (this.queue.length > 0) {
      this.processQueue();
    }

    // Start interval
    this.intervalId = setInterval(() => {
      this.processQueue();
    }, intervalMs);
  }

  /**
   * Stop processing the queue
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[OfflineQueue] Stopped');
  }

  /**
   * Process all items in the queue
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`[OfflineQueue] Processing ${this.queue.length} items...`);

    const failedItems: QueuedItem<T>[] = [];

    for (let i = this.queue.length - 1; i >= 0; i--) {
      const item = this.queue[i];

      // Check if max retries exceeded
      if (item.retries >= MAX_RETRIES) {
        console.warn(`[OfflineQueue] Item ${item.id} exceeded max retries, dropping`);
        this.queue.splice(i, 1);
        continue;
      }

      // Check if we should wait before retrying (backoff)
      if (item.lastAttempt) {
        const timeSinceLastAttempt = Date.now() - item.lastAttempt;
        const backoffMs = Math.min(RETRY_INTERVAL_MS * Math.pow(2, item.retries), 120000); // Max 2 min
        if (timeSinceLastAttempt < backoffMs) {
          continue; // Not ready for retry yet
        }
      }

      // Attempt to process
      item.retries++;
      item.lastAttempt = Date.now();

      try {
        const result = await this.processor(item.data);

        if (result.success) {
          console.log(`[OfflineQueue] Item ${item.id} processed successfully`);
          this.queue.splice(i, 1);
        } else {
          console.warn(`[OfflineQueue] Item ${item.id} failed: ${result.error}`);
          failedItems.push(item);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[OfflineQueue] Item ${item.id} error:`, message);
        failedItems.push(item);
      }
    }

    this.saveToStorage();
    this.isProcessing = false;

    if (failedItems.length > 0) {
      console.log(`[OfflineQueue] ${failedItems.length} items failed, will retry later`);
    } else {
      console.log('[OfflineQueue] Queue processing complete');
    }
  }

  /**
   * Get current queue size
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Get all items in queue
   */
  get items(): ReadonlyArray<QueuedItem<T>> {
    return [...this.queue];
  }

  /**
   * Clear the entire queue
   */
  clear(): void {
    this.queue = [];
    this.saveToStorage();
    console.log('[OfflineQueue] Queue cleared');
  }

  /**
   * Save queue to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (err) {
      console.error('[OfflineQueue] Failed to save queue to storage:', err);
      // If storage is full, drop oldest half
      if (this.queue.length > 10) {
        this.queue = this.queue.slice(-Math.floor(this.queue.length / 2));
        try {
          localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
        } catch {
          console.error('[OfflineQueue] Still failed after trimming');
        }
      }
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(`[OfflineQueue] Loaded ${this.queue.length} items from storage`);
      }
    } catch (err) {
      console.error('[OfflineQueue] Failed to load queue from storage:', err);
      this.queue = [];
    }
  }
}
