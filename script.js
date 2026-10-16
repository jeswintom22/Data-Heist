import {
  angleToLabel,
  randomAngle,
  getRayEnd,
  getZoneForRound,
  isInsideZoneCell,
} from './src/core.js';
import {
  buildFireLinesFromActors,
  resolveHits,
  chooseWinnerByPoints,
  HIT_RADIUS,
} from './src/gameLogic.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const joystickEl = document.getElementById('joystick');
const joystickStickEl = document.getElementById('joystickStick');
const restartBtn = document.getElementById('restartBtn');
const readyBtn = document.getElementById('readyBtn');
const playBtn = document.getElementById('playBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const muteBtn = document.getElementById('muteBtn');
const startScreen = document.getElementById('startScreen');
const tutorialLayer = document.getElementById('tutorialLayer');
const tutorialNextBtn = document.getElementById('tutorialNextBtn');
const pauseLayer = document.getElementById('pauseLayer');
const resultLayer = document.getElementById('resultLayer');
const tutorialStepEl = document.getElementById('tutorialStep');
const tutorialTitleEl = document.getElementById('tutorialTitle');
const tutorialCopyEl = document.getElementById('tutorialCopy');
const tutorialProgressEl = document.querySelector('.tutorial-progress span');
const resultTitleEl = document.getElementById('resultTitle');
const resultEyebrowEl = document.getElementById('resultEyebrow');
const resultScoreEl = document.getElementById('resultScore');
const resultKillsEl = document.getElementById('resultKills');
const resultRoundsEl = document.getElementById('resultRounds');
const bestScoreEl = document.getElementById('bestScore');
const timerBarEl = document.getElementById('timerBar');
const phaseLabelEl = document.getElementById('phaseLabel');
const compassEl = document.getElementById('compass');
const killFeedEl = document.getElementById('killFeed');
const roundBanner = document.getElementById('roundBanner');

const roundEl = document.getElementById('round');
const survivorsEl = document.getElementById('survivors');
const zoneEl = document.getElementById('zone');
const timerEl = document.getElementById('timer');
const aimEl = document.getElementById('aim');
const scoreEl = document.getElementById('score');
const roundKillsEl = document.getElementById('roundKills');
const roundElimsEl = document.getElementById('roundElims');
const statusEl = document.getElementById('status');

const GRID_SIZE = 10;
const LOGICAL_CANVAS_SIZE = 480;
const TILE_SIZE = LOGICAL_CANVAS_SIZE / GRID_SIZE;
const BOT_COUNT = 4;
const PLANNING_DURATION = 10;
const RESOLUTION_DURATION = 1.3;
const FIRE_ANIMATION_DURATION = 0.95;
// grid data kept in rendering logic when needed

const CARDINAL_ANGLES = {
  ArrowUp: -Math.PI / 2,
  ArrowDown: Math.PI / 2,
  ArrowLeft: Math.PI,
  ArrowRight: 0,
};

const player = {
  id: 'player',
  label: 'You',
  x: 0,
  y: 0,
  color: '#69d6ff',
  isPlayer: true,
  alive: true,
  selectedAngle: null,
  score: 0,
};

let bots = [];
let gameState = 'title'; // "title" | "planning" | "resolution" | "gameover"
let winner = null;
let roundNumber = 1;
let phaseTimer = PLANNING_DURATION;
let showFireStart = 0;
let showFireUntil = 0;
let fireLines = [];
let resolutionActors = [];
let playerPlacementLocked = false;
let lastPlayerCell = null;
let joystickPointerActive = false;
let activeZone = getZoneForRound(1, GRID_SIZE);
let playerRoundKills = 0;
let lastRoundEliminatedCount = 0;
let lastTime = 0;
let isPaused = false;
let muted = false;
let tutorialStep = 0;
let resultShown = false;
let roundKillsTotal = 0;
let killFeedItems = [];
let canvasAimPointerActive = false;

const tutorialSteps = [
  [
    'PLACE YOUR RUNNER',
    'Click any open tile inside the cyan perimeter. Your last position is remembered between rounds.',
  ],
  [
    'AIM YOUR VECTOR',
    'Drag the control or use the arrow keys. The dotted laser shows exactly where your beam will travel.',
  ],
  ['SURVIVE THE ZONE', 'Lock in early, watch the danger border, and be the last signal standing.'],
];

function configureCanvasResolution() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = LOGICAL_CANVAS_SIZE * pixelRatio;
  canvas.height = LOGICAL_CANVAS_SIZE * pixelRatio;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function createEntity(id, label, color, isPlayerEntity) {
  return {
    id,
    label,
    color,
    isPlayer: isPlayerEntity,
    x: 0,
    y: 0,
    alive: true,
    selectedAngle: null,
    score: 0,
  };
}

// helper functions are imported from src/core.js

function randomFreeCell(usedCells, zone) {
  const maxAttempts = Math.max(zone.size * zone.size * 2, 200);
  for (let i = 0; i < maxAttempts; i += 1) {
    const candidate = {
      x: zone.left + Math.floor(Math.random() * zone.size),
      y: zone.top + Math.floor(Math.random() * zone.size),
    };
    const key = `${candidate.x},${candidate.y}`;
    if (!usedCells.has(key)) {
      usedCells.add(key);
      return candidate;
    }
  }
  // Fallback: linear scan
  for (let y = zone.top; y <= zone.right; y += 1) {
    for (let x = zone.left; x <= zone.right; x += 1) {
      const key = `${x},${y}`;
      if (!usedCells.has(key)) {
        usedCells.add(key);
        return { x, y };
      }
    }
  }
  // As a final fallback (shouldn't happen), return the top-left of the zone
  return { x: zone.left, y: zone.top };
}

function setupEntities() {
  player.alive = true;
  player.selectedAngle = null;
  player.score = 0;
  playerPlacementLocked = false;
  lastPlayerCell = null;
  playerRoundKills = 0;
  lastRoundEliminatedCount = 0;

  bots = [];
  for (let i = 0; i < BOT_COUNT; i += 1) {
    const bot = createEntity(`bot-${i + 1}`, `Bot ${i + 1}`, '#ff8f8f', false);
    bots.push(bot);
  }
}

function aliveEntities() {
  return [player, ...bots].filter((entity) => entity.alive);
}

function beginPlanningPhase() {
  gameState = 'planning';
  phaseTimer = PLANNING_DURATION;
  fireLines = [];
  resolutionActors = [];
  playerPlacementLocked = false;
  playerRoundKills = 0;
  lastRoundEliminatedCount = 0;
  activeZone = getZoneForRound(roundNumber, GRID_SIZE);

  const usedCells = new Set();
  const aliveBots = bots.filter((bot) => bot.alive);
  aliveBots.forEach((bot) => {
    const cell = randomFreeCell(usedCells, activeZone);
    bot.x = cell.x;
    bot.y = cell.y;
    bot.selectedAngle = randomAngle();
  });

  // Player sets position manually every round. If no new click is made, use fallback later.
  if (lastPlayerCell && isInsideZoneCell(lastPlayerCell.x, lastPlayerCell.y, activeZone)) {
    player.x = lastPlayerCell.x;
    player.y = lastPlayerCell.y;
  }

  if (
    !isInsideZoneCell(player.x, player.y, activeZone) ||
    isCellBlockedByAliveBot(player.x, player.y)
  ) {
    const suggestedCell = randomFreeCell(usedCells, activeZone);
    player.x = suggestedCell.x;
    player.y = suggestedCell.y;
  }

  if (player.alive && player.selectedAngle === null) {
    player.selectedAngle = -Math.PI / 2;
  }

  resetJoystickStick();
  showRoundBanner(`ROUND ${roundNumber} · ZONE ${activeZone.size}×${activeZone.size}`);
  updateUI();
}

function beginResolutionPhase(nowSeconds) {
  finalizePlayerPlacement();

  gameState = 'resolution';
  phaseTimer = RESOLUTION_DURATION;

  // Keep live entity references so hits update the real game state during resolution.
  resolutionActors = aliveEntities();

  fireLines = buildFireLinesFromActors(resolutionActors, activeZone);
  const result = resolveHits(resolutionActors, fireLines, HIT_RADIUS);
  playerRoundKills = result.playerKills;
  roundKillsTotal += playerRoundKills;
  lastRoundEliminatedCount = result.eliminatedCount;
  resolutionActors.forEach((actor) => {
    if (!actor.alive && actor.id !== 'player' && playerRoundKills > 0) {
      addKillFeed(`You eliminated ${actor.label}`);
    }
  });
  showFireStart = nowSeconds;
  showFireUntil = nowSeconds + FIRE_ANIMATION_DURATION;

  updateWinnerIfFinished();
  updateUI();
}

function finalizePlayerPlacement() {
  if (!player.alive) {
    return;
  }

  const usedByBots = new Set();
  bots
    .filter((bot) => bot.alive)
    .forEach((bot) => {
      usedByBots.add(`${bot.x},${bot.y}`);
    });

  if (playerPlacementLocked && isInsideZoneCell(player.x, player.y, activeZone)) {
    lastPlayerCell = { x: player.x, y: player.y };
    return;
  }

  if (lastPlayerCell && isInsideZoneCell(lastPlayerCell.x, lastPlayerCell.y, activeZone)) {
    const remembered = `${lastPlayerCell.x},${lastPlayerCell.y}`;
    if (!usedByBots.has(remembered)) {
      player.x = lastPlayerCell.x;
      player.y = lastPlayerCell.y;
      playerPlacementLocked = true;
      return;
    }
  }

  const randomCell = randomFreeCell(usedByBots, activeZone);
  player.x = randomCell.x;
  player.y = randomCell.y;
  lastPlayerCell = { x: randomCell.x, y: randomCell.y };
  playerPlacementLocked = true;
}

function updateWinnerIfFinished() {
  const survivors = aliveEntities();

  if (!player.alive && survivors.length > 1) {
    gameState = 'gameover';
    winner = null;
    showResultScreen();
    return;
  }

  if (survivors.length === 1) {
    gameState = 'gameover';
    winner = survivors[0];
    showResultScreen();
    return;
  }

  if (survivors.length === 0) {
    gameState = 'gameover';
    winner = chooseWinnerByPoints([player, ...bots]);
    showResultScreen();
  }
}
// Phase management and timer logic are handled here.
function updatePhase(deltaSeconds, nowSeconds) {
  if (gameState === 'title' || gameState === 'gameover' || isPaused) {
    return;
  }

  phaseTimer -= deltaSeconds;

  if (gameState === 'planning' && phaseTimer <= 0) {
    beginResolutionPhase(nowSeconds);
  } else if (gameState === 'resolution' && phaseTimer <= 0) {
    updateWinnerIfFinished();
    if (gameState !== 'gameover') {
      roundNumber += 1;
      beginPlanningPhase();
    }
  }

  updateUI();
}

function restartGame() {
  winner = null;
  roundNumber = 1;
  player.selectedAngle = null;
  playerRoundKills = 0;
  lastRoundEliminatedCount = 0;
  roundKillsTotal = 0;
  resultShown = false;
  isPaused = false;
  activeZone = getZoneForRound(1, GRID_SIZE);
  setupEntities();
  beginPlanningPhase();
  hideAllScreens();
}

function updateUI() {
  roundEl.textContent = String(roundNumber);
  survivorsEl.textContent = String(aliveEntities().length);
  zoneEl.textContent = `${activeZone.size}x${activeZone.size}`;
  timerEl.textContent = Math.max(0, phaseTimer).toFixed(1);
  aimEl.textContent = angleToLabel(player.selectedAngle);
  scoreEl.textContent = String(player.score);
  if (roundKillsEl) roundKillsEl.textContent = String(playerRoundKills);
  if (roundElimsEl) roundElimsEl.textContent = String(lastRoundEliminatedCount);
  const planningProgress = Math.max(0, Math.min(1, phaseTimer / PLANNING_DURATION));
  timerBarEl.style.transform = `scaleX(${gameState === 'planning' ? planningProgress : 1})`;
  timerBarEl.classList.toggle(
    'warn',
    gameState === 'planning' && phaseTimer <= 5 && phaseTimer > 3
  );
  timerBarEl.classList.toggle('danger', gameState === 'planning' && phaseTimer <= 3);
  phaseLabelEl.textContent =
    gameState === 'resolution' ? 'FIRE!' : gameState === 'planning' ? 'PLANNING' : 'RUN COMPLETE';
  compassEl.textContent = getCompassLabel(player.selectedAngle);

  if (gameState === 'planning') {
    if (!playerPlacementLocked) {
      statusEl.textContent = 'Planning (10s): choose your tile, then set any aim angle.';
    } else {
      statusEl.textContent = 'Planning (10s): placement locked, fine-tune 360° aim.';
    }
  } else if (gameState === 'resolution') {
    statusEl.textContent = 'Resolution: beams fired.';
  } else if (!player.alive && winner !== player) {
    statusEl.textContent = `Game Over! You were eliminated. Score: ${player.score}. Press R to restart.`;
  } else if (winner && winner.id === player.id) {
    statusEl.textContent = `You Win! Score: ${player.score}. Press R to restart.`;
  } else if (winner) {
    statusEl.textContent = `${winner.label} wins on points (${winner.score}). Your score: ${player.score}. Press R to restart.`;
  } else {
    statusEl.textContent = `Everyone was eliminated. Your score: ${player.score}. Press R to restart.`;
  }
}

function getCompassLabel(angle) {
  if (angle === null || angle === undefined) return 'N';
  const degrees = ((angle * 180) / Math.PI + 360) % 360;
  return ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][Math.round(degrees / 45) % 8];
}

function showRoundBanner(text) {
  roundBanner.textContent = text;
  roundBanner.classList.remove('show');
  void roundBanner.offsetWidth;
  roundBanner.classList.add('show');
}

function addKillFeed(text) {
  killFeedItems = [{ text, id: Date.now() }, ...killFeedItems].slice(0, 3);
  killFeedEl.innerHTML = killFeedItems.map((item) => `<p>+ ${item.text}</p>`).join('');
}

function hideAllScreens() {
  [startScreen, tutorialLayer, pauseLayer, resultLayer].forEach((layer) =>
    layer.classList.remove('active')
  );
}

function showResultScreen() {
  if (resultShown) return;
  resultShown = true;
  const best = Math.max(Number(localStorage.getItem('dataHeistBestScore') || 0), player.score);
  localStorage.setItem('dataHeistBestScore', String(best));
  const won = winner && winner.id === player.id;
  resultEyebrowEl.textContent = won ? 'SIGNAL SECURED' : 'RUN COMPLETE';
  resultTitleEl.textContent = won ? 'YOU WIN' : 'SIGNAL LOST';
  resultScoreEl.textContent = String(player.score);
  resultKillsEl.textContent = String(roundKillsTotal);
  resultRoundsEl.textContent = String(Math.max(0, roundNumber - (won ? 0 : 1)));
  bestScoreEl.textContent = String(best);
  resultLayer.classList.add('active');
}

function startTutorial() {
  if (localStorage.getItem('dataHeistTutorialSeen')) {
    restartGame();
    return;
  }
  tutorialStep = 0;
  updateTutorial();
  startScreen.classList.remove('active');
  tutorialLayer.classList.add('active');
}

function updateTutorial() {
  const [title, copy] = tutorialSteps[tutorialStep];
  tutorialStepEl.textContent = String(tutorialStep + 1).padStart(2, '0');
  tutorialTitleEl.textContent = title;
  tutorialCopyEl.textContent = copy;
  tutorialProgressEl.style.width = `${((tutorialStep + 1) / tutorialSteps.length) * 100}%`;
  tutorialNextBtn.innerHTML =
    tutorialStep === tutorialSteps.length - 1 ? 'START RUN <span>→</span>' : 'NEXT <span>→</span>';
}

function drawGrid() {
  const zone = activeZone;

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const insideZone = isInsideZoneCell(x, y, zone);
      const color = insideZone ? ((x + y) % 2 === 0 ? '#0b2635' : '#0d3040') : '#050c13';

      ctx.fillStyle = color;
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

      ctx.strokeStyle = insideZone ? '#184a5a' : '#0a1721';
      ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  ctx.save();
  ctx.strokeStyle = '#54e1ee';
  ctx.lineWidth = 3;
  ctx.strokeRect(
    zone.left * TILE_SIZE + 1.5,
    zone.top * TILE_SIZE + 1.5,
    zone.size * TILE_SIZE - 3,
    zone.size * TILE_SIZE - 3
  );
  ctx.restore();
}

function drawEntity(entity) {
  const centerX = entity.x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = entity.y * TILE_SIZE + TILE_SIZE / 2;
  const radius = TILE_SIZE * 0.27;
  ctx.save();
  ctx.shadowColor = entity.color;
  ctx.shadowBlur = entity.isPlayer ? 18 : 8;
  ctx.fillStyle = entity.color;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - radius);
  ctx.lineTo(centerX + radius, centerY - radius * 0.35);
  ctx.lineTo(centerX + radius * 0.78, centerY + radius * 0.75);
  ctx.lineTo(centerX - radius * 0.78, centerY + radius * 0.75);
  ctx.lineTo(centerX - radius, centerY - radius * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#d9ffff';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (entity.isPlayer) {
    ctx.fillStyle = '#06121b';
    ctx.font = '700 7px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', centerX, centerY + 2);
  }
  ctx.restore();
}

function drawPlanningPlacementPreview() {
  if (gameState !== 'planning' || !player.alive) {
    return;
  }

  const x = player.x * TILE_SIZE;
  const y = player.y * TILE_SIZE;

  ctx.save();
  ctx.strokeStyle = playerPlacementLocked ? '#93e5ff' : '#ffd166';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  ctx.globalAlpha = playerPlacementLocked ? 0.2 : 0.28;
  ctx.fillStyle = playerPlacementLocked ? '#67d6ff' : '#ffd166';
  ctx.fillRect(x + 5, y + 5, TILE_SIZE - 10, TILE_SIZE - 10);
  ctx.restore();

  if (player.selectedAngle !== null) {
    const ray = getRayEnd(player, player.selectedAngle, activeZone);
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgb(84 225 238 / 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ray.startX * TILE_SIZE, ray.startY * TILE_SIZE);
    ctx.lineTo(ray.endX * TILE_SIZE, ray.endY * TILE_SIZE);
    ctx.stroke();
    ctx.restore();
  }
}

function drawAimIndicator(entity) {
  if (entity.selectedAngle === null) {
    return;
  }

  const centerX = entity.x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = entity.y * TILE_SIZE + TILE_SIZE / 2;
  const len = TILE_SIZE * 0.42;
  const tipX = centerX + Math.cos(entity.selectedAngle) * len;
  const tipY = centerY + Math.sin(entity.selectedAngle) * len;

  ctx.save();
  ctx.strokeStyle = entity.isPlayer ? '#89d6ff' : '#ffb5b5';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.restore();
}

function drawFireLines(nowSeconds) {
  if (nowSeconds > showFireUntil || fireLines.length === 0) {
    return;
  }

  const duration = showFireUntil - showFireStart;
  const progress = Math.max(0, Math.min(1, (nowSeconds - showFireStart) / duration));

  ctx.save();
  fireLines.forEach((line) => {
    const startPxX = line.startX * TILE_SIZE;
    const startPxY = line.startY * TILE_SIZE;
    const endPxX = line.endX * TILE_SIZE;
    const endPxY = line.endY * TILE_SIZE;
    const tipX = startPxX + (endPxX - startPxX) * progress;
    const tipY = startPxY + (endPxY - startPxY) * progress;

    // Soft outer glow beam.
    ctx.strokeStyle = 'rgb(255 215 104 / 0.24)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(startPxX, startPxY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // Bright core beam.
    ctx.strokeStyle = 'rgb(255 246 198 / 0.95)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(startPxX, startPxY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // Animated energy tip.
    ctx.fillStyle = line.shooterColor;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Subtle flare particles around the tip.
    for (let i = 0; i < 3; i += 1) {
      const phase = nowSeconds * 16 + i * 2.2 + line.angle;
      const px = tipX - Math.cos(line.angle) * (8 + i * 4) + Math.cos(phase) * 2.2;
      const py = tipY - Math.sin(line.angle) * (8 + i * 4) + Math.sin(phase) * 2.2;
      const alpha = 0.22 + 0.18 * (1 - i / 3);

      ctx.fillStyle = `rgb(255 140 70 / ${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.8 + i * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();
}

function drawEntities(nowSeconds) {
  if (gameState === 'planning') {
    bots
      .filter((bot) => bot.alive)
      .forEach((bot) => {
        drawEntity(bot);
        drawAimIndicator(bot);
      });
    drawEntity(player);
    drawPlanningPlacementPreview();
    return;
  }

  if (gameState === 'resolution') {
    // Draw the actors from shot start so boxes do not disappear mid-animation.
    resolutionActors.forEach((entity) => {
      drawEntity(entity);
      drawAimIndicator(entity);
    });
    drawFireLines(nowSeconds);
    return;
  }

  const alive = aliveEntities();
  alive.forEach((entity) => {
    drawEntity(entity);
    drawAimIndicator(entity);
  });
}

function getCanvasGridCell(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = LOGICAL_CANVAS_SIZE / rect.width;
  const scaleY = LOGICAL_CANVAS_SIZE / rect.height;
  const x = Math.floor(((clientX - rect.left) * scaleX) / TILE_SIZE);
  const y = Math.floor(((clientY - rect.top) * scaleY) / TILE_SIZE);

  if (!isInsideZoneCell(x, y, activeZone)) {
    return null;
  }

  return { x, y };
}

function isCellBlockedByAliveBot(x, y) {
  return bots.some((bot) => bot.alive && bot.x === x && bot.y === y);
}

function setPlayerPlacementFromCell(cell) {
  if (!cell || gameState !== 'planning' || !player.alive) {
    return;
  }

  if (isCellBlockedByAliveBot(cell.x, cell.y)) {
    return;
  }

  player.x = cell.x;
  player.y = cell.y;
  playerPlacementLocked = true;
  lastPlayerCell = { x: cell.x, y: cell.y };
  updateUI();
}

function resetJoystickStick() {
  joystickStickEl.style.left = '50%';
  joystickStickEl.style.top = '50%';
}

function setDirectionFromJoystickPoint(clientX, clientY) {
  const rect = joystickEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = clientX - centerX;
  const dy = clientY - centerY;

  const maxRadius = rect.width * 0.33;
  const distance = Math.hypot(dx, dy);
  const clampedRatio = distance > maxRadius ? maxRadius / distance : 1;
  const stickX = dx * clampedRatio;
  const stickY = dy * clampedRatio;

  joystickStickEl.style.left = `${50 + (stickX / (rect.width / 2)) * 50}%`;
  joystickStickEl.style.top = `${50 + (stickY / (rect.height / 2)) * 50}%`;

  if (distance < 8) {
    return;
  }

  player.selectedAngle = Math.atan2(dy, dx);
  updateUI();
}

// Game loop: update game state, render, then request next frame.
function gameLoop(timestamp) {
  const deltaTime = timestamp - lastTime;
  lastTime = timestamp;
  const deltaSeconds = deltaTime / 1000;
  const nowSeconds = timestamp / 1000;

  updatePhase(deltaSeconds, nowSeconds);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawEntities(nowSeconds);

  requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', (event) => {
  const key = event.key;

  if (key === 'Escape' && (gameState === 'planning' || gameState === 'resolution' || isPaused)) {
    togglePause();
    return;
  }

  if (key.toLowerCase() === 'r') {
    restartGame();
    return;
  }

  if (gameState !== 'planning' || !player.alive) {
    return;
  }

  if (CARDINAL_ANGLES[key] !== undefined) {
    event.preventDefault();
    player.selectedAngle = CARDINAL_ANGLES[key];
    updateUI();
  }
});

// Restart button (click/tap)
if (restartBtn) {
  restartBtn.addEventListener('click', () => {
    restartGame();
    // return focus to canvas for keyboard players
    canvas.focus();
  });
}

function togglePause() {
  if (gameState === 'gameover' || gameState === 'title') return;
  isPaused = !isPaused;
  pauseLayer.classList.toggle('active', isPaused);
  pauseBtn.textContent = isPaused ? 'RESUME' : 'PAUSE';
  updateUI();
}

playBtn.addEventListener('click', startTutorial);
playAgainBtn.addEventListener('click', restartGame);
pauseBtn.addEventListener('click', togglePause);
resumeBtn.addEventListener('click', togglePause);
muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? 'SFX OFF' : 'SFX ON';
});
tutorialNextBtn.addEventListener('click', () => {
  if (tutorialStep < tutorialSteps.length - 1) {
    tutorialStep += 1;
    updateTutorial();
    return;
  }
  localStorage.setItem('dataHeistTutorialSeen', '1');
  restartGame();
});
readyBtn.addEventListener('click', () => {
  if (gameState === 'planning' && player.alive) {
    playerPlacementLocked = true;
    lastPlayerCell = { x: player.x, y: player.y };
    beginResolutionPhase(performance.now() / 1000);
  }
});

// Allow keyboard control when joystick element is focused.
joystickEl.addEventListener('keydown', (e) => {
  if (gameState !== 'planning' || !player.alive) return;

  const k = e.key;
  if (CARDINAL_ANGLES[k] !== undefined) {
    e.preventDefault();
    player.selectedAngle = CARDINAL_ANGLES[k];
    updateUI();
    return;
  }

  if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
    e.preventDefault();
    playerPlacementLocked = true;
    lastPlayerCell = { x: player.x, y: player.y };
    updateUI();
  }
});

canvas.addEventListener('pointerdown', (event) => {
  const cell = getCanvasGridCell(event.clientX, event.clientY);
  if (cell && cell.x === player.x && cell.y === player.y && gameState === 'planning') {
    canvasAimPointerActive = true;
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  setPlayerPlacementFromCell(cell);
});

canvas.addEventListener('pointermove', (event) => {
  if (!canvasAimPointerActive || gameState !== 'planning') return;
  const rect = canvas.getBoundingClientRect();
  const scale = LOGICAL_CANVAS_SIZE / rect.width;
  const pointerX = (event.clientX - rect.left) * scale;
  const pointerY = (event.clientY - rect.top) * scale;
  const centerX = (player.x + 0.5) * TILE_SIZE;
  const centerY = (player.y + 0.5) * TILE_SIZE;
  player.selectedAngle = Math.atan2(pointerY - centerY, pointerX - centerX);
  updateUI();
});

canvas.addEventListener('pointerup', () => {
  canvasAimPointerActive = false;
});

joystickEl.addEventListener('pointerdown', (event) => {
  if (gameState !== 'planning' || !player.alive) {
    return;
  }

  joystickPointerActive = true;
  joystickEl.setPointerCapture(event.pointerId);
  setDirectionFromJoystickPoint(event.clientX, event.clientY);
});

joystickEl.addEventListener('pointermove', (event) => {
  if (!joystickPointerActive || gameState !== 'planning' || !player.alive) {
    return;
  }

  setDirectionFromJoystickPoint(event.clientX, event.clientY);
});

function stopJoystickPointer(event) {
  if (!joystickPointerActive) {
    return;
  }

  joystickPointerActive = false;
  if (typeof event.pointerId === 'number') {
    joystickEl.releasePointerCapture(event.pointerId);
  }
  resetJoystickStick();
}

joystickEl.addEventListener('pointerup', stopJoystickPointer);
joystickEl.addEventListener('pointercancel', stopJoystickPointer);

configureCanvasResolution();
setupEntities();
updateUI();
requestAnimationFrame((time) => {
  lastTime = time;
  requestAnimationFrame(gameLoop);
});
