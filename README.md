# Canvas

## Develop

```sh
pnpm install
pnpm dev
```

`pnpm build` typechecks and builds to `dist/`.

Shortcuts: `V` move · `K` scale · `F` frame · `R` rectangle · `O` ellipse · `⇧⌘K` image · `H` or hold `Space` hand · `⌘Z` / `⇧⌘Z` undo/redo · `⌘D` duplicate · `⌘C` / `⌘V` copy/paste · `⌘G` / `⇧⌘G` group/ungroup · `⇧A` auto layout · `⇧⌘H` hide · `⇧⌘L` lock · `⌫` delete · arrows nudge (`⇧` ×10) · `]` / `[` front/back · `⇧1` zoom to fit · `⌘0` 100% · pinch or `⌘`-scroll to zoom. Images can also be pasted or dropped onto the canvas.

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
- [ ] **Text tool**
- [ ] **Design side panel**
  - [ ] Position
  - [ ] Layout
  - [ ] Appearance
  - [ ] Export
- [ ] **Preview in a device bezel**: show a frame inside a mockup using [Reel](https://reel.alexvoid.com). A preview only, not a prototyping tool.

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
