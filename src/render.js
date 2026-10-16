import { getRayEnd, isInsideZoneCell } from './core.js';
import { drawEffects, getShakeOffset } from './fx.js';
import { easeOutCubic } from './timing.js';

export const LOGICAL_CANVAS_SIZE = 480;
export const GRID_SIZE = 10;
export const TILE_SIZE = LOGICAL_CANVAS_SIZE / GRID_SIZE;
const INK = '#14110F';
const CREAM = '#EFE6D2';
const VERMILION = '#E8472B';
const MUSTARD = '#E9B22E';

export function configureCanvas(canvas, ctx) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = LOGICAL_CANVAS_SIZE * ratio;
  canvas.height = LOGICAL_CANVAS_SIZE * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

export function drawGame(ctx, state, effects, now) {
  const shake = getShakeOffset(effects, now);
  ctx.save();
  ctx.translate(shake.x, shake.y);
  ctx.clearRect(-8, -8, LOGICAL_CANVAS_SIZE + 16, LOGICAL_CANVAS_SIZE + 16);
  drawBoard(ctx, state);
  drawActors(ctx, state);
  if (state.gameState === 'planning') drawAimPreview(ctx, state);
  if (state.gameState === 'resolution') drawBeams(ctx, state, now);
  drawEffects(ctx, effects);
  ctx.restore();
}

function drawBoard(ctx, state) {
  const zone = state.activeZone;
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, LOGICAL_CANVAS_SIZE, LOGICAL_CANVAS_SIZE);
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const inside = isInsideZoneCell(x, y, zone);
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      ctx.strokeStyle = `${INK}aa`;
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
      if (!inside) {
        ctx.fillStyle = INK;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      } else if (state.nextZone && !isInsideZoneCell(x, y, state.nextZone)) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.clip();
        ctx.strokeStyle = VERMILION;
        ctx.lineWidth = 3;
        for (let hatch = -TILE_SIZE; hatch < TILE_SIZE * 2; hatch += 10) {
          ctx.beginPath();
          ctx.moveTo(px + hatch, py);
          ctx.lineTo(px + hatch + TILE_SIZE, py + TILE_SIZE);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
  if (state.gameState === 'planning' && state.hoverCell) {
    const { x, y } = state.hoverCell;
    if (isInsideZoneCell(x, y, zone)) {
      const blocked = state.bots.some((bot) => bot.alive && bot.x === x && bot.y === y);
      ctx.strokeStyle = blocked ? VERMILION : MUSTARD;
      ctx.lineWidth = 4;
      ctx.strokeRect(x * TILE_SIZE + 4, y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
      if (blocked) {
        ctx.beginPath();
        ctx.moveTo(x * TILE_SIZE + 13, y * TILE_SIZE + 13);
        ctx.lineTo((x + 1) * TILE_SIZE - 13, (y + 1) * TILE_SIZE - 13);
        ctx.moveTo((x + 1) * TILE_SIZE - 13, y * TILE_SIZE + 13);
        ctx.lineTo(x * TILE_SIZE + 13, (y + 1) * TILE_SIZE - 13);
        ctx.stroke();
      }
    }
  }
  ctx.strokeStyle = MUSTARD;
  ctx.lineWidth = 4;
  ctx.strokeRect(
    zone.left * TILE_SIZE + 2,
    zone.top * TILE_SIZE + 2,
    zone.size * TILE_SIZE - 4,
    zone.size * TILE_SIZE - 4
  );
}

function drawActors(ctx, state) {
  const actors =
    state.gameState === 'resolution'
      ? state.resolutionActors
      : [state.player, ...state.bots.filter((bot) => bot.alive)];
  actors.filter(Boolean).forEach((actor) => {
    const x = (actor.x + 0.5) * TILE_SIZE;
    const y = (actor.y + 0.5) * TILE_SIZE;
    ctx.save();
    if (actor.isPlayer) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = MUSTARD;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.font = '900 9px Archivo, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('YOU', x, y + 27);
    } else {
      ctx.translate(x, y);
      ctx.rotate(actor.selectedAngle || 0);
      ctx.fillStyle = VERMILION;
      ctx.beginPath();
      ctx.moveTo(17, 0);
      ctx.lineTo(-11, -11);
      ctx.lineTo(-8, 11);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  });
}

function drawAimPreview(ctx, state) {
  if (!state.player.alive || state.player.selectedAngle === null) return;
  const ray = getRayEnd(state.player, state.player.selectedAngle, state.activeZone);
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(ray.startX * TILE_SIZE, ray.startY * TILE_SIZE);
  ctx.lineTo(ray.endX * TILE_SIZE, ray.endY * TILE_SIZE);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = INK;
  ctx.translate(ray.endX * TILE_SIZE, ray.endY * TILE_SIZE);
  ctx.rotate(state.player.selectedAngle);
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-7, -6);
  ctx.lineTo(-7, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBeams(ctx, state, now) {
  const duration = Math.max(0.01, state.showFireUntil - state.showFireStart);
  const progress = easeOutCubic((now - state.showFireStart) / duration);
  state.fireLines.forEach((line) => {
    const startX = line.startX * TILE_SIZE;
    const startY = line.startY * TILE_SIZE;
    const endX = line.startX * TILE_SIZE + (line.endX - line.startX) * TILE_SIZE * progress;
    const endY = line.startY * TILE_SIZE + (line.endY - line.startY) * TILE_SIZE * progress;
    ctx.strokeStyle = line.shooterId === 'player' ? INK : VERMILION;
    ctx.lineWidth = line.shooterId === 'player' ? 6 : 4;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  });
}
