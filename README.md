# File Info Explorer

A VS Code / Cursor extension that shows **last modified dates** and **sticky notes** directly in the Explorer sidebar — on every file and folder, inline.

![File Info Explorer screenshot placeholder](images/screenshot.png)

---

## Features

- **Modified date** shown to the right of every file and folder name in the Explorer
- **Hover tooltip** with full date/time details (and note if set)
- **Sticky notes** — attach a short note to any file or folder; shows as a `✎` badge and appears in the tooltip
- **Three tooltip styles** — compact, detailed, or card layout
- **Three date formats** — short (`Mar 12, 2:14 PM`), relative (`2h ago`), or full timestamp
- **File Info panel** — a dedicated panel in the Explorer sidebar listing all files with dates and notes
- Works in **VS Code**, **Cursor**, and **Antigravity**

---

## Installation

### From GitHub Releases (recommended for teams)

1. Go to the [Releases page](../../releases) and download the latest `.vsix` file
2. In VS Code / Cursor: open the Command Palette (`Cmd+Shift+P`) → **Extensions: Install from VSIX...**
3. Select the downloaded `.vsix` file

### From source

```bash
git clone https://github.com/mmarj-am/file-info-explorer.git
cd file-info-explorer
npm install
npm run compile
vsce package --no-dependencies --allow-missing-repository
```

Then install the generated `.vsix` as above.

---

## Usage

### Modified dates
Dates appear automatically in the Explorer sidebar as a grayed-out description next to each file/folder name. Hover over any item for the full tooltip.

### Adding a note
- Right-click any file or folder → **Add / Edit Note**
- Or use the Command Palette: `File Info: Add / Edit Note`
- Items with notes show a `✎` badge and are highlighted in yellow

### Removing a note
- Right-click a file with a note → **Remove Note**
- Or open **Add / Edit Note** and clear the input field

---

## Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `fileInfo.showDateOnHover` | boolean | `true` | Show modified date in Explorer tooltips |
| `fileInfo.dateFormat` | string | `short` | `short`, `relative`, or `full` |
| `fileInfo.showNoteBadge` | boolean | `true` | Show `✎` badge on files with notes |
| `fileInfo.tooltipStyle` | string | `detailed` | `compact`, `detailed`, or `card` |

### Tooltip styles

**compact** — everything on one line:
```
📄 README.md  ·  Mar 12, 2:14 PM  ·  ✎ Check before merging
```

**detailed** *(default)* — labeled rows with icons:
```
📄 README.md
📅 Modified: March 12, 2026 at 2:14 PM
✎  Note: Check before merging
```

**card** — sectioned layout with dividers and headers (best for the File Info panel).

### Date formats

| Value | Example |
|---|---|
| `short` | Mar 12, 2:14 PM |
| `relative` | 2h ago |
| `full` | 3/12/2026, 14:14:00 |

---

## Requirements

- VS Code `^1.74.0` (or Cursor / Antigravity equivalent)

---

## Author

**Mir Md Aurangajeb** — [mmarjb.wordpress.com](https://mmarjb.wordpress.com/)

## License

[MIT](LICENSE)
