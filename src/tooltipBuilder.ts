import * as vscode from 'vscode';
import * as path from 'path';
import { formatDate, formatSize, type TimeZoneOffset } from './dateFormatter';
import type { FileMeta } from './fileMetaReader';

export type TooltipStyle = 'compact' | 'detailed' | 'card';

interface DetailLine {
  richIcon: string;
  plainIcon: string;
  label: string;
  value: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDimensions(meta: FileMeta): string | undefined {
  if (!meta.image) return undefined;
  return `${meta.image.width} × ${meta.image.height}`;
}

function fmtHeaders(meta: FileMeta, limit = 4): string | undefined {
  if (!meta.csv) return undefined;
  const shown = meta.csv.headers.slice(0, limit).join(', ');
  const more  = meta.csv.columns > limit ? ` +${meta.csv.columns - limit} more` : '';
  return `${meta.csv.columns} columns (${shown}${more})`;
}

function fmtFolderCount(meta: FileMeta): string | undefined {
  if (!meta.folderCount) return undefined;
  const { files, dirs } = meta.folderCount;
  const parts: string[] = [];
  if (files) parts.push(`${files} file${files !== 1 ? 's' : ''}`);
  if (dirs)  parts.push(`${dirs} folder${dirs !== 1 ? 's' : ''}`);
  return parts.length ? parts.join(', ') : 'Empty';
}

function buildDetailLines(
  meta: FileMeta | undefined,
  size: number | undefined,
  timeZoneOffset: TimeZoneOffset
): DetailLine[] {
  const lines: DetailLine[] = [];
  const general = meta?.general;

  if (size !== undefined) {
    lines.push({ richIcon: '$(database)', plainIcon: '📦', label: 'Size', value: formatSize(size) });
  }
  if (general?.fileType) {
    const value = general.extension ? `${general.fileType} (.${general.extension})` : general.fileType;
    lines.push({ richIcon: '$(symbol-file)', plainIcon: '🏷', label: 'Type', value });
  }
  if (general?.mime) {
    lines.push({ richIcon: '$(tag)', plainIcon: '🏷', label: 'MIME', value: general.mime });
  }
  if (general?.created) {
    lines.push({
      richIcon: '$(diff-added)',
      plainIcon: '🆕',
      label: 'Created',
      value: formatDate(general.created, 'full', timeZoneOffset),
    });
  }
  if (general?.accessed) {
    lines.push({
      richIcon: '$(eye)',
      plainIcon: '👁',
      label: 'Accessed',
      value: formatDate(general.accessed, 'full', timeZoneOffset),
    });
  }

  const dims = meta ? fmtDimensions(meta) : undefined;
  if (dims) {
    lines.push({ richIcon: '$(symbol-color)', plainIcon: '🖼', label: 'Dimensions', value: dims });
  }

  const headers = meta ? fmtHeaders(meta) : undefined;
  if (headers) {
    lines.push({ richIcon: '$(table)', plainIcon: '📊', label: 'Columns', value: headers });
  }
  if (meta?.csv?.rows !== undefined) {
    const suffix = meta.csv.rowsTruncated ? '+' : '';
    lines.push({ richIcon: '$(list-ordered)', plainIcon: '📊', label: 'Rows', value: `${meta.csv.rows}${suffix}` });
  }

  const count = meta ? fmtFolderCount(meta) : undefined;
  if (count) {
    lines.push({ richIcon: '$(files)', plainIcon: '📁', label: 'Contents', value: count });
  }
  if (meta?.folderDetails?.largestFile && meta.folderDetails.largestFileSize !== undefined) {
    lines.push({
      richIcon: '$(arrow-up)',
      plainIcon: '⬆',
      label: 'Largest File',
      value: `${meta.folderDetails.largestFile} (${formatSize(meta.folderDetails.largestFileSize)})`,
    });
  }
  if (meta?.folderDetails?.newestFile && meta.folderDetails.newestMtime) {
    lines.push({
      richIcon: '$(clock)',
      plainIcon: '🕘',
      label: 'Newest File',
      value: `${meta.folderDetails.newestFile} (${formatDate(meta.folderDetails.newestMtime, 'relative')})`,
    });
  }
  if (meta?.folderDetails?.truncated) {
    lines.push({ richIcon: '$(warning)', plainIcon: '⚠', label: 'Folder Scan', value: 'Partial result' });
  }

  if (general?.text?.lines !== undefined) {
    const suffix = general.text.linesTruncated ? '+' : '';
    lines.push({ richIcon: '$(list-unordered)', plainIcon: '☰', label: 'Lines', value: `${general.text.lines}${suffix}` });
  }
  if (general?.text?.words !== undefined) {
    lines.push({ richIcon: '$(whole-word)', plainIcon: '🔤', label: 'Words', value: String(general.text.words) });
  }
  if (general?.markdown) {
    lines.push({
      richIcon: '$(markdown)',
      plainIcon: '📝',
      label: 'Markdown',
      value: `${general.markdown.headings} headings, ${general.markdown.links} links, ${general.markdown.images} images`,
    });
  }
  if (general?.json) {
    const value = general.json.valid
      ? formatJsonMeta(general.json)
      : 'Invalid JSON';
    lines.push({ richIcon: '$(json)', plainIcon: '🔧', label: 'JSON', value });
  }
  if (general?.packageVersion) {
    lines.push({ richIcon: '$(package)', plainIcon: '📦', label: 'Package Version', value: general.packageVersion });
  }
  if (general?.text && (general.text.todos || general.text.fixmes)) {
    const parts: string[] = [];
    if (general.text.todos) parts.push(`${general.text.todos} TODO`);
    if (general.text.fixmes) parts.push(`${general.text.fixmes} FIXME`);
    lines.push({ richIcon: '$(checklist)', plainIcon: '☑', label: 'Tasks', value: parts.join(', ') });
  }
  if (general?.text?.encoding) {
    lines.push({ richIcon: '$(symbol-key)', plainIcon: '🔡', label: 'Encoding', value: general.text.encoding });
  }
  if (general?.text?.newline) {
    lines.push({ richIcon: '$(newline)', plainIcon: '↵', label: 'Newlines', value: general.text.newline });
  }
  if (general?.permissions?.length) {
    lines.push({ richIcon: '$(lock)', plainIcon: '🔒', label: 'Permissions', value: general.permissions.join(', ') });
  }
  if (general?.symlinkTarget) {
    lines.push({ richIcon: '$(link)', plainIcon: '🔗', label: 'Symlink', value: general.symlinkTarget });
  }
  if (general?.git?.status) {
    lines.push({ richIcon: '$(git-branch)', plainIcon: '⑂', label: 'Git', value: general.git.status });
  } else if (general?.git?.ignored) {
    lines.push({ richIcon: '$(git-branch)', plainIcon: '⑂', label: 'Git', value: 'ignored' });
  }
  if (general?.git?.lastCommit) {
    const commit = general.git.lastCommit;
    lines.push({
      richIcon: '$(git-commit)',
      plainIcon: '⑂',
      label: 'Last Commit',
      value: `${commit.relativeTime} by ${commit.author}: ${commit.summary}`,
    });
  }
  if (general?.hash) {
    lines.push({ richIcon: '$(fingerprint)', plainIcon: '#', label: 'SHA-256', value: general.hash });
  }

  return lines;
}

function formatJsonMeta(meta: NonNullable<FileMeta['general']>['json']): string {
  if (!meta) return '';
  if (meta.topLevelType === 'object') return `${meta.keys ?? 0} top-level keys`;
  if (meta.topLevelType === 'array') return `${meta.items ?? 0} items`;
  return 'Valid JSON';
}

// ─── Rich tooltip (tree view) ─────────────────────────────────────────────────

export function buildRichTooltip(
  filePath: string,
  mtime: Date,
  note: string | undefined,
  style: TooltipStyle,
  isDir: boolean,
  size?: number,
  meta?: FileMeta,
  timeZoneOffset: TimeZoneOffset = 'system'
): vscode.MarkdownString {
  const name     = path.basename(filePath);
  const fileIcon = isDir ? '$(folder)' : '$(file)';
  const md       = new vscode.MarkdownString('', true);
  md.supportThemeIcons = true;

  const detailLines = buildDetailLines(meta, size, timeZoneOffset);

  switch (style) {

    case 'compact': {
      const parts = [
        `$(history) ${formatDate(mtime, 'relative')}`,
        `$(calendar) ${formatDate(mtime, 'full', timeZoneOffset)}`,
        ...detailLines.map((line) => `${line.richIcon} ${line.value}`),
      ];
      if (note)                parts.push(`$(pencil) *${note}*`);
      md.appendMarkdown(`${fileIcon} **${name}**\n\n`);
      md.appendMarkdown(parts.join('&nbsp;&nbsp;·&nbsp;&nbsp;'));
      break;
    }

    case 'card': {
      md.appendMarkdown(`### ${fileIcon}&nbsp;${name}\n\n`);
      md.appendMarkdown(`---\n\n`);
      md.appendMarkdown(`$(history)&nbsp;${formatDate(mtime, 'relative')}\n\n`);
      md.appendMarkdown(`$(calendar)&nbsp;**Last Modified**\\\n`);
      md.appendMarkdown(`${formatDate(mtime, 'full', timeZoneOffset)}\n\n`);
      for (const line of detailLines) {
        md.appendMarkdown(`${line.richIcon}&nbsp;**${line.label}**\\\n`);
        md.appendMarkdown(`${line.value}\n\n`);
      }
      if (note) {
        md.appendMarkdown(`---\n\n`);
        md.appendMarkdown(`$(pencil)&nbsp;**Note**\\\n`);
        md.appendMarkdown(`${note}\n\n`);
      }
      break;
    }

    default: { // detailed
      md.appendMarkdown(`${fileIcon}&nbsp;**${name}**\n\n`);
      md.appendMarkdown(`$(history)&nbsp;${formatDate(mtime, 'relative')}\n`);
      md.appendMarkdown(`$(calendar)&nbsp;**Modified:**&nbsp;${formatDate(mtime, 'full', timeZoneOffset)}\n`);
      for (const line of detailLines) {
        md.appendMarkdown(`${line.richIcon}&nbsp;**${line.label}:**&nbsp;${line.value}\n`);
      }
      if (note) {
        md.appendMarkdown(`\n$(pencil)&nbsp;**Note:**&nbsp;${note}\n`);
      }
      break;
    }
  }

  return md;
}

// ─── Plain tooltip (native Explorer) ─────────────────────────────────────────

export function buildPlainTooltip(
  mtime: Date,
  note: string | undefined,
  style: TooltipStyle,
  size?: number,
  meta?: FileMeta,
  timeZoneOffset: TimeZoneOffset = 'system'
): string {
  const detailLines = buildDetailLines(meta, size, timeZoneOffset);

  switch (style) {

    case 'compact': {
      const parts = [
        `📅  Modified: ${formatDate(mtime, 'full', timeZoneOffset)}`,
        ...detailLines.map((line) => `${line.plainIcon} ${line.value}`),
      ];
      if (note)               parts.push(`✎ ${note}`);
      return `${formatDate(mtime, 'relative')}\n${parts.join('  ·  ')}`;
    }

    case 'card': {
      const lines = [
        formatDate(mtime, 'relative'),
        '',
        `  🕐  Modified`,
        `      ${formatDate(mtime, 'full', timeZoneOffset)}`,
      ];
      for (const line of detailLines) {
        lines.push('', `  ${line.plainIcon}  ${line.label}`, `      ${line.value}`);
      }
      if (note) {
        lines.push('', `  ✎  Note`, `      ${note}`);
      }
      return lines.join('\n');
    }

    default: { // detailed
      const lines = [
        formatDate(mtime, 'relative'),
        `📅  Modified: ${formatDate(mtime, 'full', timeZoneOffset)}`,
      ];
      for (const line of detailLines) {
        lines.push(`${line.plainIcon}  ${line.label}: ${line.value}`);
      }
      if (note)               lines.push(`✎   Note: ${note}`);
      return lines.join('\n');
    }
  }
}
