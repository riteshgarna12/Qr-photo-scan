import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { isValidUUID } from '../utils/validators';

const router = Router();
const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, process.env.UPLOAD_DIR || './uploads'),
  filename: (_req, file, cb) => cb(null, `selfie-${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

import { getEmbeddingsForImage, isMatch } from '../utils/faceEngine';

router.post('/:eventId/face', upload.single('selfie'), async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = req.params.eventId as string;
    if (!isValidUUID(eventId)) { res.status(400).json({ error: 'Invalid event ID format' }); return; }
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) { res.status(404).json({ error: 'Event not found' }); return; }

    if (!req.file) {
      res.status(400).json({ error: 'No selfie file uploaded' });
      return;
    }

    const selfiePath = path.resolve(req.file.path);
    const selfieFaces = await getEmbeddingsForImage(selfiePath);

    if (selfieFaces.length === 0) {
      res.status(400).json({ error: 'No face detected in selfie. Please try again in a well-lit room.' });
      return;
    }

    // Take the primary face from the guest's selfie
    const guestDescriptor = selfieFaces[0].descriptor;

    // Fetch all photos for this event
    const allPhotos = await prisma.photo.findMany({
      where: { eventId },
      orderBy: { uploadedAt: 'desc' },
    });

    // Map all photos with their minimum match distance to the guest's face
    const matchedPhotos = allPhotos
      .map((photo) => {
        if (!photo.facesData) return { photo, minDistance: Infinity };
        try {
          const photoFaces = JSON.parse(photo.facesData);
          let minDistance = Infinity;
          for (const face of photoFaces) {
            const distance = euclideanDistance(guestDescriptor, face.descriptor);
            if (distance < minDistance) {
              minDistance = distance;
            }
          }
          return { photo, minDistance };
        } catch (err) {
          return { photo, minDistance: Infinity };
        }
      })
      // Return everything up to a very relaxed threshold, so client-side slider can fine-tune
      .filter((item) => item.minDistance <= 0.85)
      .map((item) => ({
        ...item.photo,
        matchDistance: item.minDistance,
      }))
      .sort((a, b) => a.matchDistance - b.matchDistance); // closest first

    // Clean up uploaded selfie file asynchronously
    const fs = require('fs');
    fs.unlink(selfiePath, () => {});

    res.json({
      message: 'Face search completed successfully',
      matchedPhotos,
      totalMatches: matchedPhotos.length,
    });
  } catch (err) {
    console.error('Face search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { euclideanDistance };
export default router;
