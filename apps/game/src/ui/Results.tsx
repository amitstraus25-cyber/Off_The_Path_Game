import { useEffect, useRef, useState } from 'preact/hooks';
import { VERDICTS, exposedNotices, recap, score } from '@otp/core';
import type { Content, GameState, GoalResult, RecapRow, SkillId, Verdict } from '@otp/core';
import { RESEARCH_URL } from '../embed/postMessage';
import { CyeraMark, Highlighted, Panel } from './components';
import { Basket } from './SkillCard';

/*
 * THE RECAP BADGES WERE TYPED, AND TWO OF THE THREE WERE NOT IN THE FONT. Measured, not asserted:
 * `public/fonts/HafferUprightsVF.ttf` carries 789 codepoints, and U+2713 CHECK MARK and U+2296
 * CIRCLED MINUS are both outside them, while "!" is inside. So this column -- whose whole job is to
 * read as one vocabulary down the page -- rendered two of its three marks from whatever the next
 * family in the stack is, at that family's weight and on its baseline, beside one real Haffer
 * glyph. It is precisely the defect SkillCard.tsx describes over its verdict glyphs, which is why
 * those are drawn.
 *
 * Both are now drawn, on the handover the previous round left here: the two marks as SVG, and the
 * specs that used to read them asserting on `data-glyph` instead of `textContent`
 * (`e2e/trifecta.spec.ts`, `e2e/results-payoff.spec.ts`). `data-glyph` is on the badge for every
 * state including "!", so a spec never has to know which of the three is drawn and which is typed.
 *
 * "!" stays as text -- it is Haffer's own, and it is what both UI_FOUNDATIONS section 5 and the
 * board's Inspect disc show.
 *
 * The paths are copied from SkillCard.tsx rather than imported, deliberately and with a cost: the
 * errand row's comment below claims its mark is "the Restrict glyph from the verdict pills", and
 * before this it was a lookalike character on a different baseline. Now it is the same two shapes,
 * to the coordinate. SkillCard.tsx belongs to another owner this round, so exporting them from
 * there is the next person's one-line tidy, not a cross-task edit today.
 */
const CheckGlyph = () => (
  <svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true" focusable="false">
    <path
      d="M4 10.5l4 4 8-9"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

const TradedGlyph = () => (
  <svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true" focusable="false">
    <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2" />
    <path d="M6.5 10h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  </svg>
);

/** The badge, named by what it means. `data-glyph` is what the specs read; the mark is what a player sees. */
function Badge({ glyph }: { glyph: 'check' | 'traded' | 'missed' }) {
  return (
    <span class="otp-recap__badge" data-glyph={glyph} aria-hidden="true">
      {glyph === 'check' ? <CheckGlyph /> : glyph === 'traded' ? <TradedGlyph /> : '!'}
    </span>
  );
}

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

/** Every verdict actually given on a skill that could have granted what this errand needed. */
function playedFor(
  goal: GoalResult,
  verdicts: Readonly<Record<SkillId, Verdict>>,
  content: Content,
): { outcome: Content['skills'][number]['outcomes'][Verdict]; best: boolean }[] {
  return content.skills.flatMap((skill) => {
    if (!VERDICTS.some((v) => skill.outcomes[v].grants.includes(goal.needs))) return [];
    const given = verdicts[skill.id];
    return given === undefined
      ? []
      : [{ outcome: skill.outcomes[given], best: given === skill.bestVerdict }];
  });
}

export function errandState(
  goal: GoalResult,
  verdicts: Readonly<Record<SkillId, Verdict>>,
  content: Content,
): ErrandState {
  if (goal.met) return 'met';
  const chosen = playedFor(goal, verdicts, content);
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

/**
 * WHY A MISS NEEDS THREE SENTENCES AND HAD ONE.
 *
 * `errandState` already knows the difference between a trade and a miss, and the screen renders
 * both. What it did not do is say WHICH KIND of miss, so all three printed `errandNeeded` --
 * "Needed a skill that reaches into your basket" -- including the two where the player was holding
 * exactly that skill. On an allow/allow/allow run all three errand rows made that claim with the
 * route, the translator and the lantern sitting in the basket eight lines below them, on the one
 * screen whose argument is "read what the thing actually does". A screen that misreports the
 * player's own run is the same defect as findings 1, 13 and 15, and this is its fourth instance.
 *
 *  - `refused`: no verdict the player gave grants it. The capability is genuinely not in hand, and
 *    "needed a skill that..." is true. This is the only case the old copy was right about.
 *  - `unused`: granted, cleanly, and the errand was never run. Night Light allowed grants the
 *    listening with no flag; not walking to the notice is the player's omission on the walk.
 *  - `flagged`: granted, and something came with it. Cottage Finder allowed hands over the basket
 *    and takes the key, so the errand did not go undone for want of a capability -- it ran, and it
 *    ran for the wolf.
 *
 * Split out from `errandState` rather than folded into it so the badge, the Haze ground and the
 * three unit cases that pin them keep their three states: this is which sentence to print, not
 * which mark to draw. Nothing here touches a number the server recomputes.
 */
export type ErrandMiss = 'refused' | 'unused' | 'flagged';

export function errandMiss(
  goal: GoalResult,
  verdicts: Readonly<Record<SkillId, Verdict>>,
  content: Content,
): ErrandMiss {
  const granted = playedFor(goal, verdicts, content).filter((c) =>
    c.outcome.grants.includes(goal.needs),
  );
  if (granted.length === 0) return 'refused';
  return granted.some((c) => c.outcome.flagsSet.length === 0) ? 'unused' : 'flagged';
}

/**
 * How a SKILL row should read. Three states, for the same reason the errand rows have three.
 *
 * `recap()` reports two booleans and this screen used only one of them: `success`, which is
 * `points === maxPerSkill`. So every verdict that was not the best one drew the Black "!" disc and
 * the Haze ground that UI_FOUNDATIONS section 5 reserves for "Missed it" -- the mark that means the
 * hidden action ran. Measured on the shipped content, over all 27 verdict combinations x 4 notice
 * readings: the game has SIX lines that reach the ceiling, and two of them (Cottage Finder
 * restricted, Word Weaver rejected, Night Light ALLOWED, with the door note read) printed "Missed
 * it" on Night Light under a headline reading the full score. A screen that tells a player who
 * scored everything that they failed is the same defect as findings 1, 13 and 15, on the row the
 * section heading promises is about what was hiding.
 *
 * The third state is the one `recap()` already measures and nothing read: `compromised`, which is
 * "this verdict set a flag", which is "something was taken". That is what separates allowing the
 * compass (the key goes) from rejecting it (you walk without a map): both score below the maximum,
 * only one of them was taken from.
 *
 *  - `caught`   full marks. Check mark, Natural ground.
 *  - `costly`   below full marks and nothing taken. The circled minus and Natural ground, exactly
 *               as an errand given up on purpose -- it is the same claim, that the player paid for
 *               something rather than failed to notice it. The chip says `nothingTaken`, which is
 *               the mechanical truth in every case: there is no run on which a flagless verdict
 *               took something, so unlike a judgement about the verdict's quality it cannot go
 *               wrong on the tied-optimal line above.
 *  - `missed`   a flag was set. The "!" disc and the Haze ground, unchanged.
 *
 * `compromised` is read FIRST so the failure mark always wins. Content lint does not forbid a
 * maximum-scoring verdict that also sets a flag (it only forbids it on the declared best verdict),
 * and a row that both lost the key and wore a check mark would be the worst of the three.
 *
 * This lives in the component, beside `errandState`, for the reason that one states: it is the
 * component's question. `recap()` is unchanged, so no number the server recomputes moves
 * (CLAUDE.md golden rule 6) and `tools/sim` keeps reading the field it reads today.
 */
export type SkillState = 'caught' | 'costly' | 'missed';

export const skillState = (row: Pick<RecapRow, 'success' | 'compromised'>): SkillState =>
  row.compromised ? 'missed' : row.success ? 'caught' : 'costly';

/*
 * Each of the four lines reads "<prefix> <the capability's own label>.", which is the shape
 * `errandTradedDetail` already uses, so the capability is named in every state and only the claim
 * about it changes.
 *
 * `errandUnusedDetail` and `errandFlaggedDetail` are the two strings this needed from the content
 * file, and they landed in content/game.json while this was being written, so there is no code-side
 * literal behind either -- which is what `test/strings.test.ts` wants, and why PENDING stays empty.
 */

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
  /*
   * "for 1 of 3 of what Grandma asked" put two `of`s in the one sentence that explains the score,
   * and the second one governed nothing: the reader parses "3 of what Grandma asked" and finds no
   * noun. The count needs a thing to count, so it has one.
   */
  if (result.errandBonus > 0)
    parts.push(
      `${result.errandBonus} for ${met} of the ${result.goals.length} things Grandma asked for`,
    );
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

  /** The one sentence under an errand row, chosen by what actually happened to the capability. */
  const errandDetail = (errand: ErrandState, goal: GoalResult): string => {
    if (errand === 'traded') return s('errandTradedDetail');
    switch (errandMiss(goal, state.verdicts, content)) {
      case 'unused':
        return s('errandUnusedDetail');
      case 'flagged':
        return s('errandFlaggedDetail');
      default:
        return s('errandNeeded');
    }
  };

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
        {/*
          NO HEADER ASIDE. The mark used to sit here AND in the footer thirty lines down, so the
          payoff screen carried the Cyera wordmark twice -- two marks on the one screen whose job is
          to carry a single mark and a single Lime (UI_FOUNDATIONS section 8, which puts the mark in
          the footer under the sentence that names the research). The footer one is the one that
          means something, because it is attached to "The Off the Path research, by".
        */}
        <Panel number="05" title={s('resultsTitle')}>
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
              <Badge glyph={result.boundaryHeld ? 'check' : 'missed'} />
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
              {rows.map((row) => {
                const skill = skillState(row);
                return (
                  <li
                    key={row.skillId}
                    class={`otp-recap__row otp-recap__row--skill${skill === 'missed' ? ' otp-recap__row--missed' : ''}`}
                  >
                    <Badge
                      glyph={
                        skill === 'caught' ? 'check' : skill === 'costly' ? 'traded' : 'missed'
                      }
                    />
                    <div>
                      <p class="otp-recap__heading">
                        {row.skillName}{' '}
                        <span>you {s(VERDICT_WORD[row.verdict]).toLowerCase()} it</span>{' '}
                        {/* Status in words, never by glyph or colour alone. */}
                        <span class="otp-recap__status">
                          {skill === 'caught'
                            ? s('caughtIt')
                            : skill === 'costly'
                              ? s('nothingTaken')
                              : s('missedIt')}
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
                );
              })}
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
                  <Badge
                    glyph={errand === 'met' ? 'check' : errand === 'traded' ? 'traded' : 'missed'}
                  />
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
                        {errandDetail(errand, goal)}{' '}
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
              {/*
                AN <a> WITH AN href, NOT A <button> WITH A HANDLER. This is the asset's single
                conversion action and it did nothing in any build this repo could produce: the
                handler behind it is `() => emit('otp:cta', {})`, and `emit` returned early whenever
                the embed origin was unset -- which was every build, because `VITE_EMBED_ORIGIN` had
                exactly one occurrence repo-wide and that occurrence was the line that read it.

                So the destination is the element's own href now, resolved once in
                `src/embed/postMessage.ts` from `VITE_RESEARCH_URL` with a default written down
                beside it. That makes the press work standalone, work with no .env file at all, and
                work for a middle-click or a "copy link address" -- none of which a click handler
                can do. `onReadResearch` stays exactly as it was, as the side channel: the parent
                page still gets `otp:cta` when it is listening, and the navigation no longer depends
                on it.

                `target="_blank"` because embedded this would otherwise navigate the iframe and take
                the game off the page with it; `rel="noopener noreferrer"` because nothing here needs
                a handle on the opener, and the project ships no analytics that wants the referrer.
              */}
              {/*
                The one property that has to be here rather than in the stylesheet: `.otp-cta` was
                written for a <button>, so it sets no `text-decoration`, and the user-agent default
                underlines an <a> whatever its specificity. An underlined Lime pill is a brand break
                a screenshot review would catch, and `screens.css` has another owner this round, so
                this is the smallest correct place for it today. It is one line to lift into
                `.otp-cta` and delete from here.
              */}
              <a
                class="otp-cta"
                style={{ textDecoration: 'none' }}
                href={RESEARCH_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onReadResearch}
              >
                {s('cta')}
                <span class="otp-cta__disc" aria-hidden="true">
                  →
                </span>
              </a>
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
