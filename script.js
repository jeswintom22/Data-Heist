import { createAudio } from './src/audio.js';
import { createEffects, triggerHit, updateEffects } from './src/fx.js';
import { attachInput } from './src/input.js';
import { configureCanvas, drawGame } from './src/render.js';
import { clampDelta } from './src/timing.js';
import {
  beginPlanningPhase,
  createGameState,
  lockIn,
  restartGame,
  updatePhase,
} from './src/state.js';
import { createUi } from './src/ui.js';

const ui = createUi();
const state = createGameState();
const effects = createEffects();
const audio = createAudio();
const canvas = ui.elements.canvas;
const ctx = canvas.getContext('2d');
let paused = false;
let lastTimestamp = 0;
let tutorialStep = 0;
let previousRound = state.roundNumber;
let lastTickSecond = -1;

configureCanvas(canvas, ctx);

function startRun() {
  if (!ui.hasSeenTutorial()) {
    ui.hide(ui.elements.start);
    ui.show(ui.elements.tutorial);
    updateTutorial();
    return;
  }
  restartGame(state);
  ui.hideScreens();
  ui.showRoundCard(state);
  audio.click();
}

function updateTutorial() {
  const steps = [
    ['1 / PLACE', 'Choose an open tile inside the zone. Your unit is the black circle.'],
    ['2 / AIM', 'Drag from your unit, use the mustard joystick, or press an arrow key.'],
    ['3 / SURVIVE', 'Lock in before the clock drains and outlast the shrinking zone.'],
  ];
  const [title, copy] = steps[tutorialStep];
  ui.elements.tutorialStep.textContent = title;
  ui.elements.tutorialTitle.textContent = title.slice(3);
  ui.elements.tutorialCopy.textContent = copy;
  ui.elements.tutorialProgress.style.width = `${((tutorialStep + 1) / steps.length) * 100}%`;
  ui.elements.tutorialNext.textContent = tutorialStep === steps.length - 1 ? 'START RUN' : 'NEXT';
}

function togglePause() {
  if (state.gameState === 'title' || state.gameState === 'gameover') return;
  paused = !paused;
  if (paused) ui.show(ui.elements.pause);
  else ui.hide(ui.elements.pause);
  ui.elements.pauseButton.textContent = paused ? 'RESUME' : 'PAUSE';
}

function finishRoundEffects() {
  if (state.playerRoundKills > 0) {
    triggerHit(
      effects,
      (state.player.x + 0.5) * 48,
      (state.player.y + 0.5) * 48,
      state.playerRoundKills
    );
    audio.hit();
    ui.addKillFeed(`BOT ${state.playerRoundKills}`);
  }
}

attachInput(ui, state, {
  restart: () => {
    restartGame(state);
    paused = false;
    ui.hideScreens();
    audio.click();
  },
  pause: togglePause,
  mute: () => {
    const muted = audio.toggleMute();
    ui.elements.mute.textContent = muted ? 'MUTE OFF' : 'MUTE ON';
  },
  placed: () => audio.place(),
  blocked: () => {
    ui.announce('BLOCKED TILE / CHOOSE ANOTHER');
    audio.click();
  },
});

ui.elements.play.addEventListener('click', startRun);
ui.elements.playAgain.addEventListener('click', () => {
  restartGame(state);
  ui.hideScreens();
  audio.click();
});
ui.elements.ready.addEventListener('click', () => {
  if (lockIn(state, performance.now() / 1000)) audio.lockIn();
});
ui.elements.pauseButton.addEventListener('click', togglePause);
ui.elements.resume.addEventListener('click', togglePause);
ui.elements.pauseRestart.addEventListener('click', () => {
  restartGame(state);
  paused = false;
  ui.hideScreens();
});
ui.elements.restart.addEventListener('click', () => {
  restartGame(state);
  ui.hideScreens();
});
ui.elements.mute.addEventListener('click', () => {
  const muted = audio.toggleMute();
  ui.elements.mute.textContent = muted ? 'MUTE OFF' : 'MUTE ON';
});
ui.elements.tutorialNext.addEventListener('click', () => {
  if (tutorialStep < 2) {
    tutorialStep += 1;
    updateTutorial();
  } else {
    ui.markTutorialSeen();
    restartGame(state);
    ui.hideScreens();
    ui.showRoundCard(state);
    audio.click();
  }
});
ui.elements.tutorialSkip.addEventListener('click', () => {
  ui.markTutorialSeen();
  restartGame(state);
  ui.hideScreens();
  ui.showRoundCard(state);
});
ui.elements.howTo.addEventListener('click', () => ui.show(ui.elements.howToLayer));
ui.elements.howToClose.addEventListener('click', () => ui.hide(ui.elements.howToLayer));
ui.elements.pause.addEventListener('cancel', (event) => {
  event.preventDefault();
  if (paused) togglePause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !paused) togglePause();
});

function loop(timestamp) {
  const now = timestamp / 1000;
  const delta = clampDelta((timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;
  if (!paused) {
    const wasResolution = state.gameState === 'resolution';
    updatePhase(state, delta, now);
    updateEffects(effects, delta);
    if (state.roundNumber !== previousRound) {
      previousRound = state.roundNumber;
      ui.showRoundCard(state);
    }
    if (state.gameState === 'planning' && state.phaseTimer <= 3) {
      const tickSecond = Math.ceil(state.phaseTimer);
      if (tickSecond !== lastTickSecond) {
        lastTickSecond = tickSecond;
        audio.tick();
      }
    }
    if (!wasResolution && state.gameState === 'resolution') audio.fire();
    if (wasResolution && state.gameState === 'planning') finishRoundEffects();
    if (state.gameState === 'gameover' && !state.resultShown) {
      state.resultShown = true;
      ui.showResult(state);
      audio[state.winner?.id === 'player' ? 'win' : 'lose']();
    }
  }
  ui.update(state);
  drawGame(ctx, state, effects, now);
  requestAnimationFrame(loop);
}

beginPlanningPhase(state);
state.gameState = 'title';
ui.update(state);
requestAnimationFrame((timestamp) => {
  lastTimestamp = timestamp;
  requestAnimationFrame(loop);
});
