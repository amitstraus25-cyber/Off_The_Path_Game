# The design board — round zero

**2026-10-19 · Paul, head of product · `main` @ 5c3650b · typecheck 0, lint 0, test 0 (exit codes, not tails)**

The target is `reference/mocks/gameplay-concepts.png`. Not the last round. Not the score. The board.

Everything below was judged against a crop of it, and every crop command is given so you can put the
same two images side by side before you touch a file. The one deliberate departure stands: the board's
scarlet cloak and terracotta roof stay rebranded. **Match its form, density, tonal range and lighting.**

```
crop reference/mocks/gameplay-concepts.png out.png <x> <y> <w> <h> [scale]
```

| Frame       | Crop                       |
| ----------- | -------------------------- |
| 01 Explore  | `0 0 1536 1024 0.72`       |
| 02 Question | `1536 0 1536 1024 0.72`    |
| 03 Inspect  | `0 1024 1536 1024 0.72`    |
| 04 Arrive   | `1536 1024 1536 1024 0.72` |

---

## 1. Where we are

**52 out of 100.**

Here is the honest version. The pixel craft has arrived and the picture has not. Open
`sheet-tree-tiles.png` at zoom 9 and the crown is built the way the board builds a crown — lumpy
clumps, five tones, a scalloped silhouette, a two-pass blue-black keyline, the bottom half genuinely
dropped to deep teal — and the trunk beneath it, with three lit roots flaring out of a keylined base
onto a contact shadow in the ground's own green, is as good as anything on the board. The grass finally
sits at the board's value. The bush has lobes. The flowers sit on bushes with no stems, as they should.
Purple is a character. The Inspect card is better than the board's. Six people have done real work.

And then you render the world and none of it is visible, because **the thing a visitor actually looks
at is composition, and nobody owns composition.** 270 trees of one crown at one scale are scattered at
even density across all 2,520 tiles; 273 copies of one bush are stamped in rows down the left margin of
every frame; 58 toadstool stamps put 174 red mushrooms on the map, including a dotted line along the
top and bottom edges of the world. The camera at spawn frames an empty lawn with a hedge at the bottom.
The payoff shot frames a grey shed. The measured half of the gap agrees: deep shade is at 0.58 of the
board's and keyline at 0.54, so the keyline campaign that `ART_DIRECTION` §1 called "the whole gap" is
exactly half finished — but the measured half is the smaller half, and I want that understood before
anyone optimises the number again.

So: not close. The distance is not made of pixels any more. It is made of **where things are put, four
faces, one fence joint and one building.** Those are five problems, they have five owners, and none of
them requires re-deriving anything in `ART_DIRECTION`.

The six-axis score reads 0.416. It cannot see repetition, cast shadow or composition and it says so
itself. Do not report it as progress. Render the frame and look at it.

---

## 2. The client's four complaints, traced

### "The landing screen looks creepy"

Four causes, verified on `salvage/ui-1280-00-title.png` and `ui-375-00-title.png`:

1. **A near-black half-screen.** At 1280 the left 35% is a near-black panel carrying faint blurred
   purple blobs, hard against a sunlit lawn, inside a thin bright-Lilac ring on black. The board's only
   dark field is a 60px header. A sunlit forest seen through a glowing rectangle in a dark room is a
   horror-film frame; the art is not the problem here, the page is.
2. **No canopy over the camera and no cast shadow on the ground.** The lawn is uniformly lit edge to
   edge and the only dark things in it are 25 near-identical bush blobs at even spacing. A bright field
   evenly dotted with dark holes reads as watched. The board never shows open lawn larger than 3×3.
3. **The bunny's face** — below.
4. **Toadstools.** Three clustered top-right, one alone at bottom-centre, 174 on the map, zero visible
   in the board's Explore frame. Red caps in clusters read as poison, not as decoration.

Fix 1 and 2 and the screen stops being creepy even before the bunny is redrawn.

### "The bunny looks like a total creepy guy"

This one is pixel-exact. `tools/graybox/src/sprites/cast.ts`, `paintRabbit`:

- The head is `orb(16, 32.4, 7.4, 5.8)` — about 15 × 12 px.
- Each eye is `img.ellipse(ex, 30.8, 1.5, 1.9, RABBIT_DARK)` — a **solid 3 × 4 px ellipse, taller than
  it is wide**, at x 12.8 and 19.2.

So each eye is **a third of the head's height**, the pair spans **63% of the face width**, and both are
vertically elongated, which is the shape a narrowed eye makes. `RABBIT_DARK` is `keyline('fur', 165)`,
**the identical value the sprite is outlined in**, against `fur` at luma 195 — so the eyes are the
highest-contrast feature on the sprite and they are painted in the silhouette's own line. The face
reads as perforated. There is no catchlight; the docstring says "the board's are solid dark ovals with
no highlight," and the board (`955 500 130 130 8`) disagrees — its eyes are smaller, rounder, carry a
light, and float inside white.

Two more, from the same crop: the face is crammed into eight rows (eyes 29–32, nose 33–34, mouth 35–36)
with **no cheek or chin below the mouth**, which is where all of the board rabbit's sweetness lives; and
the satchel is a `wood`-brown strap tapering **across the white chest** to a brown lump on the near hip,
which at 1× is a dark gash on a white animal. The board's is a woven warm-gold basket on the **back**.

### "The fence is nice, but from the top view, in the front, it looks weird"

He is right, the cause is geometric, and the board already contains the answer twice.

The east–west run is good — domed pickets, two darker rails behind, grass tufts breaking the base. That
is the "nice". But `forest-map.ts` stacks `fence-post` **down a single column at x=46, nine times**, and
`fence-post` is a face-on picket with rails. A face-on picket run cannot be seen end-on from above, so
the north–south side of the garden renders as a brown ladder lying on the lawn — and it crosses the
path (`w-cottage.png`, the vertical brown strip at x≈275; `ui-1280-05-arrive.png` has two of them, both
beginning and ending in nothing). `built.ts:122–127` confesses it in a comment.

Crop `1130 380 300 230 4` and `1536 0 1536 1024 0.72`: when the board's fence runs away from the
camera it draws **a receding column of post tops** — rounded tan caps in a line with a shaded column
beside them — terminating in one wide corner post that reads both ways. It never shows a picket face
on a run going north. That is the fix, and `TILE_NAMES` is now unfrozen, so it is buildable.

### "The map needs to make sense, all the trees in the correct place, not too many trees"

Counted off `map-forest.json`, not estimated:

|                                | count                       | share of the 60×42 map               |
| ------------------------------ | --------------------------- | ------------------------------------ |
| trees (`canopy-tl`)            | **270**                     | crown tiles are 960 = **38.1%**      |
| `bush`                         | **273**                     | 10.8%                                |
| `toadstool-ring` (3 caps each) | 58 = **174 caps**           | 2.3%                                 |
| `rock`                         | 69                          | 2.7%                                 |
| `grass-0`                      | 2,196 of 3,178 ground tiles | **69% of the ground is one variant** |

The complaint and `ART_DIRECTION` §11 ("the board is full, trees are 45% of the viewport") are not in
conflict, and reading them as a conflict would waste the round. The board is dense **where the camera
is**, with real clearings around its landmarks. Ours is uniformly medium everywhere: a tree every three
tiles over the entire world, a toadstool hem around its border, bushes in grids, and consequently a
camera frame at spawn that contains five isolated trees and a void. **Too many trees in total, none of
them anywhere on purpose.** Fewer trees, in groves, at three scales, with the camera framed by canopy
and the landmarks given clearings.

---

## 3. Per element

Judge against the named crop. Not against your last version.

### The bunny — `cast.ts` · board `955 500 130 130 8`

**Right:** proportion (21 × 34, two thirds of Purple, thirteen rows of ear); the six-pixel ear gap that
survives `outline()`; the splayed feet; the breath that moves only the head.

**Wrong:** §2 above.

**There:** eyes no more than 2 × 2 with a 1px light in the upper-left of each, moved apart and up, so
white shows all round them and they total under a quarter of the face width. A value for the eye that
is **not** the keyline value. Four or five rows of blank cheek and chin below the mouth. The basket
moved to the back or the far hip, in `gold`, reading as weave. Inner ears and blush warm — `rose()`
already exists in `w-undergrowth.ts:198` but is private to that file, so raise the ask, do not re-derive
it (see §5).

### Owl, Lantern Keeper, Wolf — `cast.ts` · board `360 225 420 300 2.4`

**The owl is the bunny's disease again, and worse.** Crop the board: two white facial discs with
**small dark pupils floating inside them, white visible all the way round**. Ours fills each disc with
a near-black blob under a heavy brow. That one ratio is the whole difference between an owl and a
lunatic. Same prescription: shrink the pupil, keep the white, add the light.

**The Lantern Keeper is the creepiest sprite in the game and the client has not seen it yet.** A grey
hood over a dark head with a pale blaze and two dark marks in it is a skull in a cowl at 48px,
whatever the marks are. The docstring records two previous passes failing the same way and concludes
the badger mask is too fine to survive; the conclusion is wrong. The problem is **a pale blaze inside a
dark hood**. Invert it: a lighter hood, a legible muzzle, eyes with the lantern's gold caught in them,
and visible warm fur, so the lamp reads as something he is carrying rather than something lighting a
face from below. He is the character who carries the thesis; he cannot be the one players flinch at.

**The wolf is right. Leave him.** Low head carried forward of the shoulder, the only horizontal back
line in the cast, amber eyes as the one warm thing, and the all-black lurking frame with two gold eyes
is the best single frame of character art in the project.

### The bystanders — `bystanders.ts`

The cat, snail and toadstool read. **The magpie does not read as a bird.** It is one near-black
horizontal wedge with a gold beak at the left, gold legs and a single blue dash at the tail tip — at
1× the gold hook reads as a bell and the bird reads as a slug with a horn. A magpie is **black and
white before it is anything**: give it a white belly and a white shoulder patch big enough to break the
silhouette, take the gold off the legs, and put the iridescence on the wing rather than as one pixel on
the tail.

Also: placement is not drawing, but a tabby standing alone in the middle of Grandma's lawn on the
arrival beat (`ui-1280-05-arrive.png`) is nobody's intention. Coordinate with the map owner.

### The trees — `w-trees.ts` · board `360 225 420 300 2.4`

**Right, and I want this on the record:** the crown construction, five tones, the scalloped silhouette,
the two-pass blue-black keyline, the deep-teal bottom half, and the trunk with its three lit keylined
roots and its contact shadow. Do not rebuild these.

**Wrong, measured.** A luma scan down into foliage from the lawn reads
`178 178 182 182 | 48 | 160 159 152 138 …`: a **single** dark pixel between a luma-180 lawn and a
**luma-160 lit leaf**. §4 requires the lit arc to sit one pixel in from the keyline, **never touching
it**, and to appear only on the upper-left. Ours touches, all the way round, which is why foliage
fringes at 1× and reads as a sticker rather than a mass. Set the lit band in by a pixel, put a mid tone
against the keyline, and confine the lit arc to the upper-left.

**There, and this is the round's biggest single unlock:** `TILE_NAMES` is unfrozen. §7.5's three crown
scales — 85–90, 60–65, 44–48 px — become buildable this round. One crown at one scale stamped 270 times
is why the forest is wallpaper, and it cannot be fixed by the map owner alone. **Build crown two and
crown three and coordinate the gid order and the map regeneration in one change, or every tile on the
map shifts.**

One more, visible at 5.6×: the mirror pass places mirrored crown halves **adjacent**, producing visible
bilateral symmetry — a butterfly the eye catches instantly, which is worse than plain repetition.

### Undergrowth and mushrooms — `w-undergrowth.ts` · board `1290 660 130 90 7`

**Right:** the bush's fingered lobes and keyline; blooms as four-petal pluses with warm 2×2 centres
sitting directly on a dark bush with no stems. This is on-board work.

**Wrong:** one bush. `flower-pink` and `flower-red` are near-indistinguishable at 1× — two of the three
variants doing one job. And **the grass has no tufts at all**: five by six tiles of `w-grass.png` at
5.6× contain not one of §6.2's 10–11 × 8–10 px three-blade sprigs. The mottle is good and the value is
right, and without tufts the lawn still reads as felt. The board's tufts are plainly visible as little
chevrons in the tree crop.

**There:** two or three bush silhouettes; `flower-red` visibly different in form from `flower-pink`, not
just in hue; one tuft per tile across the four grass variants, positioned differently in each, wrapping
at the tile edge; and the toadstool tile reduced from three caps to one or two, so the map can place
them without producing a rash.

### The fence and the bridge — `s-outdoor.ts` · board `1130 380 300 230 4`

The fence: §2 above. **Add a post-top tile for the north–south run and a corner, in the same change as
the gid order and the map.**

The bridge reads adequately and is low priority. While you are in the file: the board also carries a
second fence type — **round posts with two rails**, by the stall and along the garden in the Question
and Arrive frames. If you have the budget after the post-top, that is the one that makes a boundary
feel rural rather than suburban.

### The cottage and props — `s-cottage.ts`, `s-props.ts` · board `1960 1130 700 480 1.5`

**The arrival frame is the payoff and it is the single biggest gap on the board.** Put
`b-cottage.png` beside `ui-1280-05-arrive.png`. The board gives a tight, warm, crowded facade: scalloped
courses each with its own lit cap, cream plaster with **grey stone quoins at the corners and around the
door**, an **arched plank door with a brass four-pane window** and two knobs, a **blue window on one
side and a gold one on the other with the wolf in it**, flower boxes under both, a **gable window**, ivy
on one corner, a **stone chimney with smoke**, a log stack, a water butt, a lit mailbox, and flower
bushes banked along the whole base of the wall.

Ours is a flat grey roof band with no per-tile lighting, a flat wall with no stone, a one-tile door
with no arch and no window, two identical gold windows, and a plain grey chimney block that reads as a
headstone. It is a shed.

It is also **the wrong shape**: `prop-cottage` is `TILE * 6 × TILE * 5` with eighteen wall tiles, against
§9.1's four tiles wide, two of wall and one and a half of roof. Fifty per cent too wide and too tall in
the wall is most of why it reads long and low instead of as a cottage. Narrow it before you detail it.

Props: the **signpost's arms are blank and rounded at both ends**, so it reads as a letterbox, not a
direction sign — the board's arms are pointed. The **well's roof is a flat dark triangle** (a bus
shelter; the board's well is a round stone drum with a post). The **lantern post** needs the board's
stone footing and a cross-arm the lantern hangs from. The **stall is the best built thing we have** and
needs only the board's hanging sign on two rings.

### The map — `forest-map.ts`

This is the element that decides whether any of the above is seen, and §2's fourth complaint is its
whole brief. Specifically:

- **Delete the border hem.** A dotted line of toadstools along row 0 and row 41, and rocks down the
  edge columns, is the clearest "the map does not make sense" artefact in the build.
- **Group the trees.** Groves with edges, three scales overlapping once they exist, canopy framing the
  top and bottom of the camera at the landmarks, and real clearings — around the cottage, the stall,
  the well, the notice post — rather than a uniform scatter with a void at spawn.
- **Stop stamping bushes in grids.** The 2-wide column down the left margin is visible at 768 and 375
  as a hedge wall.
- **Fix the fence geometry** with the new tiles: an enclosure with a gate, not three fragments, and
  nothing crossing the path.
- **Make the path a route.** It is currently a full-width straight trunk road with right-angle spurs.
  The board's is a narrow winding band, 2–3 tiles, that forks.
- **Spread the ground.** 69% of the ground is `grass-0`; §6.3's four-variant scheme is not in effect,
  and `grass-2`, the quiet one, is 4%.
- **Compose the three framings you will actually be judged on**: the spawn frame, the arrival frame,
  and the portrait 375 frame, which nobody has ever composed.

### The screens — `apps/game/src/ui/*`

**The Inspect card is the best screen in the product and the best thing in this repo. Do not touch
it.** Three identical outline pills, no Lime, two neutral rows, fine print at the promise's size, a
provenance eyebrow. It is better than the board's.

Against `1536 0 1536 1024 0.72`, two things the board does better: its **selected dialogue option is a
filled Haze row with a caret**, where ours is an underlined fragment — the board's is cleaner and more
game-like at every width; and its **goal chip is bright Haze with a dark label and a white "!" disc**,
where ours is a dark chip with light text, so the one affordance that tells a player what they are
doing is the quietest thing in our header.

Then the title screen: §2's causes 1 and 2 are yours, and at 375 **the hero screen of a marketing asset
still carries no Cyera mark** — the header shows "00" and nothing else. Put the mark in the title card,
where the deck puts it.

Two strings are needed and I do not own `content/game.json`. Raise them with that owner; do not put an
English literal behind a missing key: a coarse-pointer variant of `titleMeta` (the current copy says
"Arrow keys to walk, Space to talk" on touch), and arm text for the signpost if the prop owner gives
its arms lettering.

---

## 4. What must not be broken

The review named several of these; the rest I found this round. Every one of them is something a
plausible fix in §3 would casually destroy.

1. **The Inspect card.** Including the refusal to put Lime on Allow. One Lime on Title, one on Results,
   zero elsewhere — a fix that adds a third breaks the most important decision in the asset.
2. **The shared border ring.** Every opaque decor tile and every grass tile carry the same rim, and
   there is not one seam between ground and decor anywhere in the world. The foliage-fringe fix in §3
   is one pixel in from the keyline, **inside the object** — nobody touches the ring.
3. **The tree crown and trunk as drawn.** Add scales; do not rebuild the clump construction, the
   two-pass keyline, the deep-teal lower half or the root flare.
4. **The grass's value.** Its mid-range now matches the board exactly. The tuft fix adds sprigs; it does
   not re-open the field tone.
5. **The wolf, and Purple.** Purple's approved aubergine-led cloak and her 9×9 cape device — which is a
   deliberately-not-the-logo mark, is not the logo, and must never be called one.
6. **Warm flowers and toadstool caps.** Settled: purple undergrowth made Purple the least findable thing
   in her own forest.
7. **The writing.** The Lantern Keeper's "You will find nothing in it," the Owl's "They were kind,
   though. Very kind," the forest post, and `ctaPrompt`. Protect as written.
8. **The accessibility work.** The world is playable without sight, the focus indicator reads on both
   grounds, reduced motion is honoured in Phaser. Art changes must not regress any of it.
9. **Zero partial alpha, no raw hex, no Lime in world art, 100% branch coverage in `packages/core`.**
10. **`TILE_NAMES` order _is_ gid order.** It is unfrozen, not unconstrained: any tile added must land
    in the same change as a regenerated `map-forest.json`, or every tile on the map shifts.

---

## 5. Priority order

You run in parallel and I cannot have everything. In this order.

**First — the three that change what a visitor sees in the first two seconds.**

1. **The map.** Border hem, groves, clearings, the bush grids, the three framings. It is over half of
   every frame and it gates whether anyone sees the other eight elements' work.
2. **The bunny's face**, then **the owl's pupils**, then **the Keeper's hood**. Three small edits,
   named pixel by pixel in §2 and §3, that remove the word "creepy" from the client's next note.
3. **The title screen's dark half and its missing mark.** Not art — page composition, and the largest
   single contributor to the frame reading as horror.

**Second — the two that are structurally wrong rather than thin.**

4. **The fence post-top tile and corner**, with the gid order and the map regeneration in one change.
   Coordinate with the map owner before you start; this is the one task with a hard dependency.
5. **The cottage**: narrow it to four tiles first, then stone quoins, the arched door, one blue window,
   the gable, the chimney smoke.

**Third — the craft that buys the most per hour once the picture is right.**

6. **Crown scales two and three**, in the same gid change as the fence if the timing allows.
7. **Grass tufts**, and a second bush silhouette.
8. **The foliage fringe** — the one-pixel inset. Confirm with your own luma scan before you move
   anything; do not touch the border ring.
9. **The magpie**, the signpost arms, the well roof, the lantern footing.

**Not this round:** the bridge, the stall's hanging sign, the second rural fence type, the dialogue
option treatment. Good ideas, and they are not why the client used the word creepy.

---

One last thing, for nine people who are each about to make one element defensible. The build does not
fail on any single element — it fails between them. Before you hand anything in, render the world, open
the frame your element appears in, and put it beside the board crop named in your section. If your
element now looks right and the frame still does not, say so in your handback rather than closing the
task. That sentence is worth more to me than a passing score.
