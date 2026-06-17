# Magikarp Flap

A self-contained HTML canvas game inspired by Flappy Bird. Hold space, click, or touch to swim upward, steer Magikarp through coral and Pokemon hazards, and chase a better local high score.

## Controls
- Hold Space / Arrow Up / click / touch: swim upward
- R: restart

## What changed in this build
- Integrated the PokeAPI Magikarp sprite as the player character in `assets/magikarp_pokeapi_129.png`.
- Added Tentacool, Starmie, and Qwilfish PokeAPI sprites as moving obstacle hazards.
- Restored coral obstacles so both coral gates and Pokemon hazards appear.
- Added portrait mobile canvas sizing plus basic PWA manifest and service worker files.
- Reworked scoring to count cleared obstacles instead of survival time.
- Tuned gravity, swim thrust, speed, and obstacle gaps for a hold-to-swim rhythm.
- Added swim bubble trails, score popups, and Pokemon-specific hazard motion.
- Added Pokeball bubble collectibles that charge an automatic defensive Splash meter.
- Seamless scrolling background rendering with extra tile coverage so blank spaces do not appear.
- Fixed the long-session lag: the old reset/start behavior could create multiple requestAnimationFrame loops after restarts. This version starts exactly one loop and keeps obstacle arrays capped/cleaned.

## Hosting
Upload this folder to any static host, including Cloudflare Pages.

## Asset Notes
The Pokemon sprites come from the PokeAPI sprites repository. PokeAPI notes that Pokemon image contents are copyright The Pokemon Company.
