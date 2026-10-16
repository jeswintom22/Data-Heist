import { calculateRunStats, readStoredNumber, writeStoredNumber } from './stats.js';

const BEST_SCORE_KEY = 'dataHeistBestScore';
const TUTORIAL_KEY = 'dataHeistTutorialSeen';

export function createUi(documentRef = document) {
  const get = (id) => documentRef.getElementById(id);
  const elements = {
    canvas: get('gameCanvas'),
    joystick: get('joystick'),
    stick: get('joystickStick'),
    round: get('round'),
    survivors: get('survivors'),
    zone: get('zone'),
    timer: get('timer'),
    score: get('score'),
    aim: get('aim'),
    phase: get('phaseLabel'),
    status: get('status'),
    timerBar: get('timerBar'),
    compass: get('compass'),
    killFeed: get('killFeed'),
    roundCard: get('roundCard'),
    startBestScore: get('startBestScore'),
    start: get('startScreen'),
    tutorial: get('tutorialLayer'),
    tutorialStep: get('tutorialStep'),
    tutorialTitle: get('tutorialTitle'),
    tutorialCopy: get('tutorialCopy'),
    tutorialProgress: documentRef.querySelector('.tutorial-progress span'),
    tutorialNext: get('tutorialNextBtn'),
    tutorialSkip: get('tutorialSkipBtn'),
    pause: get('pauseLayer'),
    result: get('resultLayer'),
    resultTitle: get('resultTitle'),
    resultEyebrow: get('resultEyebrow'),
    resultScore: get('resultScore'),
    resultKills: get('resultKills'),
    resultRounds: get('resultRounds'),
    bestScore: get('bestScore'),
    newBest: get('newBest'),
    mute: get('muteBtn'),
    pauseButton: get('pauseBtn'),
    ready: get('readyBtn'),
    restart: get('restartBtn'),
    play: get('playBtn'),
    playAgain: get('playAgainBtn'),
    pauseRestart: get('pauseRestartBtn'),
    resume: get('resumeBtn'),
    howTo: get('howToBtn'),
    howToLayer: get('howToLayer'),
    howToClose: get('howToClose'),
  };
  let storage = null;
  try {
    storage = documentRef.defaultView?.localStorage;
  } catch {
    storage = null;
  }
  const safeGet = (key) => {
    try {
      return storage?.getItem(key);
    } catch {
      return null;
    }
  };
  return {
    elements,
    hasSeenTutorial: () => safeGet(TUTORIAL_KEY) === '1',
    markTutorialSeen: () => {
      try {
        storage?.setItem(TUTORIAL_KEY, '1');
      } catch {
        /* optional */
      }
    },
    bestScore: () => readStoredNumber(storage, BEST_SCORE_KEY),
    update(state) {
      elements.round.textContent = String(state.roundNumber);
      elements.survivors.textContent = String(
        [state.player, ...state.bots].filter((actor) => actor.alive).length
      );
      elements.zone.textContent = `${state.activeZone.size}x${state.activeZone.size}`;
      elements.timer.textContent = Math.max(0, state.phaseTimer).toFixed(1);
      elements.score.textContent = String(state.player.score);
      elements.startBestScore.textContent = String(this.bestScore());
      elements.aim.textContent =
        state.player.selectedAngle === null
          ? '000°'
          : `${Math.round(((state.player.selectedAngle * 180) / Math.PI + 360) % 360)}°`;
      elements.phase.textContent =
        state.gameState === 'resolution'
          ? 'FIRE!'
          : state.gameState === 'planning'
            ? 'PLANNING'
            : state.gameState === 'gameover'
              ? 'BUSTED'
              : 'READY';
      elements.status.textContent =
        state.gameState === 'planning'
          ? 'CHOOSE YOUR TILE / SET YOUR VECTOR'
          : state.gameState === 'resolution'
            ? 'THE JOB IS LIVE'
            : '';
      const progress = Math.max(0, Math.min(1, state.phaseTimer / 10));
      elements.timerBar.style.transform = `scaleX(${progress})`;
      elements.timerBar.dataset.state =
        progress <= 0.3 ? 'danger' : progress <= 0.6 ? 'warn' : 'normal';
    },
    show(layer) {
      if (!layer) return;
      if (layer.tagName === 'DIALOG' && !layer.open) layer.showModal();
      else layer.classList.add('active');
    },
    hide(layer) {
      if (!layer) return;
      if (layer.tagName === 'DIALOG' && layer.open) layer.close();
      else layer.classList.remove('active');
    },
    hideScreens() {
      [elements.start, elements.tutorial].forEach((layer) => layer?.classList.remove('active'));
      [elements.pause, elements.result, elements.howToLayer].forEach((layer) => {
        if (layer?.open) layer.close();
      });
    },
    showResult(state) {
      const oldBest = readStoredNumber(storage, BEST_SCORE_KEY);
      const stats = calculateRunStats(
        state.player,
        state.roundNumber,
        state.roundKillsTotal,
        oldBest
      );
      writeStoredNumber(storage, BEST_SCORE_KEY, stats.best);
      elements.resultEyebrow.textContent =
        state.winner?.id === 'player' ? 'THE JOB IS CLEAN' : 'THE JOB WENT SOUTH';
      elements.resultTitle.textContent = state.winner?.id === 'player' ? 'YOU WIN' : 'BUSTED';
      elements.resultScore.textContent = String(stats.score);
      elements.resultKills.textContent = String(stats.kills);
      elements.resultRounds.textContent = String(stats.rounds);
      elements.bestScore.textContent = String(stats.best);
      elements.newBest.hidden = !stats.isNewBest;
      this.show(elements.result);
      elements.playAgain.focus();
    },
    addKillFeed(label) {
      const item = documentRef.createElement('span');
      item.textContent = `YOU > ${label.toUpperCase()}`;
      elements.killFeed.replaceChildren(item);
      window.setTimeout(() => item.remove(), 3000);
    },
    showRoundCard(state) {
      elements.roundCard.textContent = `ROUND ${state.roundNumber} / ZONE ${state.activeZone.size}x${state.activeZone.size}`;
      elements.roundCard.classList.remove('active');
      void elements.roundCard.offsetWidth;
      elements.roundCard.classList.add('active');
    },
    announce(message) {
      elements.status.textContent = message;
    },
  };
}
