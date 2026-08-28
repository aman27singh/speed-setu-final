import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, 'dist');
const adminDir = __dirname;

// 1. Copy dist/index.html -> admin/index.html
const distIndex = path.join(distDir, 'index.html');
const adminIndex = path.join(adminDir, 'index.html');
if (fs.existsSync(distIndex)) {
  fs.copyFileSync(distIndex, adminIndex);
  console.log('✓ Synced dist/index.html to admin/index.html');
}

// 2. Sync dist/assets/ -> admin/assets/
const distAssets = path.join(distDir, 'assets');
const adminAssets = path.join(adminDir, 'assets');

if (fs.existsSync(distAssets)) {
  if (!fs.existsSync(adminAssets)) {
    fs.mkdirSync(adminAssets, { recursive: true });
  }

  // Clean old bundle js/css files in admin/assets
  const existingFiles = fs.readdirSync(adminAssets);
  for (const file of existingFiles) {
    if (file.endsWith('.js') || file.endsWith('.css')) {
      fs.unlinkSync(path.join(adminAssets, file));
    }
  }

  // Copy new build assets
  const newAssets = fs.readdirSync(distAssets);
  for (const file of newAssets) {
    const srcPath = path.join(distAssets, file);
    const destPath = path.join(adminAssets, file);
    if (fs.statSync(srcPath).isFile()) {
      fs.copyFileSync(srcPath, destPath);
    } else if (fs.statSync(srcPath).isDirectory()) {
      fs.cpSync(srcPath, destPath, { recursive: true });
    }
  }
  console.log('✓ Synced dist/assets/ to admin/assets/');
}
