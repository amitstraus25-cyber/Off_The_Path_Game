import content from '../../../../content/game.v2.json';

/*
 * THE WORDS THE SCREENS SAY THAT ARE NOT A SCREEN'S OWN COPY. Neither source is a component
 * (CLAUDE.md rule 3):
 *
 *  - `strings` is `ui.chrome` of content/game.v2.json: the reviewed copy for the chrome the rules
 *    do not touch -- the touch pad, the music switch, the two problem screens, the post form, the
 *    board and the forest's summary for a screen reader. Read raw rather than through
 *    `v2.loadContent`, the same way main.ts reads it for the problem screen, so a content file that
 *    fails to load can still say so. Core's schema holds the file, and test/strings.test.ts names
 *    every key the UI reads.
 *
 *  - `PENDING` is the handful of words v2 introduced and no content key carries yet. Every one is
 *    a plain label, and they are listed here, in one place, for the human copy read and a move into
 *    `ui` when the copy is settled.
 */
export const strings: Readonly<Record<string, string>> = content.ui.chrome;

export const PENDING = {
  /** The how-to's one button: it starts the clock. */
  howToGo: 'Start walking',
  /** The landing's background slot, until the client's image arrives (GAME_DESIGN_V2 section 8). */
  /** The offer: open the card, and the two answers. */
  openCard: 'Open the card',
  take: 'Take it',
  leave: 'Leave it',
  /** The card's two section eyebrows. */
  cardTake: 'If you take it',
  cardLeave: 'If you leave it',
  /** The offer's way out without answering. */
  walkOn: 'Walk on',
  /** The card's way back to the conversation. */
  back: 'Go back',
  /** The reveal's row eyebrow when the player never answered. */
  unanswered: 'You walked past',
  /** Posting, when the server did not start this run. */
  postUnavailable: 'Posting is unavailable for this run.',
  /** Posting, after a late run, which the server refuses by rule. */
  postLate: 'A run that ends after dark is not posted.',
  /** The reveal's "out of 100". */
  outOf: 'out of 100',
  /** The offer panel's frame title. */
  offerTitle: 'Offer',
  /** The card panel's frame title. */
  cardTitle: 'Card',
  /** The forest's frame title. */
  exploreTitle: 'Explore',
  /** The reveal's frame title. */
  revealTitle: 'Reveal',
} as const;
