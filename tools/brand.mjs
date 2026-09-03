// Rasteriza public/favicon.svg con sharp: favicon-32.png, apple-touch-icon.png (180, fondo opaco),
// icon-192.png, icon-512.png y favicon.ico (16/32/48 como PNG embebidos).
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const svg = readFileSync('public/favicon.svg');
const BG = { r: 5, g: 7, b: 11, alpha: 1 }; // --tile-black

async function png(size, { flatten = false, pad = 0 } = {}) {
  const inner = size - pad * 2;
  let img = sharp(svg, { density: Math.ceil((72 * inner) / 64) + 8 }).resize(inner, inner);
  if (pad) {
    img = img.extend({ top: pad, bottom: pad, left: pad, right: pad, background: BG });
  }
  if (flatten) img = img.flatten({ background: BG });
  return img.png({ compressionLevel: 9 }).toBuffer();
}

function ico(entries) {
  // ICO con imágenes PNG (soportado por todos los navegadores modernos)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const dir = [];
  const blobs = [];
  let offset = 6 + 16 * entries.length;
  for (const { size, buf } of entries) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    dir.push(e);
    blobs.push(buf);
  }
  return Buffer.concat([header, ...dir, ...blobs]);
}

const out = {
  'public/favicon-32.png': await png(32),
  'public/apple-touch-icon.png': await png(180, { flatten: true, pad: 12 }),
  'public/icon-192.png': await png(192),
  'public/icon-512.png': await png(512),
};
for (const [file, buf] of Object.entries(out)) {
  writeFileSync(file, buf);
  console.log(`${file}: ${buf.length} bytes`);
}
const icoBuf = ico([
  { size: 16, buf: await png(16) },
  { size: 32, buf: await png(32) },
  { size: 48, buf: await png(48) },
]);
writeFileSync('public/favicon.ico', icoBuf);
console.log(`public/favicon.ico: ${icoBuf.length} bytes`);
