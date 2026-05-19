import * as vscode from 'vscode';
import * as fs from 'fs';
import { NotesManager } from './notesManager';
import { buildPlainTooltip, TooltipStyle } from './tooltipBuilder';
import type { TimeZoneOffset } from './dateFormatter';
import {
  FileMeta,
  isImageFile, isCsvFile,
  readImageMeta, readCsvMeta, countFolderEntries,
  readFolderDetails, readGeneralMeta,
} from './fileMetaReader';
import { getDisplaySettings } from './settings';

export class FileDecorationProvider implements vscode.FileDecorationProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this._onDidChange.event;

  constructor(private readonly notes: NotesManager) {}

  /**
   * Notify VS Code to re-fetch decorations for the given URI(s).
   * Called after a note is added, edited, or removed.
   */
  refresh(uri: vscode.Uri | vscode.Uri[]): void {
    this._onDidChange.fire(uri);
  }

  async provideFileDecoration(
    uri: vscode.Uri
  ): Promise<vscode.FileDecoration | undefined> {
    const config = vscode.workspace.getConfiguration('fileInfo');
    const showOnHover = config.get<boolean>('showDateOnHover', true);
    const timeZoneOffset = config.get<TimeZoneOffset>('timeZoneOffset', 'system');
    const tooltipStyle = config.get<TooltipStyle>('tooltipStyle', 'detailed');
    const showBadge = config.get<boolean>('showNoteBadge', true);
    const displaySettings = getDisplaySettings();

    const note = this.notes.getNote(uri.fsPath);
    const hasNote = !!note;

    // Nothing to decorate if dates are off and there's no note
    if (!showOnHover && !hasNote) {
      return undefined;
    }

    // Build tooltip
    let tooltip: string | undefined;

    if (showOnHover) {
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        const nodeStat = fs.statSync(uri.fsPath);
        const mtime = new Date(stat.mtime);
        const isFile = stat.type === vscode.FileType.File;
        const isDir  = stat.type === vscode.FileType.Directory;
        const size   = isFile && displaySettings.showFileSize ? stat.size : undefined;

        let meta: FileMeta | undefined = {};
        if (isFile) {
          if (displaySettings.showImageDimensions && isImageFile(uri.fsPath)) {
            try { const image = readImageMeta(uri.fsPath); if (image) meta.image = image; } catch { /* skip */ }
          } else if (displaySettings.showCsvInfo && isCsvFile(uri.fsPath)) {
            try {
              const csv = readCsvMeta(uri.fsPath, displaySettings.showCsvRows);
              if (csv) meta.csv = csv;
            } catch { /* skip */ }
          }
        } else if (isDir) {
          if (displaySettings.showFolderCounts) {
            try { meta.folderCount = countFolderEntries(uri.fsPath); } catch { /* skip */ }
          }
          if (displaySettings.showFolderDetails) {
            try { meta.folderDetails = readFolderDetails(uri.fsPath); } catch { /* skip */ }
          }
        }

        const general = readGeneralMeta(uri.fsPath, nodeStat, isDir, displaySettings);
        if (general) {
          meta.general = general;
        }
        if (Object.keys(meta).length === 0) {
          meta = undefined;
        }

        tooltip = buildPlainTooltip(
          mtime,
          note ?? undefined,
          tooltipStyle,
          size,
          meta,
          timeZoneOffset
        );
      } catch {
        // File may not be accessible (e.g. permission denied) — skip
        if (note) {
          tooltip = `✎ Note: ${note}`;
        }
      }
    } else if (note) {
      tooltip = `✎ Note: ${note}`;
    }

    return {
      badge: hasNote && showBadge ? '\u270E' : undefined, // ✎ pencil
      color: hasNote ? new vscode.ThemeColor('charts.yellow') : undefined,
      tooltip,
      propagate: false,
    };
  }
}
