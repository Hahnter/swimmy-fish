(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const shell = document.getElementById('shell');
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
  const pokemonNames = { tentacool: 'Tentacool', starmie: 'Starmie', qwilfish: 'Qwilfish' };
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
      fish: { x: Math.max(138, W * 0.22), y: H * 0.45, vy: 0, rot: 0, trail: 0, wiggle: 0 },
      obstacles: [],
      bubbles: [],
      swimBubbles: [],
      collectibles: [],
      popups: [],
      spawn: 0.45,
      collectibleSpawn: 0.65,
      score: 0,
      passed: 0,
      splash: 0,
      invuln: 0,
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

  function splashNeeded() {
    return 5;
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

  function blockSelection(e) {
    e.preventDefault();
  }

  [canvas, shell].forEach((el) => {
    el.addEventListener('selectstart', blockSelection);
    el.addEventListener('dragstart', blockSelection);
    el.addEventListener('contextmenu', blockSelection);
  });
  document.addEventListener('selectionchange', () => {
    if (state?.mode === 'play') window.getSelection()?.removeAllRanges();
  });
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
    const top = pokemonObstacles[Math.floor(rand(0, pokemonObstacles.length))];
    const bottom = pokemonObstacles[Math.floor(rand(0, pokemonObstacles.length))];
    state.obstacles.push({
      kind: 'pokemon',
      x: W + 110,
      w: size,
      size,
      gapY: cy,
      gap,
      passed: false,
      top,
      bottom,
      topPhase: rand(0, Math.PI * 2),
      bottomPhase: rand(0, Math.PI * 2),
      moveAmp: H > W ? 46 : 36,
      moveRate: rand(1.25, 2.15)
    });
    addPopup('Wild ' + pokemonNames[top] + '!', W - 260, 108, '#ffef83');
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

    for (const b of state.swimBubbles) {
      b.x -= (state.speed * 0.34 + b.vx) * dt;
      b.y -= b.vy * dt;
      b.life -= dt;
      b.s += dt * 5;
    }
    state.swimBubbles = state.swimBubbles.filter(b => b.life > 0);

    for (const p of state.popups) {
      p.y -= 34 * dt;
      p.life -= dt;
    }
    state.popups = state.popups.filter(p => p.life > 0);

    for (const c of state.collectibles) {
      c.x -= state.speed * dt;
      c.phase += dt * 5;
      c.y += Math.sin(c.phase) * 18 * dt;
      c.rot += dt * 2.4;
    }
    state.collectibles = state.collectibles.filter(c => c.x > -80 && !c.collected);

    if (state.mode !== 'play') return;

    state.t += dt;
    state.invuln = Math.max(0, state.invuln - dt);
    state.score = state.passed;
    state.speed = Math.min(350, 245 + state.t * 2.2);
    state.gap = Math.max(minGap(), baseGap() - state.t * 0.28);
    const f = state.fish;
    f.wiggle += dt * (input.holding ? 18 : 8);
    const swimAccel = input.holding ? -1650 : 1120;
    f.vy += swimAccel * dt;
    f.vy = Math.max(-430, Math.min(620, f.vy));
    f.y += f.vy * dt;
    const targetRot = Math.max(-0.48, Math.min(0.86, f.vy / 680));
    f.rot += (targetRot - f.rot) * Math.min(1, dt * 10);
    if (input.holding) {
      f.trail -= dt;
      if (f.trail <= 0) {
        state.swimBubbles.push({
          x: f.x - 38,
          y: f.y + rand(-18, 18),
          s: rand(3, 7),
          vx: rand(8, 28),
          vy: rand(18, 52),
          life: rand(0.45, 0.8)
        });
        f.trail = 0.055;
      }
    }

    state.spawn -= dt;
    if (state.spawn <= 0) {
      spawnObstacle();
      state.spawn = Math.max(0.92, 1.55 - state.t * 0.012);
    }

    state.collectibleSpawn -= dt;
    if (state.collectibleSpawn <= 0) {
      spawnCollectible();
      state.collectibleSpawn = rand(1.45, 2.35);
    }

    collectItems();

    for (const o of state.obstacles) {
      o.x -= state.speed * dt;
      if (!o.passed && o.x + o.w < f.x - 35) {
        o.passed = true;
        state.passed++;
        state.score = state.passed;
        addPopup(state.passed % 5 === 0 ? 'Nice swim!' : 'Dodged!', f.x + 36, f.y - 28, '#b9fffb');
        beep(900, 0.035, 'square');
      }
      if (collide(o)) {
        if (state.invuln > 0) continue;
        if (state.splash >= splashNeeded()) {
          triggerSplash();
        } else {
          gameOver();
        }
      }
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
    const obstacleLeft = Math.min(bounds.top.x, bounds.bottom.x);
    const obstacleRight = Math.max(bounds.top.x + bounds.top.w, bounds.bottom.x + bounds.bottom.w);

    if (right < obstacleLeft || left > obstacleRight) return false;
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

  function collectItems() {
    const f = state.fish;
    for (const c of state.collectibles) {
      const d = Math.hypot(f.x - c.x, f.y - c.y);
      if (d > 48) continue;
      c.collected = true;
      state.splash = Math.min(splashNeeded(), state.splash + 1);
      addPopup(state.splash >= splashNeeded() ? 'Splash ready!' : '+Splash', c.x, c.y - 18, '#ffef83');
      beep(state.splash >= splashNeeded() ? 1040 : 760, 0.045, 'square');
    }
  }

  function spawnCollectible() {
    const nextObstacle = state.obstacles.find(o => o.x > W * 0.42) || state.obstacles[state.obstacles.length - 1];
    const laneY = nextObstacle ? nextObstacle.gapY : H * 0.5;
    const x = W + rand(40, 120);
    const y = Math.max(82, Math.min(H - 82, laneY + rand(-state.gap * 0.22, state.gap * 0.22)));
    state.collectibles.push({ x, y, phase: rand(0, Math.PI * 2), rot: rand(0, Math.PI * 2), collected: false });
  }

  function triggerSplash() {
    state.splash = 0;
    state.invuln = 1.25;
    state.hitFlash = 0.5;
    addPopup('Splash!', state.fish.x + 45, state.fish.y - 38, '#ffffff');
    beep(1180, 0.11, 'triangle');
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
    const topMotion = pokemonMotion(o.top, o.topPhase, o.moveRate, o.moveAmp, 'top');
    const bottomMotion = pokemonMotion(o.bottom, o.bottomPhase, o.moveRate, o.moveAmp, 'bottom');
    return {
      top: {
        x: o.x + topMotion.x,
        y: gapTop - o.size + topMotion.y,
        w: o.w * topMotion.scale,
        h: o.size * topMotion.scale,
        rot: topMotion.rot
      },
      bottom: {
        x: o.x + bottomMotion.x,
        y: gapBot + bottomMotion.y,
        w: o.w * bottomMotion.scale,
        h: o.size * bottomMotion.scale,
        rot: bottomMotion.rot
      }
    };
  }

  function pokemonMotion(kind, phase, rate, amp, side) {
    const t = state.t * rate + phase;
    if (kind === 'tentacool') {
      return {
        x: Math.sin(t * 0.7) * 12,
        y: Math.sin(t) * amp,
        scale: 1 + Math.sin(t * 1.8) * 0.035,
        rot: Math.sin(t * 0.8) * 0.05
      };
    }
    if (kind === 'starmie') {
      const towardGap = side === 'top' ? 18 : -18;
      return {
        x: Math.sin(t * 0.65) * 8,
        y: Math.sin(t * 0.9) * (amp * 0.48) + towardGap,
        scale: 1,
        rot: t * 1.65
      };
    }
    return {
      x: Math.sin(t * 1.2) * 10,
      y: Math.sin(t) * (amp * 0.72),
      scale: 1 + Math.max(0, Math.sin(t * 2.2)) * 0.16,
      rot: Math.sin(t) * 0.1
    };
  }

  function addPopup(text, x, y, color) {
    state.popups.push({ text, x, y, color, life: 1.15 });
    if (state.popups.length > 6) state.popups.shift();
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

  function drawCollectibles() {
    for (const c of state.collectibles) {
      const bob = Math.sin(c.phase) * 4;
      ctx.save();
      ctx.translate(c.x, c.y + bob);
      ctx.rotate(c.rot);
      ctx.shadowColor = '#ffef83';
      ctx.shadowBlur = 18;
      ctx.fillStyle = 'rgba(255,239,131,.22)';
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f54242';
      ctx.strokeStyle = '#10253b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 19, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI);
      ctx.fillStyle = '#f8fbff';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-19, 0);
      ctx.lineTo(19, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#f8fbff';
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
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
    for (const b of state.swimBubbles) {
      ctx.globalAlpha = Math.max(0, b.life * 1.4);
      ctx.drawImage(img.bubble, b.x, b.y, b.s, b.s);
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
        ctx.rotate((bounds.top.rot || 0) + pulse);
        ctx.drawImage(img[o.top], -bounds.top.w / 2, -bounds.top.h / 2, bounds.top.w, bounds.top.h);
        ctx.restore();

        ctx.save();
        const counterPulse = Math.sin(state.t * o.moveRate + o.bottomPhase) * -0.08;
        ctx.globalAlpha = 0.96;
        ctx.translate(bounds.bottom.x + bounds.bottom.w / 2, bounds.bottom.y + bounds.bottom.h / 2);
        ctx.rotate((bounds.bottom.rot || 0) + counterPulse);
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
    const bob = state.mode === 'title' ? Math.sin(performance.now() / 260) * 6 : Math.sin(f.wiggle) * 2.5;
    const stretch = input.holding ? 1 + Math.sin(f.wiggle * 1.4) * 0.045 : 1;
    ctx.scale(1 + (stretch - 1) * 0.8, 1 - (stretch - 1) * 0.55);
    ctx.drawImage(img.fish, -48, -48 + bob, 96, 96);
    ctx.restore();
    if (state.invuln > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(state.t * 24) * 0.18;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 52 + Math.sin(state.t * 12) * 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
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
    const meterX = H > W ? 32 : 318;
    const meterY = H > W ? 106 : 30;
    const meterW = H > W ? 190 : 160;
    ctx.fillStyle = 'rgba(185,255,251,.25)';
    ctx.fillRect(meterX, meterY, meterW, 18);
    ctx.fillStyle = state.splash >= splashNeeded() ? '#ffef83' : '#7eeaff';
    ctx.fillRect(meterX, meterY, meterW * (state.splash / splashNeeded()), 18);
    ctx.strokeStyle = '#dffcff';
    ctx.lineWidth = 2;
    ctx.strokeRect(meterX, meterY, meterW, 18);
    ctx.fillStyle = '#dffcff';
    ctx.font = '800 14px system-ui, Segoe UI, sans-serif';
    ctx.fillText('Splash', meterX, meterY + 38);
    ctx.textAlign = 'right';
    ctx.fillText('Magikarp Flap', W - 26, 48);
    ctx.textAlign = 'left';
  }

  function drawPopups() {
    ctx.save();
    ctx.textAlign = 'center';
    for (const p of state.popups) {
      const alpha = Math.min(1, p.life);
      ctx.globalAlpha = alpha;
      ctx.font = '900 20px system-ui, Segoe UI, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,22,40,.7)';
      ctx.fillStyle = p.color;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.restore();
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
    drawCollectibles();
    drawFish();
    panel();
    drawPopups();
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


