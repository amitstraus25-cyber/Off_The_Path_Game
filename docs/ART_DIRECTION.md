# Art direction: matching the concept board

**Status: binding for every frame of world art.** The approved concept board,
`reference/mocks/gameplay-concepts.png`, is the design. This file is the written form of it, measured
off the board in the units our painters actually use, so that sixteen hands produce one world.

**Scope.** Everything drawn into `apps/game/src/assets` by `tools/graybox`: terrain tiles, characters,
portraits, items, effects. DOM UI is not in scope — that is `docs/UI_FOUNDATIONS.md` and
`docs/BRAND_AND_UI.md`, and nothing here touches them.

**What this overrides.** `docs/PIXEL_STANDARD.md` stays in force for sizes (§1), the "no raw hex" rule
(§2), hard pixels and the alpha rule (§4), tiling (§5) and the preview workflow (§7). Three of its
sentences are superseded here and I am flagging them rather than editing a file I do not own:

| PIXEL_STANDARD says                                                                     | This file says                                                                         | Where |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----- |
| §4 "Outline with the object's own dark"                                                 | Outline with a dedicated keyline value roughly 40 luma **below** the object's own dark | §3    |
| §2 "Most of any object is level 1"                                                      | True for objects; **false for ground** — grass and path are field-led at level 2–3     | §6    |
| §2 "If more than about a fifth of a shape is level 3, it has stopped being a highlight" | Tighter: 12 per cent, and ground gets none at all                                      | §5    |

Whoever owns `PIXEL_STANDARD.md` should reconcile those three lines. Until they do, this file wins for
world art.

---

## 1. The verdict, in one number

I measured the share of pixels below luma 81 and below luma 60 — the band a keyline and a deep shade
live in — in three crops of the board and in the whole shipped tileset.

| Sample                                 | below L81 | below L60 | darkest pixel |
| -------------------------------------- | --------- | --------- | ------------- |
| Board, forest, 400×320                 | **28.8%** | **18.1%** | L0            |
| Board, cottage, 420×330                | **28.2%** | **17.7%** | L0            |
| Board, open lawn, 220×180              | 7.3%      | 4.4%      | L0            |
| **`tileset-forest.png`, all 76 tiles** | **8.6%**  | **0.7%**  | L33           |

Nearly a fifth of every populated frame on the board is darker than L60. Our entire tileset puts
seven pixels in a thousand there. That one number is the whole gap. It is not resolution — our 32px
tiles have more pixels per tile than the board does — and it is not palette hue. It is that the board
draws a hard dark line around everything and we draw none.

Second number, almost as large and nobody has named it yet: **the board's lawn sits at L190 and our
`grass-0` sits at L124**, with 84 per cent of that tile a single flat colour `#3c9545`. The grass is
two ramp steps too dark, which is why every bush, trunk and rock on top of it has nothing to separate
from. On the board a flower bush is 60 to 90 levels darker than the lawn it grows on; in our build
`bush` is L131 against grass at L124 — **seven levels**. That is the smear.

---

## 2. How the board was measured, and how to convert

The board has no stated scale, so everything below is anchored to Purple, who is 48 px tall in our build.
In the Explore frame she stands 106 board pixels tall, which makes **1 of our pixels = 2.21 board
pixels**. Every size in this document was measured in board pixels and divided by 2.21. The Explore
frame's viewport is about 23 of our tiles wide; ours is 26, so the board is composed slightly tighter
than our camera — assume objects can be a touch larger than feels safe, not smaller.

Crop the board yourself before you draw. Do not work from this file alone:

```
crop reference/mocks/gameplay-concepts.png out.png <x> <y> <w> <h> [scale]
```

The four frames are a 2×2 grid of 1536×1024: Explore at (0,0), Question at (1536,0), Inspect at
(0,1024), Arrive at (1536,1024). Useful crops: a tree at `360 225 300 260 3`, the river and its banks
at `90 230 320 560 1.6`, lawn and a path edge at `980 560 230 200 4`, a flower clump at
`1290 660 130 90 7`, the fence at `1130 410 260 190 3.5`, the bridge at `330 600 220 190 4`, the stall
at `2240 250 470 360 2`, the cottage at `1960 1130 700 480 1.3`, Purple at `770 620 120 130 7`.

---

## 3. The keyline rule — the single most important rule in this document

Every object in the world is ringed in a hard dark line. Not a shade; a line, of a value far below
anything else in the object. This is what makes the board read as one storybook world and our build
read as coloured shapes on a lawn.

**3.1 The value.** The keyline is a dedicated colour, roughly **40 luma below the object's own
darkest shade**, hue-shifted into the object's shade family rather than toward neutral black.
Measured off the board:

| Family             | Board keyline                       | Luma  | Our ramp's current darkest | Luma | Short by |
| ------------------ | ----------------------------------- | ----- | -------------------------- | ---- | -------- |
| Leaves, bushes     | `#013748` – `#014757` (deep teal)   | 44–57 | `canopy[0]` `#21713c`      | 92   | **~40**  |
| Wood, earth, bark  | `#472618` – `#583526`               | 44–59 | `wood[0]` `#6b4522`        | 75   | **~25**  |
| Stone, slate, rock | `#3a3645` (cool, faint purple cast) | 55    | `stone[0]` `#5f5f66`       | 95   | **~40**  |
| Characters         | near-black                          | 15–20 | `ink[0]` `#160923`         | 15   | none ✓   |
| Purple's cloak     | near-black                          | 15–20 | `cloak[0]` `#441363`       | 35   | none ✓   |

Purple and the wolf already look closest to the board, and §14 explains why: they are the only two
things in the game whose ramp already contains a true keyline step.

**3.2 The thickness.** Measured on Purple's ring and on the crown edges: **1 px everywhere, 2 px along
the bottom and lower-right edge of any mass wider than 16 px.** The 2 px band is not a second
outline — it is the keyline thickening on the side the light does not reach, and it is what seats a
tree, a boulder or a roof onto the ground. Do not thicken the top or left edge. Ever.

**3.3 Where it is omitted.** Three places, and nowhere else.

- **Ground never gets one.** `grass-*`, `path`, `path-*`, `paving` and the body of `water` have no
  keyline at all. A path edge is a torn colour boundary (§6.3), not a line.
- **Two surfaces of the same material that meet do not get a line between them** — the courses of a
  roof, the planks of a bridge deck, the staves of a barrel. Those get a 1 px _shade_ line
  (`ramp[0]`), which is a different and much lighter thing. Only the outside of the whole object
  gets the keyline.
- **A mass that is behind another mass of the same object** (a leaf clump tucked behind a nearer one)
  is separated by deep shade, not by keyline. Keyline is for the silhouette against the world.

**3.4 The mechanic, and the trap.** `Img.outline()` only paints pixels that are currently transparent
and adjacent to opaque ones. It therefore works for a sprite and for a single-tile prop with
transparency around it, and it **cannot** give you any of these:

- an interior keyline (crown against trunk, flower box against wall),
- the 2 px shade-side band,
- the outline of anything drawn edge-to-edge on an opaque tile.

So: **a multi-tile object is composed on one scratch `Img` the size of the whole object, keylined
there, and only then cut into tiles.** Draw a 3×3 crown as one 96×96 image, outline it, slice it.
Call `outline()` per tile and the keyline appears on the internal seams and the tree looks quilted.
When this was written exactly one tile painter in the repo called `outline()` and the other
seventy-five tiles had no keyline at all, which is the mechanical root of §1. (That painter lived in
`src/tiles/built.ts`, which has since been deleted; `s-cottage.ts`, `w-trees.ts` and
`w-undergrowth.ts` call it now. Grep for `.outline(` rather than trusting a count in prose.)

---

## 4. The light

**One sun, from the top-left, at about 45°, in every frame of the game.** The board never breaks
this, and a single object lit from elsewhere reads as a hole in the ground at the game's camera.

**On a round mass** (a leaf clump, a boulder, Purple's hood, a flower bloom): the lit arc is a band
1–2 px wide hugging the upper-left edge, set **one pixel in from the keyline, never touching it**.
Base occupies the middle. The lower-right third falls to shade. The terminator between base and shade
is a curve concentric with the silhouette, not a straight diagonal.

**On a flat face** (a plaster wall, an awning panel, a sign board, a fence picket's face): the face is
one flat tone. Light is expressed only as a 1 px lighter line along its top edge and its left edge,
and a 1 px `ramp[0]` shade line along the bottom and right, inside the keyline. The interior stays
flat. Resist the urge to gradient a wall; the board does not.

**On a cylinder** (a trunk, a fence post, a bridge rail, a lantern pole, a barrel stave): three
vertical columns, not a gradient — a lit column 2 px wide one pixel in from the left silhouette, the
base occupying the middle 60 per cent, and shade down the right 25 per cent, then the keyline. A
horizontal cylinder (a rail, a log) does the same thing rotated: lit line on top, shade underneath.

**Contact shadow.** Everything that stands on the ground casts one: a flattened ellipse, about 1.4×
as wide as the object's base and 4–6 px tall, offset 1–2 px down and right, drawn in the **ground's**
dark (`shadow[1]` on grass, `path[0]` on sand) — **not** in translucent black. On a sprite with a
transparent background this must be an opaque colour, because `docs/ASSETS.md` forbids partial alpha
against transparency; on an opaque tile you may use alpha. A tree, a fence post, a stall leg, a
boulder and every character gets one. Without it they float.

---

## 5. How many tones, and when something earns a highlight

Count the keyline as a tone. Then:

| Thing                                                   | Tones         | Which                                                                      |
| ------------------------------------------------------- | ------------- | -------------------------------------------------------------------------- |
| Ground tile                                             | 3, no keyline | field, one step lighter, one step darker — plus the tuft dark as a fourth  |
| Small prop (rock, toadstool, bloom, nail head)          | 4             | keyline, shade, base, light                                                |
| Large mass (crown, roof, boulder cluster, cottage wall) | 5             | keyline, deep shade, shade, base, light                                    |
| Character, per material                                 | 4             | keyline, shade, base, light — and at most **four materials** per character |

**A shape earns a highlight (level 3) only when it both faces the light and is in front.** A leaf
clump in the top-left half of a crown gets one; the same clump tucked behind a nearer clump gets base
and shade only. A roof shingle gets a 1 px lit cap; the shingle in the course above it, overlapped,
does not.

**Budget: no more than 12 per cent of an object's pixels at level 3.** This tightens
`PIXEL_STANDARD` §2's "about a fifth" and it is a direction call rather than a board measurement —
the board's crowns are visibly stingier than a fifth, and a fifth is where "highlight" turns into
"second base tone".

**Ground never gets level 3 as a highlight.** Grass and path have no specular. Their lighter tones are
mottling (§6), which is broad, low-contrast and unrelated to the light direction.

---

## 6. Ground

The ground is more than half of every frame and it is the piece that currently reads worst. There are
four jobs here: raise the field, mottle it, tuft it, and tear the path edges.

**6.1 Raise the field.** The board's lawn runs L173–194 across five or six tones with L190 dominant.
Our `grass[3]` `#9ed858` is L192 and is the right field colour; `grass[2]` `#50ba51` is L156 and is
the _dark_ mottle. **Paint grass field-led at level 3, not base-led at level 1.** The same applies to
sand: the board's path is L207–214, which is `path[2]` `#f2cf99` (L204), with `path[3]` as the light
mottle and `path[1]` as the dark. This is the §0 exception to "most of any object is level 1".

**6.2 Mottling.** Broad soft blobs, 12–30 px across, chunky-edged (stepped in 2–4 px jumps, never
anti-aliased), covering roughly 40 per cent of the tile. Local contrast inside one tile stays at or
below **20 luma** — on grass that is the span from `grass[2]` to `grass[3]` plus the requested
mid-light step (§14). Anything with more contrast than that is a prop, not ground. Single-pixel
speckle is banned: `grass-0`'s current white noise in three greens is exactly the failure this rule
exists to stop.

**Tufts.** Small sprigs of 2–3 curved blades, **10–11 px wide and 8–10 px tall**, drawn in `grass[1]`
(L129) — a third of a tile each, not specks. Density averages **one tuft per tile** across the four
variants.

**6.3 The four-variant problem.** Four tiles scattered by the value-noise field in
`forest-map.ts` will read as a checkerboard of squares unless all five of these hold.

1. **Every blob and every tuft wraps.** Draw it at `x` and again at `x − 32` and `y − 32` so it
   continues into the neighbour. A mottle blob that stops at the tile edge draws the grid for you.
2. **Nothing within 6 px of a corner.** Four tiles meet at a corner and a feature there reads as a
   cross, repeated across the map.
3. **No two variants put a tuft in the same relative position**, and the tuft count differs:
   `grass-0` is the shade variant — field one step below the others, one tuft, heaviest mottle.
   `grass-1` — field, two tufts, moderate mottle. `grass-2` — the quiet one: field, **no tuft**,
   light mottle, so the map can breathe. `grass-3` — field, one tuft plus one small ground detail
   (a pebble or a clover), moderate mottle.
4. **Variation between variants carries more than variation inside one.** Inside a tile ≤20 luma;
   across the four variants ~38 luma from `grass-0`'s field to `grass-3`'s.
5. **Seamless on all four edges against itself and against every sibling.** Check on the contact
   sheet, where neighbours sit edge to edge, before you hand anything in.

**6.4 Path edges.** The board's path is a **narrow winding band**, 2–3 tiles wide, never rectangular.
The edge is a torn boundary: irregular teeth 1–3 px deep, no two the same, with no straight run
longer than 4 px anywhere. On the sand side, 2 px of `path[3]` runs inside the tear. On the grass
side, a 1–2 px lip of `grass[1]`. No keyline. The current `path-n/s/e/w` and `path-ne/nw/se/sw` tiles
are a sand rectangle with a 1 px nibble and they read as tiled squares at any camera.

---

## 7. Foliage: how a crown is built

A tree crown on the board is **not one silhouette with texture inside it**. It is a pile of round leaf
clumps, each one lit, shaded and overlapping its neighbours, with a keyline around the pile as a
whole.

**7.1 The clump.** Diameter **14–16 px (radius 7–8)**, roughly circular but lumpy — vary the radius by
±1 px around the circumference so no clump is a clean ellipse. Inside one clump: a 1–2 px lit arc on
the upper-left, base across the middle, shade on the lower-right. That is three tones; the clump gets
no keyline of its own.

**7.2 The stack.** Clump centres sit **10 px apart**, so neighbours overlap by about **a third of a
diameter**. Build from the back forward: place the rear clumps first in base and shade only, then the
forward clumps over them, and wherever a forward clump covers a rear one, lay a **1 px deep-shade
line** along the covered clump's upper-left arc. That line is what reads as depth. The outer
silhouette of the pile is therefore scalloped — a ring of 12–14 bumps around a big crown — and it is
that scallop, not any interior detail, that says "tree" at the game's camera.

**7.3 Which clumps get the highlight.** Only clumps whose centre is in the upper-left half of the
crown, and only if nothing overlaps them there. Expect 3–5 highlighted clumps on a 3-tile crown out
of 12–16 total.

**7.4 Under the crown.** The bottom 6–8 px of the crown falls to deep shade, then the 2 px keyline,
then a cast shadow on the ground beneath (§4). The trunk is in shade where the crown covers it.

**7.5 Sizes, from the board.** Trees come in three scales and they overlap each other:

|                 | crown width | tiles                |
| --------------- | ----------- | -------------------- |
| Foreground tree | 85–90 px    | ~2.7 (draw in a 3×3) |
| Mid tree        | 60–65 px    | 2                    |
| Background tree | 44–48 px    | 1.5                  |

The trunk is **short and wide**: about 24 px across, 30 px of visible height below the crown, flaring
to **34 px at the root**. The flare is 3–4 roots splaying left and right, each one individually
keylined, each one lit on its upper-left. The root flare is a third of what makes the board's trees
look drawn rather than generated; the current `trunk-l`/`trunk-r` pair has the width but no keyline,
no flare lighting and no crown shade.

**7.6 Bushes and flowers.** Flowers never stand alone on grass. A flower clump is a **bush first**:
a ragged, finger-lobed dark-green mass **36–40 px across** (about 1.2 tiles), core around L100–130
against the L190 lawn, with a deep-green keyline. Blooms sit on top of it: **3–5 per clump**, each a
four-petal plus-shape **9–10 px across** with a **2×2 contrasting centre**, a 1 px shade under the
lower-right petal, and no stem — the board draws no stems. Bush shapes must not be smooth ellipses;
the silhouette is fingered, like a hand of leaves.

---

## 8. The river

Both banks are **crowded with boulders**, not edged with a line of them. Irregular grey rocks
**14–16 px across**, overlapping each other, packed **two deep — a band about one tile (30–40 px)
wide** on each bank, with gaps of grass showing between them. Each boulder is faceted, not round: 3–5
straight-ish edges, a light cap of 2–3 px on the top-left face, base across the middle, shade on the
lower-right, and the L55 cool keyline around it. Where two boulders meet, deep shade, not keyline.

The water carries a **white foam line** 2–3 px wide everywhere it meets a bank or a rock, in
`water[3]`. The water body is `water[1]` with broad lighter bands of `water[2]` (not stripes — slow
irregular curves following the flow) and a darker `water[0]` band 3–4 px wide hugging each bank, so
the river reads as deeper in the middle. White ripple dashes, 3–5 px long, scattered at about two per
tile, aligned with the flow. The waterfall is vertical streaks of `water[2]` and `water[3]` over
`water[1]`, with a foam pool of `water[3]` where it lands.

The current `shore-n/s/e/w` tiles put one thin chain of rocks on the waterline and leave the grass
side of the bank bare. That is the whole difference between our river and the board's.

---

## 9. Built things

**9.1 The cottage** — verified in detail on the Arrive frame, and it is the most specific object in
the game.

- **Roof:** scalloped tiles, each **14 px wide and 9 px tall**, courses overlapping by about a third,
  each course offset half a tile from the one above. **Every tile gets a 1 px lit cap on its own
  top-left arc** and a 1 px shade line at its bottom; that per-tile lighting is the thing that makes
  the roof read as tiles rather than as a scalloped wallpaper, and the current `roof-l/m/r/peak` have
  the scallops but not the lighting. The eave is a 2 px keyline with a visible dark fascia under it.
- **Walls:** cream plaster, flat, with a faint mottle — **not brick**. `wall` is brick everywhere
  today and that is wrong.
- **Stone:** grey quoins **14 × 10 px**, at the building's corners and as a surround to the door
  only. Each block separately keylined and lit on its top-left.
- **Door:** **arched**, about **37 × 56 px**, vertical planks with 1 px shade seams, a brass
  cross-muntin window of four panes in the upper half, two round brass knobs, and a stone arch over
  it. Today's `door` is a rectangle with no stone and no window.
- **Windows:** about **27 × 26 px**, dark brown frame, 2 × 2 panes, deep blue glass where the room is
  dark and warm gold where it is lit, and a flower box beneath — a keylined wooden box planted with
  a dense dark bush and 3–4 blooms.
- **A small gable window** above the door, in its own stone surround, with a gold pane.
- Ivy on one corner. The whole building is about **4 tiles wide**, 2 tiles of wall, 1.5 of roof.

**9.2 The fence** is a picket fence: pickets **9 px wide, 26 px tall, on a 16 px pitch** (two per
tile), **domed tops**, two horizontal rails behind them in a darker wood, posts every four tiles.
Every picket is keylined. Critically, **grass tufts grow in front of the bottom of each picket**,
breaking the base line — without them the fence sits on the grass like a sticker.

**9.3 The bridge** has deck planks running across the span, **8 px wide**, four per tile, separated by
1 px shade seams (not keyline). Two thick rails run lengthwise, 5 px deep, each with a 1 px lit line
on top and a 2 px dark band beneath. Posts at both ends. Two nail dots per plank on the rails. The
whole structure is keylined in the wood keyline; the planks between themselves are not.

**9.4 The stall** is an awning with a **scalloped lower edge** (four scallops), cream, with each fold
panel lit separately — a lighter panel on the left of each fold, shade on the right. Round posts,
cylinder-lit per §4. A plank counter with a darker front face. A hanging sign on two metal rings from
a crossbar, with two screw dots in its corners. A barrel beside it, staves lit as cylinders with a
dark metal band. All of it keylined; the awning's stripes are keyline-free.

---

## 10. Characters: silhouette

Sprites are 32 × 48, shown at **96 CSS px tall at zoom 2** — the game's own zoom, and 64 CSS px per
tile. (This said 72 px, which is the abandoned 1.5× option, against a field of view to match;
`PIXEL_STANDARD` §1 has the sizes and `camera.ts` has the reasoning.) At that size the outline is read before
anything inside it. **If two characters have the same silhouette, one of them is wrong, whatever
colour it is.**

**10.1 The test, and it is a hard gate.** Export every character's idle-down frame, fill every opaque
pixel flat black, downscale to 24 px tall, and lay them in a row. You must be able to name each one.
If you cannot, the silhouette is wrong and no amount of interior detail will save it.

**10.2 The assignment.** No two characters may share both a width band (±4 px) and a height band
(±6 px), and each owns one feature that breaks its outline.

|                         | w × h, px | widest at    | the signature                                                                                                         |
| ----------------------- | --------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Purple                  | 20 × 48   | the head     | a round hood **wider than her shoulders**, overhanging; basket breaks the right edge at hip height                    |
| Rabbit                  | 20 × 34   | the base     | two ears, each 4 px wide and 14 px tall **with a 4 px gap of sky between them** — 40% of her height is ear            |
| Owl                     | 22 × 26   | mid-height   | no neck: head and body one barrel, flat-topped, two 3 px ear tufts at the corners                                     |
| Lantern Keeper (badger) | 24 × 44   | the hem      | straight-sided A-shape under a hood; **the lantern on its pole breaks the right edge 10 px out** at shoulder height   |
| Wolf                    | 30 × 30   | the shoulder | the only horizontal back line in the cast; head carried **forward and below** the shoulder; tail breaks the rear edge |
| Toadstool               | 22 × 18   | the cap      | a T: cap wider than tall on a 6 px stalk                                                                              |
| Magpie                  | 26 × 20   | the tail     | the only horizontal wedge tail, 14 px behind a 12 px body                                                             |
| Snail                   | 26 × 14   | the shell    | lowest in the cast; a spiral, no legs                                                                                 |
| Cat                     | 14 × 30   | the shoulder | triangular ears **flush with the skull**, not stalked like the rabbit's; upright tail breaks the top-right            |

**10.3 Inside the outline.** Keyline at L15–20 around the whole figure (§3), plus an interior keyline
wherever two materials meet — hood against face, cloak against trousers, wing against belly. Two
pixels of eye. At 48 px, unlike at 32, there is room for the board's **mouth and cheek blush on
Purple**, and the board uses both; take them. The board's rabbit also has pink inner ears, a pink nose
and a blush, and grey underside shading — at L194 flat white with a L194 outline our rabbit has none
of it (see §13).

**10.4 Purple specifically.** The hood is a separate round mass sitting _over_ the shoulders, with a
dark line between them and a shadow cast on her forehead by the brim. The cloak has 3–4 fold lines in
`cloak[0]` running from the shoulder to the hem. The basket is carried in the off hand in every
frame. The current sprite has the keyline and the light direction right and the structure wrong: the
hood is the same width as the body, so she reads as a bottle.

---

## 11. Density

The board is **full**. In the Explore frame, trees occupy roughly 45 per cent of the viewport, at
three scales, overlapping one another, and almost all of the remainder is path, river or bank. There
is no open lawn anywhere larger than about **3 × 3 tiles** without a bush, a rock, a tuft cluster or a
prop in it.

Level layout is `forest-map.ts`'s job, not a painter's, but it tells painters two things. First, a
crown tile will frequently sit against another crown tile at a different scale, so crowns need to
overlap convincingly rather than tile edge to edge — draw at least two crown sizes. Second, every
tile that can be strewn (bush, rock, tuft cluster, toadstool ring) will be used far more often than
it currently is, so none of them can be individually interesting enough to notice when repeated.

---

## 12. The one deliberate departure from the board

The board predates the Cyera rebrand. It shows a **scarlet cloak** and a **terracotta roof**; both
stay rebranded per `docs/ART_PRODUCTION.md` §6a. Purple's cloak is Lilac-led Cyera purple (`cloak`, with
level 2 carrying the mass — that exception is already documented in `paint.ts`), the cottage roof and
the well roof are slate (`roof`), the stall awning is Haze and Offwhite, the toadstools are Aubergine,
`flower-red` and `flower-pink` are Lilac and Haze, and the wolf is black and Deep Purple. Lime appears
nowhere in world art.

**Match the board's form, density, structure and lighting. Do not match its red.**

One call I am making inside that departure: the board's flower **centres** are warm orange, and that
warm dot is a contrast device rather than a brand colour — it is what makes a 9 px bloom legible on a
dark bush. Keep the centres warm, from `gold`, exactly as the lantern flame keeps its warm gold. If
brand disagrees, the fallback is `path[0]` sand, not a purple centre on a purple petal.

---

## 13. What not to do — the current build, by name

Every item here was observed on the contact sheets from `pnpm preview --out /tmp/dir-now --zoom 5
--what tiles` or in the shipped PNGs.

> **This section is a measurement of a build, not a standing rule, and that build has moved.** It was
> written before the keyline work landed: several painters call `outline()` now, the retired tile
> modules it named were deleted on 2026-10-20 (commit `f1a9819`), and the rabbit is no longer outlined
> in `shade('fur', 0)`. Sections 1 to 12 and 14 to 17 are the binding part of this document; **re-measure
> before working from the list below**, with `pnpm preview` and `pnpm world --frame title`. Items are
> cited by symbol rather than by line because half of this file's line citations had gone wrong and two
> pointed into a file that no longer exists.

1. **`grass-0`…`grass-3`** — single-pixel white-noise speckle in three greens over a field that is 84
   per cent one flat colour at L124. No broad mottling, no tufts, and the four variants are
   indistinguishable. Two ramp steps too dark. Fix per §6.
2. **`canopy-tl/-tr/-bl/-br`** — four tones at L92/126/156/188, no keyline, no deep shade, and the
   clumps are smooth ellipses with a 1 px darker rim. They read as balloons. The darkest pixel in the
   whole canopy group is L92 where the board's crown spends nearly a third of its area below L81.
3. **`trunk-l` / `trunk-r`** — flat brown, no keyline, no lit column, no root-flare lighting, and no
   shade cast on it by the crown above.
4. **`bush`** — one flat blob at L131 against grass at L124: **seven levels of separation**. No lobes,
   no keyline, no blooms.
5. **`flower-white` / `flower-pink` / `flower-red`** — three blooms on bare stems over a tiny mound.
   The board draws no stems and never a flower on open grass. `flower-red` is leggy and does not even
   match its two siblings in form.
6. **`path`, `path-n/-s/-e/-w`, `path-ne/-nw/-se/-sw`** — a sand rectangle with a 1 px nibble. No
   light sand inner edge, no dark grass lip, straight runs everywhere.
7. **`shore-n/-s/-e/-w`** — one thin chain of rocks on the waterline; the grass side of the bank is
   bare. The board packs both banks two boulders deep.
8. **`water` / `water-2`** — flat blue with white dashes. No foam line at the bank, no darker water
   under the bank, no flow in the lighter bands.
9. **`fence-h` / `fence-post`** — square-topped, keyline-free, no grass tufts breaking the base.
10. **`bridge-l/-m/-r`** — no seams between planks, no lit top edge on the rails, no keyline.
11. **`roof-l/-m/-r/-peak`** — the scallops are right; every course is identical, there is no per-tile
    top-left cap, no keyline, and the bottom course is a flat horizontal band.
12. **`wall`** — brick over the whole elevation. The board's wall is plaster with stone **only** at
    the corners and the door. **`door`** is a rectangle where the board's is arched with a stone
    surround and a brass four-pane window. **`wall-window`** has the flower box but no stone surround.
13. **`stall-awning-l/-m/-r`** — flat stripes, no keyline, no per-fold lighting.
14. **`rock`** — two greys and a weak rim. Needs the L55 keyline and a faceted top-left light cap.
15. **`npc-rabbit`** — the rabbit painter in `src/sprites/cast.ts` outlined her with `shade('fur', 0)`,
    and `fur[0]` is `#c9c2b4` at **L194**: outlined in a colour **lighter than the grass she sits on**,
    where the board outlines her at L18. Her ears were also fused to her head with no gap, so the one
    silhouette feature she owns was gone. _Addressed since: that painter now outlines with its own
    `RABBIT_DARK`. Re-measure before refiling._
16. **Outline values across the cast**, all against the board's L15–57 keyline band:
    `cloak[0]` L35 ✓, `ink[0]` L15 ✓, `trunk[0]` L57 ✓, `wood[0]` L75 ✗, `roof[0]` L70 ✗,
    `stone[0]` L95 ✗, `gold[0]` L119 ✗, `wall[0]` L174 ✗, `fur[0]` L194 ✗✗.
17. **Seventy-five of seventy-six tile painters never call `outline()` at all.** Only the one in
    `src/tiles/built.ts` did. This is the mechanical cause of §1 and was the first thing to fix.
    _Since: `built.ts` was deleted with four other retired modules in `f1a9819`, and the painters that
    replaced them — `s-cottage.ts`, `w-trees.ts`, `w-undergrowth.ts` — each call `outline()`. Count it
    again rather than quoting this number._

---

## 14. Palette: can the ramps express the board?

Mostly yes. `path`, `wall`, `water`, `trunk`, `cloak`, `ink`, `night` and `gold` are all in range —
measured against the board, the path's field sits on `path[2]`, plaster on `wall[1..2]`, river water
between `water[1]` and `water[2]`, foam on `water[3]`. Those need nothing.

Three things are genuinely missing. **Integrator: these are the asks. Nothing else in this document
needs a palette change.**

**Ask 1 (required): a keyline step for `canopy`, `wood`, `stone` and `roof`.** This is §1 in colour
form. Every ramp's level 0 is a _shade_; the board's keylines sit 25–40 luma below it. Measured
values to add:

| Family                   | Value     | Luma | Replaces today's              |
| ------------------------ | --------- | ---- | ----------------------------- |
| `canopy` keyline         | `#073b46` | 49   | `canopy[0]` L92               |
| `wood` / `trunk` keyline | `#472618` | 44   | `wood[0]` L75                 |
| `stone` / `roof` keyline | `#3a3645` | 55   | `stone[0]` L95, `roof[0]` L70 |

Two shapes are possible and the choice is the integrator's. Preferred: extend `PALETTE` entries to a
fifth element and let painters write `shade('canopy', 'line')`, which keeps a canopy's keyline
belonging to the canopy and is the version sixteen painters will get right. Fallback, if the
`readonly [string, string, string, string]` type is not worth changing: one new four-step `line` ramp
holding the three values above plus `#1a1016` for characters, documented loudly as **material-indexed,
not brightness-indexed**, because it breaks the dark→light convention every other ramp follows.

**Ask 2 (required): one mid-light step in `grass`, between level 2 and level 3.** Suggested
`#7ec852`, L≈176. The board's lawn spans L173–194 in five or six tones and we own exactly one value
in that band (`grass[3]`, L192). Without this step, §6.2's mottling has to jump 38 luma from
`grass[2]` to `grass[3]` and comes out as patches rather than mottle. This is the cheapest single
change on the list and it affects more screen area than anything else.

**Ask 3 (recommended): a deep-shade step for `canopy`**, around L72 — suggested `#0d5a4e`, teal-
leaning like the board's. The board's crown runs six values (L44 keyline, L70–80 deep shade, L135–145
clump shade, L156 base, L178–188 lit, L194 rim); `canopy` holds four and only three of them land
inside that range.

**What painters may do today, before any of that lands.** Do not block on the palette:

- Green keylines: `shade('shadow', 1)` `#1f3a22` is **L53**, within four of the board's leaf keyline.
  Deep crown shade: `shade('shadow', 2)` `#2c4f2b` is **L72**, within one of the board's. Both are the
  right value and a neutral green where the board is teal — close enough to ship and worth a retune
  once Ask 3 lands. Note that this repurposes `shadow`, which `PIXEL_STANDARD` §2 describes as the
  dusk-shadow ramp; that repurpose is requested here deliberately and should be reviewed.
- Cool keylines (stone, slate, rock): `shade('ink', 2)` `#3d2a4d` L41 or `shade('ink', 3)` `#543d66`
  L57. The board's own rock keyline `#3a3645` has a faint purple cast, so `ink` is closer than it
  looks. Prefer `ink[3]`.
- Warm keylines (wood, bark, roofs): **there is nothing suitable.** `wood[0]` is L75, `shadow` is
  green and `ink` is purple. Wood is the one family that has to wait for Ask 1, or accept `ink[2]` and
  a slightly cool bark.
- Character keylines: `ink[0]` L15 and `cloak[0]` L35 are both correct and already in use. Any painter
  currently outlining with `fur[0]`, `wall[0]`, `gold[0]` or `stone[0]` should move to `ink[0]` today.

---

## 15. Before you hand anything in

`docs/PIXEL_STANDARD.md` §7 still governs how you look at your work: contact sheet at zoom 8 for pixel
mistakes, zoom 2 for whether it reads at the size people see. On top of that, four checks specific to
this direction:

1. **The dark census.** Run the luma histogram over your frames. A populated tile or sprite should put
   **15–30 per cent of its opaque pixels below L81** and a visible share below L60. A ground tile is
   the exception and should be under 10 per cent. If your tile is at 2 per cent, you have not drawn a
   keyline, whatever it looks like at zoom 8.
2. **The squint test.** Downscale to 25 per cent. The silhouette must survive; the interior detail
   must not be missed.
3. **The neighbour test.** Lay your tile against each of its siblings edge to edge on the contact
   sheet. No seam, no grid, no repeating feature.
4. **The black-silhouette test** for anything with a character in it (§10.1).

And the standing rules that do not change: no raw hex, one light from the top-left, hard pixels only,
no partial alpha against transparency, nothing touching a tile edge unless it continues across it.

---

## 16. Quick reference — every size in this document

All in our pixels, at `TILE = 32`, Purple 48 tall.

|                                      | size                                                      | in tiles            |
| ------------------------------------ | --------------------------------------------------------- | ------------------- |
| Keyline                              | 1 px; 2 px on the bottom/lower-right of masses >16 px     | —                   |
| Contact shadow                       | 1.4× base width, 4–6 px tall, offset 1–2 px down-right    | —                   |
| Leaf clump                           | 14–16 diameter (radius 7–8); centres 10 apart; ~⅓ overlap | —                   |
| Crown, foreground / mid / background | 85–90 / 60–65 / 44–48 wide                                | 2.7 / 2 / 1.5       |
| Trunk                                | 24 wide, 30 visible, flaring to 34 at the root            | ~1                  |
| Grass tuft                           | 10–11 × 8–10, about one per tile                          | —                   |
| Grass mottle blob                    | 12–30 across, ≤20 luma local contrast                     | —                   |
| Path band                            | 2–3 tiles wide, teeth 1–3 px, no straight run >4 px       | —                   |
| Flower bloom                         | 9–10 across, 2×2 centre, 3–5 per clump                    | —                   |
| Flower bush                          | 36–40 across                                              | ~1.2                |
| Bank boulder                         | 14–16 across, packed two deep                             | band ~1             |
| Foam line                            | 2–3 px                                                    | —                   |
| Fence picket                         | 9 × 26 on a 16 px pitch; posts every 4 tiles              | 2/tile              |
| Bridge plank                         | 8 wide; rails 5 deep                                      | 4/tile              |
| Roof shingle                         | 14 × 9, courses overlapping ⅓, offset half a tile         | 2 across, 3 courses |
| Stone quoin                          | 14 × 10                                                   | —                   |
| Cottage door / window                | 37 × 56 (arched) / 27 × 26                                | 1.2 × 1.75 / ~1     |
| Cottage, overall                     | ~120 wide, 2 tiles wall + 1.5 roof                        | 4 wide              |
| Character sprite                     | 32 × 48, shown at 96 CSS px (zoom 2)                      | 1.5 tall            |
| Highlight budget                     | ≤12% of an object's pixels at level 3                     | —                   |
| Dark census target                   | 15–30% below L81 (ground: <10%)                           | —                   |

---

## 17. Which sections are binding for which agent

| If you are drawing                    | Read, and follow to the letter                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| Grass, path, paving                   | §3.3, §4, §5, §6 entire, §13 items 1 and 6, §15                                       |
| Trees, bushes, flowers                | §3, §4, §5, §7, §13 items 2–5, §14                                                    |
| River, shores, waterfall, rocks       | §3, §4, §8, §13 items 7, 8, 14                                                        |
| Cottage, fence, bridge, stall, props  | §3 (especially 3.4), §4, §5, §9, §13 items 9–14                                       |
| Purple                                | §3, §4, §10 entire, §12, §13 item 16                                                  |
| Rabbit, Owl, Keeper, Wolf, bystanders | §3, §4, §10 entire, §13 items 15 and 16                                               |
| Portraits, items, effects             | §3.1, §4, §5, §13 item 16 — and `docs/UI_FOUNDATIONS.md`, since these land in the DOM |
| Palette / integration                 | §14 entire, plus the §0 table of superseded `PIXEL_STANDARD` lines                    |

Everyone reads §1, §2, §12 and §15.
