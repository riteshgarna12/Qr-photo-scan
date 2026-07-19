const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../node_modules/@vladmandic/face-api/dist/face-api.node.js');
const content = fs.readFileSync(filePath, 'utf8');

const index = content.indexOf('face-api.js');
if (index !== -1) {
  console.log('Found face-api.js in face-api.node.js at index', index);
  console.log('--- CONTEXT ---');
  console.log(content.substring(index - 200, index + 300));
} else {
  console.log('face-api.js not found in face-api.node.js');
}
