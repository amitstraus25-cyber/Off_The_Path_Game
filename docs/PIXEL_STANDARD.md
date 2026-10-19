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

**Never a raw hex in any painter, ever.** If a colour you need is not reachable from `PALETTE`,
that is a palette decision and belongs in `paint.ts` with a comment saying why — not a literal at
the call site. The rebrand of 2026-10-18 worked precisely because every frame painted from shared
ramps; a single hardcoded colour would have survived it.

Three functions reach a ramp, and which one you pick is a drawing decision:

| Use                | For                                                                  |
| ------------------ | -------------------------------------------------------------------- |
| `shade(ramp, 0–3)` | flat faces and single-pixel marks — the four stops, unchanged        |
| `tone(ramp, t)`    | anything that should read as round or lit; `t` runs 0→1 continuously |
| `keyline(ramp)`    | the outline of anything that meets the ground                        |

Each ramp is still four steps — `0` dark, `1` base, `2` light, `3` highlight — and `tone` reads
between them, so `tone(r, 0)` is `shade(r, 0)` and `tone(r, 1)` is `shade(r, 3)`.

- **Base is the subject.** Most of any object is level 1. The one documented exception is Red,
  whose cloak is Lilac-led so she stays findable at a 26-tile camera; the reasoning is on `cloak`
  in `paint.ts` and it is confined to her.
- **Level 0 is the shaded face, and `keyline()` is the outline.** This reverses what this section
  used to say. The board rings every object in a near-black of _its own hue_ and that is most of
  why it reads as one illustrated world, so a tree is ringed in `keyline('canopy')` (#113b1f) and
  a trunk in `keyline('trunk')` (#18100a). It is not black — `keyline` scales the ramp's darkest
  down and keeps the ratios, so a dark purple outlines in dark purple. Reserve literal `ink` for
  the wolf, who is meant to read as a silhouette.
- **Level 3 is a highlight, not a fill.** If more than about a fifth of a shape is level 3, it has
  stopped being a highlight.
- **Reach for `tone` before you reach for more marks.** A mass that rounds off through a dozen
  values reads as round; four hard steps plus speckle to cover the banding reads as noise. More
  detail is almost never the answer — see section 5.

**The forest stays a forest.** Cyera's palette has no green, no brown and no water blue, so grass,
water, wood, stone and sand keep their own ramps.

**Brand colour is Red, the wolf, and dusk — not an accent scattered through the world.** This list
was longer and the three that left are worth knowing about, because the old wording still reads as
permission to paint props purple:

- **Red** (`cloak`, Lilac-led) and **the wolf** (`wolf`, Deep Purple at level 1) carry it, and they
  are the point: the protagonist and the attacker are the only saturated figures in frame.
- **`night`** is Deep Purple and Aubergine at levels 2 and 3. It backs every portrait, and it now
  also paints the cottage chimney flue in `s-cottage.ts` — so, unlike the note on `night` in
  `paint.ts` says, it is no longer DOM-only.
- **The toadstools, the flowers and the stall awning have moved off brand colour**, in
  `w-undergrowth.ts` and `s-props.ts`. They painted from `cloak`, which put a dozen-plus Lilac
  objects a camera in Red's exact hue at her exact luma and inverted the standard they were meant
  to serve. The caps are now `rust`, the blooms `rose` and `ember`, the awning cream `wall` with a
  warm sand stripe. Those three families are derived from `wood`, `skin` and `gold` at their call
  site in `w-undergrowth.ts`; that file flags that they want to live in `PALETTE`, and they do —
  it is a palette decision sitting in a painter, and the next person to touch `paint.ts` should
  move them.

The awning's stripe going off purple contradicts `docs/ART_PRODUCTION.md` section 6a and is still
awaiting a brand reviewer's yes or no (`PALE_HI` in `s-props.ts`). Until that lands, treat this
paragraph as describing the code, which it does, rather than settling the question.

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
- **Outline with `keyline(ramp)`**, the object's own darkest taken down with the hue kept — so a
  tree is ringed in `keyline('canopy')` and a wall in `keyline('stone')`. Level 0 is the shaded
  face now, not the outline; see section 2. Reserve `ink` for the wolf, who is meant to read as a
  silhouette.

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
