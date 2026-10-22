import { useEffect, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { TILE } from '../world/logic';
import { TERRAIN, pathFor, terrainRuns } from '../world/minimap';
import type { MapSketch } from '../world/minimap';
import type { Rect, Vec } from '../world/logic';

/*
 * THE MINIMAP, top right of the world (the client, 2026-10-22: "how do i get to this? i cant find
 * the character.. lets add a little mini map on the top rite").
 *
 * DOM, NOT CANVAS (golden rule 4): an inline SVG in the world's own box (`.otp-world-anchor`),
 * coloured entirely by classes in hud.css, so every fill is a Cyera token a stylesheet review can
 * see. One viewBox unit is one map tile, and hud.css sizes the SVG at a WHOLE number of CSS pixels
 * per tile (`--otp-map-px`), with `shape-rendering: crispEdges`, so the squares stay squares.
 *
 * WHAT IT SAYS, AND WHAT IT NEVER SAYS. The paths, the stream, Grandma's cottage, a dot for each of
 * the seven that fills once you have met them, and Purple. Nothing about a skill: a dot is the same
 * for a good deal and a bad one, so the map tells you where to go and never what to do there.
 *
 * TO A SCREEN READER it is one sentence, `Map: 5 of 7 met`, in a polite region that changes only
 * when somebody new is met -- never Purple's position, which would be a live stream of noise. The
 * picture itself is `aria-hidden`: the forest's own summary (App.tsx `worldAsText`) already lists
 * who is met and who is not, by name.
 *
 * PURPLE'S MARKER is moved by a frame loop that writes one SVG attribute, and only on a frame where
 * her rounded position changed, so walking costs no render of this tree. The minimap adds no
 * motion of its own; under reduced motion the dots fill without the short fade (hud.css).
 */

export interface MinimapProps {
  sketch: MapSketch;
  /** Ids of the cast met so far this run (core's `state.met`). */
  met: readonly string[];
  /** Purple's feet in world pixels, read every frame, or null when there is no one to show. */
  where(): Vec | null;
  /** The polite sentence, already filled (`Map: 5 of 7 met`). */
  summary: string;
  /**
   * Where the cast stand on the canvas this frame, in GAME pixels from its top-left, and the
   * canvas's width in game pixels (forest-scene.ts). When a figure is under the map, the map steps
   * back to a faint outline so it never hides a character. Absent: the map never yields.
   */
  view?: { castOnCanvas(): readonly Rect[]; readonly canvasWidth: number } | null;
}

/**
 * A dot's radius and Purple's half-diagonal, in tiles, sized to read at two CSS pixels a tile.
 * Purple's is the biggest mark on the map (the review of 2026-10-22: "a larger, easier-to-find
 * Purple marker"), and hud.css keeps it that size in CSS pixels where the map is drawn smaller.
 */
const DOT_R = 1.4;
const PURPLE_HALF = 2.4;

export function Minimap({ sketch, met, where, summary, view = null }: MinimapProps) {
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const purple = useRef<SVGGElement>(null);

  const paths = useMemo(() => {
    const runs = terrainRuns(sketch);
    return {
      open: pathFor(runs, TERRAIN.open),
      path: pathFor(runs, TERRAIN.path),
      water: pathFor(runs, TERRAIN.water),
    };
  }, [sketch]);

  /*
   * The map's width in tiles, published on `.otp-ui` so the controls hint at the top left can stop
   * short of the minimap at the top right (hud.css): read from the map, never written down.
   */
  useLayoutEffect(() => {
    const ui = box.current?.closest<HTMLElement>('.otp-ui');
    if (!ui) return;
    ui.style.setProperty('--otp-map-cols', String(sketch.cols));
    ui.dataset['mapShown'] = 'true';
    return () => {
      ui.style.removeProperty('--otp-map-cols');
      delete ui.dataset['mapShown'];
    };
  }, [sketch.cols]);

  useEffect(() => {
    let frame = 0;
    let shownX = Number.NaN;
    let shownY = Number.NaN;
    /** CSS pixels per tile, so the marker moves in whole pixels. Re-read on resize, not per frame. */
    let perTile = 0;
    /** The map's own box in the world's coordinates, and CSS pixels per game pixel. */
    let mine: Rect | null = null;
    let zoom = 0;
    let yielding = false;
    const measure = (): void => {
      const width = svg.current?.getBoundingClientRect().width ?? 0;
      perTile = width > 0 ? width / sketch.cols : 0;
      const el = box.current;
      const world = el?.parentElement;
      if (!el || !world || !view) return;
      const a = el.getBoundingClientRect();
      const w = world.getBoundingClientRect();
      mine = { x: a.left - w.left, y: a.top - w.top, width: a.width, height: a.height };
      zoom = view.canvasWidth > 0 ? w.width / view.canvasWidth : 0;
    };
    /** Whether any figure on the canvas stands under the map's box. */
    const covering = (): boolean => {
      if (!view || !mine || zoom === 0) return false;
      const m = mine;
      return view
        .castOnCanvas()
        .some(
          (r) =>
            r.x * zoom < m.x + m.width &&
            (r.x + r.width) * zoom > m.x &&
            r.y * zoom < m.y + m.height &&
            (r.y + r.height) * zoom > m.y,
        );
    };
    const step = (): void => {
      frame = requestAnimationFrame(step);
      if (perTile === 0 || (view && !mine)) measure();
      const yieldNow = covering();
      if (yieldNow !== yielding && box.current) {
        yielding = yieldNow;
        box.current.dataset['yield'] = yieldNow ? 'true' : 'false';
      }
      const at = where();
      const g = purple.current;
      if (!g) return;
      if (!at) {
        g.setAttribute('visibility', 'hidden');
        return;
      }
      const snap = (v: number): number =>
        perTile > 0 ? Math.round((v / TILE) * perTile) / perTile : v / TILE;
      const x = snap(at.x);
      const y = snap(at.y);
      if (x === shownX && y === shownY) return;
      shownX = x;
      shownY = y;
      g.setAttribute('transform', `translate(${x} ${y})`);
      g.setAttribute('visibility', 'visible');
    };
    window.addEventListener('resize', measure);
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
    };
  }, [sketch, where, view]);

  const { cottage } = sketch;
  return (
    <div class="otp-minimap" ref={box} data-minimap="" data-yield="false">
      <svg
        ref={svg}
        class="otp-minimap__map"
        viewBox={`0 0 ${sketch.cols} ${sketch.rows}`}
        style={{ '--otp-map-cols': sketch.cols, '--otp-map-rows': sketch.rows }}
        aria-hidden="true"
        focusable="false"
      >
        <path class="otp-minimap__open" d={paths.open} />
        <path class="otp-minimap__water" d={paths.water} />
        <path class="otp-minimap__path" d={paths.path} />
        <rect
          class="otp-minimap__cottage"
          data-minimap-cottage=""
          x={cottage.x}
          y={cottage.y}
          width={cottage.width}
          height={cottage.height}
        />
        {sketch.cast.map((c) => (
          <circle
            key={c.id}
            class="otp-minimap__who"
            data-who={c.id}
            data-met={met.includes(c.id) ? 'true' : 'false'}
            cx={c.col}
            cy={c.row}
            r={DOT_R}
          />
        ))}
        <g ref={purple} class="otp-minimap__purple" data-minimap-purple="" visibility="hidden">
          <path d={`M0 ${-PURPLE_HALF}L${PURPLE_HALF} 0L0 ${PURPLE_HALF}L${-PURPLE_HALF} 0z`} />
        </g>
      </svg>
      <p class="otp-visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {summary}
      </p>
    </div>
  );
}
