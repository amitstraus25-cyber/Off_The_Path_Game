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
  // What was actually given back, which core clamps for a run younger than the rewind.
  if (perk.kind === 'rewind')
    return fill(strings['perkRewind'] ?? '', { seconds: Math.round(perk.ms / 1000) });
  // Read as a plain string so a kind core adds is a line to write here and not a compile break.
  const kind: string = perk.kind;
  switch (kind) {
    case 'minimap':
      return strings['perkMinimap'] ?? '';
    case 'bridge-gate':
      return strings['perkBridgeGate'] ?? 'The gate swings open.';
    case 'early-welcome':
      return strings['perkEarlyWelcome'] ?? '';
    case 'wing-ride':
      // A ride that was given an explicit nobody to fly to does nothing, and says so. One to the
      // river's far bank (the landing point) always flies.
      return wingRideTo(perk) === null
        ? (strings['perkWingRideNobody'] ?? '')
        : (strings['perkWingRide'] ?? '');
    case 'walk-faster':
      return strings['perkWalkFaster'] ?? '';
    case 'lantern':
      return strings['perkLantern'] ?? '';
    default:
      return '';
  }
}

/**
 * Who a wing ride was recorded to land beside: a character's id, null when it was recorded with
 * nobody to fly to, and undefined when the perk carries no such field at all -- a ride that flies
 * to the map's landing point (docs/GATEKEEPER.md) and needs no one.
 */
export function wingRideTo(perk: v2.Perk): string | null | undefined {
  return (perk as { to?: string | null }).to;
}
