import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('🔍 Checking database for events and photos...');
  const events = await prisma.event.findMany({
    include: {
      _count: { select: { photos: true } },
    }
  });
  console.log(`Found ${events.length} event(s):`);
  events.forEach(e => {
    console.log(`- Event "${e.eventName}" (ID: ${e.id}, Slug: ${e.slug}): ${e._count.photos} photo(s)`);
  });

  const photos = await prisma.photo.findMany({
    take: 5,
    orderBy: { uploadedAt: 'desc' }
  });
  console.log(`\nLast 5 photos uploaded:`);
  photos.forEach(p => {
    let facesCount = 0;
    try {
      const faces = JSON.parse(p.facesData || '[]');
      facesCount = faces.length;
    } catch(e) {}
    console.log(`- Photo URL: ${p.url} (ID: ${p.id}): facesData parsed faces count = ${facesCount}`);
  });
}

run().finally(() => prisma.$disconnect());
