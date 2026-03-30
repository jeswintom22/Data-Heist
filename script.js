const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const joystickEl = document.getElementById("joystick");
const joystickStickEl = document.getElementById("joystickStick");

const roundEl = document.getElementById("round");
const survivorsEl = document.getElementById("survivors");
const zoneEl = document.getElementById("zone");
const timerEl = document.getElementById("timer");
const aimEl = document.getElementById("aim");
const scoreEl = document.getElementById("score");
const roundKillsEl = document.getElementById("roundKills");
const roundElimsEl = document.getElementById("roundElims");
const statusEl = document.getElementById("status");

const GRID_SIZE = 10;
const TILE_SIZE = canvas.width / GRID_SIZE;
const BOT_COUNT = 4;
const PLANNING_DURATION = 10;
const RESOLUTION_DURATION = 1.3;
const FIRE_ANIMATION_DURATION = 0.95;
const HIT_RADIUS = 0.34;
const MAX_ZONE_INSET = Math.floor((GRID_SIZE - 4) / 2);

// 2D array grid. It keeps the fixed board dimensions for rendering.
const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));

const CARDINAL_ANGLES = {
  ArrowUp: -Math.PI / 2,
  ArrowDown: Math.PI / 2,
  ArrowLeft: Math.PI,
  ArrowRight: 0
};

const player = {
  id: "player",
  label: "You",
  x: 0,
  y: 0,
  color: "#69d6ff",
  isPlayer: true,
  alive: true,
  selectedAngle: null,
  score: 0
};

let bots = [];
let gameState = "planning"; // "planning" | "resolution" | "gameover"
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
let activeZone = getZoneForRound(1);
let playerRoundKills = 0;
let lastRoundEliminatedCount = 0;
let lastTime = 0;

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
    score: 0
  };
}

function randomAngle() {
  return Math.random() * Math.PI * 2;
}

function getZoneForRound(round) {
  const inset = Math.min(round - 1, MAX_ZONE_INSET);
  return {
    inset,
    left: inset,
    top: inset,
    right: GRID_SIZE - 1 - inset,
    bottom: GRID_SIZE - 1 - inset,
    size: GRID_SIZE - inset * 2
  };
}

function isInsideZoneCell(x, y, zone) {
  return x >= zone.left && x <= zone.right && y >= zone.top && y <= zone.bottom;
}

function isSamePosition(a, b) {
  return a.x === b.x && a.y === b.y;
}

function randomFreeCell(usedCells, zone) {
  while (true) {
    const candidate = {
      x: zone.left + Math.floor(Math.random() * zone.size),
      y: zone.top + Math.floor(Math.random() * zone.size)
    };
    const key = `${candidate.x},${candidate.y}`;
    if (!usedCells.has(key)) {
      usedCells.add(key);
      return candidate;
    }
  }
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
    const bot = createEntity(`bot-${i + 1}`, `Bot ${i + 1}`, "#ff8f8f", false);
    bots.push(bot);
  }
}

function aliveEntities() {
  return [player, ...bots].filter((entity) => entity.alive);
}

function beginPlanningPhase() {
  gameState = "planning";
  phaseTimer = PLANNING_DURATION;
  fireLines = [];
  resolutionActors = [];
  playerPlacementLocked = false;
  playerRoundKills = 0;
  lastRoundEliminatedCount = 0;
  activeZone = getZoneForRound(roundNumber);

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

  if (!isInsideZoneCell(player.x, player.y, activeZone) || isCellBlockedByAliveBot(player.x, player.y)) {
    const suggestedCell = randomFreeCell(usedCells, activeZone);
    player.x = suggestedCell.x;
    player.y = suggestedCell.y;
  }

  if (player.alive && player.selectedAngle === null) {
    player.selectedAngle = -Math.PI / 2;
  }

  resetJoystickStick();
  updateUI();
}

function beginResolutionPhase(nowSeconds) {
  finalizePlayerPlacement();

  gameState = "resolution";
  phaseTimer = RESOLUTION_DURATION;

  // Snapshot actors for this phase so shooter boxes stay visible during beam animation.
  resolutionActors = aliveEntities().map((entity) => ({
    id: entity.id,
    label: entity.label,
    color: entity.color,
    isPlayer: entity.isPlayer,
    x: entity.x,
    y: entity.y,
    selectedAngle: entity.selectedAngle
  }));

  fireLines = buildFireLinesFromActors(resolutionActors);
  const result = resolveHits(resolutionActors, fireLines);
  playerRoundKills = result.playerKills;
  lastRoundEliminatedCount = result.eliminatedCount;
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

function getRayEnd(shooter, angle, zone) {
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

  const positive = possible.filter((value) => value > 0);
  const t = Math.min(...positive);

  return {
    startX,
    startY,
    ux,
    uy,
    maxDistance: t,
    endX: startX + ux * t,
    endY: startY + uy * t
  };
}

function buildFireLinesFromActors(actors) {
  const lines = [];

  actors.forEach((shooter) => {
    if (shooter.selectedAngle === null) {
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

function getEntityById(id) {
  if (id === player.id) {
    return player;
  }
  return bots.find((bot) => bot.id === id) || null;
}

// Line-of-fire detection for any direction using distance-to-ray math.
// Also awards 1 score point per unique target hit.
function resolveHits(actors, lines) {
  const victims = new Set();
  const killsByShooter = new Map();

  lines.forEach((line) => {
    if (!killsByShooter.has(line.shooterId)) {
      killsByShooter.set(line.shooterId, new Set());
    }

    actors.forEach((target) => {
      if (target.id === line.shooterId) {
        return;
      }

      const tx = target.x + 0.5;
      const ty = target.y + 0.5;
      const dx = tx - line.startX;
      const dy = ty - line.startY;

      const forward = dx * line.ux + dy * line.uy;
      if (forward <= 0 || forward > line.maxDistance) {
        return;
      }

      const perpendicular = Math.abs(dx * line.uy - dy * line.ux);
      if (perpendicular <= HIT_RADIUS) {
        victims.add(target.id);
        killsByShooter.get(line.shooterId).add(target.id);
      }
    });
  });

  killsByShooter.forEach((kills, shooterId) => {
    const shooter = getEntityById(shooterId);
    if (shooter) {
      shooter.score += kills.size;
    }
  });

  const playerKills = killsByShooter.has(player.id) ? killsByShooter.get(player.id).size : 0;

  let eliminatedCount = 0;
  [player, ...bots].forEach((entity) => {
    if (victims.has(entity.id)) {
      entity.alive = false;
      eliminatedCount += 1;
    }
  });

  return {
    playerKills,
    eliminatedCount
  };
}

function chooseWinnerByPoints() {
  const allEntities = [player, ...bots];
  let best = allEntities[0];

  for (let i = 1; i < allEntities.length; i += 1) {
    const candidate = allEntities[i];
    if (candidate.score > best.score) {
      best = candidate;
    }
  }

  const topScorers = allEntities.filter((entity) => entity.score === best.score);
  if (topScorers.some((entity) => entity.id === player.id)) {
    return player;
  }

  return topScorers.sort((a, b) => a.id.localeCompare(b.id))[0] || null;
}

function updateWinnerIfFinished() {
  const survivors = aliveEntities();

  if (!player.alive && survivors.length > 1) {
    gameState = "gameover";
    winner = null;
    return;
  }

  if (survivors.length === 1) {
    gameState = "gameover";
    winner = survivors[0];
    return;
  }

  if (survivors.length === 0) {
    gameState = "gameover";
    winner = chooseWinnerByPoints();
  }
}

function angleToLabel(angle) {
  if (angle === null) {
    return "None";
  }
  const degrees = ((angle * 180) / Math.PI + 360) % 360;
  return `${degrees.toFixed(0)}°`;
}

// Phase management and timer logic are handled here.
function updatePhase(deltaSeconds, nowSeconds) {
  if (gameState === "gameover") {
    return;
  }

  phaseTimer -= deltaSeconds;

  if (gameState === "planning" && phaseTimer <= 0) {
    beginResolutionPhase(nowSeconds);
  } else if (gameState === "resolution" && phaseTimer <= 0) {
    updateWinnerIfFinished();
    if (gameState !== "gameover") {
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
  activeZone = getZoneForRound(1);
  setupEntities();
  beginPlanningPhase();
}

function updateUI() {
  roundEl.textContent = String(roundNumber);
  survivorsEl.textContent = String(aliveEntities().length);
  zoneEl.textContent = `${activeZone.size}x${activeZone.size}`;
  timerEl.textContent = Math.max(0, phaseTimer).toFixed(1);
  aimEl.textContent = angleToLabel(player.selectedAngle);
  scoreEl.textContent = String(player.score);
  roundKillsEl.textContent = String(playerRoundKills);
  roundElimsEl.textContent = String(lastRoundEliminatedCount);

  if (gameState === "planning") {
    if (!playerPlacementLocked) {
      statusEl.textContent = "Planning (10s): choose your tile, then set any aim angle.";
    } else {
      statusEl.textContent = "Planning (10s): placement locked, fine-tune 360° aim.";
    }
  } else if (gameState === "resolution") {
    statusEl.textContent = "Resolution: beams fired.";
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

function drawGrid() {
  const zone = activeZone;

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const insideZone = isInsideZoneCell(x, y, zone);
      const color = insideZone
        ? (x + y) % 2 === 0
          ? "#0f2d43"
          : "#143850"
        : "#07111b";

      ctx.fillStyle = color;
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

      ctx.strokeStyle = insideZone ? "#215673" : "#0d1a27";
      ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  ctx.save();
  ctx.strokeStyle = "#7de0ff";
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
  const padding = 8;
  ctx.fillStyle = entity.color;
  ctx.fillRect(
    entity.x * TILE_SIZE + padding,
    entity.y * TILE_SIZE + padding,
    TILE_SIZE - padding * 2,
    TILE_SIZE - padding * 2
  );
}

function drawPlanningPlacementPreview() {
  if (gameState !== "planning" || !player.alive) {
    return;
  }

  const x = player.x * TILE_SIZE;
  const y = player.y * TILE_SIZE;

  ctx.save();
  ctx.strokeStyle = playerPlacementLocked ? "#93e5ff" : "#ffd166";
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  ctx.globalAlpha = playerPlacementLocked ? 0.2 : 0.28;
  ctx.fillStyle = playerPlacementLocked ? "#67d6ff" : "#ffd166";
  ctx.fillRect(x + 5, y + 5, TILE_SIZE - 10, TILE_SIZE - 10);
  ctx.restore();
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
  ctx.strokeStyle = entity.isPlayer ? "#89d6ff" : "#ffb5b5";
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
    ctx.strokeStyle = "rgb(255 215 104 / 0.24)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(startPxX, startPxY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // Bright core beam.
    ctx.strokeStyle = "rgb(255 246 198 / 0.95)";
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
  if (gameState === "planning") {
    drawPlanningPlacementPreview();
    return;
  }

  if (gameState === "resolution") {
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
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
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
  if (!cell || gameState !== "planning" || !player.alive) {
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
  joystickStickEl.style.left = "50%";
  joystickStickEl.style.top = "50%";
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

window.addEventListener("keydown", (event) => {
  const key = event.key;

  if (key.toLowerCase() === "r") {
    restartGame();
    return;
  }

  if (gameState !== "planning" || !player.alive) {
    return;
  }

  if (CARDINAL_ANGLES[key] !== undefined) {
    event.preventDefault();
    player.selectedAngle = CARDINAL_ANGLES[key];
    updateUI();
  }
});

canvas.addEventListener("pointerdown", (event) => {
  const cell = getCanvasGridCell(event.clientX, event.clientY);
  setPlayerPlacementFromCell(cell);
});

joystickEl.addEventListener("pointerdown", (event) => {
  if (gameState !== "planning" || !player.alive) {
    return;
  }

  joystickPointerActive = true;
  joystickEl.setPointerCapture(event.pointerId);
  setDirectionFromJoystickPoint(event.clientX, event.clientY);
});

joystickEl.addEventListener("pointermove", (event) => {
  if (!joystickPointerActive || gameState !== "planning" || !player.alive) {
    return;
  }

  setDirectionFromJoystickPoint(event.clientX, event.clientY);
});

function stopJoystickPointer(event) {
  if (!joystickPointerActive) {
    return;
  }

  joystickPointerActive = false;
  if (typeof event.pointerId === "number") {
    joystickEl.releasePointerCapture(event.pointerId);
  }
  resetJoystickStick();
}

joystickEl.addEventListener("pointerup", stopJoystickPointer);
joystickEl.addEventListener("pointercancel", stopJoystickPointer);

restartGame();
requestAnimationFrame((time) => {
  lastTime = time;
  requestAnimationFrame(gameLoop);
});
