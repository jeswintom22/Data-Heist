# Data-Heist

Data Heist is a small browser-based turn-based prediction duel implemented with HTML5 Canvas, vanilla JavaScript, and CSS.

## How to run

- Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).

Or run a simple local server (recommended for module support):

```powershell
npx serve .
```

## Controls

- Click a tile on the grid to set your placement (during the planning phase).
- Use the on-screen joystick (mouse/touch) or the Arrow keys to set aim.
- Press Space or Enter while the joystick is focused to lock placement.
- Press `R` or click the Restart button to restart the game.

## Improvements made

- Accessibility: canvas is focusable, joystick supports keyboard control, visible focus outlines, and a restart button was added.
- UX: added a description meta tag and a noscript message for users without JavaScript.

## Developer utilities

- `test.html` — simple browser-based tests for core helpers. Open it in a browser to run.
- `package.json` — includes `start` script using `serve` (install via `npm i -g serve` or use `npx serve`).

## Next suggestions

- Add `eslint` and `prettier` for automated linting/formatting.
- Extract more pure logic into `src/core.js` for easier unit testing.

## Notes

This is intentionally small and dependency-free. Contributions and suggestions welcome.
