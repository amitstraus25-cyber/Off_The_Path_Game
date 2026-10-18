import { useState } from 'preact/hooks';
import { exposedNotices, recap, score } from '@otp/core';
import type { Content, GameState, Verdict } from '@otp/core';
import { Highlighted, Panel } from './components';
import { Basket } from './SkillCard';

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

export interface ResultsProps {
  content: Content;
  state: GameState;
  onReplay(): void;
  onReadResearch(): void;
  /** Posting arrives with the leaderboard in Phase 6; until then this reports it is unavailable. */
  onPost(handle: string): Promise<string | null>;
}

/** "600 from your three verdicts · 100 for asking · 200 for keeping the boundary" */
function breakdown(result: ReturnType<typeof score>, content: Content): string {
  const verdictPoints = result.perSkill.reduce((sum, p) => sum + p.points, 0);
  const decided = result.perSkill.filter((p) => p.verdict !== null).length;
  const parts = [`${verdictPoints} from your ${decided === 1 ? 'verdict' : `${decided} verdicts`}`];
  if (result.bonus > 0) parts.push(`${result.bonus} for asking before you decided`);
  if (result.boundaryBonus > 0)
    parts.push(`${result.boundaryBonus} for never running all three at once`);
  const met = result.goals.filter((g) => g.met).length;
  if (result.errandBonus > 0)
    parts.push(`${result.errandBonus} for ${met} of ${result.goals.length} of what Grandma asked`);
  void content;
  return parts.join(' · ');
}

export function Results({ content, state, onReplay, onReadResearch, onPost }: ResultsProps) {
  const s = (key: string): string => content.strings[key] ?? '';
  const result = score(state.log, content);
  const rows = recap(state.log, content);
  const fired = exposedNotices(state.log, content);

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
        <Panel number="05" title={s('resultsTitle')}>
          <div class="otp-screen__body">
            <div class="otp-hero">
              <div>
                <p class="otp-section-label">{s('scoreLabel')}</p>
                {/* The score is the subject of this page, so it is the page's one h1. */}
                <h1 class="otp-hero__score">
                  {result.total.toLocaleString('en')}
                  <small>{s('scoreOutOf')}</small>
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
                <p class="otp-recap__heading">
                  {result.boundaryHeld ? s('boundaryHeld') : s('boundaryBroken')}{' '}
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
                      <span>you {s(VERDICT_WORD[row.verdict]).toLowerCase()} it</span>
                      {/* Status in words, never by glyph or colour alone. */}
                      <span class="otp-recap__status">
                        {row.success ? s('caughtIt') : s('missedIt')}
                      </span>
                    </p>
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
            {result.goals.map((goal) => (
              <div
                key={goal.id}
                class={`otp-recap__row otp-recap__row--errand${goal.met ? '' : ' otp-recap__row--missed'}`}
              >
                <span class="otp-recap__badge" aria-hidden="true">
                  {goal.met ? '✓' : '!'}
                </span>
                <div>
                  <p class="otp-recap__heading">
                    {goal.label}{' '}
                    <span>
                      {goal.met
                        ? `+${goal.points}`
                        : `needed ${content.capabilities[goal.needs]?.label.toLowerCase() ?? goal.needs}`}
                    </span>
                  </p>
                </div>
              </div>
            ))}

            {/* The Basket component carries its own label. */}
            <Basket basket={state.basket} items={content.items} />

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

            {/* The screen's one Lime lives on this button. */}
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

            <div class="otp-actions">
              <button type="button" class="otp-button otp-button--quiet" onClick={onReplay}>
                {s('replay')}
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
