import * as fs from 'fs';
import * as path from 'path';

export interface ImageMeta {
  width: number;
  height: number;
}

export interface CsvMeta {
  columns: number;
  headers: string[];
}

export interface FolderCount {
  files: number;
  dirs: number;
}

export interface FileMeta {
  image?: ImageMeta;
  csv?: CsvMeta;
  folderCount?: FolderCount;
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico']);
const CSV_EXTS   = new Set(['.csv', '.tsv']);

export function isImageFile(filePath: string): boolean {
  return IMAGE_EXTS.has(path.extname(filePath).toLowerCase());
}

export function isCsvFile(filePath: string): boolean {
  return CSV_EXTS.has(path.extname(filePath).toLowerCase());
}

// ─── Low-level byte reader ────────────────────────────────────────────────────

function readBytes(filePath: string, count: number): Buffer {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(count);
    const bytesRead = fs.readSync(fd, buf, 0, count, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

// ─── Image dimension parsers ──────────────────────────────────────────────────

function readPng(buf: Buffer): ImageMeta | undefined {
  // 8-byte signature + IHDR chunk: width @ 16, height @ 20 (big-endian uint32)
  if (buf.length < 24 || buf[0] !== 0x89 || buf[1] !== 0x50) return undefined;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readGif(buf: Buffer): ImageMeta | undefined {
  // "GIF" signature, width @ 6 and height @ 8 (little-endian uint16)
  if (buf.length < 10 || buf.toString('ascii', 0, 3) !== 'GIF') return undefined;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function readBmp(buf: Buffer): ImageMeta | undefined {
  // "BM" magic, width @ 18, height @ 22 (little-endian int32; height can be negative)
  if (buf.length < 26 || buf[0] !== 0x42 || buf[1] !== 0x4D) return undefined;
  return { width: buf.readInt32LE(18), height: Math.abs(buf.readInt32LE(22)) };
}

function readWebp(buf: Buffer): ImageMeta | undefined {
  if (buf.length < 30) return undefined;
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return undefined;
  if (buf.toString('ascii', 8, 12) !== 'WEBP') return undefined;

  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ' && buf.length >= 30) {
    return { width: buf.readUInt16LE(26) & 0x3FFF, height: buf.readUInt16LE(28) & 0x3FFF };
  }
  if (chunk === 'VP8L' && buf.length >= 25) {
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3FFF) + 1, height: ((b >> 14) & 0x3FFF) + 1 };
  }
  if (chunk === 'VP8X' && buf.length >= 30) {
    const w = buf[24] | (buf[25] << 8) | (buf[26] << 16);
    const h = buf[27] | (buf[28] << 8) | (buf[29] << 16);
    return { width: w + 1, height: h + 1 };
  }
  return undefined;
}

function readJpeg(buf: Buffer): ImageMeta | undefined {
  // Scan for SOF markers (FF C0-C3, C5-C7, C9-CB) which carry dimensions
  if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) return undefined;

  let i = 2;
  while (i + 1 < buf.length) {
    while (i < buf.length && buf[i] !== 0xFF) i++;
    while (i < buf.length && buf[i] === 0xFF) i++; // skip fill bytes
    if (i >= buf.length) break;

    const marker = buf[i++];

    // Markers with no payload
    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) continue;
    if (i + 2 > buf.length) break;

    const segLen = buf.readUInt16BE(i); // includes the 2 length bytes

    const isSOF = (marker >= 0xC0 && marker <= 0xC3) ||
                  (marker >= 0xC5 && marker <= 0xC7) ||
                  (marker >= 0xC9 && marker <= 0xCB);

    if (isSOF && i + 7 <= buf.length) {
      // layout: [2 len][1 precision][2 height][2 width]
      return { height: buf.readUInt16BE(i + 3), width: buf.readUInt16BE(i + 5) };
    }

    if (marker === 0xDA) break; // SOS — image data starts, no more segments
    i += segLen;
  }
  return undefined;
}

function readSvg(filePath: string): ImageMeta | undefined {
  const text = readBytes(filePath, 2048).toString('utf8');
  const w = text.match(/\bwidth=["']([0-9.]+)/);
  const h = text.match(/\bheight=["']([0-9.]+)/);
  if (w && h) return { width: parseFloat(w[1]), height: parseFloat(h[1]) };

  const vb = text.match(/viewBox=["'][0-9.]+ [0-9.]+ ([0-9.]+) ([0-9.]+)/);
  if (vb) return { width: parseFloat(vb[1]), height: parseFloat(vb[2]) };
  return undefined;
}

function readIco(buf: Buffer): ImageMeta | undefined {
  // ICO header: [2 reserved][2 type=1][2 count], first image entry @ 6: [1 width][1 height]
  if (buf.length < 8 || buf[0] !== 0 || buf[1] !== 0 || buf[2] !== 1 || buf[3] !== 0) return undefined;
  return { width: buf[6] || 256, height: buf[7] || 256 };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function readImageMeta(filePath: string): ImageMeta | undefined {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.svg') return readSvg(filePath);

  // JPEG may need up to 64 KB to find the SOF marker; others only need ~30 bytes
  const bytes = ext === '.jpg' || ext === '.jpeg' ? 65536 : 64;
  const buf = readBytes(filePath, bytes);

  switch (ext) {
    case '.png':  return readPng(buf);
    case '.gif':  return readGif(buf);
    case '.bmp':  return readBmp(buf);
    case '.webp': return readWebp(buf);
    case '.jpg':
    case '.jpeg': return readJpeg(buf);
    case '.ico':  return readIco(buf);
  }
  return undefined;
}

export function readCsvMeta(filePath: string): CsvMeta | undefined {
  const ext = path.extname(filePath).toLowerCase();
  const delimiter = ext === '.tsv' ? '\t' : ',';

  const text = readBytes(filePath, 4096).toString('utf8');
  const firstLine = text.split(/\r?\n/)[0];
  if (!firstLine) return undefined;

  const headers = firstLine
    .split(delimiter)
    .map(h => h.trim().replace(/^["']|["']$/g, ''));

  return { columns: headers.length, headers };
}

export function countFolderEntries(dirPath: string): FolderCount {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const visible = entries.filter(e => !e.name.startsWith('.'));
  return {
    files: visible.filter(e => !e.isDirectory()).length,
    dirs:  visible.filter(e =>  e.isDirectory()).length,
  };
}
