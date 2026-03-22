# Changelog

## [0.4.0]

- Display image dimensions (width × height) on hover for PNG, JPEG, GIF, WebP, BMP, SVG, ICO — zero dependencies, parsed from raw file headers
- Display CSV/TSV column count and header names on hover
- Display folder contents count (files and subfolders) on hover for directories
- Extension icon added

## [0.3.0]

- Display file size in hover tooltips for files in the native Explorer and File Info panel
- Display total folder size (recursive) in hover tooltips for folders in the File Info panel
- Size shown in human-readable format: B, KB, MB, GB
- Size appears in all three tooltip styles: compact, detailed, and card

## [0.2.0]

- Add `fileInfo.tooltipStyle` setting with three layout options: `compact`, `detailed`, `card`
- Rich Markdown tooltips in the File Info panel (icons, dividers, bold labels)
- Improved plain-text tooltips in the native Explorer with emoji and better spacing
- Shared `tooltipBuilder` module for consistent tooltip logic across providers

## [0.1.0]

- Initial release
- Modified date shown inline in the Explorer sidebar (grayed-out description)
- Hover tooltip with full date/time
- Sticky notes on files and folders via right-click context menu
- `✎` badge on files/folders that have a note
- File Info panel in the Explorer sidebar
- Settings: `dateFormat`, `showDateOnHover`, `showNoteBadge`
