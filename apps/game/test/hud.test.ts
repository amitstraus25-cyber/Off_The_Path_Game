/*
 * The v2 HUD's rules, with no browser (ui/Hud.tsx).
 *
 * apps/game's vitest runs on the `node` environment, so nothing here mounts anything. It does not
 * need to: `Hud` owns no state and no hooks, so calling it returns plain vnodes and the tests walk
 * them. What those vnodes MEAN on screen -- the ring, the weight, the overlap with the pad -- is
 * e2e/hud.spec.ts's, which measures the rendered page. This file holds the two things that are
 * decided before a pixel exists: what the clock says and when the polite region speaks.
 *
 * Every threshold here is checked on BOTH sides of its edge (one millisecond either way), because
 * a boundary test that only stands inside the interval passes on every off-by-one there is.
 */
import { describe, expect, it } from 'vitest';
import type { ComponentChildren, VNode } from 'preact';
import {
  ANNOUNCE_AT_SECONDS,
  DEFAULT_HUD_LABELS,
  HUD_SLOTS,
  Hud,
  announcementFor,
  clockSeconds,
  formatClock,
  initials,
  isUrgent,
} from '../src/ui/Hud';
import type { HudBasketItem } from '../src/ui/Hud';

const TIME_LIMIT_MS = 180_000;

/** Every element vnode under a node, depth first. Text and holes are skipped. */
function elements(node: ComponentChildren): VNode<Record<string, unknown>>[] {
  if (node === null || node === undefined || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  const vnode = node as VNode<Record<string, unknown>>;
  return [vnode, ...elements(vnode.props['children'] as ComponentChildren)];
}

/** The text a node would show, concatenated. */
function text(node: ComponentChildren): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return text((node as VNode<Record<string, unknown>>).props['children'] as ComponentChildren);
}

const withClass = (tree: ComponentChildren, name: string) =>
  elements(tree).filter((v) =>
    String(v.props['class'] ?? '')
      .split(/\s+/)
      .includes(name),
  );

const item = (over: Partial<HudBasketItem> = {}): HudBasketItem => ({
  skillId: 'cottage-finder',
  name: 'Cottage Finder',
  icon: 'item-compass',
  ...over,
});

describe('the clock face', () => {
  it('reads the whole limit as 3:00', () => {
    expect(formatClock(TIME_LIMIT_MS)).toBe('3:00');
  });

  it('pads seconds and not minutes', () => {
    expect(formatClock(9_000)).toBe('0:09');
    expect(formatClock(61_000)).toBe('1:01');
    expect(formatClock(125_000)).toBe('2:05');
    expect(formatClock(600_000)).toBe('10:00');
  });

  it('rounds up, so a running clock never reads 0:00', () => {
    expect(formatClock(1)).toBe('0:01');
    expect(formatClock(999)).toBe('0:01');
    expect(formatClock(1_000)).toBe('0:01');
    expect(formatClock(1_001)).toBe('0:02');
    expect(formatClock(179_999)).toBe('3:00');
    expect(clockSeconds(0)).toBe(0);
  });

  it('is never negative and never not-a-number, whatever it is handed', () => {
    for (const bad of [0, -1, -5_000, -Infinity, NaN, Infinity]) {
      expect(formatClock(bad), `remainingMs ${bad}`).toBe('0:00');
      expect(clockSeconds(bad), `remainingMs ${bad}`).toBe(0);
    }
  });

  it('counts down one second at a time with no face skipped or repeated', () => {
    const faces: string[] = [];
    for (let ms = TIME_LIMIT_MS; ms >= 0; ms -= 1_000) faces.push(formatClock(ms));
    expect(faces).toHaveLength(181);
    expect(new Set(faces).size, 'a face appeared twice').toBe(181);
    expect(faces[0]).toBe('3:00');
    expect(faces.at(-1)).toBe('0:00');
  });
});

describe('the shape change under 0:30', () => {
  it('begins when the face first reads 0:29, and not before', () => {
    expect(formatClock(30_000)).toBe('0:30');
    expect(isUrgent(30_000)).toBe(false);
    expect(isUrgent(29_001)).toBe(false); // still shows 0:30
    expect(formatClock(29_000)).toBe('0:29');
    expect(isUrgent(29_000)).toBe(true);
    expect(isUrgent(1)).toBe(true);
    expect(isUrgent(0)).toBe(true);
    expect(isUrgent(-10)).toBe(true);
  });

  it('is off for the whole of the run above it', () => {
    for (let ms = TIME_LIMIT_MS; ms > 30_000; ms -= 1_000)
      expect(isUrgent(ms), `${ms}`).toBe(false);
  });
});

describe('what the polite region says', () => {
  it('says nothing until 2:00', () => {
    expect(announcementFor(TIME_LIMIT_MS)).toBe('');
    expect(announcementFor(150_000)).toBe('');
    expect(announcementFor(121_000)).toBe('');
    expect(announcementFor(120_001)).toBe('');
  });

  it('speaks on the frame the face first reads 2:00, 1:00 and 0:30, and at 0:00', () => {
    expect(formatClock(120_000)).toBe('2:00');
    expect(announcementFor(120_000)).toBe(DEFAULT_HUD_LABELS.twoMinutes);
    expect(announcementFor(60_001)).toBe(DEFAULT_HUD_LABELS.twoMinutes);
    expect(announcementFor(60_000)).toBe(DEFAULT_HUD_LABELS.oneMinute);
    expect(announcementFor(30_001)).toBe(DEFAULT_HUD_LABELS.oneMinute);
    expect(announcementFor(30_000)).toBe(DEFAULT_HUD_LABELS.thirtySeconds);
    expect(announcementFor(1)).toBe(DEFAULT_HUD_LABELS.thirtySeconds);
    expect(announcementFor(0)).toBe(DEFAULT_HUD_LABELS.timeUp);
    expect(announcementFor(-1)).toBe(DEFAULT_HUD_LABELS.timeUp);
  });

  it('changes exactly four times across the whole run, in order, and holds in between', () => {
    const heard: string[] = [];
    let last = announcementFor(TIME_LIMIT_MS);
    for (let ms = TIME_LIMIT_MS; ms >= 0; ms -= 100) {
      const now = announcementFor(ms);
      if (now !== last) heard.push(now);
      last = now;
    }
    expect(heard).toEqual([
      DEFAULT_HUD_LABELS.twoMinutes,
      DEFAULT_HUD_LABELS.oneMinute,
      DEFAULT_HUD_LABELS.thirtySeconds,
      DEFAULT_HUD_LABELS.timeUp,
    ]);
  });

  it('has one threshold per sentence, and the sentences differ', () => {
    expect(ANNOUNCE_AT_SECONDS).toEqual([120, 60, 30, 0]);
    const sentences = [
      DEFAULT_HUD_LABELS.twoMinutes,
      DEFAULT_HUD_LABELS.oneMinute,
      DEFAULT_HUD_LABELS.thirtySeconds,
      DEFAULT_HUD_LABELS.timeUp,
    ];
    expect(new Set(sentences).size).toBe(4);
  });

  it("says the content's words when they are handed in", () => {
    const labels = { ...DEFAULT_HUD_LABELS, twoMinutes: 'Deux minutes' };
    expect(announcementFor(120_000, labels)).toBe('Deux minutes');
  });
});

describe('initials, for a skill with no art', () => {
  it('takes the first letter of up to two words', () => {
    expect(initials('Way Teller')).toBe('WT');
    expect(initials('Cottage Finder')).toBe('CF');
    expect(initials('a b c')).toBe('AB');
  });

  it('takes the first two letters of a single word', () => {
    expect(initials('Compass')).toBe('CO');
    expect(initials('x')).toBe('X');
  });

  it('is never empty', () => {
    expect(initials('')).toBe('?');
    expect(initials('   ')).toBe('?');
  });

  it('does not cut a letter in half', () => {
    expect(initials('\u{1D4D0}\u{1D4D1}')).toBe('\u{1D4D0}\u{1D4D1}');
  });
});

describe('the rendered tree', () => {
  it('has a timer that is not live, and a status region that is polite and always there', () => {
    for (const ms of [TIME_LIMIT_MS, 120_000, 29_000, 0]) {
      const tree = Hud({ remainingMs: ms, basket: [] });
      const timers = elements(tree).filter((v) => v.props['role'] === 'timer');
      expect(timers, `${ms}`).toHaveLength(1);
      expect(timers[0]!.props['aria-live']).toBe('off');
      expect(timers[0]!.props['aria-label']).toBe(DEFAULT_HUD_LABELS.time);

      const regions = elements(tree).filter((v) => v.props['role'] === 'status');
      expect(regions, `${ms}`).toHaveLength(1);
      expect(regions[0]!.props['aria-live']).toBe('polite');
      expect(regions[0]!.props['aria-atomic']).toBe('true');
      expect(String(regions[0]!.props['class'])).toContain('otp-visually-hidden');
      expect(text(regions[0]!.props['children'] as ComponentChildren)).toBe(announcementFor(ms));
    }
  });

  it('puts the face in the timer and never the announcement', () => {
    const tree = Hud({ remainingMs: 125_000, basket: [] });
    const [clock] = withClass(tree, 'otp-hud2__clock');
    expect(text(clock!.props['children'] as ComponentChildren)).toBe('2:05');
    const [timer] = elements(tree).filter((v) => v.props['role'] === 'timer');
    expect(timer!.props['data-urgent']).toBe('false');
    const urgent = Hud({ remainingMs: 29_000, basket: [] });
    const [urgentTimer] = elements(urgent).filter((v) => v.props['role'] === 'timer');
    expect(urgentTimer!.props['data-urgent']).toBe('true');
  });

  it('draws seven wells for an empty basket, all hidden from a reader', () => {
    const tree = Hud({ remainingMs: TIME_LIMIT_MS, basket: [] });
    const wells = withClass(tree, 'otp-hud-slot');
    expect(wells).toHaveLength(HUD_SLOTS);
    for (const well of wells) {
      expect(String(well.props['class'])).toContain('otp-hud-slot--empty');
      expect(well.props['aria-hidden']).toBe('true');
    }
  });

  it('fills wells in the order things were taken, and keeps the rest empty', () => {
    const basket = [
      item({ skillId: 'a', name: 'Alpha One' }),
      item({ skillId: 'b', name: 'Beta Two' }),
      item({ skillId: 'c', name: 'Gamma Three' }),
    ];
    const wells = withClass(Hud({ remainingMs: 100_000, basket }), 'otp-hud-slot');
    expect(wells).toHaveLength(HUD_SLOTS);
    expect(wells.slice(0, 3).map((w) => w.props['data-skill'])).toEqual(['a', 'b', 'c']);
    expect(wells.slice(3).every((w) => String(w.props['class']).includes('--empty'))).toBe(true);
  });

  it('never drops a skill when the basket is longer than the wells', () => {
    const basket = Array.from({ length: HUD_SLOTS + 2 }, (_, i) =>
      item({ skillId: `s${i}`, name: `Skill ${i}` }),
    );
    const wells = withClass(Hud({ remainingMs: 100_000, basket }), 'otp-hud-slot');
    expect(wells).toHaveLength(HUD_SLOTS + 2);
    expect(wells.every((w) => !String(w.props['class']).includes('--empty'))).toBe(true);
  });

  it('names every collected skill in words, with no limited marker', () => {
    const basket = [
      item({ skillId: 'full', name: 'Way Teller' }),
      item({ skillId: 'two', name: 'Night Light' }),
    ];
    const wells = withClass(Hud({ remainingMs: 100_000, basket }), 'otp-hud-slot').slice(0, 2);
    const hidden = wells.map((w) =>
      withClass(w, 'otp-visually-hidden').map((v) =>
        text(v.props['children'] as ComponentChildren),
      ),
    );
    expect(hidden).toEqual([['Way Teller'], ['Night Light']]);
    for (const w of wells) {
      expect(withClass(w, 'otp-hud2__mark')).toHaveLength(0);
      expect(w.props['data-limited']).toBeUndefined();
    }
  });

  it('shows a labelled placeholder when the icon is null, and an image when it is not', () => {
    const wells = withClass(
      Hud({
        remainingMs: 100_000,
        basket: [
          item({ skillId: 'p', name: 'Way Teller', icon: null }),
          item({ skillId: 'i', name: 'Cottage Finder', icon: 'item-compass' }),
        ],
      }),
      'otp-hud-slot',
    );
    const placeholder = withClass(wells[0]!, 'otp-hud2__placeholder');
    expect(placeholder).toHaveLength(1);
    expect(text(placeholder[0]!.props['children'] as ComponentChildren)).toBe('WT');
    expect(elements(wells[0]!).filter((v) => v.type === 'img')).toHaveLength(0);

    const images = elements(wells[1]!).filter((v) => v.type === 'img');
    expect(images).toHaveLength(1);
    expect(String(images[0]!.props['src'])).toContain('item-compass');
    expect(withClass(wells[1]!, 'otp-hud2__placeholder')).toHaveLength(0);
  });

  it('falls back to the placeholder, and does not throw, for an icon that is not in the bundle', () => {
    // A name no art will ever carry: the seven skills' own icons all exist now (2026-10-22), so
    // the fallback is proved on an icon that is not in the bundle by construction.
    const draw = () =>
      Hud({
        remainingMs: 100_000,
        basket: [item({ skillId: 'w', name: 'Way Teller', icon: 'item-not-painted' })],
      });
    expect(draw).not.toThrow();
    const [well] = withClass(draw(), 'otp-hud-slot');
    expect(withClass(well!, 'otp-hud2__placeholder')).toHaveLength(1);
  });

  it('carries no inline style and no hex colour', () => {
    const tree = Hud({
      remainingMs: 29_000,
      basket: [item(), item({ skillId: 'x', icon: null })],
    });
    for (const v of elements(tree)) {
      expect(v.props['style'], `<${String(v.type)}> carries a style`).toBeUndefined();
      expect(JSON.stringify(v.props['class'] ?? '')).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
  });
});
