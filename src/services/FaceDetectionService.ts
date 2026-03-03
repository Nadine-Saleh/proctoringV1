import * as faceapi from 'face-api.js';

export interface FaceDetectionConfig {
  modelPath?: string;
  detectorOptions?: faceapi.TinyFaceDetectorOptions | faceapi.SsdMobilenetv1Options | faceapi.MtcnnOptions;
  minConfidence?: number;
  returnFaceLandmarks?: boolean;
  returnFaceExpressions?: boolean;
  returnAgeAndGender?: boolean;
}

export interface DetectedFace {
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks?: faceapi.FaceLandmarks68;
  expressions?: faceapi.FaceExpressions;
  age?: number;
  gender?: string;
  genderProbability?: number;
}

export class FaceDetectionService {
  private modelsLoaded = false;
  private config: Required<FaceDetectionConfig>;

  constructor(config: FaceDetectionConfig = {}) {
    this.config = {
      modelPath: config.modelPath || '/models',
      detectorOptions: config.detectorOptions || new faceapi.TinyFaceDetectorOptions(),
      minConfidence: config.minConfidence ?? 0.5,
      returnFaceLandmarks: config.returnFaceLandmarks ?? true,
      returnFaceExpressions: config.returnFaceExpressions ?? true,
      returnAgeAndGender: config.returnAgeAndGender ?? true,
    };
  }

  /**
   * Loads all required face-api.js models
   */
  async loadModels(): Promise<void> {
    if (this.modelsLoaded) {
      return;
    }

    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(this.config.modelPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(this.config.modelPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(this.config.modelPath),
        faceapi.nets.faceExpressionNet.loadFromUri(this.config.modelPath),
        faceapi.nets.ageGenderNet.loadFromUri(this.config.modelPath),
      ]);
      this.modelsLoaded = true;
    } catch (error) {
      console.error('Error loading face-api models:', error);
      throw new Error('Failed to load face detection models');
    }
  }

  /**
   * Checks if all models are loaded
   */
  areModelsLoaded(): boolean {
    return this.modelsLoaded;
  }

  /**
   * Detects faces in an image/video element - builds pipeline based on config
   */
  async detectFaces(
    mediaElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
  ): Promise<DetectedFace[]> {
    if (!this.modelsLoaded) {
      throw new Error('Models not loaded. Call loadModels() first.');
    }

    // Build the detection pipeline based on requested features
    if (this.config.returnFaceLandmarks && this.config.returnFaceExpressions && this.config.returnAgeAndGender) {
      const fullResults = await faceapi
        .detectAllFaces(mediaElement, this.config.detectorOptions)
        .withFaceLandmarks()
        .withFaceExpressions()
        .withAgeAndGender();
      
      return fullResults.map(detection => ({
        box: {
          x: detection.detection.box.x,
          y: detection.detection.box.y,
          width: detection.detection.box.width,
          height: detection.detection.box.height,
        },
        landmarks: detection.landmarks,
        expressions: detection.expressions,
        age: detection.age,
        gender: detection.gender,
        genderProbability: detection.genderProbability,
      }));
    } 
    else if (this.config.returnFaceLandmarks && this.config.returnFaceExpressions) {
      const results = await faceapi
        .detectAllFaces(mediaElement, this.config.detectorOptions)
        .withFaceLandmarks()
        .withFaceExpressions();
      
      return results.map(detection => ({
        box: {
          x: detection.detection.box.x,
          y: detection.detection.box.y,
          width: detection.detection.box.width,
          height: detection.detection.box.height,
        },
        landmarks: detection.landmarks,
        expressions: detection.expressions,
        age: undefined,
        gender: undefined,
        genderProbability: undefined,
      }));
    } 
    else if (this.config.returnFaceLandmarks && this.config.returnAgeAndGender) {
      const results = await faceapi
        .detectAllFaces(mediaElement, this.config.detectorOptions)
        .withFaceLandmarks()
        .withAgeAndGender();
      
      return results.map(detection => ({
        box: {
          x: detection.detection.box.x,
          y: detection.detection.box.y,
          width: detection.detection.box.width,
          height: detection.detection.box.height,
        },
        landmarks: detection.landmarks,
        expressions: undefined,
        age: detection.age,
        gender: detection.gender,
        genderProbability: detection.genderProbability,
      }));
    } 
    else if (this.config.returnFaceExpressions && this.config.returnAgeAndGender) {
      const results = await faceapi
        .detectAllFaces(mediaElement, this.config.detectorOptions)
        .withFaceExpressions()
        .withAgeAndGender();
      
      return results.map(detection => ({
        box: {
          x: detection.detection.box.x,
          y: detection.detection.box.y,
          width: detection.detection.box.width,
          height: detection.detection.box.height,
        },
        landmarks: undefined,
        expressions: detection.expressions,
        age: detection.age,
        gender: detection.gender,
        genderProbability: detection.genderProbability,
      }));
    } 
    else if (this.config.returnFaceLandmarks) {
      const results = await faceapi
        .detectAllFaces(mediaElement, this.config.detectorOptions)
        .withFaceLandmarks();
      
      return results.map(detection => ({
        box: {
          x: detection.detection.box.x,
          y: detection.detection.box.y,
          width: detection.detection.box.width,
          height: detection.detection.box.height,
        },
        landmarks: detection.landmarks,
        expressions: undefined,
        age: undefined,
        gender: undefined,
        genderProbability: undefined,
      }));
    } 
    else if (this.config.returnFaceExpressions) {
      const results = await faceapi
        .detectAllFaces(mediaElement, this.config.detectorOptions)
        .withFaceExpressions();
      
      return results.map(detection => ({
        box: {
          x: detection.detection.box.x,
          y: detection.detection.box.y,
          width: detection.detection.box.width,
          height: detection.detection.box.height,
        },
        landmarks: undefined,
        expressions: detection.expressions,
        age: undefined,
        gender: undefined,
        genderProbability: undefined,
      }));
    } 
    else if (this.config.returnAgeAndGender) {
      const results = await faceapi
        .detectAllFaces(mediaElement, this.config.detectorOptions)
        .withAgeAndGender();
      
      return results.map(detection => ({
        box: {
          x: detection.detection.box.x,
          y: detection.detection.box.y,
          width: detection.detection.box.width,
          height: detection.detection.box.height,
        },
        landmarks: undefined,
        expressions: undefined,
        age: detection.age,
        gender: detection.gender,
        genderProbability: detection.genderProbability,
      }));
    } 
    else {
      const results = await faceapi
        .detectAllFaces(mediaElement, this.config.detectorOptions);
      
      return results.map(detection => ({
        box: {
          x: detection.box.x,
          y: detection.box.y,
          width: detection.box.width,
          height: detection.box.height,
        },
        landmarks: undefined,
        expressions: undefined,
        age: undefined,
        gender: undefined,
        genderProbability: undefined,
      }));
    }
  }

  /**
   * Draws face detection results on a canvas
   */
  drawDetections(
    canvas: HTMLCanvasElement,
    detections: DetectedFace[],
    drawBoxes: boolean = true,
    drawLandmarks: boolean = true,
    drawExpressions: boolean = true
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    try {
      // Draw boxes first
      if (drawBoxes) {
        const boxes = detections.map(d => 
          new faceapi.Rect(d.box.x, d.box.y, d.box.width, d.box.height)
        );
        faceapi.draw.drawDetections(canvas, boxes);
      }

      // Draw landmarks separately - face-api expects FaceLandmarks68 objects for this
      if (drawLandmarks) {
        const landmarkDetections = detections
          .filter(d => d.landmarks) // Only process detections that have landmarks
          .map(d => d.landmarks!); // Use non-null assertion since we filtered
        
        if (landmarkDetections.length > 0) {
          faceapi.draw.drawFaceLandmarks(canvas, landmarkDetections);
        }
      }

      // Draw expressions - create proper format with only detections that have expressions
      if (drawExpressions) {
        const expressionDetections = detections
          .filter(d => d.expressions) // Only process detections that have expressions
          .map(d => {
            // Create an object with the detection and expressions in the right format
            return {
              detection: new faceapi.FaceDetection(
                0.8, // confidence
                new faceapi.Rect(d.box.x, d.box.y, d.box.width, d.box.height),
                {} as any
              ),
              expressions: d.expressions!
            };
          });
        
        if (expressionDetections.length > 0) {
          faceapi.draw.drawFaceExpressions(canvas, expressionDetections);
        }
      }
    } catch (error) {
      console.error("Error during drawing:", error);
      // Fallback: draw basic rectangles if face-api draw fails
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      detections.forEach(detection => {
        ctx.strokeRect(detection.box.x, detection.box.y, detection.box.width, detection.box.height);
      });
    }
  }

  /**
   * Resizes detection results to match a display size
   */
  resizeResults(
    detections: DetectedFace[],
    displaySize: { width: number; height: number }
  ): DetectedFace[] {
    // Convert to face-api format for resizing
    const faceapiDetections = detections.map(detection => {
      return {
        detection: new faceapi.FaceDetection(
          0.8, // confidence
          new faceapi.Rect(
            detection.box.x,
            detection.box.y,
            detection.box.width,
            detection.box.height
          ),
          {} as any
        ),
        landmarks: detection.landmarks,
        expressions: detection.expressions,
        age: detection.age,
        gender: detection.gender,
        genderProbability: detection.genderProbability,
      };
    });

    try {
      // Resize using face-api
      const resized = faceapi.resizeResults(faceapiDetections, displaySize);

      // Convert back to our format
      return resized.map(detection => ({
        box: {
          x: detection.detection.box.x,
          y: detection.detection.box.y,
          width: detection.detection.box.width,
          height: detection.detection.box.height,
        },
        landmarks: detection.landmarks,
        expressions: detection.expressions,
        age: detection.age,
        gender: detection.gender,
        genderProbability: detection.genderProbability,
      }));
    } catch (error) {
      console.error("Error during resizing:", error);
      // Return original detections if resize fails
      return detections;
    }
  }
}