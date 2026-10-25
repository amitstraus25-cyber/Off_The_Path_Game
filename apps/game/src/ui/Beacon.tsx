import { useEffect, useState } from 'preact/hooks';

/*
 * THE WAY ON (the client's review, 2026-10-25, P5): a small, quiet arrow at the edge of the world
 * pointing at the nearest character the player has not met, shown ONLY while none of them is on
 * screen. With one in view the "!" and the ground glow already say where to go.
 *
 * The scene says the angle (world/forest-scene.ts `otp:beacon`, whole degrees clockwise from
 * east, or null to hide it); this places the arrow where that ray leaves the world's box, inset
 * so it never sits under the frame. Haze on a Black disc like the HUD's pills, never Lime: the
 * Wood Map still earns its keep, because the arrow says which way and never how to get there.
 *
 * aria-hidden: a screen reader has the same directions in words, in the forest summary.
 */
const BEACON = 'otp:beacon';

/** How far in from the world's edge the arrow's centre stands, in CSS pixels. */
const INSET = 30;

/** The event's payload, checked: anything on the page can dispatch it. */
export function readBeacon(detail: unknown): number | null {
  if (typeof detail !== 'object' || detail === null || !('degrees' in detail)) return null;
  const { degrees } = detail as { degrees: unknown };
  return typeof degrees === 'number' && Number.isFinite(degrees) ? degrees : null;
}

/** Where on a w x h box the ray at `degrees` from its centre leaves it, `inset` from the edge. */
export function edgePoint(
  w: number,
  h: number,
  degrees: number,
  inset = INSET,
): { x: number; y: number } {
  const a = (degrees * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const hw = Math.max(0, w / 2 - inset);
  const hh = Math.max(0, h / 2 - inset);
  const t = Math.min(
    dx === 0 ? Infinity : hw / Math.abs(dx),
    dy === 0 ? Infinity : hh / Math.abs(dy),
  );
  return { x: w / 2 + dx * t, y: h / 2 + dy * t };
}

export function Beacon() {
  const [degrees, setDegrees] = useState<number | null>(null);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const on = (event: Event): void => void setDegrees(readBeacon((event as CustomEvent).detail));
    window.addEventListener(BEACON, on);
    return () => void window.removeEventListener(BEACON, on);
  }, []);
  const at = degrees !== null && box ? edgePoint(box.clientWidth, box.clientHeight, degrees) : null;
  return (
    <div class="otp-beacon-layer" ref={setBox} aria-hidden="true">
      {at && (
        <span
          class="otp-beacon"
          data-beacon={String(degrees)}
          style={{ transform: `translate(${at.x}px, ${at.y}px) rotate(${degrees}deg)` }}
        />
      )}
    </div>
  );
}
