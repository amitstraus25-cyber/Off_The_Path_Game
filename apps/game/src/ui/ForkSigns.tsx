import { useEffect, useRef } from 'preact/hooks';
import type { v2 } from '@otp/core';
import { signFor } from '../world/forks';
import type { Fork } from '../world/forks';
import type { Vec } from '../world/logic';
import { iconUrl } from './Hud';

/*
 * THE WAY TELLER'S LABELS (the client, 2026-10-22): "at each fork, a small sign shows who lives that
 * way (the unmet character's face icon and an arrow; text labels only in DOM, never on canvas)".
 *
 * The board is the canvas's (`prop-forksign`, forest-scene.ts); who and which way is this: one chip
 * per heading that still has somebody unmet down it, standing on top of the board and following it
 * as the camera moves. A chip is the character's own figure (frame 0 of their sheet, at one CSS pixel
 * per art pixel), their name, and an arrow drawn by CSS -- a shape, no glyph and no invented icon.
 * Who it names is world/forks.ts `signFor`: the nearest unmet character down that heading, never the
 * cottage, so it changes as people are met and goes blank when everyone has been.
 *
 * TO A SCREEN READER it is nothing: positions on a picture are not a thing to tab through, and the
 * perk's own line ("Signs at each fork now show who lives that way.") has already been said once,
 * politely, by the toast. The whole layer is `aria-hidden`.
 *
 * Positioned by a frame loop that writes one `transform` per board, and only when it moved, so the
 * camera's motion costs no render of this tree. The layer clips to the world's box, so a board that
 * has scrolled off the canvas takes its chips with it.
 */

/** What the labels need of the scene: the forks, where each board stands, and the camera. */
export interface SignBoards {
  readonly forks: readonly Fork[];
  boardTop(name: string): Vec | null;
  toCanvas(world: Vec): Vec | null;
  readonly canvasWidth: number;
}

export interface ForkSignsProps {
  boards: SignBoards;
  met: readonly string[];
  content: v2.Content;
}

export function ForkSigns({ boards, met, content }: ForkSignsProps) {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const shown = new Map<string, string>();
    const step = (): void => {
      frame = requestAnimationFrame(step);
      const box = layer.current;
      if (!box) return;
      // CSS pixels per game pixel: the world's box is the canvas's box (ui/stage.ts).
      const zoom = boards.canvasWidth > 0 ? box.clientWidth / boards.canvasWidth : 0;
      for (const el of Array.from(box.children) as HTMLElement[]) {
        const name = el.dataset['fork'] ?? '';
        const top = boards.boardTop(name);
        const at = top ? boards.toCanvas(top) : null;
        const transform =
          at && zoom > 0
            ? `translate(${Math.round(at.x * zoom)}px, ${Math.round(at.y * zoom)}px)`
            : 'translate(-9999px, -9999px)';
        if (shown.get(name) === transform) continue;
        shown.set(name, transform);
        el.style.transform = transform;
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [boards]);

  return (
    <div class="otp-forksigns" ref={layer} aria-hidden="true" data-fork-signs="">
      {boards.forks.map((fork) => (
        <div class="otp-forksign" key={fork.name} data-fork={fork.name}>
          <ul class="otp-forksign__list">
            {signFor(fork, met).map((entry) => {
              const who = content.characters.find((c) => c.id === entry.id);
              if (!who) return null;
              const face = iconUrl(who.spawn);
              return (
                <li
                  class="otp-forksign__chip"
                  key={entry.heading}
                  data-heading={entry.heading}
                  data-who={entry.id}
                >
                  {face && (
                    <span class="otp-forksign__face">
                      <img src={face} alt="" />
                    </span>
                  )}
                  <span class="otp-forksign__name">{who.name}</span>
                  <span class="otp-forksign__arrow" />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
