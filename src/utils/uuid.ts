// ============================================
// UUID Utilities for Mock Data
// ============================================

/**
 * Converts a mock numeric ID to a deterministic UUID v4 format.
 * This allows mock data to work with Supabase UUID columns during development.
 * 
 * @param mockId - The mock ID (number or string number)
 * @param namespace - Optional namespace to differentiate ID types
 * @returns A valid UUID v4 string
 */
export function mockIdToUuid(mockId: string | number, namespace: string = 'exam'): string {
  const idStr = String(mockId);
  
  // Create a deterministic UUID from the namespace and ID
  // Using a simple hash to generate consistent UUIDs
  const hash = simpleHash(`${namespace}:${idStr}`);
  
  // Format as UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const hex = hash.toString(16).padStart(32, '0');
  
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    '4' + hex.substring(13, 16), // UUID v4 marker
    ((parseInt(hex.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hex.substring(18, 20), // Variant bits
    hex.substring(20, 32)
  ].join('-');
}

/**
 * Simple hash function for deterministic UUID generation
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Checks if a string is a valid UUID v4 format
 */
export function isValidUuid(str: string): boolean {
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const result = uuidV4Regex.test(str);
  console.log('[isValidUuid] Checking:', str, 'Result:', result);
  return result;
}

/**
 * Ensures an ID is in UUID format, converting mock IDs if necessary
 */
export function ensureUuid(id: string | number, namespace: string = 'exam'): string {
  const idStr = String(id);
  const result = isValidUuid(idStr) ? idStr : mockIdToUuid(idStr, namespace);
  console.log('[ensureUuid] id:', id, 'namespace:', namespace, 'result:', result);
  return result;
}
