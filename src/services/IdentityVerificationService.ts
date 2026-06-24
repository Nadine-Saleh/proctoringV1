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

export interface StartSessionCalibration {
  calibration_skipped: boolean;
  optimal_distance_cm?: number;
  distance_tolerance_cm?: number;
}

export interface StartSessionResponse {
  session: {
    id: string;
    started_at: string;
    status: 'in_progress';
    optimal_distance_cm: number;
    distance_tolerance_cm: number;
    calibration_skipped: boolean;
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

    const detections = await faceapi
      .detectAllFaces(
        videoEl,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.6,
        })
      )
      .withFaceLandmarks(true)
      .withFaceDescriptors();

    if (detections.length !== 1) {
      console.warn('Face verification failed: expected exactly one face');
      return null;
    }

    const detection = detections[0];

    if (!detection) {
      return null;
    }

    const box = detection.detection.box;

    const videoWidth = videoEl.videoWidth;
    const videoHeight = videoEl.videoHeight;

    if (
      box.width < videoWidth * 0.2 ||
      box.height < videoHeight * 0.2
    ) {
      console.warn('Face verification failed: face too small');
      return null;
    }

    return detection.descriptor;
  }

  /**
   * دي بتتستخدم عند دخول الامتحان بالكود.
   * مهم جدًا: p_fresh_capture لازم يفضل false
   * عشان ما يطلبش reference capture جديدة قبل الامتحان.
   */
  static async joinExam(
    accessCode: string
  ): Promise<{ success: boolean; data?: JoinExamResponse; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('join_exam', {
        p_access_code: accessCode.toUpperCase(),
        p_fresh_capture: false,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as JoinExamResponse };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * بتشيك هل الطالب عنده face reference محفوظة قبل كده ولا لأ.
   * دي تتستخدم بعد اللوجن.
   */
  static async hasReference(): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return false;

      const { data, error } = await supabase
        .from('student_face_references')
        .select('student_id')
        .eq('student_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking face reference:', error);
        return false;
      }

      return !!data;
    } catch (err) {
      console.error('Error checking face reference:', err);
      return false;
    }
  }

  /**
   * دي تتحط بعد اللوجن فقط.
   * وظيفتها تحفظ face embedding مرة واحدة فقط.
   * ممنوع استخدامها قبل الامتحان.
   */
  static async saveReferenceEmbedding(
    embedding: Float32Array,
    qualityScore: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const alreadyHasReference = await this.hasReference();

      if (alreadyHasReference) {
        return {
          success: false,
          error: 'Face reference already exists. Please verify identity instead.',
        };
      }

      const { error } = await supabase.from('student_face_references').insert({
        student_id: user.id,
        embedding: Array.from(embedding),
        quality_score: qualityScore,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * دي تستخدم قبل الامتحان فقط.
   * بتبعت صورة/embedding جديد للمقارنة مع القديم.
   * لا تحفظ reference جديدة.
   */
  static async verifyIdentity(
    sessionId: string,
    embedding: Float32Array
  ): Promise<{ success: boolean; data?: VerificationResponse; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('verify_student_identity', {
        p_session_id: sessionId,
        p_embedding: Array.from(embedding),
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as VerificationResponse };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  static async startSession(
    sessionId: string,
    calibration: StartSessionCalibration
  ): Promise<{ success: boolean; data?: StartSessionResponse; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('start_exam_session', {
        p_session_id: sessionId,
        p_calibration: calibration,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as StartSessionResponse };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
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

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, sessions: data as any[] };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}