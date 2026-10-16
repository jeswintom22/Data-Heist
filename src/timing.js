export function clampDelta(deltaSeconds, maximum = 0.1) {
  return Math.max(0, Math.min(deltaSeconds, maximum));
}

export function easeOutCubic(progress) {
  const clamped = Math.max(0, Math.min(1, progress));
  return 1 - (1 - clamped) ** 3;
}
