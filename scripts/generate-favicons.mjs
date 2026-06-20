/**
 * Generate app/favicon.ico and app/icon.png from app/icon.svg.
 * Run: node scripts/generate-favicons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const svgPath = path.join(root, 'app', 'icon.svg');
const pngPath = path.join(root, 'app', 'icon.png');
const icoPath = path.join(root, 'app', 'favicon.ico');

const svg = fs.readFileSync(svgPath);

const png512 = await sharp(svg).resize(512, 512).png().toBuffer();
fs.writeFileSync(pngPath, png512);

const sizes = [16, 32, 48];
const pngBuffers = await Promise.all(
  sizes.map((size) => sharp(svg).resize(size, size).png().toBuffer()),
);
const ico = await pngToIco(pngBuffers);
fs.writeFileSync(icoPath, ico);

console.log(`Wrote ${pngPath} (512x512)`);
console.log(`Wrote ${icoPath} (${sizes.join(', ')}px)`);
