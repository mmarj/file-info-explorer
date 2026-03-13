import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

type NotesStore = Record<string, string>;

export class NotesManager {
  private notes: NotesStore = {};
  private storagePath: string;

  constructor(context: vscode.ExtensionContext) {
    const storageDir = context.globalStorageUri.fsPath;
    this.storagePath = path.join(storageDir, 'notes.json');
    this.load();
  }

  private load(): void {
    try {
      const raw = fs.readFileSync(this.storagePath, 'utf-8');
      this.notes = JSON.parse(raw) as NotesStore;
    } catch {
      this.notes = {};
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });
      fs.writeFileSync(this.storagePath, JSON.stringify(this.notes, null, 2), 'utf-8');
    } catch (err) {
      console.error('[File Info Explorer] Failed to save notes:', err);
    }
  }

  getNote(filePath: string): string | undefined {
    return this.notes[filePath];
  }

  hasNote(filePath: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.notes, filePath);
  }

  setNote(filePath: string, text: string): void {
    this.notes[filePath] = text;
    this.save();
  }

  removeNote(filePath: string): void {
    delete this.notes[filePath];
    this.save();
  }

  allPaths(): string[] {
    return Object.keys(this.notes);
  }
}
