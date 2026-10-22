import type { v2 } from '@otp/core';
import { fill, strings } from './copy';

/*
 * THE ONE LINE A PERK SAYS WHEN IT IS TAKEN (the client, 2026-10-22: "each effect starts the moment
 * the skill is taken and shows a one-line toast ... naming the perk").
 *
 * Keyed by the effect's KIND, never by a skill id, so a skill added to the content that picks an
 * existing kind is announced with no code change (CLAUDE.md rule 3). The words are chrome keys in
 * content/game.v2.json, spelled out below as `strings['...']` reads so test/strings.test.ts can see
 * every one of them.
 *
 * One line per perk and no more: it goes into the toast's polite region, and a region that is
 * rewritten every few frames is a region that never finishes a sentence.
 */
export function perkLine(perk: v2.Perk): string {
  switch (perk.kind) {
    case 'minimap':
      return strings['perkMinimap'] ?? '';
    case 'fork-signs':
      return strings['perkForkSigns'] ?? '';
    case 'early-welcome':
      return strings['perkEarlyWelcome'] ?? '';
    case 'wing-ride':
      // `to` is null when nobody was left unmet: the ride does nothing, and says so.
      return perk.to === null
        ? (strings['perkWingRideNobody'] ?? '')
        : (strings['perkWingRide'] ?? '');
    case 'walk-faster':
      return strings['perkWalkFaster'] ?? '';
    case 'lantern':
      return strings['perkLantern'] ?? '';
    case 'rewind':
      // What was actually given back, which core clamps for a run younger than the rewind.
      return fill(strings['perkRewind'] ?? '', { seconds: Math.round(perk.ms / 1000) });
  }
}
