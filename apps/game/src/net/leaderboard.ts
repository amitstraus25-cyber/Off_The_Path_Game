import type { Content, GameState } from '@otp/core';

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  score: number;
}

export interface LeaderboardClient {
  /** Returns null on success, or a message to show the player. Never throws. */
  submit(state: GameState, handle: string): Promise<string | null>;
  top(limit: number): Promise<LeaderboardEntry[]>;
}

/**
 * Phase 5 ships the UI against this stub, which always reports the board as unavailable.
 * The real Vercel Function adapter arrives in Phase 6 behind the same interface; the game must
 * stay fully playable either way, so nothing here ever blocks results or the CTA.
 */
export function createLeaderboardClient(content: Content): LeaderboardClient {
  const unavailable = content.strings['leaderboardDown'] ?? 'Leaderboard unavailable right now.';
  return {
    async submit() {
      return unavailable;
    },
    async top() {
      return [];
    },
  };
}
