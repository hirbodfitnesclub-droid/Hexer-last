const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Minimal high-contrast dark PNG icon representation (valid transparent/black 1x1 pixel)
const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYP8DAAEDAWb2uAAAAABJRU5ErkJggg==';

const icons = [
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png'
];

icons.forEach(icon => {
  const filePath = path.join(publicDir, icon);
  fs.writeFileSync(filePath, Buffer.from(tinyPngBase64, 'base64'));
  console.log(`Generated icon at ${filePath}`);
});
