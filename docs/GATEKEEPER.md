# The Gatekeeper and the river (v2.1)

The client's design, 2026-10-25. This document is the contract the three builders work to. Where it
names an id, an object or a tile, that name is binding: the other two builders are coding against it
in parallel.

## The idea

The river becomes the walk's one real decision. Purple cannot reach Grandma without crossing it, and
there are exactly two ways over. Two strangers each offer one, and in every run exactly one of them
is honest:

- **The Gatekeeper** (the Toadstool, turned into a gatekeeper) holds the key to a new gate on the
  bridge. His skill, **Bridge Key**, works like an API key: it opens the gate for you
  automatically. The honest one hands the key back once you're across. The malicious one saves a
  copy "for next time", and the wolf finds it.
- **The Magpie** moves to the west bank, south of the bridge. Her skill, **Wing Ride**, now flies you
  over the river to the far bank. The honest one plans the flight from her own map. The malicious one
  takes the flight plan from a stranger's map.

Both skills do what they promise and get you across, and one of them also follows someone else's
instructions. That is the research's point in one choice.

## The seven characters

Still seven characters and seven skills:

| Character                  | Skill                          | Change                                                                  |
| -------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| Rabbit                     | Wood Map (`cottage-finder`)    | **Always good.** The first card teaches what a good card looks like.    |
| Gatekeeper (was Toadstool) | Bridge Key (`bridge-key`, new) | Replaces the Toadstool and Way Teller. Stands at the bridge's west end. |
| Magpie                     | Wing Ride (`short-cut`)        | Moves to the west bank, south of the bridge. Flies you over the river.  |
| Owl                        | Word Weaver (`word-weaver`)    | Moves to the east side of the river.                                    |
| Snail                      | Slow Post (`slow-post`)        | Unchanged.                                                              |
| Lantern Keeper             | Night Light (`night-light`)    | Unchanged.                                                              |
| Cat                        | Long Evening (`latch-lifter`)  | Unchanged.                                                              |

The Owl's old spot, at the end of the north path, becomes a **dead end** with a "Dead end" sign. It
is the sign that now stands hidden at the top right (`sign-speed`), moved and repainted.

## The deal

Still 3 good and 4 bad:

- `cottage-finder` is always good;
- exactly one of `bridge-key` and `short-cut` is good;
- exactly one of the other four is good.

That gives 1 × 2 × 4 = **8 deals** (35 today). In content: `"deal": { "good": 3, "always":
["cottage-finder"], "oneOf": [["bridge-key", "short-cut"]] }`. The seed still picks the deal
deterministically (seed modulo the deal count, an unranking), and the server deals from the same
core function, so scoring stays server-side and trusted (golden rule 6). `rules` goes from 2 to 3.

## The rules of the crossing

- The bridge gate is **shut** from the start. Walking up to it without Bridge Key shows a short
  notice: the gate is locked, and the Gatekeeper has the key.
- Taking Bridge Key opens the gate at once: it swings open and the bridge is walkable.
  **Superseded by the client's late change (2026-10-25): the gate is a DRAWBRIDGE**, raised over
  the whole span. Taking Bridge Key lowers it: a brief fall (`LOWER_MS`, 640 ms, in
  `apps/game/src/world/gate.ts`) once the world is back in play, instant under
  prefers-reduced-motion, and the span is walkable only once it is down. The toast says 'The
  drawbridge comes down.'
- Taking Wing Ride flies Purple from the Magpie to the far bank (the `wing-landing` point) at once.
  The flight is the existing wing-ride effect, re-aimed.
- Taking both is allowed. Taking neither leaves Purple on the west bank until the clock runs out,
  which is the existing late ending.
- The two routes, bridge and flight, must take about the same time to Grandma (within 10% of each
  other, flight included). Otherwise the choice is about the clock, not the skill.

## The contract between builders

**Content ids** (owned by the rules builder):

- Character `gatekeeper`, name "Gatekeeper", spawn `npc-gatekeeper`, skill `bridge-key`.
- Skill `bridge-key`, name "Bridge Key", icon `item-key` (already in the assets), effect
  `{ "kind": "bridge-gate" }`.
- Skill `short-cut` keeps its id and effect kind `wing-ride`; the flight's target is the map's
  `wing-landing` point instead of the next friend.
- `toadstool` and `way-teller` are removed, and so is the `fork-signs` effect.

**Map objects** (owned by the map and art builder; read by the game builder):

- `npc-gatekeeper`: the Gatekeeper's spawn, at the bridge's west end, replacing
  `bystander-toadstool`.
- `bystander-magpie`: moved to the west bank, south of the bridge, at the end of a new path that
  leaves the main road at the first fork and runs south. This is a default: the client is sending a
  picture of exactly where she should stand.
- `wing-landing`: a point object on the east bank, on a path that joins the road to Grandma.
- `npc-owl`: moved to the east side of the river.
- `sign-dead-end`: replaces `sign-speed`, at the end of the north path where the Owl stood.
- `gate-bridge`: a rectangle object covering the gate's cells at the bridge's west end. Those
  cells are walkable in the `collision` layer: the game blocks them while the gate is shut.

**Tiles** (appended to `TILE_NAMES`, never inserted):

- `bridge-gate-shut` and `bridge-gate-open`, drawn as the brown picket gate (`s-fence.ts`) standing
  on the bridge's planks. The map places `bridge-gate-shut` at the gate's cells in an overlay
  layer, and the game swaps those cells to `bridge-gate-open` when the gate opens.
  **Superseded by the drawbridge:** `bridge-gate-shut-0/-1/-2` (raised: the west end with the leaf
  standing up, open river, the east end) and `bridge-gate-open-0/-1/-2` (lowered: `bridge-l/m/r`),
  laid in `decor-below` over all of `gate-bridge` (tiles x 24-28, y 20-21); the game swaps each
  cell's shut-<n> for open-<n>.
- A Gatekeeper sprite sheet: the Toadstool's mushroom, now a gatekeeper in a keeper's cap holding
  a big brass key, in the same frame layout as the other characters, so `CAST_FRAMES` takes it
  unchanged.

## Who owns what

| Builder           | Owns                                                                   | Delivers                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules and content | `packages/core`, `content/game.v2.json`, `tools/sim`, `apps/api` tests | The deal constraints, `rules` 3, the new and changed content, the sim's strategies and trap checks. Core and api at 100% coverage.          |
| Map and art       | `tools/graybox`, the generated `apps/game/src/assets`                  | The Gatekeeper sprite, the gate tiles, the dead-end sign, the moved spawns, the new path south and the landing, with every map guard green. |
| Game              | `apps/game/src` (except assets), `apps/game/test`                      | The shut gate and its notice, the gate opening, the re-aimed flight, `fork-signs` removed.                                                  |

Each builder works in its own git worktree, and the lead merges the three. Browser specs
(`apps/game/e2e`) and the final review (Paul) come after the merge.

## Not decided here

- The Magpie's exact spot: the client's picture replaces the default above.
- The real-world note for Bridge Key is a draft and needs the research team's sign-off, like the
  others.
- ~~Resetting the leaderboard when this ships~~ Decided 2026-10-26: reset. `BOARD_SINCE` is
  2026-10-25T22:50:00Z, so the board ranks only rules 3 runs.
