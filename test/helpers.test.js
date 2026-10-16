import { describe, expect, it } from 'vitest';
import { chooseBotAngle } from '../src/botAi.js';
import { canvasPointToCell } from '../src/geometry.js';
import { calculateRunStats, readStoredNumber, writeStoredNumber } from '../src/stats.js';
import { clampDelta, easeOutCubic } from '../src/timing.js';

describe('pure game helpers', () => {
  it('aims a bot at the known player cell when the difficulty roll succeeds', () => {
    const angle = chooseBotAngle({ x: 1, y: 1 }, { x: 3, y: 1 }, () => 0.1);
    expect(angle).toBe(0);
  });

  it('falls back to a random angle when the bot roll misses', () => {
    const angle = chooseBotAngle({ x: 1, y: 1 }, { x: 3, y: 1 }, () => 0.9);
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(Math.PI * 2);
  });

  it('maps a responsive DPR canvas point to a grid cell', () => {
    const cell = canvasPointToCell(120, 60, { left: 0, top: 0, width: 240, height: 240 }, 480, 10);
    expect(cell).toEqual({ x: 5, y: 2 });
  });

  it('clamps long frame gaps and eases from zero to one', () => {
    expect(clampDelta(2)).toBe(0.1);
    expect(clampDelta(-1)).toBe(0);
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it('calculates run stats and guards storage access', () => {
    const storage = new Map();
    const fakeStorage = {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    };
    const stats = calculateRunStats({ score: 12, alive: true }, 4, 3, 10);
    expect(stats).toEqual({ score: 12, kills: 3, rounds: 4, best: 12, isNewBest: true });
    writeStoredNumber(fakeStorage, 'best', 12);
    expect(readStoredNumber(fakeStorage, 'best')).toBe(12);
    expect(readStoredNumber(null, 'best', 7)).toBe(7);
  });
});
