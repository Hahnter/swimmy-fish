(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const muteBtn = document.getElementById('muteBtn');
  let W = canvas.width, H = canvas.height;

  const img = {};
  const masks = {};
  const files = {
    bg: 'assets/underwater_background_tile.png',
    fish: 'assets/magikarp_pokeapi_129.png',
    coralTop: 'assets/coral_obstacle_top.png',
    coralBottom: 'assets/coral_obstacle_bottom.png',
    bubble: 'assets/bubble.png',
    tentacool: 'assets/tentacool_pokeapi_72.png',
    starmie: 'assets/starmie_pokeapi_121.png',
    qwilfish: 'assets/qwilfish_pokeapi_211.png'
  };

  const pokemonObstacles = ['tentacool', 'starmie', 'qwilfish'];
  const rand = (a, b) => a + Math.random() * (b - a);
  let loaded = 0;
  let state;
  let muted = false;
  let best = Math.floor(Number(localStorage.swimmyBest || 0));
  let rafStarted = false;
  let last = 0;
  const input = { holding: false };

  configureCanvas();
  window.addEventListener('resize', () => configureCanvas('title'));
  window.addEventListener('orientationchange', () => setTimeout(() => configureCanvas('title'), 120));

  Object.entries(files).forEach(([k, src]) => {
    img[k] = new Image();
    img[k].onload = () => {
      loaded++;
      if (loaded === Object.keys(files).length) {
        createMasks();
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
      fish: { x: Math.max(138, W * 0.22), y: H * 0.45, vy: 0, rot: 0 },
      obstacles: [],
      bubbles: [],
      spawn: 0.45,
      score: 0,
      passed: 0,
      speed: 245,
      gap: baseGap(),
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

  function configureCanvas(resetMode) {
    const portrait = window.innerHeight > window.innerWidth && window.innerWidth <= 820;
    const nextW = portrait ? 540 : 960;
    const nextH = portrait ? 960 : 540;
    document.documentElement.dataset.layout = portrait ? 'portrait' : 'landscape';
    if (canvas.width === nextW && canvas.height === nextH) return;
    canvas.width = nextW;
    canvas.height = nextH;
    W = nextW;
    H = nextH;
    if (state) reset(resetMode || (state.mode === 'play' ? 'title' : state.mode));
  }

  function baseGap() {
    return H > W ? 220 : 170;
  }

  function minGap() {
    return H > W ? 178 : 142;
  }

  function pokemonSize() {
    return H > W ? 112 : 104;
  }

  function coralWidth() {
    return H > W ? 126 : 146;
  }

  function createMasks() {
    masks.coralTop = createAlphaMask(img.coralTop);
    masks.coralBottom = createAlphaMask(img.coralBottom);
    masks.tentacool = createAlphaMask(img.tentacool);
    masks.starmie = createAlphaMask(img.starmie);
    masks.qwilfish = createAlphaMask(img.qwilfish);
  }

  function createAlphaMask(image) {
    const c = document.createElement('canvas');
    c.width = image.naturalWidth;
    c.height = image.naturalHeight;
    const maskCtx = c.getContext('2d');
    maskCtx.drawImage(image, 0, 0);
    return {
      w: c.width,
      h: c.height,
      alpha: maskCtx.getImageData(0, 0, c.width, c.height).data
    };
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

  function startSwim() {
    if (!state) return;
    if (state.mode !== 'play') reset('play');
    if (!input.holding) beep(520, 0.045, 'triangle');
    input.holding = true;
    state.fish.rot = -0.35;
  }

  function stopSwim() {
    input.holding = false;
  }

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      startSwim();
    }
    if (e.code === 'KeyR') reset('title');
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      stopSwim();
    }
  });
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    startSwim();
  });
  canvas.addEventListener('pointerup', stopSwim);
  canvas.addEventListener('pointercancel', stopSwim);
  canvas.addEventListener('pointerleave', stopSwim);
  window.addEventListener('blur', stopSwim);
  muteBtn.onclick = () => {
    muted = !muted;
    muteBtn.textContent = 'Sound: ' + (muted ? 'Off' : 'On');
  };

  function spawnObstacle() {
    const margin = H > W ? 126 : 96;
    const gap = state.gap;
    const cy = rand(margin + gap / 2, H - margin - gap / 2);
    if (Math.random() < 0.42) {
      state.obstacles.push({ kind: 'coral', x: W + 110, w: coralWidth(), gapY: cy, gap, passed: false });
      return;
    }
    const size = pokemonSize();
    state.obstacles.push({
      kind: 'pokemon',
      x: W + 110,
      w: size,
      size,
      gapY: cy,
      gap,
      passed: false,
      top: pokemonObstacles[Math.floor(rand(0, pokemonObstacles.length))],
      bottom: pokemonObstacles[Math.floor(rand(0, pokemonObstacles.length))],
      topPhase: rand(0, Math.PI * 2),
      bottomPhase: rand(0, Math.PI * 2),
      moveAmp: H > W ? 46 : 36,
      moveRate: rand(1.25, 2.15)
    });
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
    state.score = state.passed;
    state.speed = Math.min(350, 245 + state.t * 2.2);
    state.gap = Math.max(minGap(), baseGap() - state.t * 0.28);
    const f = state.fish;
    const swimAccel = input.holding ? -1650 : 1120;
    f.vy += swimAccel * dt;
    f.vy = Math.max(-430, Math.min(620, f.vy));
    f.y += f.vy * dt;
    const targetRot = Math.max(-0.48, Math.min(0.86, f.vy / 680));
    f.rot += (targetRot - f.rot) * Math.min(1, dt * 10);

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
        state.score = state.passed;
        beep(900, 0.035, 'square');
      }
      if (collide(o)) gameOver();
    }

    // Critical performance fix: keep the active obstacle list small forever.
    state.obstacles = state.obstacles.filter(o => o.x > -230);
    if (state.obstacles.length > 8) state.obstacles.splice(0, state.obstacles.length - 8);

    if (f.y < 18 || f.y > H - 40) gameOver();
  }

  function collide(o) {
    const f = state.fish;
    const rx = 31;
    const ry = 34;
    const bounds = obstacleBounds(o);
    const left = f.x - rx;
    const right = f.x + rx;
    const top = f.y - ry;
    const bottom = f.y + ry;

    if (right < o.x || left > o.x + o.w) return false;
    if (bottom < bounds.top.y || top > bounds.bottom.y + bounds.bottom.h) return false;

    for (let y = top; y <= bottom; y += 8) {
      for (let x = left; x <= right; x += 8) {
        const nx = (x - f.x) / rx;
        const ny = (y - f.y) / ry;
        if (nx * nx + ny * ny > 1) continue;
        if (o.kind === 'coral') {
          if (alphaHit(masks.coralTop, x, y, bounds.top.x, bounds.top.y, bounds.top.w, bounds.top.h)) return true;
          if (alphaHit(masks.coralBottom, x, y, bounds.bottom.x, bounds.bottom.y, bounds.bottom.w, bounds.bottom.h)) return true;
        } else {
          if (alphaHit(masks[o.top], x, y, bounds.top.x, bounds.top.y, bounds.top.w, bounds.top.h)) return true;
          if (alphaHit(masks[o.bottom], x, y, bounds.bottom.x, bounds.bottom.y, bounds.bottom.w, bounds.bottom.h)) return true;
        }
      }
    }
    return false;
  }

  function alphaHit(mask, worldX, worldY, drawX, drawY, drawW, drawH) {
    const localX = Math.floor((worldX - drawX) / drawW * mask.w);
    const localY = Math.floor((worldY - drawY) / drawH * mask.h);
    if (localX < 0 || localX >= mask.w || localY < 0 || localY >= mask.h) return false;
    return mask.alpha[(localY * mask.w + localX) * 4 + 3] > 48;
  }

  function obstacleBounds(o) {
    const gapTop = o.gapY - o.gap / 2;
    const gapBot = o.gapY + o.gap / 2;
    if (o.kind === 'coral') {
      return {
        top: { x: o.x, y: gapTop - 720, w: o.w, h: 720 },
        bottom: { x: o.x, y: gapBot, w: o.w, h: 720 }
      };
    }
    const topDrift = Math.sin(state.t * o.moveRate + o.topPhase) * o.moveAmp;
    const bottomDrift = Math.sin(state.t * o.moveRate + o.bottomPhase) * o.moveAmp;
    return {
      top: { x: o.x, y: gapTop - o.size + topDrift, w: o.w, h: o.size },
      bottom: { x: o.x, y: gapBot + bottomDrift, w: o.w, h: o.size }
    };
  }
  function gameOver() {
    if (state.mode !== 'play') return;
    state.mode = 'over';
    input.holding = false;
    state.hitFlash = 1;
    best = Math.max(best, state.score);
    localStorage.swimmyBest = String(best);
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
      const bounds = obstacleBounds(o);
      if (o.kind === 'coral') {
        ctx.drawImage(img.coralTop, bounds.top.x, bounds.top.y, bounds.top.w, bounds.top.h);
        ctx.drawImage(img.coralBottom, bounds.bottom.x, bounds.bottom.y, bounds.bottom.w, bounds.bottom.h);
      } else {
        ctx.save();
        const pulse = Math.sin(state.t * o.moveRate + o.topPhase) * 0.08;
        ctx.globalAlpha = 0.96;
        ctx.translate(bounds.top.x + bounds.top.w / 2, bounds.top.y + bounds.top.h / 2);
        ctx.rotate(pulse);
        ctx.drawImage(img[o.top], -bounds.top.w / 2, -bounds.top.h / 2, bounds.top.w, bounds.top.h);
        ctx.restore();

        ctx.save();
        const counterPulse = Math.sin(state.t * o.moveRate + o.bottomPhase) * -0.08;
        ctx.globalAlpha = 0.96;
        ctx.translate(bounds.bottom.x + bounds.bottom.w / 2, bounds.bottom.y + bounds.bottom.h / 2);
        ctx.rotate(counterPulse);
        ctx.drawImage(img[o.bottom], -bounds.bottom.w / 2, -bounds.bottom.h / 2, bounds.bottom.w, bounds.bottom.h);
        ctx.restore();
      }
    }
  }

  function drawFish() {
    const f = state.fish;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.scale(-1, 1);
    const bob = state.mode === 'title' ? Math.sin(performance.now() / 260) * 6 : 0;
    ctx.drawImage(img.fish, -48, -48 + bob, 96, 96);
    ctx.restore();
  }

  function panel() {
    ctx.font = '900 24px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(0,25,45,.52)';
    ctx.beginPath();
    ctx.roundRect(16, 14, 292, 84, 16);
    ctx.fill();
    ctx.fillStyle = '#dffcff';
    ctx.fillText('Score: ' + state.score, 32, 48);
    ctx.fillText('Best: ' + best, 32, 82);
    ctx.textAlign = 'right';
    ctx.fillText('Magikarp Flap', W - 26, 48);
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
    ctx.fillText('HOLD SPACE / PRESS / TOUCH to swim - R to restart', W / 2, H * 0.55);
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
    if (state.mode === 'title') overlay('Magikarp Flap', 'Hold to swim up. Release to sink.');
    if (state.mode === 'over') overlay('Splash Down!', 'Final score: ' + state.score);
    if (state.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${state.hitFlash * 0.4})`;
      ctx.fillRect(0, 0, W, H);
      state.hitFlash = Math.max(0, state.hitFlash - dt * 2);
    }
    requestAnimationFrame(loop);
  }
})();
