# Assets: the gap, and the rules an artist has to follow

## The gap, stated plainly

The approved pixel art exists only as **one flattened concept board** (`reference/off-the-path-concept-board.png`, four panels with UI drawn on top).
It is a visual target, not a production asset: there are no separable tiles, no sprite sheets, no walk cycles. A production build needs layered, separable art.
**Phase 0 must resolve who produces it** [DECISION D2]. Engineering is never blocked: the `tools/graybox` script generates placeholders with the same file names, sizes and atlas keys, so real art drops in without code changes.

## Where the facts live, so this file cannot be wrong about them

This file used to carry a technical spec and a manifest table with Status and Placeholder columns.
Both were false in nearly every line — they described 16 × 16 tiles, a 480 × 270 scene, a 50 × 36 map,
16 × 24 sprites and portraits at 3× — and `CLAUDE.md` lists this file read-first, so that is a page of
wrong numbers handed to whoever starts next. They are gone. Three places hold the truth, and each of
them is derived or generated rather than typed out:

| Question                                                 | Answer                                                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| What size is anything drawn at, and what is it shown at? | **`docs/PIXEL_STANDARD.md` section 1.** Binding, and the painters follow it.                                                          |
| Which files ship, with what frame sizes and atlas keys?  | **`apps/game/src/assets/manifest.json`**, which the loader reads at boot and `apps/game/test/assets.test.ts` checks the PNGs against. |
| How big is the camera, and what is in frame?             | `cameraFor()` in `packages/core/src/camera.ts`, or `pnpm world --frame title`.                                                        |

`manifest.json` currently declares one tileset, one map, Purple's atlas, eleven spritesheets (four NPCs,
four bystanders, three effects) and fifteen images: six portraits and nine items, among them all
seven skills' icons (the last four, signpost, parcel, shortcut and latch, painted 2026-10-22). It carries
`"placeholder": true`; that flag flipping to `false` is what "real art has landed" means.

## The rules, which are not in the manifest and do have to be written down

These are binding on any artist, and on every painter in `tools/graybox/src`. Code across the repo
cites this file by name for them.

- **No partial alpha against transparency.** A semi-transparent colour drawn onto an _opaque_ pixel is
  fine — the result is opaque. Drawn onto a _transparent_ pixel it leaves a partly-transparent pixel in
  the PNG, and those are forbidden. Build soft shading by picking a darker ramp level, never by lowering
  alpha over nothing. (`docs/PIXEL_STANDARD.md` section 4 states the same rule and names this file as
  its home.)
- **Palette: keep the approved board's greens, browns, water blues, Purple's cloak red.** Exactly **one**
  limited "dusk shadow" ramp is allowed, for the wolf reveal, and it extends an existing ramp downward
  rather than introducing a hue. **Do not recolor the world to Cyera purple**; `docs/PIXEL_STANDARD.md`
  section 2 says which three things carry brand colour and why.
- **Layers per tileset:** `ground`, `decor-below`, `decor-above` (tree canopies Purple walks behind),
  `collision` (invisible), `objects` (Tiled object layer: `spawn-purple`, `npc-*`, `bystander-*`,
  `trigger-cottage`, `notice-*`, `gate-fence-gap`, `prop-*`).
- **File naming:** `kebab-case`, no spaces. Atlas frame names: `purple-idle-<facing>-0` and
  `purple-walk-<facing>-0..2` for four facings. The generator and the scene both depend on exactly these
  names.
- **Source files** in Aseprite (`.aseprite`) kept in `art-src/`; exports to PNG (+ JSON hash atlas) into
  `apps/game/src/assets/`.
- **Audio** (stretch, and ahead of plan — there is a generated music bed with no files in the repo):
  CC0 or commissioned, **under 300 KB total**.

## Crops available from the board for reference only

Portraits, compass, key and letter can be cropped from the board as _style references_ (see `reference/off-the-path-concept-board.png`).
They are soft because the board is upscaled; **do not ship them**. Redraw at native resolution.

## Asset pipeline tasks (Phase 0 and 2)

- [x] `tools/graybox`: generate tileset, map, sprites, portraits, items with final names.
- [x] Loader that fails loudly, with a named error rather than a black screen, if a manifest asset is
      missing or a map has been rescaled under it (`world/assets.ts`, `world/map.ts`, `world/scenes.ts`).
- [ ] A checklist in PLAN.md Phase 5 tracks swap-in of real art. **There is no status column here any
      more**: a hand-maintained one went stale the week it was written, and `manifest.json`'s
      `"placeholder"` flag is the machine-readable version of the same question.
- [ ] Integer-scale and crispness test (Playwright screenshot at 1x, 2x, 3x device pixel ratios).
