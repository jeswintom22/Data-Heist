# Data Heist

Data Heist is a compact browser game where you place your unit, choose an angle, and survive the shrinking zone while enemy rays fire across the board.

## Live Demo

https://data-heist-xi.vercel.app/

## Tech Stack

- HTML5 Canvas for rendering
- Vanilla JavaScript using ES modules
- CSS for layout and game styling
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
- Use the on-screen joystick with mouse or touch, or use the Arrow keys, to set your aim.
- Press Space or Enter while the joystick is focused to lock placement.
- Press R or click Restart to begin a new game.

## Tests

Run the automated logic tests with:

```powershell
npm test
```

## Project Layout

- `index.html` is the entry point.
- `script.js` contains the main game loop and canvas rendering.
- `src/core.js` contains reusable gameplay helpers.
- `src/gameLogic.js` contains ray resolution and win logic.
- `test/gameLogic.test.js` covers the pure game logic.

