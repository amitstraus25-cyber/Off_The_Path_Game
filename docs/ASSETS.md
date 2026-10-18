# Assets: manifest, gaps and placeholder strategy

## The gap, stated plainly

The approved pixel art exists only as **one flattened concept board** (`reference/off-the-path-concept-board.png`, four panels with UI drawn on top).
It is a visual target, not a production asset: there are no separable tiles, no sprite sheets, no walk cycles. A production build needs layered, separable art.
**Phase 0 must resolve who produces it** [DECISION D2]. Engineering is never blocked: the `tools/graybox` script generates placeholders with the same file names, sizes and atlas keys, so real art drops in without code changes.

## Technical spec for art (confirm with the artist, then freeze)

- Tile size **16 x 16**, scene logical resolution **480 x 270**. Nearest-neighbor, no anti-aliasing, no sub-pixel offsets. Source files in Aseprite (`.aseprite`) kept in `art-src/`; exports to PNG (+ JSON hash atlas) into `apps/game/src/assets/`.
- Palette: keep the approved board's greens, browns, water blues, Red's cloak red. Add one limited "dusk shadow" ramp for the wolf reveal. Do not recolor to Cyera purple.
- Layers per tileset: `ground`, `decor-below`, `decor-above` (tree canopies Red walks behind), `collision` (invisible), `objects` (Tiled object layer: `spawn-red`, `npc-*`, `trigger-cottage`, `prop-*`).
- File naming: `kebab-case`, no spaces. Atlas frame names: `red-walk-down-0` etc.

## Manifest

| Asset                                                                                         | Needed for                                                                  | Spec                                                                                                                           | Status                                           | Placeholder                                           |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ----------------------------------------------------- |
| `tileset-forest.png` (+ Tiled `.tsx`)                                                         | Ground, paths, water, trees, flowers, fences, rocks, bridge, well, signpost | 16px grid, about 200 tiles incl. autotile edges for water/path                                                                 | Missing (target in board)                        | graybox: flat colored tiles with edge hints           |
| `map-forest.json` (Tiled)                                                                     | The one v1 level                                                            | about 50 x 36 tiles; river with bridge, central path with fork, market stall, lantern post, signpost, well, cottage at the end | Missing                                          | graybox map with all landmarks as labelled rectangles |
| `red.png` / atlas                                                                             | Player                                                                      | 4 directions x (idle + 3-frame walk), 16 x 24                                                                                  | Missing (cloak design in board)                  | colored capsule with a direction nub                  |
| `npc-rabbit`, `npc-owl`, `npc-lantern-keeper`, `npc-wolf`                                     | NPCs                                                                        | idle 2 frames; wolf also "window silhouette" and "at door"                                                                     | Rabbit and owl in board; keeper and wolf partial | labelled rectangles                                   |
| `portrait-red`, `portrait-rabbit`, `portrait-owl`, `portrait-keeper`, `portrait-wolf-grandma` | Dialogue boxes                                                              | about 32 x 32 art shown at 3x (100px) with 3px Deep Purple border added in CSS                                                 | Red and rabbit exist in board (crop reference)   | flat color + initial letter                           |
| `item-compass`, `item-translator`, `item-lantern`, `item-key`, `item-letter`                  | Skill card icon well, basket                                                | 32 x 32, transparent background                                                                                                | Compass, key, letter in board                    | labelled squares                                      |
| `fx-interact-prompt`                                                                          | Bobbing "A" above NPCs                                                      | 2 frames                                                                                                                       | Missing                                          | simple arrow                                          |
| `fx-pawprints`                                                                                | Wolf trail at the cottage                                                   | 3 sprites                                                                                                                      | In board                                         | circles                                               |
| Fonts (`Haffer`, `Season Mix` `.woff2`)                                                       | UI                                                                          | licensed                                                                                                                       | Not in repo; request from Brand Kit              | Inter / Georgia fallbacks                             |
| Audio (stretch)                                                                               | SFX + loop                                                                  | CC0 or commissioned, under 300 KB total                                                                                        | Not started                                      | none                                                  |

## Crops available from the board for reference only

Portraits, compass, key and letter can be cropped from the board as _style references_ (see `reference/off-the-path-concept-board.png`).
They are soft because the board is upscaled; **do not ship them**. Redraw at native resolution.

## Asset pipeline tasks (Phase 0 and 2)

- [ ] `tools/graybox`: generate tileset, map, sprites, portraits, items with final names.
- [ ] Loader that fails the build if any manifest asset is missing (so a stale placeholder is a visible choice).
- [ ] `docs/ASSETS.md` status column kept current; a checklist in PLAN.md Phase 5 tracks swap-in of real art.
- [ ] Integer-scale and crispness test (Playwright screenshot at 1x, 2x, 3x device pixel ratios).
