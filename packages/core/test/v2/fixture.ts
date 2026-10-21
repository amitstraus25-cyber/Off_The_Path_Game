/*
 * A MINIMAL v2 content set, for driving the rules and nothing else.
 *
 * It is deliberately not the game. The real six or seven skills are Phase B and need copy
 * judgment; every line of text here says "fixture" so nobody mistakes it for player copy, and the
 * names are chosen to be unlike anything v1 or the spec's sketch uses.
 *
 * Three skills, one of each shape GAME_DESIGN_V2 section 5 asks the mix to contain:
 *
 *   lantern     safe in full     take  600, no wolf   limit 300, no wolf     best: take   (600)
 *   courier     safe if limited  take  450, WOLF      limit 400, no wolf     best: limit  (400)
 *   locksmith   dangerous        take  100, WOLF      limit  50, WOLF        best: leave  (0)
 *
 * With `wolfCost` 500 the worth of each verdict is points, minus 500 if it served the wolf, and
 * leaving is always worth 0. So the arithmetic every suite below leans on is:
 *
 *   careful (best each)   600 + 400 + 0                  = 1000   the ceiling, = outOf
 *   greedy  (take all)    600 + (450-500) + (100-500)    =  150   near zero, and the wolf ending
 *   limit everything      300 + 400 + (50-500)           =  250
 *   leave everything      0                              =    0
 *
 * Those numbers are written here for the reader. The tests do not trust this comment: each one is
 * recomputed from the data in the suite that asserts it (trap 1).
 */
export const raw = {
  rules: 2,
  version: 'fixture-1',
  status: 'test fixture, not player copy',
  scoring: { outOf: 1000, wolfCost: 500 },
  characters: [
    {
      id: 'glowworm',
      name: 'Fixture Glowworm',
      spawn: 'spawn-glowworm',
      skillId: 'lantern',
      greet: 'Fixture greeting one.',
    },
    {
      id: 'magpie',
      name: 'Fixture Magpie',
      spawn: 'spawn-magpie',
      skillId: 'courier',
      greet: 'Fixture greeting two.',
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
      promise: 'Fixture promise: lights the path.',
      card: {
        take: 'Fixture card: lights every path.',
        limit: 'Fixture card: lights this path only.',
        leave: 'Fixture card: walk in the dark.',
      },
      inspectMs: 8000,
      did: {
        take: { line: 'Fixture: lit the whole way.', points: 600 },
        limit: { line: 'Fixture: lit part of the way.', points: 300 },
      },
    },
    {
      id: 'courier',
      name: 'Fixture Courier',
      icon: 'item-letter',
      promise: 'Fixture promise: sends word ahead.',
      card: {
        take: 'Fixture card: sends word to anyone.',
        limit: 'Fixture card: sends word to the cottage only.',
        leave: 'Fixture card: arrive unannounced.',
      },
      inspectMs: 10000,
      did: {
        take: {
          line: 'Fixture: sent word ahead.',
          points: 450,
          wolf: 'Fixture: and the wolf read it.',
        },
        limit: { line: 'Fixture: sent word to the cottage.', points: 400 },
      },
    },
    {
      id: 'locksmith',
      name: 'Fixture Locksmith',
      icon: 'item-key',
      promise: 'Fixture promise: opens the door.',
      card: {
        take: 'Fixture card: copies every key.',
        limit: 'Fixture card: copies the door key.',
        leave: 'Fixture card: knock and wait.',
      },
      inspectMs: 12000,
      did: {
        take: {
          line: 'Fixture: opened the door.',
          points: 100,
          wolf: 'Fixture: and kept a copy for the wolf.',
        },
        limit: {
          line: 'Fixture: opened the door.',
          points: 50,
          wolf: 'Fixture: and the copy still went to the wolf.',
        },
      },
    },
  ],
  endings: {
    grandma: { title: 'Fixture: grandma', lines: ['Fixture: you made it.'] },
    wolf: { title: 'Fixture: wolf', lines: ['Fixture: the wolf knew you were coming.'] },
    late: { title: 'Fixture: late', lines: ['Fixture: you never made it.'] },
  },
  strings: {},
};

/** A deep copy to mutate, typed loosely enough to break on purpose. */
export const variant = (): typeof raw => structuredClone(raw);
