import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const wwwDir = path.join(rootDir, 'www');
const publicDir = path.join(rootDir, 'public');
const vendorDir = path.join(wwwDir, 'vendor');

fs.rmSync(wwwDir, { recursive: true, force: true });
fs.mkdirSync(vendorDir, { recursive: true });

fs.copyFileSync(path.join(rootDir, 'index.html'), path.join(wwwDir, 'index.html'));

if (fs.existsSync(publicDir)) {
  for (const entry of fs.readdirSync(publicDir)) {
    const src = path.join(publicDir, entry);
    const dest = path.join(wwwDir, entry);
    const stat = fs.statSync(src);
    if (stat.isFile()) {
      fs.copyFileSync(src, dest);
    }
  }
}

const mp4Src = path.join(rootDir, 'node_modules/mp4-muxer/build/mp4-muxer.mjs');
const webmSrc = path.join(rootDir, 'node_modules/webm-muxer/build/webm-muxer.mjs');

if (fs.existsSync(mp4Src)) {
  fs.copyFileSync(mp4Src, path.join(vendorDir, 'mp4-muxer.mjs'));
}
if (fs.existsSync(webmSrc)) {
  fs.copyFileSync(webmSrc, path.join(vendorDir, 'webm-muxer.mjs'));
}

fs.writeFileSync(path.join(wwwDir, '.nojekyll'), '');
console.log('Prepared www/ bundle for APK / static hosting.');
