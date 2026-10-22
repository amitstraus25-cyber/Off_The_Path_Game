import content from '../../../../content/game.v2.json';

/*
 * THE WORDS THE SCREENS SAY THAT ARE NOT A SCREEN'S OWN COPY (CLAUDE.md rule 3).
 *
 * `strings` is `ui.chrome` of content/game.v2.json: the reviewed copy for the chrome the rules do
 * not touch -- the touch pad, the music switch, the two problem screens, the post form, the board
 * and the forest's summary for a screen reader. Read raw rather than through `v2.loadContent`, the
 * same way main.ts reads it for the problem screen, so a content file that fails to load can still
 * say so. Core's schema names every key (`v2.CHROME_KEYS`, strict), and test/strings.test.ts names
 * every key the UI reads.
 *
 * There used to be a pending list here too: the handful of words v2 introduced before any content
 * key carried them. They are all in `ui` now (`howTo.go`, `world`, `offer`, `card`, `reveal`,
 * `chrome.postUnavailable` / `postLate`), schema-validated like the rest, and the list is gone so
 * nothing can be added to it again.
 */
export const strings: Readonly<Record<string, string>> = content.ui.chrome;

/** The marquee's words, raw for the same reason: the cabinet is up before the content is checked. */
export const marqueeText: string = content.ui.cabinet.marquee;

/**
 * Fills a content template's `{holes}`. Every hole a screen fills is held to being in the line by
 * the schema (`template` in packages/core/src/v2/content.ts), so a hole that is missing here is a
 * content file the game would not have started with.
 */
export function fill(line: string, values: Readonly<Record<string, string | number>>): string {
  return line.replace(/\{([A-Za-z]+)\}/g, (hole, name: string) =>
    name in values ? String(values[name]) : hole,
  );
}
