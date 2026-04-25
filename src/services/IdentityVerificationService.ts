import { supabase } from '../lib/supabase/client';
import type { ProctoringPolicy } from '../types/examSession';

export interface JoinExamResponse {
  session_id: string;
  exam: {
    id: string;
    title: string;
    description: string | null;
    starts_at: string;
    duration_minutes: number;
    proctoring_policy: ProctoringPolicy;
  };
  requires_reference_capture: boolean;
  verification_attempts_remaining: number;
}

export interface VerificationResponse {
  outcome: 'pass' | 'fail';
  confidence: number;
  attempts_remaining: number;
  blocked: boolean;
  session_status: 'verified' | 'awaiting_verification' | 'verification_blocked';
}

export interface StartSessionResponse {
  session: {
    id: string;
    started_at: string;
    status: 'in_progress';
  };
  questions: Array<{
    id: string;
    position: number;
    type: string;
    prompt: string;
    options: unknown;
    points: number;
  }>;
}

export class IdentityVerificationService {
  private static faceApiLoaded = false;

  static async loadFaceApiModels(): Promise<void> {
    if (this.faceApiLoaded) return;

    const faceapi = await import('face-api.js');
    const MODEL_URL = '/models';

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);

    this.faceApiLoaded = true;
  }

  static async extractEmbedding(
    videoEl: HTMLVideoElement
  ): Promise<Float32Array | null> {
    await this.loadFaceApiModels();
    const faceapi = await import('face-api.js');

    const detection = await faceapi
      .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (!detection) return null;
    return detection.descriptor;
  }

  static async joinExam(
    accessCode: string,
    freshCapture = false
  ): Promise<{ success: boolean; data?: JoinExamResponse; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('join_exam', {
        p_access_code: accessCode.toUpperCase(),
        p_fresh_capture: freshCapture,
      });

      if (error) return { success: false, error: error.message };
      return { success: true, data: data as JoinExamResponse };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  static async saveReferenceEmbedding(
    embedding: Float32Array,
    qualityScore: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: 'Not authenticated' };

      const { error } = await supabase.from('student_face_references').upsert({
        student_id: user.id,
        embedding: Array.from(embedding),
        quality_score: qualityScore,
        captured_at: new Date().toISOString(),
      });

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  static async verifyIdentity(
    sessionId: string,
    embedding: Float32Array
  ): Promise<{ success: boolean; data?: VerificationResponse; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('verify_student_identity', {
        p_session_id: sessionId,
        p_embedding: Array.from(embedding),
      });

      if (error) return { success: false, error: error.message };
      return { success: true, data: data as VerificationResponse };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  static async startSession(
    sessionId: string
  ): Promise<{ success: boolean; data?: StartSessionResponse; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('start_exam_session', {
        p_session_id: sessionId,
      });

      if (error) return { success: false, error: error.message };
      return { success: true, data: data as StartSessionResponse };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  static async listMySessions(): Promise<{
    success: boolean;
    sessions?: Array<{
      session_id: string;
      exam_id: string;
      exam_title: string;
      exam_starts_at: string;
      duration_minutes: number;
      status: string;
      started_at: string | null;
      submitted_at: string | null;
      live_cheating_score: number;
      created_at: string;
    }>;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase.rpc('list_my_sessions');
      if (error) return { success: false, error: error.message };
      return { success: true, sessions: data as any[] };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}
