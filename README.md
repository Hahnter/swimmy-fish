# Magikarp Flap

A self-contained HTML canvas game inspired by Flappy Bird. Tap, click, or press a key to flap upward, steer Magikarp through coral and Pokemon hazards, and chase a better local high score.

## Controls
- Space / Arrow Up / click / tap: flap upward
- R: restart

## What changed in this build
- Integrated the PokeAPI Magikarp sprite as the player character in `assets/magikarp_pokeapi_129.png`.
- Added Tentacool, Starmie, and Qwilfish PokeAPI sprites as obstacle hazards.
- Restored coral obstacles so both coral gates and Pokemon hazards appear.
- Added portrait mobile canvas sizing plus basic PWA manifest and service worker files.
- Reworked scoring to count cleared obstacles instead of survival time.
- Tuned gravity, flap strength, speed, and obstacle gaps for a Flappy Bird-style rhythm.
- Seamless scrolling background rendering with extra tile coverage so blank spaces do not appear.
- Fixed the long-session lag: the old reset/start behavior could create multiple requestAnimationFrame loops after restarts. This version starts exactly one loop and keeps obstacle arrays capped/cleaned.

## Hosting
Upload this folder to any static host, including Cloudflare Pages.

## Asset Notes
The Pokemon sprites come from the PokeAPI sprites repository. PokeAPI notes that Pokemon image contents are copyright The Pokemon Company.
