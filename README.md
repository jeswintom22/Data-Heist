# Data Heist

Data Heist is a compact browser game where you place your unit, choose an angle, and survive the shrinking zone while enemy rays fire across the board. Its interface is a flat, four-color 1960s heist-film title card built with HTML, CSS, and Canvas.

## Live Demo

https://data-heist-xi.vercel.app/

## Tech Stack

- HTML5 Canvas for rendering
- Vanilla JavaScript using ES modules
- CSS for the paper-cut poster layout and game styling
- Vitest for automated unit tests
- Vercel for deployment

## Run Locally

1. Install dependencies:

```powershell
npm install
```

2. Start the local server:

```powershell
npm start
```

3. Open the local URL shown in the terminal.

If you prefer, you can also open `index.html` directly in a browser, but a local server is recommended.

## Controls

- Click a tile on the grid during the planning phase to place your unit.
- Drag from your unit, use the optional joystick with mouse or touch, or use the Arrow keys to set your aim.
- Press Lock In to resolve the round early.
- Press R to restart, P or Esc to pause, and M to mute sound.

## Tests

Run the automated logic tests with:

```powershell
npm test
```

## Project Layout

- `index.html` is the entry point.
- `script.js` wires the modules and owns the animation loop.
- `src/core.js` contains reusable gameplay helpers.
- `src/gameLogic.js` contains ray resolution and win logic.
- `src/state.js` contains the phase machine and mutable run state.
- `src/render.js` contains high-DPI Canvas rendering.
- `src/fx.js` contains paper-cut hit particles, shake, and score text.
- `src/audio.js` contains Web Audio API sound effects.
- `src/ui.js` and `src/input.js` own DOM screens and controls.
- `src/botAi.js`, `src/stats.js`, `src/geometry.js`, and `src/timing.js` contain testable helpers.
- `test/` covers gameplay and pure helper logic.
