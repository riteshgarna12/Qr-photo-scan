const fs = require('fs');
const path = require('path');

const modelsDir = path.resolve(__dirname, '../models');

const manifests = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'face_landmark_68_model-weights_manifest.json',
  'face_recognition_model-weights_manifest.json'
];

manifests.forEach(manifest => {
  const filePath = path.join(modelsDir, manifest);
  if (!fs.existsSync(filePath)) {
    console.log(`Manifest not found: ${manifest}`);
    return;
  }
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(`\n--- Manifest: ${manifest} ---`);
  
  const paths = [];
  content.forEach(group => {
    if (group.paths) {
      paths.push(...group.paths);
    }
  });
  console.log('Required shard files:', paths);
});
