import * as vscode from 'vscode';
import * as path from 'path';
import { formatDate, formatSize } from './dateFormatter';
import type { FileMeta } from './fileMetaReader';

export type TooltipStyle = 'compact' | 'detailed' | 'card';

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

// ─── Rich tooltip (tree view) ─────────────────────────────────────────────────

export function buildRichTooltip(
  filePath: string,
  mtime: Date,
  note: string | undefined,
  style: TooltipStyle,
  isDir: boolean,
  size?: number,
  meta?: FileMeta
): vscode.MarkdownString {
  const name     = path.basename(filePath);
  const fileIcon = isDir ? '$(folder)' : '$(file)';
  const md       = new vscode.MarkdownString('', true);
  md.supportThemeIcons = true;

  const dims    = meta ? fmtDimensions(meta) : undefined;
  const headers = meta ? fmtHeaders(meta)    : undefined;
  const count   = meta ? fmtFolderCount(meta): undefined;

  switch (style) {

    case 'compact': {
      const parts = [
        `${fileIcon} **${name}**`,
        `$(calendar) ${formatDate(mtime, 'short')}`,
      ];
      if (size !== undefined)  parts.push(`$(database) ${formatSize(size)}`);
      if (dims)                parts.push(`$(symbol-color) ${dims}`);
      if (headers)             parts.push(`$(table) ${meta!.csv!.columns} cols`);
      if (count)               parts.push(`$(files) ${count}`);
      if (note)                parts.push(`$(pencil) *${note}*`);
      md.appendMarkdown(parts.join('&nbsp;&nbsp;·&nbsp;&nbsp;'));
      break;
    }

    case 'card': {
      md.appendMarkdown(`### ${fileIcon}&nbsp;${name}\n\n`);
      md.appendMarkdown(`---\n\n`);
      md.appendMarkdown(`$(calendar)&nbsp;**Last Modified**\\\n`);
      md.appendMarkdown(`${formatDate(mtime, 'full')}\n\n`);
      if (size !== undefined) {
        md.appendMarkdown(`$(database)&nbsp;**Size**\\\n`);
        md.appendMarkdown(`${formatSize(size)}\n\n`);
      }
      if (dims) {
        md.appendMarkdown(`$(symbol-color)&nbsp;**Dimensions**\\\n`);
        md.appendMarkdown(`${dims}\n\n`);
      }
      if (headers) {
        md.appendMarkdown(`$(table)&nbsp;**Columns**\\\n`);
        md.appendMarkdown(`${headers}\n\n`);
      }
      if (count) {
        md.appendMarkdown(`$(files)&nbsp;**Contents**\\\n`);
        md.appendMarkdown(`${count}\n\n`);
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
      md.appendMarkdown(`$(calendar)&nbsp;**Modified:**&nbsp;${formatDate(mtime, 'full')}\n`);
      if (size !== undefined) {
        md.appendMarkdown(`$(database)&nbsp;**Size:**&nbsp;${formatSize(size)}\n`);
      }
      if (dims) {
        md.appendMarkdown(`$(symbol-color)&nbsp;**Dimensions:**&nbsp;${dims}\n`);
      }
      if (headers) {
        md.appendMarkdown(`$(table)&nbsp;**Columns:**&nbsp;${headers}\n`);
      }
      if (count) {
        md.appendMarkdown(`$(files)&nbsp;**Contents:**&nbsp;${count}\n`);
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
  dateFormat: 'short' | 'relative' | 'full',
  size?: number,
  meta?: FileMeta
): string {
  const dims    = meta ? fmtDimensions(meta)  : undefined;
  const headers = meta ? fmtHeaders(meta, 3)  : undefined;
  const count   = meta ? fmtFolderCount(meta) : undefined;

  switch (style) {

    case 'compact': {
      const parts = [`⏱ ${formatDate(mtime, dateFormat)}`];
      if (size !== undefined) parts.push(`⬛ ${formatSize(size)}`);
      if (dims)               parts.push(`🖼 ${dims}`);
      if (headers)            parts.push(`📊 ${meta!.csv!.columns} cols`);
      if (count)              parts.push(`📁 ${count}`);
      if (note)               parts.push(`✎ ${note}`);
      return parts.join('  ·  ');
    }

    case 'card': {
      const lines = [`  🕐  Modified`, `      ${formatDate(mtime, 'full')}`];
      if (size !== undefined) {
        lines.push('', `  📦  Size`, `      ${formatSize(size)}`);
      }
      if (dims) {
        lines.push('', `  🖼   Dimensions`, `      ${dims}`);
      }
      if (headers) {
        lines.push('', `  📊  Columns`, `      ${headers}`);
      }
      if (count) {
        lines.push('', `  📁  Contents`, `      ${count}`);
      }
      if (note) {
        lines.push('', `  ✎  Note`, `      ${note}`);
      }
      return lines.join('\n');
    }

    default: { // detailed
      const lines = [`📅  Modified: ${formatDate(mtime, dateFormat)}`];
      if (size !== undefined) lines.push(`📦  Size: ${formatSize(size)}`);
      if (dims)               lines.push(`🖼   Dimensions: ${dims}`);
      if (headers)            lines.push(`📊  Columns: ${headers}`);
      if (count)              lines.push(`📁  Contents: ${count}`);
      if (note)               lines.push(`✎   Note: ${note}`);
      return lines.join('\n');
    }
  }
}
