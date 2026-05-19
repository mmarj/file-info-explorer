import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { NotesManager } from './notesManager';
import { formatDate, type TimeZoneOffset } from './dateFormatter';
import { buildRichTooltip, TooltipStyle } from './tooltipBuilder';
import {
  FileMeta,
  isImageFile, isCsvFile,
  readImageMeta, readCsvMeta, countFolderEntries,
  readFolderDetails, readGeneralMeta,
} from './fileMetaReader';
import { getDisplaySettings } from './settings';

// ─── Tree Item ────────────────────────────────────────────────────────────────

export class FileInfoItem extends vscode.TreeItem {
  constructor(
    public readonly resourceUri: vscode.Uri,
    collapsibleState: vscode.TreeItemCollapsibleState,
    mtime: Date,
    notes: NotesManager,
    size?: number,
    meta?: FileMeta
  ) {
    super(resourceUri, collapsibleState);

    const config = vscode.workspace.getConfiguration('fileInfo');
    const timeZoneOffset = config.get<TimeZoneOffset>('timeZoneOffset', 'system');
    const tooltipStyle = config.get<TooltipStyle>('tooltipStyle', 'detailed');
    const note = notes.getNote(resourceUri.fsPath);
    const hasNote = !!note;
    const isDir = collapsibleState !== vscode.TreeItemCollapsibleState.None;

    // Date shown to the right of the label (grayed-out description)
    this.description = formatDate(mtime, 'relative');

    // Rich tooltip
    this.tooltip = buildRichTooltip(
      resourceUri.fsPath,
      mtime,
      note ?? undefined,
      tooltipStyle,
      isDir,
      size,
      meta,
      timeZoneOffset
    );

    // Context value controls which menu items appear
    this.contextValue = hasNote ? 'hasNote' : 'noNote';

    // Icon: folder/file with a visual hint when a note exists
    if (hasNote) {
      this.iconPath = new vscode.ThemeIcon(
        isDir ? 'folder' : 'note',
        new vscode.ThemeColor('charts.yellow')
      );
    } else {
      this.iconPath = new vscode.ThemeIcon(isDir ? 'folder' : 'file');
    }

    // Double-click opens the file (ignored for directories)
    if (!isDir) {
      this.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [resourceUri],
      };
    }
  }
}

// ─── Size Helper ──────────────────────────────────────────────────────────────

function getDirSize(dirPath: string): number {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.reduce((total: number, entry: fs.Dirent) => {
      try {
        const entryPath = path.join(dirPath, entry.name);
        return total + (entry.isDirectory() ? getDirSize(entryPath) : fs.statSync(entryPath).size);
      } catch {
        return total;
      }
    }, 0);
  } catch {
    return 0;
  }
}

// ─── Tree Data Provider ───────────────────────────────────────────────────────

export class FileInfoProvider implements vscode.TreeDataProvider<FileInfoItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<FileInfoItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly notes: NotesManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: FileInfoItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: FileInfoItem): Promise<FileInfoItem[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return [];
    }

    const dirPath = element
      ? element.resourceUri.fsPath
      : undefined;

    if (!dirPath) {
      // Root level: return each workspace folder
      return workspaceFolders.map((folder) => this.makeItem(folder.uri));
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      const filtered = entries.filter((e) => !e.name.startsWith('.'));

      // Folders first, then files — both sorted alphabetically
      filtered.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return filtered.map((entry) => {
        const uri = vscode.Uri.file(path.join(dirPath, entry.name));
        return this.makeItem(uri);
      });
    } catch {
      return [];
    }
  }

  private makeItem(uri: vscode.Uri): FileInfoItem {
    const displaySettings = getDisplaySettings();
    let mtime = new Date();
    let isDir = false;
    let size: number | undefined;
    let meta: FileMeta | undefined;

    try {
      const stat = fs.statSync(uri.fsPath);
      mtime = stat.mtime;
      isDir = stat.isDirectory();

      if (isDir) {
        meta = {};
        if (displaySettings.showFolderSize) {
          size = getDirSize(uri.fsPath);
        }
        if (displaySettings.showFolderCounts) {
          try { meta.folderCount = countFolderEntries(uri.fsPath); } catch { /* skip */ }
        }
        if (displaySettings.showFolderDetails) {
          try { meta.folderDetails = readFolderDetails(uri.fsPath); } catch { /* skip */ }
        }
      } else {
        meta = {};
        if (displaySettings.showFileSize) {
          size = stat.size;
        }
        if (displaySettings.showImageDimensions && isImageFile(uri.fsPath)) {
          try { const image = readImageMeta(uri.fsPath); if (image) meta = { image }; } catch { /* skip */ }
        } else if (displaySettings.showCsvInfo && isCsvFile(uri.fsPath)) {
          try {
            const csv = readCsvMeta(uri.fsPath, displaySettings.showCsvRows);
            if (csv) meta.csv = csv;
          } catch { /* skip */ }
        }
      }

      const general = readGeneralMeta(uri.fsPath, stat, isDir, displaySettings);
      if (general) {
        meta = { ...(meta ?? {}), general };
      }
      if (meta && Object.keys(meta).length === 0) {
        meta = undefined;
      }
    } catch {
      // Inaccessible — use defaults
    }

    const collapsibleState = isDir
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    return new FileInfoItem(uri, collapsibleState, mtime, this.notes, size, meta);
  }
}
