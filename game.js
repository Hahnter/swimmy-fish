(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const muteBtn = document.getElementById('muteBtn');
  const W = canvas.width, H = canvas.height;

  const img = {};
  const files = {
    bg: 'assets/underwater_background_tile.png',
    fish: 'assets/swimmy_fish_game.png',
    coralTop: 'assets/coral_obstacle_top.png',
    coralBottom: 'assets/coral_obstacle_bottom.png',
    mine: 'assets/urchin_mine.png',
    bubble: 'assets/bubble.png'
  };

  const rand = (a, b) => a + Math.random() * (b - a);
  let loaded = 0;
  let state;
  let muted = false;
  let best = Number(localStorage.swimmyBest || 0);
  let rafStarted = false;
  let last = 0;

  Object.entries(files).forEach(([k, src]) => {
    img[k] = new Image();
    img[k].onload = () => {
      loaded++;
      if (loaded === Object.keys(files).length) {
        reset('title');
        startLoopOnce();
      }
    };
    img[k].src = src;
  });

  function reset(mode = 'title') {
    state = {
      mode,
      t: 0,
      bgx: 0,
      fish: { x: 195, y: H * 0.45, vy: 0, rot: 0 },
      obstacles: [],
      bubbles: [],
      spawn: 0.45,
      score: 0,
      passed: 0,
      speed: 210,
      gap: 188,
      hitFlash: 0
    };
    for (let i = 0; i < 32; i++) {
      state.bubbles.push({ x: rand(0, W), y: rand(0, H), s: rand(0.25, 0.95), v: rand(14, 42) });
    }
  }

  function startLoopOnce() {
    if (rafStarted) return;
    rafStarted = true;
    requestAnimationFrame(loop);
  }

  function beep(freq = 480, dur = 0.05, type = 'sine') {
    if (muted) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = beep.ac || (beep.ac = new AC());
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0.03;
    o.connect(g);
    g.connect(ac.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.stop(ac.currentTime + dur);
  }

  function swim() {
    if (!state) return;
    if (state.mode !== 'play') reset('play');
    state.fish.vy = -330;
    state.fish.rot = -0.27;
    beep(630, 0.055, 'triangle');
  }

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      swim();
    }
    if (e.code === 'KeyR') reset('title');
  });
  canvas.addEventListener('pointerdown', swim);
  muteBtn.onclick = () => {
    muted = !muted;
    muteBtn.textContent = 'Sound: ' + (muted ? 'Off' : 'On');
  };

  function spawnObstacle() {
    const margin = 78;
    const gap = state.gap;
    const cy = rand(margin + gap / 2, H - margin - gap / 2);
    const kind = Math.random() < 0.84 ? 'coral' : 'mine';
    state.obstacles.push({ x: W + 110, w: 146, gapY: cy, gap, passed: false, kind, phase: rand(0, 10) });
  }

  function update(dt) {
    if (!state) return;
    const bgWidth = img.bg.naturalWidth || 1024;
    state.bgx = (state.bgx + state.speed * 0.28 * dt) % bgWidth;

    for (const b of state.bubbles) {
      b.y -= b.v * dt;
      b.x -= state.speed * 0.11 * dt * b.s;
      if (b.y < -40) { b.y = H + 40; b.x = rand(0, W + 160); b.s = rand(0.25, 0.95); }
      if (b.x < -40) b.x = W + 40;
    }

    if (state.mode !== 'play') return;

    state.t += dt;
    state.score = state.t;
    state.speed = Math.min(372, 210 + state.t * 3.1);
    state.gap = Math.max(134, 188 - state.t * 0.43);

    const f = state.fish;
    f.vy += 820 * dt;
    f.y += f.vy * dt;
    f.rot = Math.min(0.65, f.rot + 1.8 * dt);

    state.spawn -= dt;
    if (state.spawn <= 0) {
      spawnObstacle();
      state.spawn = Math.max(0.92, 1.55 - state.t * 0.012);
    }

    for (const o of state.obstacles) {
      o.x -= state.speed * dt;
      if (!o.passed && o.x + o.w < f.x - 35) {
        o.passed = true;
        state.passed++;
        beep(900, 0.035, 'square');
      }
      if (collide(o)) gameOver();
    }

    // Critical performance fix: keep the active obstacle list small forever.
    state.obstacles = state.obstacles.filter(o => o.x > -230);
    if (state.obstacles.length > 8) state.obstacles.splice(0, state.obstacles.length - 8);

    if (f.y < 22 || f.y > H - 48) gameOver();
  }

  function collide(o) {
    const f = state.fish;
    const fx = f.x - 41, fy = f.y - 30, fw = 82, fh = 60;
    if (o.kind === 'mine') {
      const mx = o.x + o.w / 2;
      const my = o.gapY + Math.sin(state.t * 2 + o.phase) * 78;
      return Math.hypot(f.x - mx, f.y - my) < 68;
    }
    const gapTop = o.gapY - o.gap / 2;
    const gapBot = o.gapY + o.gap / 2;
    const inX = fx + fw > o.x && fx < o.x + o.w;
    return inX && (fy < gapTop || fy + fh > gapBot);
  }

  function gameOver() {
    if (state.mode !== 'play') return;
    state.mode = 'over';
    state.hitFlash = 1;
    best = Math.max(best, state.score);
    localStorage.swimmyBest = best.toFixed(2);
    beep(130, 0.18, 'sawtooth');
  }

  function drawBg() {
    const bgWidth = img.bg.naturalWidth || 1024;
    const x = -state.bgx;
    // Draw enough copies to cover the canvas at all offsets. No blank seam, ever.
    for (let tx = x - bgWidth; tx < W + bgWidth; tx += bgWidth) {
      ctx.drawImage(img.bg, Math.floor(tx), 0, bgWidth, H);
    }

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(176,248,255,.14)');
    g.addColorStop(0.55, 'rgba(0,72,122,.04)');
    g.addColorStop(1, 'rgba(0,15,38,.26)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const b of state.bubbles) {
      ctx.globalAlpha = 0.35 + b.s * 0.35;
      ctx.drawImage(img.bubble, b.x, b.y, 34 * b.s, 34 * b.s);
    }
    ctx.globalAlpha = 1;
  }

  function drawObstacles() {
    for (const o of state.obstacles) {
      if (o.kind === 'mine') {
        const y = o.gapY + Math.sin(state.t * 2 + o.phase) * 78;
        ctx.drawImage(img.mine, o.x - 8, y - 80, 160, 160);
        continue;
      }
      const gapTop = o.gapY - o.gap / 2;
      const gapBot = o.gapY + o.gap / 2;
      ctx.drawImage(img.coralTop, o.x, gapTop - 720, o.w, 720);
      ctx.drawImage(img.coralBottom, o.x, gapBot, o.w, 720);
    }
  }

  function drawFish() {
    const f = state.fish;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    const bob = state.mode === 'title' ? Math.sin(performance.now() / 260) * 6 : 0;
    ctx.drawImage(img.fish, -64, -48 + bob, 128, 96);
    ctx.restore();
  }

  function panel() {
    ctx.font = '900 24px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(0,25,45,.52)';
    ctx.beginPath();
    ctx.roundRect(16, 14, 292, 84, 16);
    ctx.fill();
    ctx.fillStyle = '#dffcff';
    ctx.fillText('Time: ' + state.score.toFixed(1) + 's', 32, 48);
    ctx.fillText('Coral cleared: ' + state.passed, 32, 82);
    ctx.textAlign = 'right';
    ctx.fillText('Best: ' + best.toFixed(1) + 's', W - 26, 48);
    ctx.textAlign = 'left';
  }

  function overlay(title, sub) {
    ctx.fillStyle = 'rgba(0,18,36,.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 64px system-ui, Segoe UI, sans-serif';
    ctx.strokeStyle = '#00344d';
    ctx.lineWidth = 8;
    ctx.strokeText(title, W / 2, H * 0.35);
    ctx.fillText(title, W / 2, H * 0.35);
    ctx.font = '800 24px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = '#c8fbff';
    ctx.fillText(sub, W / 2, H * 0.47);
    ctx.font = '700 18px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = '#92e8f3';
    ctx.fillText('SPACE / CLICK / TAP to swim • R to restart', W / 2, H * 0.55);
    ctx.textAlign = 'left';
  }

  function loop(ts) {
    const dt = Math.min(0.033, (ts - last) / 1000 || 0);
    last = ts;
    update(dt);
    ctx.clearRect(0, 0, W, H);
    drawBg();
    drawObstacles();
    drawFish();
    panel();
    if (state.mode === 'title') overlay('Swimmy Fish', 'Stay alive as long as possible.');
    if (state.mode === 'over') overlay('Fish Food!', 'You lasted ' + state.score.toFixed(1) + ' seconds.');
    if (state.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${state.hitFlash * 0.4})`;
      ctx.fillRect(0, 0, W, H);
      state.hitFlash = Math.max(0, state.hitFlash - dt * 2);
    }
    requestAnimationFrame(loop);
  }
})();
