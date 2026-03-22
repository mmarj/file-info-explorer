# File Info Explorer — Claude Code Context

## Project
VS Code / Cursor / Antigravity extension that shows file metadata (modified date, size, sticky notes) inline in the Explorer sidebar.

- **Publisher:** `mmarj` (OpenVSX + VS Code Marketplace)
- **Repo:** `git@github-personal:mmarj/file-info-explorer.git`
- **Current version:** `0.3.0`

## GitHub Accounts
This machine has two GitHub accounts. This project always uses the **personal** one:

| Account | SSH Host Alias | Used For |
|---|---|---|
| `mmarj` | `github-personal` | This project |
| `mmarj-am` | `github.com` | Other/work repos |

The remote is intentionally set to `git@github-personal:mmarj/file-info-explorer.git` so the correct key is always picked up without any manual switching.

**Never change the remote to `github.com` or `https://` for this repo** — it will fall through to the wrong account.

## Source Layout

```
src/
  extension.ts          # Entry point, registers providers + commands
  fileDecorationProvider.ts  # Adds tooltips + badges to native Explorer
  fileInfoProvider.ts   # Tree view (File Info panel) + recursive dir size
  tooltipBuilder.ts     # buildRichTooltip (panel) + buildPlainTooltip (Explorer)
  dateFormatter.ts      # formatDate() + formatSize()
  notesManager.ts       # Sticky notes persistence (globalStorage)
```

## Settings Contributed

| Setting | Default | Options |
|---|---|---|
| `fileInfo.showDateOnHover` | `true` | boolean |
| `fileInfo.dateFormat` | `short` | `short`, `relative`, `full` |
| `fileInfo.showNoteBadge` | `true` | boolean |
| `fileInfo.tooltipStyle` | `detailed` | `compact`, `detailed`, `card` |

## Release Workflow

1. Update version in `package.json` and `package-lock.json`
2. Add entry to `CHANGELOG.md`
3. Compile: `npm run compile`
4. Package: `vsce package --no-dependencies`
5. Commit and push to `main`
6. Push a version tag: `git tag v0.x.0 && git push origin v0.x.0`
   - GitHub Actions (`.github/workflows/release.yml`) auto-publishes the `.vsix`
7. Publish to OpenVSX manually (publisher namespace: `mmarj`):
   ```bash
   ovsx publish file-info-explorer-0.x.0.vsix -p <OVSX_TOKEN>
   ```

## Key Design Decisions

- `fileDecorationProvider` uses `vscode.workspace.fs.stat` (async, VS Code API) and only shows file size for files, not folders (too expensive per-decoration call)
- `fileInfoProvider` uses `fs.statSync` (sync, Node.js) with a recursive `getDirSize()` helper — folder sizes shown in the File Info panel only
- `tooltipBuilder` is a shared module so rich (MarkdownString) and plain (string) tooltips stay in sync
- Notes are stored in VS Code `globalStorage`, not workspace storage, so they persist across projects
