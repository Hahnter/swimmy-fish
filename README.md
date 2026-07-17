# Hahnter Arcade

A static gaming hub that hosts a growing collection of small browser games. The
root `index.html` is the arcade landing page; each game lives in its own folder
under `games/` and links back to the hub.

## Structure
- `index.html` + `hub.css` — the arcade hub landing page with game cards.
- `sw.js` + `manifest.webmanifest` — shared PWA service worker and manifest so
  the hub and every game work offline once loaded.
- `games/magikarp-flap/` — the first game (see below). New games get their own
  folder here plus a card on the hub page.

## Adding a new game
1. Create `games/<your-game>/` with its own `index.html` and assets.
2. Add a card for it in the root `index.html` (copy the Magikarp Flap card).
3. Add its files to the `ASSETS` list in `sw.js` and bump `CACHE_NAME`.

## Magikarp Flap

A self-contained HTML canvas game inspired by Flappy Bird. Hold space, click,
or touch to swim upward, steer Magikarp through coral and Pokemon hazards, and
chase a better local high score.

### Controls
- Hold Space / Arrow Up / click / touch: swim upward
- R: restart
- P: pause / resume (also auto-pauses when the tab is hidden)

### What changed in this build
- Restructured the repo into a gaming hub: arcade landing page at the root,
  game moved to `games/magikarp-flap/`, shared service worker for offline play.
- Fixed a long-standing rendering bug: the background tile's light shafts and
  rock ridge are transparent pixels and rendered as black cutouts. An ocean
  gradient now sits underneath, so they show as proper sunbeams and scenery.
- Graphics: animated god rays, drifting plankton motes, parallax sea-floor
  silhouette, vignette, depth-tinted water that darkens with each route.
- Animation: death tumble (Magikarp spins and sinks before the game-over
  screen), screen shake on hits and Splash saves, particle bursts and shock
  rings for collecting, Splash, and crashes, scale-in score popups.
- Gameplay: perfect-pass combo system (thread the center of a gap for bonus
  points; every 3-streak charges the Splash meter), medals on the results
  screen (Bronze / Silver / Gold / Gyarados), NEW BEST celebration, pause
  support, and a short input guard on the game-over screen so you can't
  accidentally restart.
- Kept from earlier builds: PokeAPI sprites, alpha-mask collision, Splash
  meter collectibles, route difficulty waves, capped obstacle arrays and a
  single requestAnimationFrame loop.

## Hosting
Upload this folder to any static host, including Cloudflare Pages or GitHub
Pages. The hub is the site root; games are plain subfolders.

## Asset Notes
The Pokemon sprites come from the PokeAPI sprites repository. PokeAPI notes
that Pokemon image contents are copyright The Pokemon Company.
