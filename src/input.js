import { canvasPointToCell } from './geometry.js';
import { isCellBlockedByBot, setAim, setPlayerPlacement } from './state.js';
import { LOGICAL_CANVAS_SIZE, TILE_SIZE } from './render.js';

export function attachInput(ui, state, actions) {
  const { canvas, joystick, stick } = ui.elements;
  let joystickActive = false;
  let canvasAimActive = false;
  const getCell = (event) =>
    canvasPointToCell(
      event.clientX,
      event.clientY,
      canvas.getBoundingClientRect(),
      LOGICAL_CANVAS_SIZE,
      10
    );
  const setAngleFromPoint = (clientX, clientY) => {
    const rect = joystick.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    const radius = rect.width * 0.34;
    const ratio = distance > radius ? radius / distance : 1;
    stick.style.left = `${50 + ((dx * ratio) / (rect.width / 2)) * 50}%`;
    stick.style.top = `${50 + ((dy * ratio) / (rect.height / 2)) * 50}%`;
    if (distance > 8) setAim(state, Math.atan2(dy, dx));
  };
  canvas.addEventListener('pointerdown', (event) => {
    if (state.gameState !== 'planning') return;
    const cell = getCell(event);
    if (cell.x === state.player.x && cell.y === state.player.y) {
      canvasAimActive = true;
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (isCellBlockedByBot(state, cell.x, cell.y)) {
      actions.blocked();
      return;
    }
    if (setPlayerPlacement(state, cell)) actions.placed();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (state.gameState !== 'planning') return;
    state.hoverCell = getCell(event);
    if (!canvasAimActive) return;
    const rect = canvas.getBoundingClientRect();
    const scale = LOGICAL_CANVAS_SIZE / rect.width;
    const px = (event.clientX - rect.left) * scale;
    const py = (event.clientY - rect.top) * scale;
    setAim(
      state,
      Math.atan2(py - (state.player.y + 0.5) * TILE_SIZE, px - (state.player.x + 0.5) * TILE_SIZE)
    );
  });
  canvas.addEventListener('pointerleave', () => {
    state.hoverCell = null;
  });
  canvas.addEventListener('pointerup', () => {
    canvasAimActive = false;
  });
  joystick.addEventListener('pointerdown', (event) => {
    if (state.gameState === 'planning') {
      joystickActive = true;
      joystick.setPointerCapture(event.pointerId);
      setAngleFromPoint(event.clientX, event.clientY);
    }
  });
  joystick.addEventListener('pointermove', (event) => {
    if (joystickActive) setAngleFromPoint(event.clientX, event.clientY);
  });
  const stopJoystick = () => {
    joystickActive = false;
    stick.style.left = '50%';
    stick.style.top = '50%';
  };
  joystick.addEventListener('pointerup', stopJoystick);
  joystick.addEventListener('pointercancel', stopJoystick);
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'r') actions.restart();
    else if (key === 'p' || event.key === 'escape') actions.pause();
    else if (key === 'm') actions.mute();
    else if (
      state.gameState === 'planning' &&
      { arrowup: -Math.PI / 2, arrowdown: Math.PI / 2, arrowleft: Math.PI, arrowright: 0 }[key] !==
        undefined
    ) {
      event.preventDefault();
      setAim(
        state,
        { arrowup: -Math.PI / 2, arrowdown: Math.PI / 2, arrowleft: Math.PI, arrowright: 0 }[key]
      );
    }
  });
}
