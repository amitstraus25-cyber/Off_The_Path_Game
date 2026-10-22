import { v2 } from '@otp/core';
import raw from '../../../content/game.v2.json';

/*
 * Real runs, through the real v2 reducer, against the shipped content. Nothing in this directory
 * fabricates a log by hand except where a test is deliberately forging one: a fixture the reducer
 * would not have produced proves nothing about a route whose whole job is replaying.
 */

export const content: v2.Content = v2.loadContent(raw);

/**
 * Five seconds a walk and a second a talk and a card: a careful run arrives at 54 s, inside par
 * (1:45), so it scores 100. Five seconds because the walk floor charges the longest straight leg
 * of the content-order tour at a little over four (core floor.ts); one second a walk, as this
 * used to be, is now a log faster than the map and is refused.
 */
export const PACE: v2.Pace = { walkMs: 5000, talkMs: 1000 };
const QUICK_READ = { msPerWord: 0, buttonWords: 0, decideMs: 1000 };

/** core's own simulator, played at `seed`: careful takes the good and leaves the bad. */
export const runOf = (strategy: string, seed: number, pace: v2.Pace = PACE): v2.State =>
  v2.play(content, strategy, { seed, pace, reading: QUICK_READ }).state;

/** The careful run for a seed: grandma, 100. */
export const carefulLog = (seed: number): v2.RunLog => v2.toRunLog(runOf('careful', seed));

/** How long a log says it lasted: the reducer's clock at its last event. */
export const claimedMs = (log: v2.RunLog): number => log.events.at(-1)?.at ?? 0;
