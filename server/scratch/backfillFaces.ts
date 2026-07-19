import '../src/utils/polyfills';
import { PrismaClient } from '@prisma/client';
import { getEmbeddingsForImage } from '../src/utils/faceEngine';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

async function run() {
  console.log('🔄 Starting face descriptor backfill for existing photos...');
  const photos = await prisma.photo.findMany({
    where: {
      OR: [
        { facesData: null },
        { facesData: '[]' }
      ]
    }
  });

  console.log(`Found ${photos.length} photo(s) requiring face indexing.`);

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    // Resolve local path
    // Photo URL format: /uploads/filename.jpg
    const filename = photo.url.replace('/uploads/', '');
    const filePath = path.resolve(__dirname, '../uploads', filename);

    if (!fs.existsSync(filePath)) {
      console.log(`[${i + 1}/${photos.length}] File not found at: ${filePath}, skipping.`);
      continue;
    }

    try {
      console.log(`[${i + 1}/${photos.length}] Processing ${filename}...`);
      const faces = await getEmbeddingsForImage(filePath);
      await prisma.photo.update({
        where: { id: photo.id },
        data: { facesData: JSON.stringify(faces) }
      });
      console.log(`[${i + 1}/${photos.length}] Success: Found ${faces.length} face(s).`);
    } catch (err) {
      console.error(`[${i + 1}/${photos.length}] Failed to index ${filename}:`, err);
    }
  }

  console.log('🎉 Backfill task completed successfully!');
}

run().finally(() => prisma.$disconnect());
