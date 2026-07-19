const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../node_modules/@vladmandic/face-api/dist/face-api.node.js');
const content = fs.readFileSync(filePath, 'utf8');

const regex = /require\(['"][^'"]+['"]\)/g;
let match;
while ((match = regex.exec(content)) !== null) {
  console.log('Found require:', match[0]);
}
