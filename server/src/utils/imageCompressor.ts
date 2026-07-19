import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export interface CompressionResult {
  originalSizeBytes: number;
  compressedSizeBytes: number;
  reductionPercent: number;
  wasCompressed: boolean;
  newFilePath: string; // may differ if extension changed (e.g. .heic → .jpg)
}

/** Files at or below this size are left untouched */
const COMPRESS_THRESHOLD = 5 * 1024 * 1024; // 5 MB

/** Target compressed size range */
const TARGET_MIN = 2 * 1024 * 1024;  // 2 MB
const TARGET_MAX = 5 * 1024 * 1024;  // 5 MB

/** Maximum number of compression passes to converge on target size */
const MAX_ITERATIONS = 6;

/**
 * Compress an image file in-place using an iterative binary-search approach.
 * 
 * Strategy:
 * 1. Start with quality 75 (a sensible default), NO resize on first attempt.
 * 2. Compress and check the output size.
 * 3. If output > TARGET_MAX → lower quality. If output < TARGET_MIN → raise quality.
 * 4. Use binary search between low/high quality bounds for fast convergence.
 * 5. Only resize as a last resort for extremely large images (>20MP or >25MB originals).
 * 
 * - Files ≤ 5 MB are skipped entirely.
 * - HEIC/HEIF/PNG/WebP are converted to JPEG.
 */
export async function compressImage(filePath: string): Promise<CompressionResult> {
  const stat = fs.statSync(filePath);
  const originalSize = stat.size;

  // Skip files already within acceptable range
  if (originalSize <= COMPRESS_THRESHOLD) {
    return {
      originalSizeBytes: originalSize,
      compressedSizeBytes: originalSize,
      reductionPercent: 0,
      wasCompressed: false,
      newFilePath: filePath,
    };
  }

  // Read image metadata
  const metadata = await sharp(filePath).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const megapixels = (width * height) / 1_000_000;
  const sizeInMB = originalSize / (1024 * 1024);

  // Only resize for truly huge images (>20 megapixels OR >25MB source)
  // This preserves quality for most photos (typically 12-16MP from phones/cameras)
  const maxDim = (megapixels > 20 || sizeInMB > 25) ? 5000 : undefined;

  // Prepare output paths
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));
  const newFileName = `${baseName}.jpg`;
  const newFilePath = path.join(dir, newFileName);
  const tempPath = path.join(dir, `_tmp_compress_${baseName}.jpg`);

  // Binary search bounds for quality
  let lowQ = 10;
  let highQ = 95;
  let quality = 75; // start at 75
  let bestTempSize = 0;
  let iteration = 0;

  console.log(`[Compress] Starting compression: ${path.basename(filePath)} (${formatBytes(originalSize)}, ${width}×${height}, ${megapixels.toFixed(1)}MP)`);

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    // Build the sharp pipeline
    let pipeline = sharp(filePath, { failOn: 'none' })
      .rotate(); // auto-rotate based on EXIF orientation

    // Only resize if needed (very large images)
    if (maxDim) {
      pipeline = pipeline.resize({
        width: maxDim,
        height: maxDim,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Compress to JPEG
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });

    await pipeline.toFile(tempPath);
    bestTempSize = fs.statSync(tempPath).size;

    console.log(`[Compress]   Pass ${iteration}: quality=${quality} → ${formatBytes(bestTempSize)}`);

    // Check if within target range
    if (bestTempSize >= TARGET_MIN && bestTempSize <= TARGET_MAX) {
      break; // Perfect!
    }

    if (bestTempSize > TARGET_MAX) {
      // Too large — search lower
      highQ = quality - 1;
    } else {
      // Too small — search higher
      lowQ = quality + 1;
    }

    // If bounds have converged, stop
    if (lowQ > highQ) {
      console.log(`[Compress]   Bounds converged (lowQ=${lowQ}, highQ=${highQ}), using last result`);
      break;
    }

    // Next quality = midpoint of bounds
    quality = Math.round((lowQ + highQ) / 2);
  }

  // Remove original if extension is different (e.g. .heic, .png)
  if (filePath !== newFilePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // If compressed is somehow larger than original, discard
  if (bestTempSize >= originalSize && filePath === newFilePath) {
    fs.unlinkSync(tempPath);
    return {
      originalSizeBytes: originalSize,
      compressedSizeBytes: originalSize,
      reductionPercent: 0,
      wasCompressed: false,
      newFilePath: filePath,
    };
  }

  // Move temp → final destination
  if (fs.existsSync(newFilePath)) {
    fs.unlinkSync(newFilePath);
  }
  fs.renameSync(tempPath, newFilePath);

  const compressedSize = fs.statSync(newFilePath).size;
  const reductionPercent = Math.round((1 - compressedSize / originalSize) * 100);

  return {
    originalSizeBytes: originalSize,
    compressedSizeBytes: compressedSize,
    reductionPercent,
    wasCompressed: true,
    newFilePath,
  };
}

/** Format bytes into a human-readable string (e.g. "14.7 MB") */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
