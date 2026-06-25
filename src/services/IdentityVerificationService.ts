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

export interface DuringExamVerificationResponse {
  outcome: 'pass' | 'fail';
  confidence: number;
  distance: number;
  threshold: number;
  reason?: string;
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

    if (box.width < videoWidth * 0.2 || box.height < videoHeight * 0.2) {
      console.warn('Face verification failed: face too small');
      return null;
    }

    return detection.descriptor;
  }

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

  static async hasReference(): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return false;

      const { data, error } = await supabase
        .from('student_faces')
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

  static async saveReferenceEmbedding(
    embedding: Float32Array,
    qualityScore: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      void qualityScore;

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

      const { error } = await supabase.from('student_faces').insert({
        student_id: user.id,
        face_image: '',
        face_descriptor: Array.from(embedding),
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

  static async verifyIdentity(
    sessionId: string,
    embedding: Float32Array
  ): Promise<{ success: boolean; data?: VerificationResponse; error?: string }> {
    try {
      const threshold = 0.6;

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { data: sessionData, error: sessionError } = await supabase
        .from('exam_sessions')
        .select('status, verification_attempts_remaining')
        .eq('id', sessionId)
        .maybeSingle();

      if (sessionError) {
        return { success: false, error: sessionError.message };
      }

      if (!sessionData) {
        return { success: false, error: 'Session not found' };
      }

      const currentAttempts =
        typeof sessionData.verification_attempts_remaining === 'number'
          ? sessionData.verification_attempts_remaining
          : 3;

      if (
        sessionData.status === 'verification_blocked' ||
        currentAttempts <= 0
      ) {
        return {
          success: true,
          data: {
            outcome: 'fail',
            confidence: 0,
            attempts_remaining: 0,
            blocked: true,
            session_status: 'verification_blocked',
          },
        };
      }

      const { data: faceData, error: faceError } = await supabase
        .from('student_faces')
        .select('face_descriptor')
        .eq('student_id', user.id)
        .maybeSingle();

      if (faceError) {
        return { success: false, error: faceError.message };
      }

      if (!faceData?.face_descriptor) {
        return {
          success: false,
          error: 'reference_missing',
        };
      }

      let referenceDescriptor: number[];

      if (Array.isArray(faceData.face_descriptor)) {
        referenceDescriptor = faceData.face_descriptor.map(Number);
      } else if (typeof faceData.face_descriptor === 'string') {
        referenceDescriptor = JSON.parse(faceData.face_descriptor).map(Number);
      } else {
        return {
          success: false,
          error: 'Invalid face reference format',
        };
      }

      const currentDescriptor = Array.from(embedding);

      if (referenceDescriptor.length !== currentDescriptor.length) {
        return {
          success: false,
          error: 'Face descriptor size mismatch',
        };
      }

      let sum = 0;

      for (let i = 0; i < referenceDescriptor.length; i++) {
        const diff = referenceDescriptor[i] - currentDescriptor[i];
        sum += diff * diff;
      }

      const distance = Math.sqrt(sum);
      const confidence = Math.max(0, Math.min(1, 1 - distance / 2));
      const outcome: 'pass' | 'fail' = distance < threshold ? 'pass' : 'fail';

      if (outcome === 'pass') {
        const { error: updateError } = await supabase
          .from('exam_sessions')
          .update({
            student_id: user.id,
            status: 'verified',
            verification_attempts_remaining: 3,
          })
          .eq('id', sessionId);

        if (updateError) {
          return { success: false, error: updateError.message };
        }

        return {
          success: true,
          data: {
            outcome: 'pass',
            confidence,
            attempts_remaining: 3,
            blocked: false,
            session_status: 'verified',
          },
        };
      }

      const nextAttempts = Math.max(0, currentAttempts - 1);
      const isBlocked = nextAttempts <= 0;

      const { error: updateFailError } = await supabase
        .from('exam_sessions')
        .update({
          student_id: user.id,
          status: isBlocked
            ? 'verification_blocked'
            : 'awaiting_verification',
          verification_attempts_remaining: nextAttempts,
        })
        .eq('id', sessionId);

      if (updateFailError) {
        return { success: false, error: updateFailError.message };
      }

      return {
        success: true,
        data: {
          outcome: 'fail',
          confidence,
          attempts_remaining: nextAttempts,
          blocked: isBlocked,
          session_status: isBlocked
            ? 'verification_blocked'
            : 'awaiting_verification',
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  static async verifyDuringExam(
    embedding: Float32Array
  ): Promise<{
    success: boolean;
    data?: DuringExamVerificationResponse;
    error?: string;
  }> {
    try {
      const threshold = 0.6;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { data: faceData, error } = await supabase
        .from('student_faces')
        .select('face_descriptor')
        .eq('student_id', user.id)
        .maybeSingle();

      if (error) {
        return { success: false, error: error.message };
      }

      if (!faceData?.face_descriptor) {
        return { success: false, error: 'No reference face found' };
      }

      let referenceDescriptor: number[];

      if (Array.isArray(faceData.face_descriptor)) {
        referenceDescriptor = faceData.face_descriptor.map(Number);
      } else if (typeof faceData.face_descriptor === 'string') {
        referenceDescriptor = JSON.parse(faceData.face_descriptor).map(Number);
      } else {
        return {
          success: false,
          error: 'Invalid face reference format',
        };
      }

      const currentDescriptor = Array.from(embedding);

      if (referenceDescriptor.length !== currentDescriptor.length) {
        return { success: false, error: 'Face descriptor size mismatch' };
      }

      let sum = 0;

      for (let i = 0; i < referenceDescriptor.length; i++) {
        const diff = referenceDescriptor[i] - currentDescriptor[i];
        sum += diff * diff;
      }

      const distance = Math.sqrt(sum);
      const confidence = Math.max(0, Math.min(1, 1 - distance / 2));
      const outcome = distance < threshold ? 'pass' : 'fail';

      return {
        success: true,
        data: {
          outcome,
          confidence,
          distance,
          threshold,
          reason:
            outcome === 'pass' ? 'Same person' : 'Different person suspected',
        },
      };
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