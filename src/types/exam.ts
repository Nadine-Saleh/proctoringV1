export interface ExamQuestion {
  id: string;
  position: number;
  type: string;
  prompt: string;
  options: string[];
  points: number;
}

export interface SessionCalibration {
  optimal_distance_cm: number;
  distance_tolerance_cm: number;
  calibration_skipped: boolean;
}

export type WarningLevel = 'info' | 'warning' | 'critical';

export interface WarningBannerState {
  message: string;
  level: WarningLevel;
}
