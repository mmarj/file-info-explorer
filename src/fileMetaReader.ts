import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execFileSync } from 'child_process';
import type { FileInfoDisplaySettings } from './settings';

export interface ImageMeta {
  width: number;
  height: number;
}

export interface CsvMeta {
  columns: number;
  headers: string[];
  rows?: number;
  rowsTruncated?: boolean;
}

export interface FolderCount {
  files: number;
  dirs: number;
}

export interface FolderDetails {
  largestFile?: string;
  largestFileSize?: number;
  newestFile?: string;
  newestMtime?: Date;
  truncated?: boolean;
}

export interface TextMeta {
  encoding?: string;
  newline?: 'LF' | 'CRLF' | 'CR' | 'Mixed' | 'None';
  lines?: number;
  linesTruncated?: boolean;
  words?: number;
  todos?: number;
  fixmes?: number;
}

export interface JsonMeta {
  valid: boolean;
  topLevelType?: 'array' | 'object' | 'other';
  keys?: number;
  items?: number;
}

export interface MarkdownMeta {
  headings: number;
  links: number;
  images: number;
}

export interface GitCommitMeta {
  relativeTime: string;
  author: string;
  summary: string;
}

export interface GitMeta {
  status?: string;
  ignored?: boolean;
  lastCommit?: GitCommitMeta;
}

export interface GeneralMeta {
  created?: Date;
  accessed?: Date;
  fileType?: string;
  extension?: string;
  mime?: string;
  permissions?: string[];
  symlinkTarget?: string;
  hash?: string;
  text?: TextMeta;
  json?: JsonMeta;
  markdown?: MarkdownMeta;
  packageVersion?: string;
  git?: GitMeta;
}

export interface FileMeta {
  image?: ImageMeta;
  csv?: CsvMeta;
  folderCount?: FolderCount;
  folderDetails?: FolderDetails;
  general?: GeneralMeta;
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico']);
const CSV_EXTS   = new Set(['.csv', '.tsv']);
const JSON_EXTS  = new Set(['.json', '.jsonc']);
const MARKDOWN_EXTS = new Set(['.md', '.markdown', '.mdx']);
const TEXT_EXTS = new Set([
  '.c', '.cpp', '.cs', '.css', '.go', '.h', '.hpp', '.html', '.java', '.js', '.jsx',
  '.json', '.jsonc', '.less', '.lua', '.md', '.mdx', '.php', '.py', '.rb', '.rs',
  '.scss', '.sh', '.sql', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml',
]);
const HASH_MAX_BYTES = 10 * 1024 * 1024;
const TEXT_MAX_BYTES = 1024 * 1024;
const FOLDER_DETAILS_MAX_ENTRIES = 2000;

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

export function readCsvMeta(filePath: string, includeRows = false): CsvMeta | undefined {
  const ext = path.extname(filePath).toLowerCase();
  const delimiter = ext === '.tsv' ? '\t' : ',';

  const text = readBytes(filePath, 4096).toString('utf8');
  const firstLine = text.split(/\r?\n/)[0];
  if (!firstLine) return undefined;

  const headers = firstLine
    .split(delimiter)
    .map(h => h.trim().replace(/^["']|["']$/g, ''));

  const meta: CsvMeta = { columns: headers.length, headers };

  if (includeRows) {
    const stat = fs.statSync(filePath);
    const sample = readBytes(filePath, Math.min(stat.size, TEXT_MAX_BYTES)).toString('utf8');
    const rows = sample.trim() ? sample.split(/\r?\n/).length : 0;
    meta.rows = Math.max(0, rows - 1);
    meta.rowsTruncated = stat.size > TEXT_MAX_BYTES;
  }

  return meta;
}

export function countFolderEntries(dirPath: string): FolderCount {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const visible = entries.filter(e => !e.name.startsWith('.'));
  return {
    files: visible.filter(e => !e.isDirectory()).length,
    dirs:  visible.filter(e =>  e.isDirectory()).length,
  };
}

export function readFolderDetails(dirPath: string): FolderDetails | undefined {
  const details: FolderDetails = {};
  let seen = 0;

  function walk(currentPath: string): void {
    if (seen >= FOLDER_DETAILS_MAX_ENTRIES) {
      details.truncated = true;
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (seen >= FOLDER_DETAILS_MAX_ENTRIES) {
        details.truncated = true;
        return;
      }
      seen++;

      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }

      let stat: fs.Stats;
      try {
        stat = fs.statSync(entryPath);
      } catch {
        continue;
      }

      if (details.largestFileSize === undefined || stat.size > details.largestFileSize) {
        details.largestFile = path.relative(dirPath, entryPath);
        details.largestFileSize = stat.size;
      }
      if (!details.newestMtime || stat.mtime > details.newestMtime) {
        details.newestFile = path.relative(dirPath, entryPath);
        details.newestMtime = stat.mtime;
      }
    }
  }

  walk(dirPath);
  return details.largestFile || details.newestFile || details.truncated ? details : undefined;
}

export function readGeneralMeta(
  filePath: string,
  stat: fs.Stats,
  isDir: boolean,
  settings: FileInfoDisplaySettings
): GeneralMeta | undefined {
  const meta: GeneralMeta = {};
  const ext = path.extname(filePath).toLowerCase();

  if (settings.showCreatedTime) meta.created = stat.birthtime;
  if (settings.showAccessedTime) meta.accessed = stat.atime;
  if (settings.showFileType) meta.fileType = describeFileType(filePath, isDir);
  if (settings.showMimeType && !isDir) meta.mime = mimeTypeForExt(ext);
  if (settings.showFileType && ext) meta.extension = ext.slice(1);
  if (settings.showPermissions) meta.permissions = describePermissions(stat);

  if (settings.showSymlinkTarget) {
    try {
      const linkStat = fs.lstatSync(filePath);
      if (linkStat.isSymbolicLink()) {
        meta.symlinkTarget = fs.readlinkSync(filePath);
      }
    } catch {
      // skip
    }
  }

  if (!isDir) {
    if (settings.showHash && stat.size <= HASH_MAX_BYTES) {
      try { meta.hash = hashFile(filePath); } catch { /* skip */ }
    }

    const wantsText = settings.showLineCount ||
      settings.showWordCount ||
      settings.showEncoding ||
      settings.showNewline ||
      settings.showTodoCount ||
      settings.showMarkdownInfo;
    if (wantsText && isLikelyTextFile(filePath)) {
      try {
        const text = readTextMeta(filePath, stat, settings);
        if (text) meta.text = text;
      } catch {
        // skip
      }
    }

    if (settings.showPackageVersion && path.basename(filePath) === 'package.json') {
      try { meta.packageVersion = readPackageVersion(filePath); } catch { /* skip */ }
    }

    if (settings.showJsonInfo && JSON_EXTS.has(ext)) {
      try {
        const json = readJsonMeta(filePath, stat);
        if (json) meta.json = json;
      } catch {
        meta.json = { valid: false };
      }
    }

    if (settings.showMarkdownInfo && MARKDOWN_EXTS.has(ext)) {
      try {
        const markdown = readMarkdownMeta(filePath, stat);
        if (markdown) meta.markdown = markdown;
      } catch {
        // skip
      }
    }
  }

  if (settings.showGitStatus || settings.showGitLastCommit || settings.showGitIgnored) {
    try {
      const git = readGitMeta(filePath, isDir, settings);
      if (git) meta.git = git;
    } catch {
      // skip
    }
  }

  return Object.keys(meta).length ? meta : undefined;
}

function isLikelyTextFile(filePath: string): boolean {
  return TEXT_EXTS.has(path.extname(filePath).toLowerCase());
}

function describeFileType(filePath: string, isDir: boolean): string {
  if (isDir) return 'Folder';

  const base = path.basename(filePath).toLowerCase();
  const ext = path.extname(base);
  const byName: Record<string, string> = {
    'package.json': 'npm package manifest',
    'tsconfig.json': 'TypeScript config',
    'readme.md': 'Markdown readme',
    'dockerfile': 'Dockerfile',
    'makefile': 'Makefile',
  };
  const byExt: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript React',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript React',
    '.json': 'JSON',
    '.md': 'Markdown',
    '.css': 'CSS',
    '.html': 'HTML',
    '.py': 'Python',
    '.sh': 'Shell script',
    '.png': 'PNG image',
    '.jpg': 'JPEG image',
    '.jpeg': 'JPEG image',
    '.gif': 'GIF image',
    '.svg': 'SVG image',
    '.csv': 'CSV',
    '.tsv': 'TSV',
  };

  return byName[base] ?? byExt[ext] ?? (ext ? `${ext.slice(1).toUpperCase()} file` : 'File');
}

function mimeTypeForExt(ext: string): string | undefined {
  const types: Record<string, string> = {
    '.css': 'text/css',
    '.csv': 'text/csv',
    '.gif': 'image/gif',
    '.html': 'text/html',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ts': 'text/typescript',
    '.tsx': 'text/typescript',
    '.txt': 'text/plain',
    '.webp': 'image/webp',
    '.xml': 'application/xml',
  };
  return types[ext];
}

function describePermissions(stat: fs.Stats): string[] | undefined {
  const permissions: string[] = [];
  if ((stat.mode & 0o222) === 0) permissions.push('read-only');
  if ((stat.mode & 0o111) !== 0) permissions.push('executable');
  return permissions.length ? permissions : undefined;
}

function hashFile(filePath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex').slice(0, 12);
}

function readTextMeta(
  filePath: string,
  stat: fs.Stats,
  settings: FileInfoDisplaySettings
): TextMeta | undefined {
  const bytes = readBytes(filePath, Math.min(stat.size, TEXT_MAX_BYTES));
  if (bytes.length === 0) {
    return { encoding: settings.showEncoding ? 'Empty' : undefined, newline: settings.showNewline ? 'None' : undefined };
  }

  const binary = bytes.includes(0);
  if (binary) {
    return settings.showEncoding ? { encoding: 'Binary' } : undefined;
  }

  const text = bytes.toString('utf8');
  const meta: TextMeta = {};

  if (settings.showEncoding) {
    meta.encoding = hasUtf8Bom(bytes) ? 'UTF-8 BOM' : 'UTF-8';
  }
  if (settings.showNewline) {
    meta.newline = detectNewline(text);
  }
  if (settings.showLineCount) {
    meta.lines = countLines(text);
    meta.linesTruncated = stat.size > TEXT_MAX_BYTES;
  }
  if (settings.showWordCount && MARKDOWN_EXTS.has(path.extname(filePath).toLowerCase())) {
    meta.words = countWords(text);
  }
  if (settings.showTodoCount) {
    meta.todos = countMatches(text, /\bTODO\b/gi);
    meta.fixmes = countMatches(text, /\bFIXME\b/gi);
  }

  return Object.keys(meta).length ? meta : undefined;
}

function hasUtf8Bom(bytes: Buffer): boolean {
  return bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;
}

function detectNewline(text: string): TextMeta['newline'] {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  const lf = (text.match(/(?<!\r)\n/g) ?? []).length;
  const cr = (text.match(/\r(?!\n)/g) ?? []).length;
  const kinds = [crlf, lf, cr].filter(Boolean).length;
  if (kinds > 1) return 'Mixed';
  if (crlf) return 'CRLF';
  if (lf) return 'LF';
  if (cr) return 'CR';
  return 'None';
}

function countLines(text: string): number {
  if (!text) return 0;
  return text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length;
}

function countWords(text: string): number {
  return text.match(/\b[\p{L}\p{N}_'-]+\b/gu)?.length ?? 0;
}

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function readPackageVersion(filePath: string): string | undefined {
  const raw = readBytes(filePath, TEXT_MAX_BYTES).toString('utf8');
  const parsed = JSON.parse(raw) as { version?: unknown };
  return typeof parsed.version === 'string' ? parsed.version : undefined;
}

function readJsonMeta(filePath: string, stat: fs.Stats): JsonMeta | undefined {
  if (stat.size > TEXT_MAX_BYTES) return undefined;
  const raw = readBytes(filePath, TEXT_MAX_BYTES).toString('utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) {
    return { valid: true, topLevelType: 'array', items: parsed.length };
  }
  if (parsed && typeof parsed === 'object') {
    return { valid: true, topLevelType: 'object', keys: Object.keys(parsed).length };
  }
  return { valid: true, topLevelType: 'other' };
}

function readMarkdownMeta(filePath: string, stat: fs.Stats): MarkdownMeta | undefined {
  const text = readBytes(filePath, Math.min(stat.size, TEXT_MAX_BYTES)).toString('utf8');
  return {
    headings: countMatches(text, /^#{1,6}\s+/gm),
    links: countMatches(text, /(?<!!)\[[^\]]+\]\([^)]+\)/g),
    images: countMatches(text, /!\[[^\]]*]\([^)]+\)/g),
  };
}

function readGitMeta(
  filePath: string,
  isDir: boolean,
  settings: FileInfoDisplaySettings
): GitMeta | undefined {
  const cwd = isDir ? filePath : path.dirname(filePath);
  const root = git(['-C', cwd, 'rev-parse', '--show-toplevel'])?.trim();
  if (!root) return undefined;

  const relativePath = path.relative(root, filePath) || '.';
  const meta: GitMeta = {};

  if (settings.showGitStatus || settings.showGitIgnored) {
    const status = git(['-C', root, 'status', '--porcelain=v1', '--ignored', '--', relativePath]);
    const first = status?.split(/\r?\n/).find(Boolean);
    if (first?.startsWith('!!')) {
      meta.ignored = true;
      if (settings.showGitIgnored) meta.status = 'ignored';
    } else if (first?.startsWith('??')) {
      meta.status = 'untracked';
    } else if (first) {
      meta.status = describeGitStatus(first.slice(0, 2));
    } else if (settings.showGitStatus) {
      meta.status = 'clean';
    }
  }

  if (settings.showGitLastCommit && !meta.ignored) {
    const log = git(['-C', root, 'log', '-1', '--format=%cr%x09%an%x09%s', '--', relativePath]);
    if (log) {
      const [relativeTime, author, summary] = log.trim().split('\t');
      if (relativeTime && author && summary) {
        meta.lastCommit = { relativeTime, author, summary };
      }
    }
  }

  return Object.keys(meta).length ? meta : undefined;
}

function git(args: string[]): string | undefined {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      timeout: 750,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return undefined;
  }
}

function describeGitStatus(code: string): string {
  const index = code[0];
  const worktree = code[1];
  if (index !== ' ' && worktree !== ' ') return 'staged + modified';
  if (index !== ' ') return 'staged';
  if (worktree !== ' ') return 'modified';
  return 'changed';
}
