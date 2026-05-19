import * as vscode from 'vscode';

export interface FileInfoDisplaySettings {
  showFileSize: boolean;
  showFolderSize: boolean;
  showImageDimensions: boolean;
  showCsvInfo: boolean;
  showCsvRows: boolean;
  showFolderCounts: boolean;
  showFolderDetails: boolean;
  showCreatedTime: boolean;
  showAccessedTime: boolean;
  showFileType: boolean;
  showMimeType: boolean;
  showPermissions: boolean;
  showSymlinkTarget: boolean;
  showLineCount: boolean;
  showWordCount: boolean;
  showEncoding: boolean;
  showNewline: boolean;
  showHash: boolean;
  showGitStatus: boolean;
  showGitLastCommit: boolean;
  showGitIgnored: boolean;
  showTodoCount: boolean;
  showPackageVersion: boolean;
  showJsonInfo: boolean;
  showMarkdownInfo: boolean;
}

export function getDisplaySettings(): FileInfoDisplaySettings {
  const config = vscode.workspace.getConfiguration('fileInfo');

  return {
    showFileSize: config.get<boolean>('showFileSize', true),
    showFolderSize: config.get<boolean>('showFolderSize', true),
    showImageDimensions: config.get<boolean>('showImageDimensions', true),
    showCsvInfo: config.get<boolean>('showCsvInfo', true),
    showCsvRows: config.get<boolean>('showCsvRows', true),
    showFolderCounts: config.get<boolean>('showFolderCounts', true),
    showFolderDetails: config.get<boolean>('showFolderDetails', false),
    showCreatedTime: config.get<boolean>('showCreatedTime', true),
    showAccessedTime: config.get<boolean>('showAccessedTime', false),
    showFileType: config.get<boolean>('showFileType', true),
    showMimeType: config.get<boolean>('showMimeType', false),
    showPermissions: config.get<boolean>('showPermissions', false),
    showSymlinkTarget: config.get<boolean>('showSymlinkTarget', true),
    showLineCount: config.get<boolean>('showLineCount', true),
    showWordCount: config.get<boolean>('showWordCount', true),
    showEncoding: config.get<boolean>('showEncoding', false),
    showNewline: config.get<boolean>('showNewline', false),
    showHash: config.get<boolean>('showHash', false),
    showGitStatus: config.get<boolean>('showGitStatus', true),
    showGitLastCommit: config.get<boolean>('showGitLastCommit', false),
    showGitIgnored: config.get<boolean>('showGitIgnored', false),
    showTodoCount: config.get<boolean>('showTodoCount', true),
    showPackageVersion: config.get<boolean>('showPackageVersion', true),
    showJsonInfo: config.get<boolean>('showJsonInfo', true),
    showMarkdownInfo: config.get<boolean>('showMarkdownInfo', true),
  };
}
