# Canvas

A small, fast vector editor that runs in the browser: the basic design toolset and nothing more.

**Try it: [canvas.alexvoid.com](https://canvas.alexvoid.com)**

## Goal

Canvas covers the part of a design tool that gets used every day (frames, shapes, vectors, text, auto layout, export) and leaves the rest out. Speed is the main criterion for every decision: the editor should open at once and stay smooth on a large document.

It was built first for one person on a MacBook and is public for anyone to use, fork or learn from. There is no account and no server: the document and its images are saved in your browser.

## Features

- **Pages and layers**: several pages per document; a layer tree with reorder, rename, hide and lock
- **Frames and auto layout**: frames as containers with device presets; flexbox-style layout with direction, gap, padding, alignment, wrap, hug / fill / fixed sizing and absolute children
- **Shapes and images**: rectangle, ellipse and image (cover, contain, stretch, tile)
- **Pen and vector editing**: draw paths, edit points and bezier handles, bend segments, toggle corner and smooth points; stroke caps and joins
- **Text**: font family, size, weight, line height, letter spacing and alignment; auto-width, auto-height and fixed boxes; mixed styles in one layer
- **Colour**: solid, linear and radial fills on fills and strokes; opacity; hex, RGB, HSL and OKLCH notation; pick from canvas; saved colours
- **Move, scale and rotate**: with smart guides that snap to sibling and parent edges and centres, and an optional pixel grid
- **Arrange**: align, distribute, tidy up, group and ungroup
- **Clipboard**: copy, cut, paste and duplicate; paste images, SVG markup and plain text; drop images and SVG files onto the canvas; copy as SVG
- **Export**: PNG, JPG and SVG, at 0.5x to 4x
- **Open in Reel**: send a frame to [Reel](https://reel.alexvoid.com) to see it inside a device bezel
- **Undo and redo**, and autosave to the browser

## Shortcuts

| Action | Keys |
| --- | --- |
| Move · Scale · Hand | `V` · `K` · `H` or hold `Space` |
| Frame · Rectangle · Ellipse | `F` · `R` · `O` |
| Pen · Text · Image | `P` · `T` · `⇧⌘K` |
| Edit points or text | `Enter` or double-click |
| Go one level into a group or frame | double-click |
| Finish | `Esc` |
| Undo · Redo | `⌘Z` · `⇧⌘Z` |
| Copy · Cut · Paste · Duplicate | `⌘C` · `⌘X` · `⌘V` · `⌘D` |
| Drag a copy | `⌥`-drag (`⇧` locks the axis) |
| Group · Ungroup | `⌘G` · `⇧⌘G` |
| Auto layout | `⇧A` |
| Hide · Lock | `⇧⌘H` · `⇧⌘L` |
| Delete | `⌫` |
| Nudge | arrows (`⇧` for ×10) |
| Bring to front · Send to back | `]` · `[` |
| Zoom to fit · 100% | `⇧1` · `⌘0` |
| Zoom | pinch or `⌘`-scroll |
| Rotate | drag just outside a corner (`⇧` snaps to 15°) |
| Bold on the selected text | `⌘B` |

While editing points: click a line to add a point, drag a line to bend it, `⌥`-click a point to toggle corner and smooth, `⌥`-drag to pull out handles.

## Develop

Canvas needs [Node](https://nodejs.org) and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev
```

`pnpm build` typechecks and builds a static site to `dist/`, which any static host can serve.

Under the hood it is TypeScript, React and Tailwind CSS on Vite, with a WebGL2 compositor over Canvas2D-rasterized layer textures.

## Todo

- [ ] Layer tree virtualization for very large documents
- [ ] Saved documents that follow you across devices, on [x2sdk](https://github.com/algox2/x2sdk)
- [ ] Sharing a document by link
- [ ] Live multiplayer

The server-backed items are optional: Canvas will keep working as a static, local-only app when no server is configured.

## Contributing

Issues and pull requests are welcome. For anything larger than a small fix, please open an issue first to agree on the approach.

## License

[MIT](LICENSE) © Alex Shevliakov

---

<sub>Built in collaboration with [Claude](https://claude.com/claude-code).</sub>
