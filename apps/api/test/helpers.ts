import { v2 } from '@otp/core';
import raw from '../../../content/game.v2.json';

/*
 * Real runs, through the real v2 reducer, against the shipped content. Nothing in this directory
 * fabricates a log by hand except where a test is deliberately forging one: a fixture the reducer
 * would not have produced proves nothing about a route whose whole job is replaying.
 */

export const content: v2.Content = v2.loadContent(raw);

/** A second a step: walking to each character, then talking. Seven characters, about 22 seconds. */
const PACE = { walkMs: 1000, talkMs: 1000 };

/** core's own simulator, played at `seed`: careful takes the good and leaves the bad. */
export const runOf = (strategy: string, seed: number, pace = PACE): v2.State =>
  v2.play(content, strategy, { seed, pace }).state;

/** The careful run for a seed: grandma, 100. */
export const carefulLog = (seed: number): v2.RunLog => v2.toRunLog(runOf('careful', seed));

/** How long a log says it lasted: the reducer's clock at its last event. */
export const claimedMs = (log: v2.RunLog): number => log.events.at(-1)?.at ?? 0;
