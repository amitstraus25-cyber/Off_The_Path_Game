import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * A STATIC INLINE STYLE IS THE ONE PLACE THE BRAND RULES CANNOT REACH.
 *
 * `docs/BRAND_AND_UI.md` is binding and `reference/brand/cyera-theme.css` holds the tokens, and
 * every reviewer who has ever checked a colour against them has checked a stylesheet. A value
 * written as `style={{ ... }}` in the JSX is not in a stylesheet: it is not in the cascade, no
 * token can reach it, a `brand-reviewer` pass over the CSS will not see it, and the usual way it
 * gets noticed is a client screenshot.
 *
 * Three of them shipped. The Results review found all three and could lift none, because
 * `screens.css` had a different owner that round and two owners never share a file -- so the
 * round closed with a docstring in `Results.tsx` explaining precisely which one line to move and
 * where, which is exactly the right thing to leave behind and is also how a defect survives a
 * review that found it. They are lifted now: `.otp-cta` carries its own `text-decoration`,
 * `.otp-recap__body` carries the flex pair, `.otp-handle` carries the rest.
 *
 * WHAT THIS BANS, AND WHAT IT DOES NOT. Only STATIC styles -- every value a quoted string or a
 * number -- which are the ones that belong in a stylesheet and can always be moved to one. A
 * computed style is left alone, because `backgroundImage: url("<portrait>.png")` genuinely cannot
 * live in CSS: the portrait is chosen at runtime, `assetUrl()` resolves the hashed build path, and
 * the alternative is one class per character generated at build time. Two of those are in
 * `Dialogue.tsx` and `Cottage.tsx` and both are correct.
 *
 * This is a SOURCE guard, for the same reason `test/handle-field.test.ts` is one: apps/game's
 * vitest runs on the `node` environment with no DOM, so there is nothing here to mount Preact
 * into. It is also the right shape regardless -- the defect is a property of what is written, not
 * of what renders, and a rendered check would pass happily on a hard-coded hex that matched.
 *
 * NOTE ON CSP, because it looks like this file's business and is not. The policy is
 * `style-src 'self'` with no `'unsafe-inline'`, which blocks a `style` ATTRIBUTE parsed from
 * markup. Preact sets a style object through the CSSOM (`dom.style.setProperty`), which CSP does
 * not govern, so none of these were ever blocked and removing them fixes no policy hole. The
 * argument here is brand reach, not security; `test/csp.test.ts` owns the policy.
 */

const UI = fileURLToPath(new URL('../src/ui', import.meta.url));

/** Every value a string literal or a number -- so there is nothing runtime about it. */
const LITERAL = /^[A-Za-z-]+\s*:\s*('[^']*'|"[^"]*"|-?\d+(?:\.\d+)?)$/;

/**
 * The `style={{ ... }}` blocks in a file, as their inner text.
 *
 * Brace-counted rather than regex-matched to the closing `}}`: a lazy `[\s\S]*?\}\}` stops at the
 * first `}}` in the file, which for a template literal like `url("${x}")` is the one closing the
 * interpolation -- so the richest values, the ones most likely to be dynamic, would be truncated
 * into something that looks static. That is the wrong way for this guard to fail.
 */
function inlineStyles(code: string): string[] {
  const found: string[] = [];
  const open = /style=\{\{/g;
  let m: RegExpExecArray | null;
  while ((m = open.exec(code)) !== null) {
    let depth = 2;
    let i = m.index + m[0].length;
    const from = i;
    while (i < code.length && depth > 0) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') depth--;
      i++;
    }
    if (depth === 0) found.push(code.slice(from, i - 2));
  }
  return found;
}

/** Top-level commas only, so a value containing one does not split its own pair. */
function pairs(inner: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of inner) {
    if ('{[('.includes(ch)) depth++;
    else if ('}])'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      out.push(current);
      current = '';
    } else current += ch;
  }
  out.push(current);
  return out.map((p) => p.trim()).filter(Boolean);
}

const files = readdirSync(UI)
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => [f, readFileSync(`${UI}/${f}`, 'utf8')] as const);

describe('the brand rules can reach every static style', () => {
  it('reads the files it thinks it does', () => {
    // A guard that silently stops matching is worse than no guard: this project has shipped one.
    expect(
      files.length,
      'no .tsx found under src/ui -- this guard is watching nothing',
    ).toBeGreaterThan(3);
    expect(
      files.some(([, code]) => code.includes('style={{')),
      'no style={{ anywhere, so the brace scanner is unexercised -- if the last computed style has gone, delete this guard rather than leaving it green',
    ).toBe(true);
  });

  for (const [name, code] of files) {
    it(`${name} keeps its static styles in the stylesheet`, () => {
      for (const inner of inlineStyles(code)) {
        const parts = pairs(inner);
        const isStatic = parts.length > 0 && parts.every((p) => LITERAL.test(p));
        expect(
          isStatic,
          `${name} has a static inline style: { ${inner.trim()} }. No token reaches it and no ` +
            'brand review of the CSS will see it -- give it a class in panels.css or screens.css. ' +
            'A computed value (a template literal, a ternary, anything resolved at runtime) is ' +
            'fine here and this guard allows it.',
        ).toBe(false);
      }
    });
  }
});
