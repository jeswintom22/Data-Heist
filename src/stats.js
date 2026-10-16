export function calculateRunStats(player, roundNumber, totalKills, bestScore) {
  const score = player?.score || 0;
  const best = Math.max(score, bestScore || 0);
  return {
    score,
    kills: totalKills || 0,
    rounds: Math.max(0, roundNumber - (player?.alive ? 0 : 1)),
    best,
    isNewBest: score > (bestScore || 0),
  };
}

export function readStoredNumber(storage, key, fallback = 0) {
  try {
    const value = Number(storage?.getItem(key));
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredNumber(storage, key, value) {
  try {
    storage?.setItem(key, String(value));
  } catch {
    // Storage can be disabled in private browsing; the run still works.
  }
}
