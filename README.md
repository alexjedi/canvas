# Canvas

## Develop

```sh
pnpm install
pnpm dev
```

`pnpm build` typechecks and builds to `dist/`.

Shortcuts: `V` move · `K` scale · `F` frame · `R` rectangle · `O` ellipse · `P` pen · `T` text · `Enter` or double-click edit points or text · double-click a group or frame to go one level deeper · `Esc` finish · `⇧⌘K` image · `H` or hold `Space` hand · `⌘Z` / `⇧⌘Z` undo/redo · `⌘D` duplicate · `⌘C` / `⌘V` copy/paste · `⌘G` / `⇧⌘G` group/ungroup · `⇧A` auto layout · `⇧⌘H` hide · `⇧⌘L` lock · `⌫` delete · arrows nudge (`⇧` ×10) · `]` / `[` front/back · `⇧1` zoom to fit · `⌘0` 100% · pinch or `⌘`-scroll to zoom. Drag just outside a corner to rotate (`⇧` snaps to 15°). While editing points: click a line to add a point, drag a line to bend it, `⌥`-click a point to toggle corner/smooth, `⌥`-drag to pull out handles. While editing text: `⌘B` bold on the selected range. Images, SVG markup and plain text can be pasted; images and SVG files can be dropped onto the canvas. Right-click for Copy as SVG.

The document and its images autosave to the browser.

## Todo

Canvas is a small, fast vector editor: the basic design toolset and nothing more. Built first for one person on a MacBook, public for anyone to use.

### Requirements

- [ ] **Pages**: several pages per document
- [ ] **Layers**: layer tree with reorder, rename, hide and lock
- [ ] **Frame tool**: frames as containers, with auto layout (flexbox-style: direction, gap, padding, alignment, hug / fill / fixed)
- [ ] **Move and scale tools**: select, move, resize, rotate
- [ ] **Pen and vector editing**: draw paths, edit points and bezier handles
- [ ] **Shapes**: rectangle, ellipse, image (fill, fit, stretch, tile)
- [ ] **Groups**: bounds follow the children
- [ ] **Smart guides**: snap to sibling and parent edges and centres, optional pixel grid
- [ ] **Align and distribute**
- [ ] **Context menu**
- [ ] **Page settings**: background colour
- [ ] **Colour picker**: opacity, notation (hex, RGB, HSL, OKLCH), pick from canvas, palette and saved colours
- [ ] **Text tool**
- [ ] **Design side panel**
  - [ ] Position
  - [ ] Layout
  - [ ] Appearance
  - [ ] Export
- [ ] **Preview in a device bezel**: show a frame inside a mockup using [Reel](https://reel.alexvoid.com). A preview only, not a prototyping tool.

### Up next

Written but waiting on a visual check: everything above except the bezel preview, plus everything below. Still unwritten: the bezel preview.

- [ ] **Pen and vector editing**: draw paths, edit points and bezier handles
- [ ] **Shapes**: rectangle, ellipse, image (fill, fit, stretch, tile)
- [ ] **Groups**: bounds follow the children
- [ ] **Smart guides**: snap to sibling and parent edges and centres, optional pixel grid
- [ ] **Align and distribute**
- [ ] **Context menu**
- [ ] **Page settings**: background colour
- [ ] **Colour picker**: opacity, notation (hex, RGB, HSL, OKLCH), pick from canvas, palette and saved colours
- [ ] **Text tool**
- [ ] **Design side panel**
  - [ ] Position
  - [ ] Layout
  - [ ] Appearance
  - [ ] Export
- [ ] **Preview in a device bezel**: show a frame inside a mockup using [Reel](https://reel.alexvoid.com). A preview only, not a prototyping tool.

### Up next

Written but waiting on a visual check: everything above except the bezel preview, plus pen and vector editing, text, and gradients below. Still unwritten: the smaller gaps and the bezel preview.

- [ ] **Pen and vector editing**
  - [ ] `vector` layer: one or more open or closed paths of points with bezier handles; its box always fits the path
  - [ ] Pen tool (`P`): click for a corner point, click-drag for a smooth one, click the first point to close, `Enter` or `Esc` to finish
  - [ ] Edit mode (double-click or `Enter`): drag points and handles, click a segment to add a point, `⌫` deletes points, `⌥`-click toggles corner/smooth
  - [ ] Entering edit mode on a rectangle or ellipse converts it to a path
  - [ ] Exact hit testing on the shape; SVG export as `<path>`
- [ ] **Text**
  - [ ] `text` layer: font family, size, weight, line height, letter spacing, alignment; colour is the fill; one style per layer
  - [ ] Resizing: auto width, auto height, fixed
  - [ ] Text tool (`T`): click for auto-width text, drag for a fixed box; editing in a native text field placed over the layer
  - [ ] Own line breaking so canvas, PNG and SVG export agree; SVG exports as `<text>`
  - [ ] Fonts: common system families, plus installed fonts where the browser allows reading them
- [ ] **Gradients**: fill type switch in the colour picker (solid, linear, radial), editable stops, on fills and strokes
- [ ] **Smaller gaps**
  - [ ] Resize handles for a multi-selection
  - [ ] Rotate handle on canvas
  - [ ] Frame name labels on canvas
  - [ ] Dragged auto layout child follows the cursor; wrap; absolute-positioned children
  - [ ] Mixed text styles inside one layer
  - [ ] Layer tree virtualization
- [ ] **Clipboard**: paste SVG as editable layers, paste text as a text layer, copy as SVG
- [ ] **Stroke caps and joins** on vectors; point panel in vector edit mode
- [ ] **Confirmation before deleting a page**

### Look and feel

- [ ] Start with the alexvoid theme and component styles
- [ ] Direction: a compact, dark, tool-first interface

### Decided

- [x] Platform: web only, TypeScript
- [x] Renderer: WebGL2 compositor over Canvas2D-rasterized node textures

### Later, maybe

- [ ] Saved documents and multiplayer on x2sdk

---

<sub>Built in collaboration with [Claude](https://claude.com/claude-code) — thanks for the coworking on this repo.</sub>
