import { useEffect, useRef, useState } from 'preact/hooks';
import { VERDICTS, exposedNotices, recap, score } from '@otp/core';
import type { Content, GameState, GoalResult, SkillId, Verdict } from '@otp/core';
import { CyeraMark, Highlighted, Panel } from './components';
import { Basket } from './SkillCard';

/*
 * THE RECAP BADGES ARE TYPED, AND TWO OF THE THREE ARE NOT IN THE FONT. Measured, not asserted:
 * `public/fonts/HafferUprightsVF.ttf` carries 789 codepoints, and U+2713 CHECK MARK and U+2296
 * CIRCLED MINUS are both outside them, while "!" is inside. So this column -- whose whole job is to
 * read as one vocabulary down the page -- renders two of its three marks from whatever the next
 * family in the stack is, at that family's weight and on its baseline, beside one real Haffer
 * glyph. It is precisely the defect SkillCard.tsx describes over its verdict glyphs, which is why
 * those are drawn; and the "⊖" here is a LOOKALIKE of the Restrict pill's mark, not the same path,
 * although the comment on the errand row below says it takes "the Restrict glyph from the verdict
 * pills".
 *
 * I drew both and reverted it, which is why this note is here instead of the fix. Two end-to-end
 * specs read these badges as text and pin the characters --
 * `e2e/trifecta.spec.ts:247` expects `['✓', '⊖', '⊖']` and `e2e/results-payoff.spec.ts:179` counts
 * `r.badge === '⊖'` -- so drawing the marks turns every badge's textContent into "" and takes the
 * suite red. Neither spec is this round's file, and the glyph assertion in the second one is
 * load-bearing for finding 15, so it wants its owner rather than a drive-by edit. Results carries
 * no board frame, so this was craft work beyond the brief and not worth a red build.
 *
 * The handover, so nobody has to re-derive it: draw the two marks, and change the specs to assert
 * on a `data-glyph` attribute (or on the drawn path) instead of textContent. "!" stays as text --
 * it is Haffer's own and it is what both UI_FOUNDATIONS section 5 and the board's Inspect disc
 * show.
 */

/** Matches the server rule in ARCHITECTURE section 8, so a handle never fails only on the server. */
const HANDLE = /^[A-Za-z0-9][A-Za-z0-9_.-]{1,14}[A-Za-z0-9]$/;
const BLOCKED = ['cyera', 'admin', 'official', 'moderator', 'support'];

export function validateHandle(raw: string): string | null {
  const handle = raw.trim();
  if (handle.length < 3 || handle.length > 16) return 'Use between 3 and 16 characters.';
  if (!HANDLE.test(handle))
    return 'Letters, numbers, dot, dash or underscore, starting and ending with a letter or number.';
  if (BLOCKED.some((word) => handle.toLowerCase().includes(word)))
    return 'Please pick a different handle.';
  return null;
}

const VERDICT_WORD: Record<Verdict, string> = {
  allow: 'verdictAllowed',
  restrict: 'verdictRestricted',
  reject: 'verdictRejected',
};

/**
 * How an errand row should read. Three states, not two.
 *
 * Two of Grandma's three errands need a capability that the best verdict withholds: "Leave word at
 * the post" needs the Word Weaver's sending, whose best verdict is Reject, and "Read the note she
 * pinned to her door" needs Night Light left listening to strangers, whose best verdict is Restrict.
 * A player who gets all three skills right therefore arrives with one errand done and two given up
 * -- and the screen marked both of those with the Haze ground and the Black "!" disc that
 * UI_FOUNDATIONS section 5 reserves for "Missed it". The one run that understands the lesson was
 * told twice that it had failed, on the screen that carries the argument (docs/UX_REVIEW.md 15).
 *
 * `recap()` is right about the skills themselves -- content lint pins the best verdict to
 * `maxPerSkill`, so a correct Reject already scores full marks and renders as "Caught it" -- so
 * this is a view question about the errand rows, not a scoring one, and nothing here changes a
 * number the server recomputes.
 */
export type ErrandState = 'met' | 'traded' | 'missed';

export function errandState(
  goal: GoalResult,
  verdicts: Readonly<Record<SkillId, Verdict>>,
  content: Content,
): ErrandState {
  if (goal.met) return 'met';
  // Every verdict actually given on a skill that could have granted what this errand needed.
  const chosen = content.skills.flatMap((skill) => {
    if (!VERDICTS.some((v) => skill.outcomes[v].grants.includes(goal.needs))) return [];
    const given = verdicts[skill.id];
    return given === undefined
      ? []
      : [{ outcome: skill.outcomes[given], best: given === skill.bestVerdict }];
  });
  /*
   * The capability was handed over cleanly and the errand still went undone, so what was missing
   * was the walk, not the verdict: holding the Word Weaver on Restrict and never going to the post
   * is a miss, and saying "traded for the boundary" there would be the same kind of lie as finding
   * 1. A grant that comes with a flag is not clean -- that errand was run for the wolf.
   */
  if (chosen.some((c) => c.outcome.grants.includes(goal.needs) && c.outcome.flagsSet.length === 0))
    return 'missed';
  // Given up because every skill that could have granted it was played the way the game says is
  // right. Refusing Cottage Finder outright loses the same errand for nothing, and stays a miss.
  return chosen.length > 0 && chosen.every((c) => c.best) ? 'traded' : 'missed';
}

export interface ResultsProps {
  content: Content;
  state: GameState;
  onReplay(): void;
  onReadResearch(): void;
  /** Posting arrives with the leaderboard in Phase 6; until then this reports it is unavailable. */
  onPost(handle: string): Promise<string | null>;
}

/**
 * "600 from your three verdicts · 100 for asking · 200 for never running all three at once"
 *
 * Every bonus `score()` adds into `total` must have a clause here, or the parts do not sum to the
 * headline and the screen that carries the argument is wrong about the player's own run -- the
 * same failure as finding 1, in arithmetic. `trustBonus` had no clause, so a clean
 * take-one-on-trust run showed parts totalling 800 under a headline of 900 (UX_REVIEW finding 13).
 * `trustBreakdown` is the copy that was written for it, and it IS wired -- sixteen lines below, in
 * the `result.trustBonus > 0` clause. This sentence used to end "and never wired", which was true
 * when the copy was first written and false from the moment the clause landed; it survived a round
 * and was repeated in `test/strings.test.ts`'s docstring, which has since corrected itself.
 *
 * Exported for `test/results.test.ts`, which adds the clauses up and holds them against
 * `score().total` on every run shape, so the next bonus cannot be added without one.
 */
export function breakdown(result: ReturnType<typeof score>, content: Content): string {
  const verdictPoints = result.perSkill.reduce((sum, p) => sum + p.points, 0);
  const decided = result.perSkill.filter((p) => p.verdict !== null).length;
  const parts = [`${verdictPoints} from your ${decided === 1 ? 'verdict' : `${decided} verdicts`}`];
  if (result.bonus > 0) parts.push(`${result.bonus} for asking before you decided`);
  if (result.boundaryBonus > 0)
    parts.push(`${result.boundaryBonus} for never running all three at once`);
  const met = result.goals.filter((g) => g.met).length;
  if (result.errandBonus > 0)
    parts.push(`${result.errandBonus} for ${met} of ${result.goals.length} of what Grandma asked`);
  if (result.trustBonus > 0)
    parts.push(`${result.trustBonus} ${content.strings['trustBreakdown'] ?? ''}`.trim());
  return parts.join(' · ');
}

export function Results({ content, state, onReplay, onReadResearch, onPost }: ResultsProps) {
  const s = (key: string): string => content.strings[key] ?? '';
  const result = score(state.log, content);
  const rows = recap(state.log, content);
  const fired = exposedNotices(state.log, content);

  /*
   * Results is the only long panel that skipped the project's own fix for this. `Dialogue`,
   * `SkillCard` and `Notice` all focus their body on mount; Results did not, so on arrival
   * `activeElement` was BODY -- and because `.otp-screen` is a `position: fixed` scroller, the
   * document itself has zero overflow, which left PageDown, End, Space and the arrows all no-ops
   * over a panel 1,680px long in an 860px viewport. The keyboard could reach the call to action by
   * tabbing and no other way (docs/UX_REVIEW.md 9).
   *
   * No focus trap here: Results is a whole screen, not a modal, and there is nothing behind it to
   * tab into. `preventScroll` because the body starts at the top of its own scroller and a focus
   * jump would be the player's first frame of the screen.
   */
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    body.current?.focus({ preventScroll: true });
  }, []);

  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const submit = async (e: Event): Promise<void> => {
    e.preventDefault();
    const problem = validateHandle(handle);
    setError(problem);
    setNotice(null);
    if (problem) return;
    setPosting(true);
    setNotice(await onPost(handle.trim()));
    setPosting(false);
  };

  return (
    <div class="otp-screen">
      <div class="otp-screen__inner">
        <Panel number="05" title={s('resultsTitle')} aside={<CyeraMark />}>
          <div class="otp-screen__body" ref={body} tabIndex={-1} data-autofocus>
            <div class="otp-hero">
              <div>
                <p class="otp-section-label">{s('scoreLabel')}</p>
                {/* The score is the subject of this page, so it is the page's one h1. */}
                {/*
                  The explicit space is load-bearing: JSX drops whitespace that spans a line
                  break, so the number and the <small> ran together and the page's one h1
                  announced as "900out of 1,000" (docs/UX_REVIEW.md 21). It is a space, not copy.
                */}
                <h1 class="otp-hero__score">
                  {result.total.toLocaleString('en')} <small>{s('scoreOutOf')}</small>
                </h1>
                {/* Say where the points came from, in words, as the deck does. */}
                <p class="otp-hero__breakdown">{breakdown(result, content)}</p>
              </div>
            </div>

            {/* The boundary is the headline result, above the per-skill rows. */}
            <h2 class="otp-section-label">{s('trifectaLabel')}</h2>
            <div
              class={`otp-recap__row otp-recap__row--boundary${result.boundaryHeld ? '' : ' otp-recap__row--missed'}`}
            >
              <span class="otp-recap__badge" aria-hidden="true">
                {result.boundaryHeld ? '✓' : '!'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/*
                  Three states, not two. `boundaryHeld` is `!trifectaLive` and says nothing about
                  notices, so choosing between two strings on it alone asserted "a notice on a post
                  did the rest" for every run that let all three run -- including the runs where no
                  notice was ever read, which then rendered that claim above an empty explanation,
                  because the paragraphs below are a map over `fired`. An asset about checking what
                  systems really do cannot misreport the player's own run on the screen that carries
                  its argument (docs/UX_REVIEW.md blocker 1).
                */}
                <p class="otp-recap__heading">
                  {result.boundaryHeld
                    ? s('boundaryHeld')
                    : fired.length > 0
                      ? s('boundaryBroken')
                      : s('boundaryOpen')}{' '}
                  <span>{result.boundaryBonus > 0 ? `+${result.boundaryBonus}` : 'no bonus'}</span>
                </p>
                {fired.map((notice) => (
                  <p class="otp-recap__detail" key={notice.id}>
                    {notice.whenExposed?.recap}
                  </p>
                ))}
              </div>
            </div>

            <h2 class="otp-section-label">
              <Highlighted text={s('recapHeading')} word={s('recapHeadingHighlight')} />
            </h2>
            <ul class="otp-recap">
              {rows.map((row) => (
                <li
                  key={row.skillId}
                  class={`otp-recap__row otp-recap__row--skill${row.success ? '' : ' otp-recap__row--missed'}`}
                >
                  <span class="otp-recap__badge" aria-hidden="true">
                    {row.success ? '✓' : '!'}
                  </span>
                  <div>
                    <p class="otp-recap__heading">
                      {row.skillName}{' '}
                      <span>you {s(VERDICT_WORD[row.verdict]).toLowerCase()} it</span>{' '}
                      {/* Status in words, never by glyph or colour alone. */}
                      <span class="otp-recap__status">
                        {row.success ? s('caughtIt') : s('missedIt')}
                      </span>
                    </p>
                    {/*
                      The payoff for a gamble that did not come off, and the only place the game
                      says anything about it. The fine print below is shown either way, so a
                      player who never opened the card reads here what was in it.
                    */}
                    {row.onTrust && <p class="otp-recap__trust">{s('cardNotOpened')}</p>}
                    <p class="otp-recap__detail">{row.recap}</p>
                    {/*
                      The section is headed "What was hiding" and never showed it: outcomes.ts
                      computes hiddenAction for every row and this screen discarded it. The fine
                      print is the one piece of text the whole game teaches you to find.
                    */}
                    {row.hiddenAction && (
                      <p class="otp-recap__hidden">
                        <span class="otp-recap__hidden-title">{row.hiddenAction.title}</span>
                        {row.hiddenAction.detail}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {/*
              One row per goal rather than a single errand verdict. A careful run carries out one
              of the three on purpose -- the other two need capabilities it refused -- so a lone
              "errand failed" line read as a mistake when it was the trade the game is about.
            */}
            <p class="otp-section-label">{s('errandHeading')}</p>
            {result.goals.map((goal) => {
              const errand = errandState(goal, state.verdicts, content);
              return (
                <div
                  key={goal.id}
                  class={`otp-recap__row otp-recap__row--errand${errand === 'missed' ? ' otp-recap__row--missed' : ''}`}
                >
                  {/*
                    A goal forgone to keep the boundary takes the Restrict glyph from the verdict
                    pills -- the one mark in this product's vocabulary that means "withheld on
                    purpose" -- on the Natural ground, not Haze. The "!" disc stays for a goal
                    genuinely dropped.
                  */}
                  <span class="otp-recap__badge" aria-hidden="true">
                    {errand === 'met' ? '✓' : errand === 'traded' ? '⊖' : '!'}
                  </span>
                  <div>
                    <p class="otp-recap__heading">
                      {goal.label}{' '}
                      <span>
                        {errand === 'met'
                          ? `+${goal.points}`
                          : errand === 'traded'
                            ? s('errandTraded')
                            : 'not met'}
                      </span>
                    </p>
                    {/*
                      On its own line, and as a sentence. Gluing "needed" to a capability label built
                      "Find the cottage before dark needed reaches into your basket" -- a run-on at
                      every width, because the labels are verb phrases ("Reaches into your basket").
                    */}
                    {errand !== 'met' && (
                      <p class="otp-recap__detail">
                        {errand === 'traded' ? s('errandTradedDetail') : s('errandNeeded')}{' '}
                        {content.capabilities[goal.needs]?.label.toLowerCase() ?? goal.needs}.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* The Basket component carries its own label. */}
            <Basket basket={state.basket} items={content.items} />

            {/*
              The screen's one Lime lives on this button, and it comes before the score form.
              "Who wrote the instructions your agent follows?" is the sentence this whole asset
              exists to ask, and it sat below a form that cannot work until the Phase 6 API exists
              and says so when you press it -- 1,412px down a panel in an 860px viewport, past the
              only dead control on the screen. Band first, so the first thing the keyboard reaches
              and the first thing a scroll finds is the question (docs/UX_REVIEW.md 9).
            */}
            <div class="otp-band">
              <p class="otp-band__question">
                <Highlighted text={s('ctaPrompt')} word="agent" />
              </p>
              <button type="button" class="otp-cta" onClick={onReadResearch}>
                {s('cta')}
                <span class="otp-cta__disc" aria-hidden="true">
                  →
                </span>
              </button>
            </div>

            <p class="otp-section-label">{s('postHeading')}</p>
            <form class="otp-post" onSubmit={submit} noValidate>
              <label class="otp-field" aria-label={s('handleLabel')}>
                <input
                  type="text"
                  class="otp-field"
                  style={{ all: 'unset', width: '100%' }}
                  value={handle}
                  placeholder={s('handlePlaceholder')}
                  maxLength={16}
                  aria-invalid={error !== null}
                  aria-describedby="otp-handle-hint"
                  onInput={(e) => setHandle((e.target as HTMLInputElement).value)}
                />
              </label>
              <button type="submit" class="otp-button" disabled={posting}>
                {s('post')}
              </button>
            </form>
            <p class="otp-fine" id="otp-handle-hint">
              {s('handleHint')} {s('privacyLine')}
            </p>
            {error && (
              <p class="otp-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p class="otp-error" role="status">
                {notice}
              </p>
            )}

            <div class="otp-actions">
              <button type="button" class="otp-button otp-button--quiet" onClick={onReplay}>
                {s('replay')}
              </button>
            </div>

            {/*
              docs/UI_FOUNDATIONS.md section 8 puts this footer under 06 Leaderboard, whose rows
              are Black -- hence "white Cyera logo" there. That screen does not exist yet, and
              Results is where a run actually ends, so it lives here for now. Results' body is
              Shell, so the mark is the black one: a white mark would be invisible on it.
            */}
            <p class="otp-foot">
              {s('researchFooter')}
              <CyeraMark on="light" />
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
