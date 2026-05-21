// Lightweight pure helpers extracted for testing and reuse
export function angleToLabel(angle) {
  if (angle === null || angle === undefined) return 'None';
  const degrees = ((angle * 180) / Math.PI + 360) % 360;
  return `${degrees.toFixed(0)}°`;
}

export function randomAngle() {
  return Math.random() * Math.PI * 2;
}

export function getZoneForRound(round, gridSize = 10) {
  const MAX_ZONE_INSET = Math.floor((gridSize - 4) / 2);
  const inset = Math.min(Math.max(0, round - 1), MAX_ZONE_INSET);
  return {
    inset,
    left: inset,
    top: inset,
    right: gridSize - 1 - inset,
    bottom: gridSize - 1 - inset,
    size: gridSize - inset * 2,
  };
}

export function isInsideZoneCell(x, y, zone) {
  return x >= zone.left && x <= zone.right && y >= zone.top && y <= zone.bottom;
}

export function getRayEnd(shooter, angle, zone) {
  const startX = shooter.x + 0.5;
  const startY = shooter.y + 0.5;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);

  const possible = [];
  if (ux > 0) {
    possible.push((zone.right + 1 - startX) / ux);
  } else if (ux < 0) {
    possible.push((zone.left - startX) / ux);
  }

  if (uy > 0) {
    possible.push((zone.bottom + 1 - startY) / uy);
  } else if (uy < 0) {
    possible.push((zone.top - startY) / uy);
  }

  const positive = possible.filter((v) => v > 0);
  const t = Math.min(...positive);

  return {
    startX,
    startY,
    ux,
    uy,
    maxDistance: t,
    endX: startX + ux * t,
    endY: startY + uy * t,
  };
}
