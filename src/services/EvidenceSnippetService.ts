import { supabase } from '../lib/supabase/client';

const BUCKET = 'evidence-snippets';

export interface UploadedSnippet {
  bucket_path: string;
  content_type: string;
  byte_length: number;
}

export interface UploadSnippetOptions {
  sessionId: string;
  data: Blob | string;
  contentType?: string;
  extension?: string;
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; contentType: string } {
  const [header, payload] = dataUrl.split(',', 2);
  if (!header || !payload) throw new Error('Invalid data URL');

  const mimeMatch = /data:([^;]+)(;base64)?/.exec(header);
  if (!mimeMatch) throw new Error('Invalid data URL header');
  const contentType = mimeMatch[1] || 'application/octet-stream';
  const isBase64 = Boolean(mimeMatch[2]);

  let bytes: Uint8Array;
  if (isBase64) {
    const binary = atob(payload);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(payload));
  }
  const buffer = new Uint8Array(bytes);
  return { blob: new Blob([buffer], { type: contentType }), contentType };
}

function extensionForContentType(contentType: string, fallback: string): string {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'video/webm') return 'webm';
  if (contentType === 'video/mp4') return 'mp4';
  return fallback;
}

export class EvidenceSnippetService {
  /**
   * Uploads a captured snippet to the private `evidence-snippets` bucket via a
   * signed PUT URL, returning the metadata the caller needs to attach to a
   * violation event's `evidence` field. The RPC `record_violation_batch`
   * inserts the corresponding `evidence_artifacts` row server-side.
   *
   * Caller MUST gate this on `exam.proctoring_policy.visual_evidence_allowed = true`
   * — uploading under a disallowing policy will be rejected by the RPC and
   * wastes bytes (FR-020, SC-010).
   */
  static async upload(options: UploadSnippetOptions): Promise<UploadedSnippet> {
    const { sessionId } = options;
    if (!sessionId) throw new Error('sessionId is required');

    let body: Blob;
    let contentType: string;

    if (typeof options.data === 'string') {
      const converted = dataUrlToBlob(options.data);
      body = converted.blob;
      contentType = options.contentType ?? converted.contentType;
    } else {
      body = options.data;
      contentType = options.contentType ?? options.data.type ?? 'application/octet-stream';
    }

    const ext = extensionForContentType(contentType, options.extension ?? 'bin');
    const bucketPath = `sessions/${sessionId}/${crypto.randomUUID()}.${ext}`;

    const { data: signed, error: signError } = await supabase
      .storage
      .from(BUCKET)
      .createSignedUploadUrl(bucketPath);

    if (signError || !signed) {
      throw new Error(`Failed to create signed upload URL: ${signError?.message ?? 'unknown'}`);
    }

    const { error: uploadError } = await supabase
      .storage
      .from(BUCKET)
      .uploadToSignedUrl(signed.path, signed.token, body, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload snippet: ${uploadError.message}`);
    }

    return {
      bucket_path: signed.path,
      content_type: contentType,
      byte_length: body.size,
    };
  }

  /**
   * T080 — Playback half: returns a short-lived signed GET URL for an evidence
   * artifact so the instructor SubmissionDetail view can play it back.
   * Only instructors who own the exam can call this (enforced by RLS on the
   * evidence-snippets bucket via the session → exam → instructor_id chain).
   */
  static async getPlaybackUrl(
    bucketPath: string,
    expiresInSeconds = 300
  ): Promise<string> {
    const { data, error } = await supabase
      .storage
      .from(BUCKET)
      .createSignedUrl(bucketPath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(`Failed to create signed playback URL: ${error?.message ?? 'unknown'}`);
    }

    return data.signedUrl;
  }

  /**
   * Bulk-resolve signed GET URLs for a list of artifact bucket paths.
   * Silently skips paths that fail (e.g., already purged); returns a Map from
   * path → signedUrl for paths that succeeded.
   */
  static async getPlaybackUrls(
    bucketPaths: string[],
    expiresInSeconds = 300
  ): Promise<Map<string, string>> {
    const results = await Promise.allSettled(
      bucketPaths.map(p => this.getPlaybackUrl(p, expiresInSeconds).then(url => ({ path: p, url })))
    );
    const map = new Map<string, string>();
    for (const r of results) {
      if (r.status === 'fulfilled') map.set(r.value.path, r.value.url);
    }
    return map;
  }
}
