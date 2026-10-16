# Data Heist

A turn-based Canvas heist game about placing your runner, lining up the shot, and surviving the shrinking zone.

**Live demo:** https://data-heist-xi.vercel.app/

## Screenshots

<!-- TODO: Add polished screenshots to docs/screenshots/ and uncomment the image links below. -->
<!-- ![Title screen](docs/screenshots/title-screen.png) -->
<!-- ![Planning phase](docs/screenshots/planning-phase.png) -->
<!-- ![Result screen](docs/screenshots/result-screen.png) -->

## Game Overview

Each round has two phases:

1. **Planning:** Place the player circle on an open tile inside the current zone and choose an aim angle. The dotted line previews the ray to the zone edge.
2. **Fire:** The player and surviving bots fire simultaneously. Any unit intersecting a ray is eliminated, and the shooter receives one point per hit.

After each round, the safe zone shrinks toward the center. Tiles outside the next zone are marked with vermilion hatching before the next planning phase. The last surviving unit wins. If every unit is eliminated in the same fire phase, the winner is chosen by score, with the player winning ties.

Bots use random aim most of the time and aim toward the player's last known cell approximately 40% of the time. Bot behavior is isolated in `src/botAi.js` so the difficulty can be tuned without changing hit resolution.

## Controls

| Action         | Mouse                                             | Touch                                             | Keyboard                                          |
| -------------- | ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| Place          | Click an open board tile                          | Tap an open board tile                            | Tab to the board, then activate a focused control |
| Aim            | Drag from the player circle, or drag the joystick | Drag from the player circle, or drag the joystick | Arrow keys                                        |
| Lock in        | Click **LOCK IN**                                 | Tap **LOCK IN**                                   | Focus **LOCK IN**, then Enter or Space            |
| Pause / resume | Click **PAUSE**                                   | Tap **PAUSE**                                     | `P` or `Esc`                                      |
| Mute / unmute  | Click **MUTE ON/OFF**                             | Tap **MUTE ON/OFF**                               | `M`                                               |
| Restart        | Click **RESTART**                                 | Tap **RESTART**                                   | `R`                                               |

## Design Notes

The interface uses flat cut-paper geometry inspired by 1960s heist-film title sequences: oversized off-axis typography, hard borders, solid shapes, and poster-like asymmetry.

- **Palette:** paper cream `#EFE6D2`, ink `#14110F`, vermilion `#E8472B`, and mustard `#E9B22E`.
- **Typography:** Archivo for body and display text, with Impact / Arial Black fallbacks.
- **Player and bots:** The player is an ink circle with a mustard center; bots are vermilion triangles. Shape and color both communicate team identity.
- **Accessibility:** Reduced-motion styles, visible keyboard focus, keyboard play, high-contrast palette, semantic buttons/dialogs, live phase announcements, and touch-safe Canvas/joystick controls.

## Tech Stack

- Vanilla JavaScript ES modules
- HTML5 Canvas with device-pixel-ratio rendering
- CSS poster layout with no build step
- Web Audio API for generated sound effects
- Vitest, ESLint, Prettier, and Husky for quality checks
- Vercel static hosting

## Project Layout

- `index.html` - static entry point, metadata, screens, and controls.
- `style.css` - responsive 1960s paper-cut visual system.
- `script.js` - module wiring and the animation loop.
- `src/core.js` - pure angle, zone, and ray helpers.
- `src/gameLogic.js` - ray construction, collision resolution, scoring, and winner selection.
- `src/state.js` - mutable game state and planning/fire phase machine.
- `src/render.js` - Canvas board, units, aim preview, beams, and high-DPI setup.
- `src/fx.js` - particles, screen shake, hit flash, and floating score text.
- `src/audio.js` - Web Audio API sound effects and mute persistence.
- `src/ui.js` - HUD, title/tutorial, dialogs, result stats, and localStorage helpers.
- `src/input.js` - pointer, touch, joystick, and keyboard controls.
- `src/botAi.js` - testable bot aiming behavior.
- `src/stats.js` - testable score and storage helpers.
- `src/geometry.js` - responsive Canvas coordinate mapping.
- `src/timing.js` - frame-delta clamping and easing helpers.
- `test/gameLogic.test.js` - core hit and winner tests.
- `test/helpers.test.js` - bot, stats, timing, and coordinate helper tests.
- `.github/workflows/ci.yml` - install, lint, and test workflow.
- `.github/workflows/vercel-deploy.yml` - static production deployment workflow.
- `vercel.json` - Vercel project configuration.

## Scripts

```powershell
npm start       # Serve the static site locally
npm test        # Run Vitest
npm run lint    # Run ESLint
npm run format  # Format the repository with Prettier
```

## Testing and Quality

The test suite covers ray construction, hit resolution, score updates, winner selection, bot aim selection, DPR coordinate mapping, timing helpers, and guarded best-score storage.

Run the complete local gate with:

```powershell
npm install
npm run format
npm run lint
npm test
```

CI runs `npm ci`, `npm run lint`, and `npm test` on pull requests and pushes to `main` through `.github/workflows/ci.yml`.

## Deployment

Data Heist is a static site deployed to free Vercel hosting. There is no build step, backend, database, serverless function, or runtime dependency. The Vercel workflow serves the repository as-is after its no-op build step.

## Roadmap

- Difficulty levels with configurable bot count and planning time.
- Achievements such as Double Kill and Survive Five Rounds.
- Daily seed, streak tracking, and richer bot tactics.
- Additional title-card variations and screenshot coverage in `docs/screenshots/`.

## License

MIT
