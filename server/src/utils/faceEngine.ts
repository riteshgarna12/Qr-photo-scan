import './polyfills';
import * as faceapi from '@vladmandic/face-api/dist/face-api.node.js';
// @ts-ignore
import { Canvas, Image, ImageData, loadImage } from 'canvas';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

// Monkey patch face-api environment to use canvas on Node.js
// @ts-ignore
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let isInitialized = false;

export async function initFaceAPI() {
  if (isInitialized) return;

  const modelPath = path.resolve(__dirname, '../../models');
  try {
    console.log('🧠 Loading Face-API model weights...');
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
    isInitialized = true;
    console.log('✓ Face-API model weights loaded successfully');
  } catch (err: any) {
    console.error('✗ Failed to load Face-API weights:', err.message);
    throw err;
  }
}

export interface DetectedFace {
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  descriptor: number[];
}

/**
 * Pre-process an image for better face detection:
 * - Normalize brightness/contrast
 * - Sharpen slightly to bring out facial features
 * - Ensure image is right-side-up (EXIF rotation)
 * - Scale to a consistent size for detection (max 1600px on longest side)
 *   This helps SSD MobileNet detect faces more consistently.
 */
async function preprocessForDetection(imagePath: string): Promise<string> {
  const tmpPath = imagePath + '.faceprep.jpg';

  await sharp(imagePath, { failOn: 'none' })
    .rotate() // auto-rotate based on EXIF
    .resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .normalise() // auto-stretch contrast for better face visibility
    .sharpen({ sigma: 1.0 }) // subtle sharpen to bring out edges
    .jpeg({ quality: 92 })
    .toFile(tmpPath);

  return tmpPath;
}

/**
 * Detects all faces in an image file and extracts their 128-dimensional descriptor vectors.
 * 
 * Enhanced approach:
 * 1. Pre-process the image (normalize, sharpen, resize) for better detection
 * 2. Run face detection at multiple confidence levels for maximum recall
 * 3. Deduplicate overlapping detections
 */
export async function getEmbeddingsForImage(imagePath: string): Promise<DetectedFace[]> {
  await initFaceAPI();

  let preparedPath: string | null = null;

  try {
    // Pre-process image for better detection
    preparedPath = await preprocessForDetection(imagePath);

    const img = await loadImage(preparedPath);

    // Run detection with LOW confidence to catch more faces
    // Face-api SSD MobileNet often misses faces at higher thresholds
    const detections = await faceapi
      .detectAllFaces(img as any, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    // If we got no results at low confidence, try even lower as a fallback
    let allDetections = detections;
    if (allDetections.length === 0) {
      allDetections = await faceapi
        .detectAllFaces(img as any, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.05 }))
        .withFaceLandmarks()
        .withFaceDescriptors();
    }

    const results = allDetections.map((det) => {
      const box = det.detection.box;
      return {
        box: {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
        },
        descriptor: Array.from(det.descriptor),
        score: det.detection.score,
      };
    });

    // Deduplicate overlapping boxes (IoU > 0.5 = same face)
    const deduped = deduplicateFaces(results);

    return deduped.map(({ box, descriptor }) => ({ box, descriptor }));
  } catch (err: any) {
    console.error(`✗ Error processing face embeddings for image: ${imagePath}`, err.message);
    return [];
  } finally {
    // Clean up preprocessed temp file
    if (preparedPath && fs.existsSync(preparedPath)) {
      try { fs.unlinkSync(preparedPath); } catch { }
    }
  }
}

/**
 * Remove duplicate detections of the same face (from overlapping bounding boxes).
 * Keeps the detection with the higher confidence score.
 */
function deduplicateFaces(faces: Array<{ box: { x: number; y: number; width: number; height: number }; descriptor: number[]; score: number }>): typeof faces {
  if (faces.length <= 1) return faces;

  // Sort by score descending so we keep highest-confidence detections
  const sorted = [...faces].sort((a, b) => b.score - a.score);
  const kept: typeof faces = [];

  for (const face of sorted) {
    const isDuplicate = kept.some((existing) => {
      const iou = computeIoU(face.box, existing.box);
      return iou > 0.4; // 40% overlap = same face
    });
    if (!isDuplicate) {
      kept.push(face);
    }
  }

  return kept;
}

/** Compute Intersection-over-Union for two bounding boxes */
function computeIoU(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (intersection === 0) return 0;

  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  return intersection / (areaA + areaB - intersection);
}

/**
 * Calculates Euclidean distance between two vectors.
 */
export function getDistance(v1: number[], v2: number[]): number {
  if (v1.length !== v2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < v1.length; i++) {
    sum += (v1[i] - v2[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/**
 * Checks if a selfie face matches any of the descriptors in an event photo.
 * Threshold is typically 0.6 (lower means stricter match).
 */
export function isMatch(selfieDescriptor: number[], photoDescriptors: DetectedFace[], threshold = 0.60): boolean {
  for (const face of photoDescriptors) {
    const distance = getDistance(selfieDescriptor, face.descriptor);
    if (distance <= threshold) {
      return true;
    }
  }
  return false;
}
export { faceapi };
