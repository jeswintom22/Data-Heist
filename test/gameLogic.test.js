import { describe, it, expect } from 'vitest';
import { buildFireLinesFromActors, resolveHits, chooseWinnerByPoints } from '../src/gameLogic.js';
import { getZoneForRound } from '../src/core.js';

describe('gameLogic basic', () => {
  it('builds fire lines and resolves simple hit', () => {
    const zone = getZoneForRound(1, 10);
    const shooter = { id: 's1', x: 0, y: 0, selectedAngle: 0, color: 'red', score: 0, alive: true };
    const target = {
      id: 't1',
      x: 2,
      y: 0,
      selectedAngle: null,
      color: 'blue',
      score: 0,
      alive: true,
    };
    const actors = [shooter, target];
    const lines = buildFireLinesFromActors(actors, zone);
    expect(lines.length).toBe(1);
    const result = resolveHits(actors, lines);
    expect(result.eliminatedCount).toBe(1);
    expect(result.playerKills).toBe(0);
    expect(target.alive).toBe(false);
    expect(shooter.score).toBe(1);
  });

  it('chooses winner by points', () => {
    const a = { id: 'player', score: 5 };
    const b = { id: 'bot-1', score: 3 };
    const winner = chooseWinnerByPoints([a, b]);
    expect(winner.id).toBe('player');
  });
});
