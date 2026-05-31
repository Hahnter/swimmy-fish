# Swimmy Fish

A self-contained HTML endless swimmer game.

## Controls
- Space / Arrow Up / click / tap: swim upward
- R: restart

## What changed in this build
- Higher-quality pixel-style fish, coral, mine, bubble, and underwater background assets.
- Seamless scrolling background rendering with extra tile coverage so blank spaces do not appear.
- Fixed the long-session lag: the old reset/start behavior could create multiple requestAnimationFrame loops after restarts. This version starts exactly one loop and keeps obstacle arrays capped/cleaned.

## Hosting
Upload this folder to any static host, including Cloudflare Pages.
