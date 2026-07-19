import '../src/utils/polyfills';
import { PrismaClient } from '@prisma/client';
import { getEmbeddingsForImage } from '../src/utils/faceEngine';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

async function run() {
  console.log('🔄 Starting forced AI face re-indexing on all photos...');
  const photos = await prisma.photo.findMany();

  console.log(`Found ${photos.length} total photo(s) to re-index.`);

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const filename = photo.url.replace('/uploads/', '');
    const filePath = path.resolve(__dirname, '../uploads', filename);

    if (!fs.existsSync(filePath)) {
      console.log(`[${i + 1}/${photos.length}] File not found: ${filePath}, skipping.`);
      continue;
    }

    try {
      console.log(`[${i + 1}/${photos.length}] Re-indexing ${filename}...`);
      const faces = await getEmbeddingsForImage(filePath);
      await prisma.photo.update({
        where: { id: photo.id },
        data: { facesData: JSON.stringify(faces) }
      });
      console.log(`[${i + 1}/${photos.length}] Complete: Found ${faces.length} face(s).`);
    } catch (err) {
      console.error(`[${i + 1}/${photos.length}] Failed to index ${filename}:`, err);
    }
  }

  console.log('🎉 Forced re-index task completed successfully!');
}

run().finally(() => prisma.$disconnect());
