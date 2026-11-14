# CLAUDE.md

Working rules for Claude in this repository. These override any default behavior.

## Rules

1. **Ask about design decisions.** Don't pick an architecture, library, data model, API shape, or UX direction on your own. Lay out the options with a recommendation and wait for an answer.
2. **Plan before you implement.** For anything beyond a trivial fix, write the plan first (approach, files touched, trade-offs) and get approval before writing code.
3. **Never commit, and never add co-author lines.** Don't run `git commit`, `git push`, or anything that rewrites history. Leave changes in the working tree for review. Don't add `Co-Authored-By` or other attribution trailers anywhere.
4. **Reuse existing assets and components.** Before creating a new component, util, style, icon, or asset, search the repo for one that already does the job and extend it. Don't add duplicates.
5. **Performance comes first.** It is the main criterion for every decision. Prefer the approach with fewer allocations, fewer re-renders, smaller bundles, and less work on the main thread. Point out the performance cost of any change you propose.
6. **Never test visually.** Don't launch the app, take screenshots, or drive a browser to check UI. Visual verification is done by the maintainer. When a change needs a visual check, say exactly what to look at and hand it over.
7. **Never write comments in code.** No line, block, or doc comments. Make names and structure carry the meaning.

## Stack and conventions

- **Platform**: web only, TypeScript. Vite, React, Tailwind CSS 4, `pnpm`.
- **Renderer**: WebGL2 compositor over Canvas2D-rasterized node textures. No WASM.
- **Reuse from sibling repos**: components and controls from `../reel` (`src/ui/controls.tsx`), palette and styles from `../alexvoid` (`src/styles/palette.css`). Copy and extend them before writing anything new.
- **Layout in `.tsx`**: prefer more small `.tsx` layout components over logic-heavy `.ts` files for UI.
- **Styling**: Tailwind classes in the `.tsx`. Don't add CSS files beyond the palette and the Tailwind entry.
- **Icons**: `lucide-react`. Nucleo is licensed and can't ship in this open-source repo.
