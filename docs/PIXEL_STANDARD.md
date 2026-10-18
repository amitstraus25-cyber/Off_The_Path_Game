# The 32px drawing standard (binding)

Every painter in `tools/graybox/src` follows this. It exists because the art is drawn by many hands
into one tileset, and a tileset reads as one world only if the hands agree. Where this file and a
painter disagree, this file wins.

Companions: `docs/ART_PRODUCTION.md` (what to draw and in what order), `docs/ASSETS.md` (file names
and the alpha rule), `reference/mocks/gameplay-concepts.png` (the approved direction).

---

## 1. Sizes

| Thing                     | Source size | Shown at (1.5× camera upscale) |
| ------------------------- | ----------- | ------------------------------ |
| Terrain tile              | 32 × 32     | 48 × 48                        |
| Red, NPCs, bystanders     | 32 × 48     | 48 × 72                        |
| Portraits                 | 64 × 64     | DOM, unscaled                  |
| Items                     | 64 × 64     | DOM, unscaled                  |
| Interact prompt, pawprint | 32 × 32     | 48 × 48                        |
| Dust                      | 16 × 16     | 24 × 24                        |

The map stays 60 × 42 tiles and the field of view stays 26 × 15 tiles. Nothing about the level
changes; only the number of pixels inside each square.

**The detail budget is 4×, and it buys structure, not noise.** A 16px plank was one line; a 32px
plank is a plank with a visible end grain and a gap to the next one. Four times the pixels spent on
four times the speckle just reads as dirt.

---

## 2. Colour

**Only `shade(ramp, level)`.** No raw hex in any painter, ever. If a colour you need is not in
`PALETTE`, that is a palette decision and belongs in `paint.ts` with a comment saying why — not a
literal at the call site. The rebrand of 2026-10-18 worked precisely because every frame painted
from shared ramps; a single hardcoded colour would have survived it.

Each ramp is four steps: `0` dark, `1` base, `2` light, `3` highlight.

- **Base is the subject.** Most of any object is level 1.
- **Level 0 is its own outline and its contact shadow**, not a black key line.
- **Level 3 is a highlight, not a fill.** If more than about a fifth of a shape is level 3, it has
  stopped being a highlight.

**The forest stays a forest.** Cyera's palette has no green, no brown and no water blue, so grass,
water, wood, stone and sand keep their own ramps. Brand colour reaches the world through Red, the
wolf, the toadstools, the flowers, the stall awning and the night, and nowhere else.

**Lime appears nowhere in world art.** It is one call to action per screen, in the DOM
(`docs/UI_FOUNDATIONS.md` section 2).

---

## 3. Light

**One light, from the top-left, everywhere.** Top and left faces catch level 2 or 3; bottom and
right faces fall to level 0. A single object lit from the other side will read as a hole in the
ground, and at a 26-tile camera you will see it before you see anything else.

Anything standing on the ground gets a **contact shadow**: a flattened ellipse in `shadow`, wider
than it is tall, tucked under the base and offset one or two pixels down-right. Without it a tree
floats.

---

## 4. Edges

- **Hard pixels only. No anti-aliasing, no gradients, no blur.** The game renders with
  `pixelArt: true` (nearest sampling); a softened edge is simply a wrong colour.
- **No partial alpha against transparency.** `Img.px` blends source-over, so drawing a
  semi-transparent colour onto an _opaque_ pixel is fine — the result is opaque. Drawing it onto a
  _transparent_ pixel leaves a partly-transparent pixel in the file, which `docs/ASSETS.md`
  forbids. Build soft shading by picking a darker ramp level, not by lowering alpha over nothing.
  (`fx-dust`, `fx-pawprints` and `npc-lantern-keeper` currently break this and need fixing.)
- **Outline with the object's own dark**, so a tree is outlined in canopy-dark and a wall in
  stone-dark. Reserve `ink` for the wolf, who is meant to read as a silhouette.

---

## 5. Tiles

- **Seamless on every edge that can repeat.** `grass-*`, `water`, `path` and `wall` must tile
  against themselves in all four directions with no seam and no visible grid. Check by eye on the
  contact sheet, where neighbours sit edge to edge.
- **No feature touching an edge unless it continues across it.** A flower two pixels from the top
  edge becomes half a flower against the tile above.
- **Variation lives in the map, not the tile.** `grass-0..3` are four quiet variants, and
  `forest-map.ts` scatters them with value noise in patches several tiles wide. A tile that is
  individually interesting becomes a repeating pattern the moment forty of them are laid side by
  side — which is the single most common way a tileset looks cheap.
- **Path edges are irregular.** Two pixels of lighter sand, then a darker grass lip, and never a
  straight line. The concept board has no straight path edge anywhere.

---

## 6. Characters

32 × 48, four directions, four frames each (idle, then three walk).

- **Silhouette first.** At a 26-tile camera you read the outline before anything inside it. If two
  characters have the same silhouette, one of them is wrong, whatever colour it is.
- **Two pixels of eye, and no mouth** below this size. A drawn mouth at 32px reads as a smear.
- **The walk cycle moves the whole body**, not just the legs: a one-pixel bob on frames 1 and 3
  does more for the walk than any amount of leg detail.
- **Red carries her basket in the off hand** in every frame. It is the detail that says she is on an
  errand rather than out for a walk.

---

## 7. Looking at it

A painter who has not looked at the output has not finished.

```bash
pnpm preview --out /tmp/art --zoom 8 --what tiles
```

`--what` takes `tiles`, `red`, `npcs`, `portraits`, `items`, `fx` or `all`. It writes contact sheets
at an integer zoom, on a checkerboard so transparency is visible, with a magenta grid on the frame
boundaries, and prints which cell holds which name. Magenta and the checkerboard are not in any
palette, so neither can be mistaken for art.

Judge at zoom 8 for pixel mistakes, then at zoom 2 for whether it reads at the size people will
actually see. Most things that look good at zoom 8 and bad at zoom 2 are over-detailed.
