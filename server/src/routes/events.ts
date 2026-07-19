import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import QRCode from 'qrcode';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { checkEventLimit, PLAN_LIMITS } from '../middleware/planLimits';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { compressImage, formatBytes } from '../utils/imageCompressor';
import { uploadFile, deleteFile, isCloudEnabled } from '../utils/cloudStorage';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, process.env.UPLOAD_DIR || './uploads'),
  filename: (_req, file, cb) => cb(null, `cover-${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });


const router = Router();
const prisma = new PrismaClient();

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50) + '-' + Math.random().toString(36).substring(2, 7);
}

router.post('/', authMiddleware, checkEventLimit, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventName, eventDate } = req.body;
    if (!eventName) { res.status(400).json({ error: 'Event name is required' }); return; }
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const slug = generateSlug(eventName);
    const limits = PLAN_LIMITS[user.subscriptionTier] || PLAN_LIMITS.FREE;
    const eventUrl = `http://localhost:5173/e/${slug}`;
    const qrCodeData = await QRCode.toDataURL(eventUrl, { width: 400, margin: 2 });
    const event = await prisma.event.create({ data: { hostId: user.id, slug, eventName, eventDate: eventDate ? new Date(eventDate) : null, qrCodeData, maxPhotosAllowed: limits.maxPhotos } });
    res.status(201).json({ event, eventUrl });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/my', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const events = await prisma.event.findMany({ where: { hostId: req.userId }, include: { _count: { select: { photos: true } } }, orderBy: { createdAt: 'desc' } });
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/slug/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const event = await prisma.event.findUnique({ 
      where: { slug: req.params.slug }, 
      include: { 
        host: { select: { subscriptionTier: true } },
        _count: { select: { photos: true } } 
      } 
    });
    if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
    if (event.isLocked) { res.status(403).json({ error: 'This event has been locked' }); return; }
    res.json({ 
      id: event.id, 
      eventName: event.eventName, 
      eventDate: event.eventDate, 
      coverImageUrl: event.coverImageUrl, 
      slug: event.slug, 
      photoCount: event._count.photos,
      subscriptionTier: event.host.subscriptionTier
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id }, include: { photos: { orderBy: { uploadedAt: 'desc' } }, _count: { select: { photos: true } } } });
    if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
    if (event.hostId !== req.userId) { res.status(403).json({ error: 'Not authorized' }); return; }
    res.json({ event });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/lock', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isLocked } = req.body;
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
    if (event.hostId !== req.userId) { res.status(403).json({ error: 'Not authorized' }); return; }
    const updated = await prisma.event.update({ where: { id }, data: { isLocked: Boolean(isLocked) } });
    res.json({ event: updated });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/cover', authMiddleware, upload.single('cover'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
    if (event.hostId !== req.userId) { res.status(403).json({ error: 'Not authorized' }); return; }
    if (!req.file) { res.status(400).json({ error: 'No cover file uploaded' }); return; }

    // Compress cover photo
    let finalFilename = req.file.filename;
    let finalPath = path.resolve(req.file.path);
    try {
      const result = await compressImage(finalPath);
      if (result.wasCompressed) {
        console.log(`[Compress] Cover photo: ${formatBytes(result.originalSizeBytes)} → ${formatBytes(result.compressedSizeBytes)} (${result.reductionPercent}% reduction)`);
      }
      finalFilename = path.basename(result.newFilePath);
      finalPath = result.newFilePath;
    } catch (err) {
      console.error('[Compress] Failed to compress cover photo, using original:', err);
    }

    // Upload to cloud if enabled
    const coverImageUrl = await uploadFile(finalPath, finalFilename, req.file.mimetype);

    // Clean up local temp file if cloud storage is active
    if (isCloudEnabled()) {
      try {
        if (fs.existsSync(finalPath)) {
          fs.unlinkSync(finalPath);
        }
      } catch (cleanupErr: any) {
        console.error(`[Cover Upload] Temp file cleanup error: ${cleanupErr.message}`);
      }
    }

    // Delete old cover photo from cloud/disk if it exists
    if (event.coverImageUrl) {
      try {
        await deleteFile(event.coverImageUrl);
      } catch (err: any) {
        console.error('[Cover Upload] Failed to delete old cover:', err.message);
      }
    }

    const updated = await prisma.event.update({ where: { id }, data: { coverImageUrl } });
    res.json({ event: updated });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
