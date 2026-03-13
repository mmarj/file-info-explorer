import * as vscode from 'vscode';
import { NotesManager } from './notesManager';
import { FileDecorationProvider } from './fileDecorationProvider';
import { FileInfoProvider } from './fileInfoProvider';

export function activate(context: vscode.ExtensionContext): void {
  const notes = new NotesManager(context);
  const decorationProvider = new FileDecorationProvider(notes);
  const treeProvider = new FileInfoProvider(notes);

  // ── Register decoration provider (tooltips + badges in native Explorer) ──
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(decorationProvider)
  );

  // ── Register the "File Info" tree view in the Explorer sidebar ────────────
  const treeView = vscode.window.createTreeView('fileInfoExplorer', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // ── Auto-refresh when files change ───────────────────────────────────────
  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  watcher.onDidChange(() => treeProvider.refresh());
  watcher.onDidCreate(() => treeProvider.refresh());
  watcher.onDidDelete(() => treeProvider.refresh());
  context.subscriptions.push(watcher);

  // ── Also refresh tree when settings change ────────────────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('fileInfo')) {
        treeProvider.refresh();
      }
    })
  );

  // ── Commands ─────────────────────────────────────────────────────────────

  // Add / Edit Note
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'fileInfo.addNote',
      async (itemOrUri?: { resourceUri?: vscode.Uri } | vscode.Uri) => {
        const uri = resolveUri(itemOrUri);
        if (!uri) {
          vscode.window.showWarningMessage('File Info: no file selected.');
          return;
        }

        const existing = notes.getNote(uri.fsPath);
        const input = await vscode.window.showInputBox({
          title: `Note for ${uri.fsPath.split('/').pop()}`,
          prompt: 'Leave empty to remove the note.',
          value: existing ?? '',
          placeHolder: 'Type your note here…',
        });

        // undefined = user pressed Escape
        if (input === undefined) return;

        if (input.trim() === '') {
          notes.removeNote(uri.fsPath);
        } else {
          notes.setNote(uri.fsPath, input.trim());
        }

        treeProvider.refresh();
        decorationProvider.refresh(uri);
      }
    )
  );

  // Remove Note
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'fileInfo.removeNote',
      async (itemOrUri?: { resourceUri?: vscode.Uri } | vscode.Uri) => {
        const uri = resolveUri(itemOrUri);
        if (!uri) return;

        notes.removeNote(uri.fsPath);
        treeProvider.refresh();
        decorationProvider.refresh(uri);
        vscode.window.showInformationMessage('Note removed.');
      }
    )
  );

  // Refresh
  context.subscriptions.push(
    vscode.commands.registerCommand('fileInfo.refresh', () => {
      treeProvider.refresh();
    })
  );
}

export function deactivate(): void {
  // Nothing to clean up — subscriptions are disposed automatically.
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve a URI from the various forms a command argument can take:
 * - A TreeItem-like object with a resourceUri property
 * - A raw vscode.Uri
 * - Undefined → fall back to the active text editor
 */
function resolveUri(
  arg?: { resourceUri?: vscode.Uri } | vscode.Uri
): vscode.Uri | undefined {
  if (!arg) {
    return vscode.window.activeTextEditor?.document.uri;
  }
  if (arg instanceof vscode.Uri) {
    return arg;
  }
  if (arg.resourceUri instanceof vscode.Uri) {
    return arg.resourceUri;
  }
  // The native explorer passes the URI directly as the first argument
  // when the command is in explorer/context
  return undefined;
}
