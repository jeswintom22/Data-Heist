import { angleToLabel, getZoneForRound, isInsideZoneCell } from './core.js';
import {
  buildFireLinesFromActors,
  chooseWinnerByPoints,
  resolveHits,
  HIT_RADIUS,
} from './gameLogic.js';
import { chooseBotAngle } from './botAi.js';

export const GRID_SIZE = 10;
export const BOT_COUNT = 4;
export const PLANNING_DURATION = 10;
export const RESOLUTION_DURATION = 1.3;

function createEntity(id, label, color, isPlayer) {
  return { id, label, color, isPlayer, x: 0, y: 0, alive: true, selectedAngle: null, score: 0 };
}

export function createGameState(random = Math.random) {
  const state = {
    player: createEntity('player', 'You', '#E9B22E', true),
    bots: Array.from({ length: BOT_COUNT }, (_, index) =>
      createEntity(`bot-${index + 1}`, `Bot ${index + 1}`, '#E8472B', false)
    ),
    gameState: 'title',
    winner: null,
    roundNumber: 1,
    phaseTimer: PLANNING_DURATION,
    activeZone: getZoneForRound(1, GRID_SIZE),
    nextZone: getZoneForRound(2, GRID_SIZE),
    hoverCell: null,
    playerPlacementLocked: false,
    lastPlayerCell: null,
    playerRoundKills: 0,
    roundKillsTotal: 0,
    lastRoundEliminatedCount: 0,
    fireLines: [],
    resolutionActors: [],
    showFireStart: 0,
    showFireUntil: 0,
    resultShown: false,
    random,
  };
  return state;
}

export function aliveEntities(state) {
  return [state.player, ...state.bots].filter((entity) => entity.alive);
}

function randomFreeCell(state, usedCells, zone) {
  const cells = [];
  for (let y = zone.top; y <= zone.bottom; y += 1) {
    for (let x = zone.left; x <= zone.right; x += 1) {
      if (!usedCells.has(`${x},${y}`)) cells.push({ x, y });
    }
  }
  return cells[Math.floor(state.random() * cells.length)] || { x: zone.left, y: zone.top };
}

export function beginPlanningPhase(state) {
  state.gameState = 'planning';
  state.phaseTimer = PLANNING_DURATION;
  state.fireLines = [];
  state.resolutionActors = [];
  state.playerPlacementLocked = false;
  state.playerRoundKills = 0;
  state.lastRoundEliminatedCount = 0;
  state.activeZone = getZoneForRound(state.roundNumber, GRID_SIZE);
  state.nextZone = getZoneForRound(state.roundNumber + 1, GRID_SIZE);
  const usedCells = new Set();
  state.bots
    .filter((bot) => bot.alive)
    .forEach((bot) => {
      const cell = randomFreeCell(state, usedCells, state.activeZone);
      bot.x = cell.x;
      bot.y = cell.y;
      bot.selectedAngle = chooseBotAngle(bot, state.lastPlayerCell, state.random);
    });
  if (
    state.lastPlayerCell &&
    isInsideZoneCell(state.lastPlayerCell.x, state.lastPlayerCell.y, state.activeZone)
  ) {
    state.player.x = state.lastPlayerCell.x;
    state.player.y = state.lastPlayerCell.y;
  }
  if (
    !isInsideZoneCell(state.player.x, state.player.y, state.activeZone) ||
    isCellBlockedByBot(state, state.player.x, state.player.y)
  ) {
    const cell = randomFreeCell(state, usedCells, state.activeZone);
    state.player.x = cell.x;
    state.player.y = cell.y;
  }
  if (state.player.selectedAngle === null) state.player.selectedAngle = -Math.PI / 2;
}

export function isCellBlockedByBot(state, x, y) {
  return state.bots.some((bot) => bot.alive && bot.x === x && bot.y === y);
}

export function setPlayerPlacement(state, cell) {
  if (
    state.gameState !== 'planning' ||
    !state.player.alive ||
    !cell ||
    !isInsideZoneCell(cell.x, cell.y, state.activeZone) ||
    isCellBlockedByBot(state, cell.x, cell.y)
  )
    return false;
  state.player.x = cell.x;
  state.player.y = cell.y;
  state.playerPlacementLocked = true;
  state.lastPlayerCell = { ...cell };
  return true;
}

export function lockIn(state, nowSeconds) {
  if (state.gameState !== 'planning') return false;
  state.playerPlacementLocked = true;
  if (!state.lastPlayerCell) state.lastPlayerCell = { x: state.player.x, y: state.player.y };
  beginResolutionPhase(state, nowSeconds);
  return true;
}

export function beginResolutionPhase(state, nowSeconds) {
  if (state.player.alive && !state.playerPlacementLocked) {
    const used = new Set(state.bots.filter((bot) => bot.alive).map((bot) => `${bot.x},${bot.y}`));
    const cell = randomFreeCell(state, used, state.activeZone);
    state.player.x = cell.x;
    state.player.y = cell.y;
    state.lastPlayerCell = cell;
  }
  state.gameState = 'resolution';
  state.phaseTimer = RESOLUTION_DURATION;
  state.resolutionActors = aliveEntities(state);
  state.fireLines = buildFireLinesFromActors(state.resolutionActors, state.activeZone);
  const result = resolveHits(state.resolutionActors, state.fireLines, HIT_RADIUS);
  state.playerRoundKills = result.playerKills;
  state.roundKillsTotal += result.playerKills;
  state.lastRoundEliminatedCount = result.eliminatedCount;
  state.showFireStart = nowSeconds;
  state.showFireUntil = nowSeconds + 0.95;
  updateWinnerIfFinished(state);
}

export function updateWinnerIfFinished(state) {
  const survivors = aliveEntities(state);
  if (!state.player.alive && survivors.length > 1) {
    state.gameState = 'gameover';
    state.winner = null;
  } else if (survivors.length === 1) {
    state.gameState = 'gameover';
    state.winner = survivors[0];
  } else if (survivors.length === 0) {
    state.gameState = 'gameover';
    state.winner = chooseWinnerByPoints([state.player, ...state.bots]);
  }
  return state.gameState === 'gameover';
}

export function updatePhase(state, deltaSeconds, nowSeconds) {
  if (state.gameState === 'title' || state.gameState === 'gameover') return false;
  state.phaseTimer -= deltaSeconds;
  if (state.gameState === 'planning' && state.phaseTimer <= 0)
    beginResolutionPhase(state, nowSeconds);
  else if (
    state.gameState === 'resolution' &&
    state.phaseTimer <= 0 &&
    !updateWinnerIfFinished(state)
  ) {
    state.roundNumber += 1;
    beginPlanningPhase(state);
  }
  return true;
}

export function restartGame(state) {
  const fresh = createGameState(state.random);
  Object.assign(state, fresh);
  beginPlanningPhase(state);
}

export function setAim(state, angle) {
  if (state.gameState === 'planning' && state.player.alive) state.player.selectedAngle = angle;
}

export { angleToLabel };
