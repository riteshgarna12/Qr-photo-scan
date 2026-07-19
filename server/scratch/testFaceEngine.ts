import '../src/utils/polyfills';
import { getEmbeddingsForImage } from '../src/utils/faceEngine';
import path from 'path';

async function run() {
  console.log('🏃 Starting Face Engine check...');
  const testImgPath = path.resolve(__dirname, '../uploads/0c21b7f6-2a37-4ae2-b690-0e1d2afb34bd.jpg');
  console.log(`Processing image: ${testImgPath}`);
  
  try {
    const faces = await getEmbeddingsForImage(testImgPath);
    console.log(`🎉 Success! Found ${faces.length} face(s) in test image.`);
    faces.forEach((face, i) => {
      console.log(`Face #${i + 1}: Box: ${JSON.stringify(face.box)}, Descriptor vector size: ${face.descriptor.length}`);
    });
  } catch (err: any) {
    console.error('✗ Test failed with error:', err);
  }
}

run();
