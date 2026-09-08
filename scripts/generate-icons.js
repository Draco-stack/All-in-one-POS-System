import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, drawPixel) {
  // RGBA buffer with filter byte 0 at beginning of each scanline
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function createChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);

    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);

    // CRC32 calculation
    let crc = 0xffffffff;
    const updateCrc = (buf) => {
      for (let i = 0; i < buf.length; i++) {
        let byte = buf[i];
        for (let j = 0; j < 8; j++) {
          if ((crc ^ byte) & 1) {
            crc = (crc >>> 1) ^ 0xedb88320;
          } else {
            crc = crc >>> 1;
          }
          byte >>>= 1;
        }
      }
    };
    updateCrc(typeBuf);
    updateCrc(data);
    crc = (crc ^ 0xffffffff) >>> 0;
    crcBuf.writeUInt32BE(crc, 0);

    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // PNG Header
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression: deflate
  ihdrData[11] = 0; // Filter: adaptive
  ihdrData[12] = 0; // Interlace: none

  const ihdrChunk = createChunk('IHDR', ihdrData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

// Draw MasterPOS Branding (Dark Theme with Emerald Geometric Crown / Shield & 'M')
function renderIcon(isMaskable = false) {
  return (x, y, w, h) => {
    const nx = x / w;
    const ny = y / h;
    const cx = 0.5;
    const cy = 0.5;
    const dx = nx - cx;
    const dy = ny - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Background Gradient: Deep slate / obsidian (#090d16 to #1a2233)
    let r = Math.round(10 + ny * 18);
    let g = Math.round(14 + ny * 20);
    let b = Math.round(22 + ny * 30);
    let a = 255;

    // Outer corner rounding for non-maskable icons
    if (!isMaskable) {
      const radius = 0.22;
      const qx = Math.max(0, Math.abs(dx) - (0.5 - radius));
      const qy = Math.max(0, Math.abs(dy) - (0.5 - radius));
      const cornerDist = Math.sqrt(qx * qx + qy * qy);
      if (cornerDist > radius) {
        return [0, 0, 0, 0];
      }
    }

    // Emerald Border Glow
    const borderThickness = 0.015;
    if (dist > 0.38 && dist < 0.38 + borderThickness) {
      return [52, 211, 153, 220]; // #34d399
    }

    // Inner Radiant Shield (Emerald #10b981 / #34d399 / #059669)
    const scale = isMaskable ? 0.7 : 0.85;
    const px = (nx - 0.5) / scale;
    const py = (ny - 0.5) / scale;

    // Draw Monogram "M" and central jewel
    // Left stem of M
    if (px >= -0.3 && px <= -0.16 && py >= -0.25 && py <= 0.25) {
      return [52, 211, 153, 255];
    }
    // Right stem of M
    if (px >= 0.16 && px <= 0.3 && py >= -0.25 && py <= 0.25) {
      return [52, 211, 153, 255];
    }
    // Center V-diagonal left
    if (px >= -0.2 && px <= 0 && py >= px + 0.05 && py <= px + 0.22 && py >= -0.25 && py <= 0.15) {
      return [16, 185, 129, 255];
    }
    // Center V-diagonal right
    if (px >= 0 && px <= 0.2 && py >= -px + 0.05 && py <= -px + 0.22 && py >= -0.25 && py <= 0.15) {
      return [16, 185, 129, 255];
    }
    // Central Diamond Jewel Node
    const diamondDist = Math.abs(px) + Math.abs(py - 0.05);
    if (diamondDist < 0.065) {
      return [255, 255, 255, 255];
    }
    // Apex Crown Top Point
    const crownDist = Math.abs(px) + Math.abs(py + 0.28);
    if (crownDist < 0.07) {
      return [52, 211, 153, 255];
    }

    return [r, g, b, a];
  };
}

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate PWA Icons
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPNG(192, 192, renderIcon(false)));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPNG(512, 512, renderIcon(false)));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPNG(512, 512, renderIcon(true)));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPNG(180, 180, renderIcon(false)));

console.log('✓ PWA icons generated successfully in /public');
