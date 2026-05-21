import { getRayEnd } from './core.js';

export const HIT_RADIUS = 0.34;

export function buildFireLinesFromActors(actors, activeZone) {
  const lines = [];

  actors.forEach((shooter) => {
    if (shooter.selectedAngle === null || shooter.selectedAngle === undefined) {
      return;
    }

    const ray = getRayEnd(shooter, shooter.selectedAngle, activeZone);
    lines.push({
      shooterId: shooter.id,
      shooterColor: shooter.color,
      angle: shooter.selectedAngle,
      ...ray
    });
  });

  return lines;
}

export function resolveHits(actors, lines, hitRadius = HIT_RADIUS) {
  const victims = new Set();
  const killsByShooter = new Map();

  lines.forEach((line) => {
    if (!killsByShooter.has(line.shooterId)) {
      killsByShooter.set(line.shooterId, new Set());
    }

    actors.forEach((target) => {
      if (target.id === line.shooterId) return;

      const tx = target.x + 0.5;
      const ty = target.y + 0.5;
      const dx = tx - line.startX;
      const dy = ty - line.startY;

      const forward = dx * line.ux + dy * line.uy;
      if (forward <= 0 || forward > line.maxDistance) return;

      const perpendicular = Math.abs(dx * line.uy - dy * line.ux);
      if (perpendicular <= hitRadius) {
        victims.add(target.id);
        killsByShooter.get(line.shooterId).add(target.id);
      }
    });
  });

  killsByShooter.forEach((kills, shooterId) => {
    const shooter = actors.find((a) => a.id === shooterId);
    if (shooter) shooter.score += kills.size;
  });

  const playerKills = killsByShooter.has('player') ? killsByShooter.get('player').size : 0;

  let eliminatedCount = 0;
  actors.forEach((entity) => {
    if (victims.has(entity.id)) {
      entity.alive = false;
      eliminatedCount += 1;
    }
  });

  return { playerKills, eliminatedCount };
}

export function chooseWinnerByPoints(allEntities) {
  if (!Array.isArray(allEntities) || allEntities.length === 0) return null;
  let best = allEntities[0];
  for (let i = 1; i < allEntities.length; i += 1) {
    const candidate = allEntities[i];
    if (candidate.score > best.score) best = candidate;
  }

  const topScorers = allEntities.filter((e) => e.score === best.score);
  if (topScorers.some((e) => e.id === 'player')) return allEntities.find((a) => a.id === 'player');

  return topScorers.sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0))[0] || null;
}
