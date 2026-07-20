import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, process.env.UPLOAD_DIR || './uploads'),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

import { getEmbeddingsForImage } from '../utils/faceEngine';
import { compressImage, formatBytes } from '../utils/imageCompressor';
import { uploadFile, deleteFile, isCloudEnabled } from '../utils/cloudStorage';

// Background queue to process face indexing without blocking upload HTTP response
const uploadQueue: Array<{ photoId: string; filePath: string }> = [];
let isProcessingQueue = false;

async function processUploadQueue() {
  if (isProcessingQueue || uploadQueue.length === 0) return;
  isProcessingQueue = true;

  while (uploadQueue.length > 0) {
    const job = uploadQueue.shift();
    if (!job) continue;

    try {
      console.log(`[AI Worker] Indexing faces for photo: ${job.photoId}...`);
      const faces = await getEmbeddingsForImage(job.filePath);
      await prisma.photo.update({
        where: { id: job.photoId },
        data: { facesData: JSON.stringify(faces) },
      });
      console.log(`[AI Worker] Indexing complete for photo: ${job.photoId}. Found ${faces.length} face(s).`);

      // Clean up local temp file once indexed if cloud storage is active
      if (isCloudEnabled()) {
        try {
          if (fs.existsSync(job.filePath)) {
            fs.unlinkSync(job.filePath);
            console.log(`[AI Worker] Cleaned up local temp file after indexing: ${path.basename(job.filePath)}`);
          }
        } catch (cleanupErr: any) {
          console.error(`[AI Worker] Temp file cleanup error: ${cleanupErr.message}`);
        }
      }
    } catch (err) {
      console.error(`[AI Worker] Failed to process photo: ${job.photoId}`, err);
    }

    // Brief break to avoid pegging CPU threads indefinitely
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  isProcessingQueue = false;
}

router.post('/:eventId/upload', authMiddleware, upload.array('photos', 50), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const event = await prisma.event.findUnique({ where: { id: eventId }, include: { host: true, _count: { select: { photos: true } } } });
    if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
    if (event.hostId !== req.userId) { res.status(403).json({ error: 'Not authorized' }); return; }
    if (event.isLocked) { res.status(403).json({ error: 'Event is locked' }); return; }
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) { res.status(400).json({ error: 'No files uploaded' }); return; }
    const currentCount = event._count.photos;
    const maxAllowed = event.maxPhotosAllowed;
    if (currentCount + files.length > maxAllowed) {
      res.status(403).json({ error: `Upload would exceed photo limit. You have ${currentCount}/${maxAllowed} photos.`, currentCount, maxAllowed });
      return;
    }

    // Compress images before creating DB records
    const compressedFiles = await Promise.all(files.map(async (file) => {
      try {
        const result = await compressImage(path.resolve(file.path));
        if (result.wasCompressed) {
          console.log(`[Compress] ${file.originalname}: ${formatBytes(result.originalSizeBytes)} → ${formatBytes(result.compressedSizeBytes)} (${result.reductionPercent}% reduction)`);
        }
        // Return the updated filename (extension may have changed, e.g. .heic → .jpg)
        const newFilename = path.basename(result.newFilePath);
        return { ...file, filename: newFilename, path: result.newFilePath };
      } catch (err) {
        console.error(`[Compress] Failed to compress ${file.originalname}, using original:`, err);
        return file; // Use uncompressed file on failure
      }
    }));
    
    // Create database records with compressed file references (uploading to cloud if enabled)
    const photos = await Promise.all(compressedFiles.map(async (file) => {
      const publicUrl = await uploadFile(file.path, file.filename, file.mimetype);

      const photo = await prisma.photo.create({
        data: {
          eventId,
          url: publicUrl,
          fileName: file.originalname,
          facesData: '[]', // Start empty so it is immediately visible in the gallery
        },
      });

      // Add to background processing queue (still uses local file path for scanning)
      const fullPath = path.resolve(file.path);
      uploadQueue.push({ photoId: photo.id, filePath: fullPath });

      return photo;
    }));

    // Trigger background queue processing (non-blocking)
    processUploadQueue();

    // Respond immediately!
    res.status(201).json({ 
      message: `${photos.length} photo(s) uploaded and compressed successfully. AI face matching is indexing in the background.`, 
      photos, 
      totalPhotos: currentCount + photos.length, 
      maxAllowed 
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:eventId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const eventId = req.params.eventId as string;
    const photos = await prisma.photo.findMany({ where: { eventId }, orderBy: { uploadedAt: 'desc' } });
    res.json({ photos });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:photoId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const photoId = req.params.photoId as string;
    const photo = await prisma.photo.findUnique({ where: { id: photoId }, include: { event: true } });
    if (!photo) { res.status(404).json({ error: 'Photo not found' }); return; }
    if (photo.event.hostId !== req.userId) { res.status(403).json({ error: 'Not authorized' }); return; }
    
    // Delete file from disk/R2
    await deleteFile(photo.url);
    
    await prisma.photo.delete({ where: { id: photoId } });
    res.json({ message: 'Photo deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/event/:eventId/all', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const eventId = req.params.eventId as string;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
    if (event.hostId !== req.userId) { res.status(403).json({ error: 'Not authorized' }); return; }

    // Fetch all photos to delete their files from disk/cloud
    const photos = await prisma.photo.findMany({ where: { eventId } });

    for (const photo of photos) {
      await deleteFile(photo.url);
    }

    // Bulk delete from database
    const result = await prisma.photo.deleteMany({ where: { eventId } });

    res.json({ message: `Successfully deleted ${result.count} photo(s) from this event.`, deletedCount: result.count });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download endpoint — forces browser to download instead of opening in a new tab
router.get('/download/:filename', (req, res: Response): void => {
  const { filename } = req.params;
  const sanitized = path.basename(filename);

  if (isCloudEnabled()) {
    // Redirect to cloud storage public URL
    const base = process.env.CLOUDFLARE_R2_PUBLIC_URL!.replace(/\/$/, '');
    res.redirect(`${base}/${sanitized}`);
    return;
  }

  const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
  const filePath = path.join(uploadDir, sanitized);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  res.setHeader('Content-Disposition', `attachment; filename="${sanitized}"`);
  res.sendFile(filePath);
});

// Re-index all faces for an event (useful after upgrading the face engine)
router.post('/reindex/:eventId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const eventId = req.params.eventId as string;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
    if (event.hostId !== req.userId) { res.status(403).json({ error: 'Not authorized' }); return; }

    const photos = await prisma.photo.findMany({ where: { eventId } });
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');

    // Queue all photos for re-indexing
    let queued = 0;
    for (const photo of photos) {
      const filePath = path.join(uploadDir, path.basename(photo.url));
      if (fs.existsSync(filePath)) {
        uploadQueue.push({ photoId: photo.id, filePath });
        queued++;
      }
    }

    // Trigger background processing
    processUploadQueue();

    res.json({ message: `Re-indexing ${queued} photo(s) with improved AI. This runs in the background.`, queued });
  } catch (err) {
    console.error('Reindex error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

