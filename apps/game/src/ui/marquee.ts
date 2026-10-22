/**
 * The cabinet's marquee: the supplied Cyera logo, white on dark as it ships, beside the game's
 * name, across the top of every screen (the client's decision, 2026-10-22).
 *
 * Plain DOM, mounted by main.ts at module load, BEFORE the content is validated, for the same
 * reason the problem screen is: the cabinet is furniture and must be standing when a screen has to
 * say that something broke. Its words come raw from content/game.v2.json (`ui.cabinet.marquee`).
 *
 * The logo file is `reference/brand/logos/cyera-logo-white.svg`, served from `public/brand` as-is:
 * height is the only thing screens.css sets on it, never colour, proportion or form.
 *
 * `aria-hidden`, because it is signage. The screen under it carries its own heading -- the title
 * card's h1 is the same name -- and a reader who meets "Cyera, Off the Path" before every screen's
 * real heading is reading the furniture.
 */
export function mountMarquee(parent: HTMLElement, words: string): HTMLElement {
  const marquee = document.createElement('div');
  marquee.className = 'otp-marquee';
  marquee.setAttribute('aria-hidden', 'true');
  const logo = document.createElement('img');
  logo.className = 'otp-marquee__logo';
  logo.src = '/brand/cyera-logo-white.svg';
  logo.alt = '';
  const name = document.createElement('span');
  name.className = 'otp-marquee__name';
  name.textContent = words;
  marquee.append(logo, name);
  parent.prepend(marquee);
  return marquee;
}
