import * as vscode from 'vscode';
import { NotesManager } from './notesManager';
import { buildPlainTooltip, TooltipStyle } from './tooltipBuilder';

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
    const dateFormat = config.get<'short' | 'relative' | 'full'>('dateFormat', 'short');
    const tooltipStyle = config.get<TooltipStyle>('tooltipStyle', 'detailed');
    const showBadge = config.get<boolean>('showNoteBadge', true);

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
        const mtime = new Date(stat.mtime);
        tooltip = buildPlainTooltip(mtime, note ?? undefined, tooltipStyle, dateFormat);
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
