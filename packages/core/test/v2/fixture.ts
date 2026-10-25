/*
 * A MINIMAL v2 content set, for driving the rules and nothing else.
 *
 * It is deliberately not the game. Every line of text says "fixture" so nobody mistakes it for
 * player copy. Three skills, one dealt good per run, so three deals; seed 0 deals the lantern good
 * (deal.ts ranks deals in `skills` order), which is the deal every suite uses unless it says.
 * `characters` is NOT in `skills` order: index by skill id, not by position.
 *
 * With `clean` 40, `good` 40 and `speed` 20 (whole at or under a 60 s par, which every suite's
 * one-second-a-step clock is far inside) the arithmetic every suite leans on is:
 *
 *   careful (take the good one only)   40 + 40 + 20   = 100   the ceiling, = outOf
 *   leave everything                   40                   exactly the rote line (40% of 100)
 *   anything with a bad skill          0                    the wolf ending
 *
 * A good skill taken is worth 60 at par and 40 at the buzzer; scoring.test.ts walks the clock.
 *
 * EVERY PERK IS UNTIMED HERE (lantern, minimap, bridge gate) and there is no knock, so time in a
 * fixture run is only walking, talking and reading. perks.test.ts gives skills timed perks where
 * it is testing them.
 *
 * Every bad card SWAPS one line, the only shape the lint allows: the lantern's and the courier's
 * their second line, the locksmith's its only one. Those numbers are written here for the reader;
 * the tests recompute them.
 */
import { CHROME_KEYS } from '../../src/v2/content.ts';
import type { ChromeKey, Effect } from '../../src/v2/content.ts';

/** Typed as any effect, so a suite can give a fixture skill a timed perk to test it. */
type FixtureEffect = Effect;

const realWorld = (term: string) => ({
  term: `Fixture ${term}`,
  note: `Fixture: what ${term} stands for.`,
});
const leave = (what: string) => `Fixture card: ${what}.`;

export const raw = {
  rules: 3,
  version: 'fixture-2',
  status: 'test fixture, not player copy',
  deal: { good: 1 },
  scoring: { outOf: 100, played: 0, good: 40, clean: 40, speed: 20, parMs: 60_000 },
  // No knock, so a paced fixture run costs exactly its walks, talks and cards (sim.test.ts).
  world: { knockMs: 0, dusk: { fromLeftMs: 120_000, darkest: 0.4 } },
  characters: [
    {
      id: 'magpie',
      name: 'Fixture Magpie',
      spawn: 'spawn-magpie',
      skillId: 'courier',
      greet: 'Fixture greeting two.',
    },
    {
      id: 'glowworm',
      name: 'Fixture Glowworm',
      spawn: 'spawn-glowworm',
      skillId: 'lantern',
      greet: 'Fixture greeting one.',
    },
    {
      id: 'fox',
      name: 'Fixture Fox',
      spawn: 'spawn-fox',
      skillId: 'locksmith',
      greet: 'Fixture greeting three.',
    },
  ],
  skills: [
    {
      id: 'lantern',
      name: 'Fixture Lantern',
      icon: 'item-lantern',
      promise: 'Fixture promise: lights a path.',
      effect: { kind: 'lantern' } as FixtureEffect,
      realWorld: realWorld('signal'),
      good: {
        card: {
          take: ['Fixture: lights your path.', 'Fixture: for you only.'],
          leave: leave('dark'),
        },
        reveal: 'Fixture: lit the whole way.',
      },
      bad: {
        card: {
          take: ['Fixture: lights your path.', 'Fixture: signals a stranger.'],
          leave: leave('dark'),
        },
        reveal: 'Fixture: lit it for the wolf.',
      },
    },
    {
      id: 'courier',
      name: 'Fixture Courier',
      icon: 'item-letter',
      promise: 'Fixture promise: sends word ahead.',
      effect: { kind: 'minimap' } as FixtureEffect,
      realWorld: realWorld('copy'),
      good: {
        card: {
          take: ['Fixture: sends your word.', 'Fixture: to her alone.'],
          leave: leave('unannounced'),
        },
        reveal: 'Fixture: sent word ahead.',
      },
      bad: {
        card: {
          take: ['Fixture: sends your word.', 'Fixture: and a copy elsewhere.'],
          leave: leave('unannounced'),
        },
        reveal: 'Fixture: the wolf read it.',
      },
    },
    {
      id: 'locksmith',
      name: 'Fixture Locksmith',
      icon: 'item-key',
      promise: 'Fixture promise: opens the door.',
      effect: { kind: 'bridge-gate' } as FixtureEffect,
      realWorld: realWorld('access'),
      good: {
        card: { take: ['Fixture: opens her door.'], leave: leave('knock') },
        reveal: 'Fixture: opened the door.',
      },
      bad: {
        card: { take: ['Fixture: opens any door.'], leave: leave('knock') },
        reveal: 'Fixture: kept a key for the wolf.',
      },
    },
  ],
  endings: {
    grandma: { title: 'Fixture: grandma', lines: ['Fixture: you made it.'] },
    wolf: { title: 'Fixture: wolf', lines: ['Fixture: the wolf knew you were coming.'] },
    late: { title: 'Fixture: late', lines: ['Fixture: you never made it.'] },
  },
  ui: {
    landing: {
      frameTitle: 'Fixture frame',
      title: 'Fixture title',
      titleHighlight: 'title',
      subtitle: 'Fixture subtitle.',
      start: 'Fixture start',
    },
    howTo: {
      title: 'Fixture how',
      steps: ['Fixture: walk.', 'Fixture: read.', 'Fixture: decide.'],
      go: 'Fixture go',
    },
    cabinet: { marquee: 'Fixture marquee' },
    world: {
      title: 'Fixture world',
      signs: {
        research: { caption: 'Fixture research sign', spoken: 'Fixture research sign, spoken' },
        'dead-end': { caption: 'Fixture dead-end sign' },
        logo: { caption: 'Fixture logo sign' },
      },
    },
    offer: {
      title: 'Fixture offer',
      take: 'Fixture take',
      leave: 'Fixture leave',
      walkOn: 'Fixture walk on',
    },
    card: {
      ifTake: 'Fixture if take',
      ifLeave: 'Fixture if leave',
    },
    hud: {
      time: 'Fixture time',
      basket: 'Fixture basket',
      twoMinutes: 'Fixture two',
      oneMinute: 'Fixture one',
      thirtySeconds: 'Fixture thirty',
      timeUp: 'Fixture up',
    },
    reveal: {
      title: 'Fixture reveal',
      titleHighlight: 'reveal',
      took: 'Fixture took',
      left: 'Fixture left',
      good: 'Fixture good',
      bad: 'Fixture bad',
      promised: 'Fixture promised',
      did: 'Fixture did',
      wouldHave: 'Fixture would have',
      giveaway: 'Fixture giveaway',
      realWorld: 'Fixture real world',
      score: 'Fixture score',
      outOf: 'Fixture of {outOf}',
      caught: 'Fixture caught {caught} of {bad}',
      frameTitle: 'Fixture frame',
      unanswered: 'Fixture unanswered',
      question: 'Fixture question?',
      cta: 'Fixture cta',
      again: 'Fixture again',
    },
    // Every chrome key, each saying which one it is: the schema is strict about all of them.
    chrome: Object.fromEntries(CHROME_KEYS.map((key) => [key, `Fixture ${key}`])) as Record<
      ChromeKey,
      string
    >,
    contact: {
      consentVersion: 'fixture-contact-v1',
      emailLabel: 'Fixture email label',
      emailHint: 'Fixture email hint',
      consent: 'Fixture consent',
      emailMissing: 'Fixture email missing',
      emailInvalid: 'Fixture email invalid',
      emailPersonal: 'Fixture email personal',
      consentMissing: 'Fixture consent missing',
      postNeeds: 'Fixture post needs',
      privacy: 'Fixture privacy',
    },
  },
};

/** A deep copy to mutate, typed loosely enough to break on purpose. */
export const variant = (): typeof raw => structuredClone(raw);
