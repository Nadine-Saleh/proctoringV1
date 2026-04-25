/**
 * Idempotency helpers for offline buffering and replay.
 *
 * client_event_id is a unique identifier generated on the client
 * and used to detect and suppress duplicate event uploads.
 *
 * Schema: <sessionId>-<timestamp>-<randomSuffix>
 * Example: "550e8400-e29b-41d4-a716-446655440000-1713457292.3-abc123"
 */

/**
 * Generate a unique client_event_id for an offline event.
 * Format: <sessionId>-<timestamp>-<randomSuffix>
 * @param sessionId Exam session UUID
 * @returns A unique client_event_id string
 */
export function generateClientEventId(sessionId: string): string {
  const timestamp = Date.now() / 1000; // seconds with fractional part
  const randomSuffix = Math.random().toString(36).substring(2, 8); // 6 random alphanumeric chars
  return `${sessionId}-${timestamp}-${randomSuffix}`;
}

/**
 * Parse a client_event_id to extract its components.
 * @param clientEventId The event ID to parse
 * @returns Parsed components or null if invalid
 */
export function parseClientEventId(
  clientEventId: string
): {
  sessionId: string;
  timestamp: number;
  randomSuffix: string;
} | null {
  const parts = clientEventId.split('-');
  if (parts.length < 3) return null;

  // Session ID is typically UUID (36 chars with dashes), but we'll be lenient
  // and assume the last two parts are timestamp and suffix
  const randomSuffix = parts.pop();
  const timestamp = parseFloat(parts.pop() ?? '');
  const sessionId = parts.join('-');

  if (!sessionId || !randomSuffix || isNaN(timestamp)) {
    return null;
  }

  return { sessionId, timestamp, randomSuffix };
}

/**
 * Deduplicate events by client_event_id.
 * Keeps the first occurrence of each ID, discards duplicates.
 * @param events Array of events with client_event_id field
 * @returns Deduplicated array and count of removed duplicates
 */
export function deduplicateByClientEventId<
  T extends { client_event_id: string }
>(events: T[]): { events: T[]; deduplicated: number } {
  const seen = new Set<string>();
  const deduplicated: T[] = [];
  let duplicateCount = 0;

  for (const event of events) {
    if (!seen.has(event.client_event_id)) {
      seen.add(event.client_event_id);
      deduplicated.push(event);
    } else {
      duplicateCount++;
    }
  }

  return { events: deduplicated, deduplicated: duplicateCount };
}

/**
 * Reconcile offline-buffered events with server state.
 * Used after reconnection to identify events that were uploaded
 * while offline vs. events that still need to be sent.
 *
 * @param bufferedEvents Events that were queued offline
 * @param serverEventIds Set of client_event_ids already on the server
 * @returns Events that still need to be uploaded
 */
export function reconcileOfflineBuffer<
  T extends { client_event_id: string }
>(bufferedEvents: T[], serverEventIds: Set<string>): T[] {
  return bufferedEvents.filter((event) => !serverEventIds.has(event.client_event_id));
}
