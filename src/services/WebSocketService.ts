// ============================================
// Phase 3: WebSocket Service
// ============================================
// Manages WebSocket connection for real-time instructor alerts
// Responsibility: Connection lifecycle, message sending/receiving

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

type MessageHandler = (data: any) => void;

export interface WebSocketServiceConfig {
  url: string;
  reconnectAttempts?: number;
  reconnectDelayMs?: number;
  heartbeatIntervalMs?: number;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private config: WebSocketServiceConfig;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempt = 0;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private messageQueue: string[] = [];

  constructor(config: WebSocketServiceConfig) {
    this.config = {
      reconnectAttempts: 5,
      reconnectDelayMs: 3000,
      heartbeatIntervalMs: 30000,
      ...config,
    };
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.state === 'connected') {
        resolve(true);
        return;
      }

      this.setState('connecting');
      console.log(`[WebSocketService] Connecting to ${this.config.url}...`);

      try {
        this.ws = new WebSocket(this.config.url);

        this.ws.onopen = () => {
          console.log('[WebSocketService] Connected successfully');
          this.setState('connected');
          this.reconnectAttempt = 0;
          this.startHeartbeat();
          this.flushMessageQueue();
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (err) {
            console.error('[WebSocketService] Failed to parse message:', err);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocketService] Connection error:', error);
          this.setState('error');
        };

        this.ws.onclose = (event) => {
          console.log(`[WebSocketService] Connection closed (code: ${event.code})`);
          this.setState('disconnected');
          this.stopHeartbeat();
          this.attemptReconnect();
        };
      } catch (err) {
        console.error('[WebSocketService] Failed to create connection:', err);
        this.setState('error');
        resolve(false);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    console.log('[WebSocketService] Disconnecting...');
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }

    this.setState('disconnected');
    this.reconnectAttempt = this.config.reconnectAttempts || 5; // Prevent reconnection
  }

  /**
   * Send a message
   */
  send(type: string, payload: any): boolean {
    const message = JSON.stringify({ type, payload });

    if (this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
      console.log(`[WebSocketService] Message sent: ${type}`);
      return true;
    }

    // Queue message for later delivery
    console.warn(`[WebSocketService] Queuing message (not connected): ${type}`);
    this.messageQueue.push(message);
    return false;
  }

  /**
   * Register a message handler
   */
  on(messageType: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
  }

  /**
   * Remove a message handler
   */
  off(messageType: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    const maxAttempts = this.config.reconnectAttempts || 5;

    if (this.reconnectAttempt >= maxAttempts) {
      console.error('[WebSocketService] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempt++;
    const delay = Math.min(
      (this.config.reconnectDelayMs || 3000) * Math.pow(2, this.reconnectAttempt - 1),
      30000
    );

    console.log(
      `[WebSocketService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt}/${maxAttempts})...`
    );

    setTimeout(() => {
      if (this.state === 'disconnected' || this.state === 'error') {
        this.connect();
      }
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    const interval = this.config.heartbeatIntervalMs || 30000;
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send('ping', { timestamp: Date.now() });
      }
    }, interval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: any): void {
    const messageType = data.type || 'unknown';
    const handlers = this.messageHandlers.get(messageType);

    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data.payload);
        } catch (err) {
          console.error(`[WebSocketService] Handler error for ${messageType}:`, err);
        }
      });
    } else {
      console.warn(`[WebSocketService] No handlers for message type: ${messageType}`);
    }
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(message);
      }
    }
    console.log('[WebSocketService] Message queue flushed');
  }

  /**
   * Update connection state
   */
  private setState(state: ConnectionState): void {
    this.state = state;
    console.log(`[WebSocketService] State changed: ${state}`);
  }
}

// Singleton instance for instructor monitoring
let instructorWebSocketService: WebSocketService | null = null;

/**
 * Get or create the instructor WebSocket service
 */
export function getInstructorWebSocketService(): WebSocketService {
  if (!instructorWebSocketService) {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/instructor';
    instructorWebSocketService = new WebSocketService({
      url: wsUrl,
      reconnectAttempts: 10,
      reconnectDelayMs: 2000,
      heartbeatIntervalMs: 25000,
    });
  }

  return instructorWebSocketService;
}

/**
 * Check if instructor WebSocket is initialized
 */
export function hasInstructorWebSocketService(): boolean {
  return instructorWebSocketService !== null;
}

/**
 * Reset instructor WebSocket service (for testing or reconnection)
 */
export function resetInstructorWebSocketService(): void {
  if (instructorWebSocketService) {
    instructorWebSocketService.disconnect();
    instructorWebSocketService = null;
  }
}
