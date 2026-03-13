import * as vscode from 'vscode';
import * as path from 'path';
import { formatDate } from './dateFormatter';

export type TooltipStyle = 'compact' | 'detailed' | 'card';

/**
 * Rich MarkdownString tooltip for tree view items (supports icons + formatting).
 */
export function buildRichTooltip(
  filePath: string,
  mtime: Date,
  note: string | undefined,
  style: TooltipStyle,
  isDir: boolean
): vscode.MarkdownString {
  const name = path.basename(filePath);
  const fileIcon = isDir ? '$(folder)' : '$(file)';
  const md = new vscode.MarkdownString('', true);
  md.supportThemeIcons = true;

  switch (style) {
    case 'compact': {
      // Single line: icon · filename · date · note
      const parts = [
        `${fileIcon} **${name}**`,
        `$(calendar) ${formatDate(mtime, 'short')}`,
      ];
      if (note) {
        parts.push(`$(pencil) *${note}*`);
      }
      md.appendMarkdown(parts.join('&nbsp;&nbsp;·&nbsp;&nbsp;'));
      break;
    }

    case 'card': {
      // Sectioned card with dividers and labeled rows
      md.appendMarkdown(`### ${fileIcon}&nbsp;${name}\n\n`);
      md.appendMarkdown(`---\n\n`);
      md.appendMarkdown(`$(calendar)&nbsp;**Last Modified**\\\n`);
      md.appendMarkdown(`${formatDate(mtime, 'full')}\n\n`);
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
      if (note) {
        md.appendMarkdown(`\n$(pencil)&nbsp;**Note:**&nbsp;${note}\n`);
      }
      break;
    }
  }

  return md;
}

/**
 * Plain string tooltip for native Explorer file decorations.
 * FileDecoration.tooltip only accepts string (no MarkdownString), so we use
 * Unicode symbols and careful spacing for a polished look.
 */
export function buildPlainTooltip(
  mtime: Date,
  note: string | undefined,
  style: TooltipStyle,
  dateFormat: 'short' | 'relative' | 'full'
): string {
  switch (style) {
    case 'compact': {
      const parts = [`⏱ ${formatDate(mtime, dateFormat)}`];
      if (note) {
        parts.push(`✎ ${note}`);
      }
      return parts.join('  ·  ');
    }

    case 'card': {
      const lines = [
        `  🕐  Modified`,
        `      ${formatDate(mtime, 'full')}`,
      ];
      if (note) {
        lines.push('');
        lines.push(`  ✎  Note`);
        lines.push(`      ${note}`);
      }
      return lines.join('\n');
    }

    default: { // detailed
      const lines = [`📅  Modified: ${formatDate(mtime, dateFormat)}`];
      if (note) {
        lines.push(`✎   Note: ${note}`);
      }
      return lines.join('\n');
    }
  }
}
