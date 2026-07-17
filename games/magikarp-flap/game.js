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
  const medals = [
    { score: 80, name: 'Gyarados', color: '#8ee6ff', ring: '#2f6f9f' },
    { score: 50, name: 'Gold', color: '#ffd94d', ring: '#8f6a00' },
    { score: 25, name: 'Silver', color: '#dfe8f2', ring: '#6d7d8f' },
    { score: 10, name: 'Bronze', color: '#e2a05f', ring: '#7a4b1f' }
  ];
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
      floorx: 0,
      fish: { x: Math.max(138, W * 0.22), y: H * 0.45, vy: 0, rot: 0, trail: 0, wiggle: 0 },
      obstacles: [],
      bubbles: [],
      motes: [],
      swimBubbles: [],
      collectibles: [],
      particles: [],
      popups: [],
      spawn: 0.45,
      collectibleSpawn: 0.65,
      score: 0,
      passed: 0,
      bonus: 0,
      streak: 0,
      splash: 0,
      invuln: 0,
      speed: 245,
      gap: baseGap(),
      route: 0,
      routeFlash: 0,
      hitFlash: 0,
      shake: 0,
      dyingT: 0,
      overT: 0,
      newBest: false,
      medal: null
    };
    for (let i = 0; i < 32; i++) {
      state.bubbles.push({ x: rand(0, W), y: rand(0, H), s: rand(0.25, 0.95), v: rand(14, 42) });
    }
    for (let i = 0; i < 42; i++) {
      state.motes.push({ x: rand(0, W), y: rand(0, H), s: rand(1, 2.6), v: rand(4, 13), drift: rand(0, Math.PI * 2) });
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

  function hardMinGap() {
    return H > W ? 166 : 132;
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

  function routeLevel() {
    return Math.floor((state?.passed || 0) / 10);
  }

  function routeName(level = routeLevel()) {
    const names = ['Shallow Route', 'Kelp Channel', 'Deep Current', 'Abyssal Drift'];
    return names[Math.min(level, names.length - 1)];
  }

  function pokemonChance() {
    const passed = state?.passed || 0;
    if (passed < 5) return 0;
    if (passed < 12) return 0.32;
    return Math.min(0.74, 0.46 + routeLevel() * 0.09);
  }

  function medalFor(score) {
    return medals.find(m => score >= m.score) || null;
  }

  function alpha(value) {
    return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
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

  function beep(freq = 480, dur = 0.05, type = 'sine', gain = 0.03) {
    if (muted) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = beep.ac || (beep.ac = new AC());
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(ac.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.stop(ac.currentTime + dur);
  }

  function chord(freqs, dur = 0.12, type = 'triangle') {
    freqs.forEach((f, i) => setTimeout(() => beep(f, dur, type, 0.024), i * 55));
  }

  function startSwim() {
    if (!state) return;
    if (state.mode === 'dying') return;
    if (state.mode === 'pause') { state.mode = 'play'; return; }
    if (state.mode === 'over') {
      if (state.overT < 0.55) return;
      reset('play');
    }
    if (state.mode !== 'play') reset('play');
    if (!input.holding) beep(520, 0.045, 'triangle');
    input.holding = true;
    state.fish.rot = -0.35;
  }

  function stopSwim() {
    input.holding = false;
  }

  function togglePause() {
    if (!state) return;
    if (state.mode === 'play') {
      state.mode = 'pause';
      input.holding = false;
    } else if (state.mode === 'pause') {
      state.mode = 'play';
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      startSwim();
    }
    if (e.code === 'KeyR') reset('title');
    if (e.code === 'KeyP') togglePause();
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
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state?.mode === 'play') {
      state.mode = 'pause';
      input.holding = false;
    }
  });

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
    const route = routeLevel();
    if (Math.random() >= pokemonChance()) {
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
      moveAmp: (H > W ? 46 : 36) + Math.min(route * 7, 24),
      moveRate: rand(1.25, 2.15) + Math.min(route * 0.16, 0.56)
    });
    addPopup('Wild ' + pokemonNames[top] + '!', W - 260, 108, '#ffef83');
  }

  function spawnParticles(x, y, count, opts = {}) {
    for (let i = 0; i < count; i++) {
      const ang = rand(0, Math.PI * 2);
      const speed = rand(opts.minSpeed ?? 40, opts.maxSpeed ?? 190);
      state.particles.push({
        x, y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - (opts.lift ?? 30),
        s: rand(opts.minSize ?? 2, opts.maxSize ?? 5),
        life: rand(0.35, opts.maxLife ?? 0.8),
        maxLife: opts.maxLife ?? 0.8,
        color: opts.color ?? '#b9fffb',
        gravity: opts.gravity ?? 260
      });
    }
    if (state.particles.length > 260) state.particles.splice(0, state.particles.length - 260);
  }

  function spawnRing(x, y, color) {
    state.particles.push({ ring: true, x, y, r: 12, vr: 340, life: 0.5, maxLife: 0.5, color });
  }

  function recomputeScore() {
    state.score = state.passed + state.bonus;
  }

  function update(dt) {
    if (!state) return;
    if (state.mode === 'pause') return;
    const bgWidth = img.bg.naturalWidth || 1024;
    const scroll = state.mode === 'dying' ? state.speed * 0.25 : state.speed;
    state.bgx = (state.bgx + scroll * 0.28 * dt) % bgWidth;
    state.floorx += scroll * 0.55 * dt;
    state.shake = Math.max(0, state.shake - dt * 3.2);

    for (const b of state.bubbles) {
      b.y -= b.v * dt;
      b.x -= scroll * 0.11 * dt * b.s;
      if (b.y < -40) { b.y = H + 40; b.x = rand(0, W + 160); b.s = rand(0.25, 0.95); }
      if (b.x < -40) b.x = W + 40;
    }

    for (const m of state.motes) {
      m.drift += dt * 0.7;
      m.y -= m.v * dt;
      m.x -= (scroll * 0.05 + Math.sin(m.drift) * 6) * dt;
      if (m.y < -10) { m.y = H + 10; m.x = rand(0, W); }
      if (m.x < -10) m.x = W + 10;
    }

    for (const b of state.swimBubbles) {
      b.x -= (scroll * 0.34 + b.vx) * dt;
      b.y -= b.vy * dt;
      b.life -= dt;
      b.s += dt * 5;
    }
    state.swimBubbles = state.swimBubbles.filter(b => b.life > 0);

    for (const p of state.particles) {
      if (p.ring) {
        p.r += p.vr * dt;
        p.vr *= Math.pow(0.2, dt);
      } else {
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      p.life -= dt;
    }
    state.particles = state.particles.filter(p => p.life > 0);

    for (const p of state.popups) {
      p.y -= 34 * dt;
      p.life -= dt;
    }
    state.popups = state.popups.filter(p => p.life > 0);

    for (const c of state.collectibles) {
      c.x -= scroll * dt;
      c.phase += dt * 5;
      c.y += Math.sin(c.phase) * 18 * dt;
      c.rot += dt * 2.4;
    }
    state.collectibles = state.collectibles.filter(c => c.x > -80 && !c.collected);

    if (state.mode === 'dying') {
      const f = state.fish;
      state.dyingT += dt;
      f.vy += 1500 * dt;
      f.y += f.vy * dt;
      f.rot += dt * 7;
      f.trail -= dt;
      if (f.trail <= 0) {
        state.swimBubbles.push({ x: f.x + rand(-14, 14), y: f.y + rand(-14, 14), s: rand(3, 6), vx: rand(0, 15), vy: rand(-10, 30), life: rand(0.3, 0.6) });
        f.trail = 0.07;
      }
      for (const o of state.obstacles) o.x -= scroll * dt;
      if (state.dyingT > 1.05 || f.y > H + 90) finalizeGameOver();
      return;
    }

    if (state.mode === 'over') {
      state.overT += dt;
      return;
    }

    if (state.mode !== 'play') return;

    state.t += dt;
    state.invuln = Math.max(0, state.invuln - dt);
    state.routeFlash = Math.max(0, state.routeFlash - dt);
    const route = routeLevel();
    state.speed = Math.min(405, 245 + state.t * 1.45 + state.passed * 3.1 + route * 10);
    state.gap = Math.max(hardMinGap(), baseGap() - state.t * 0.16 - state.passed * 1.18 - route * 6);
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
        const perfect = Math.abs(f.y - o.gapY) < o.gap * 0.18;
        if (perfect) {
          state.streak++;
          state.bonus++;
          spawnParticles(f.x, f.y, 10, { color: '#ffef83', maxSpeed: 130, gravity: 60, maxLife: 0.55 });
          addPopup(state.streak >= 2 ? 'Perfect x' + state.streak + '! +1' : 'Perfect! +1', f.x + 36, f.y - 28, '#ffef83');
          if (state.streak % 3 === 0 && state.splash < splashNeeded()) {
            state.splash++;
            addPopup('+Splash', f.x + 36, f.y - 54, '#7eeaff');
          }
          beep(1040 + Math.min(state.streak, 6) * 60, 0.045, 'square');
        } else {
          state.streak = 0;
          addPopup(state.passed % 5 === 0 ? 'Nice swim!' : 'Dodged!', f.x + 36, f.y - 28, '#b9fffb');
          beep(900, 0.035, 'square');
        }
        recomputeScore();
        const nextRoute = routeLevel();
        if (nextRoute > state.route) {
          state.route = nextRoute;
          state.routeFlash = 2.35;
          addPopup('Route gets deeper!', W / 2, H * 0.34, '#ffef83');
          chord([420, 520, 640], 0.1, 'sawtooth');
        }
      }
      if (collide(o)) {
        if (state.invuln > 0) continue;
        if (state.splash >= splashNeeded()) {
          triggerSplash();
        } else {
          startDying();
        }
      }
    }

    // Critical performance fix: keep the active obstacle list small forever.
    state.obstacles = state.obstacles.filter(o => o.x > -230);
    if (state.obstacles.length > 8) state.obstacles.splice(0, state.obstacles.length - 8);

    if (f.y < 18 || f.y > H - 40) startDying();
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
      spawnParticles(c.x, c.y, 14, { color: '#ffef83', maxSpeed: 170, gravity: 90, maxLife: 0.6 });
      spawnRing(c.x, c.y, 'rgba(255,239,131,.8)');
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
    state.shake = 0.8;
    spawnRing(state.fish.x, state.fish.y, 'rgba(255,255,255,.9)');
    spawnRing(state.fish.x, state.fish.y, 'rgba(126,234,255,.7)');
    spawnParticles(state.fish.x, state.fish.y, 26, { color: '#dffcff', maxSpeed: 260, gravity: 120, maxLife: 0.7 });
    addPopup('Splash!', state.fish.x + 45, state.fish.y - 38, '#ffffff');
    chord([880, 1180, 1480], 0.11, 'triangle');
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

  function startDying() {
    if (state.mode !== 'play') return;
    state.mode = 'dying';
    input.holding = false;
    state.dyingT = 0;
    state.hitFlash = 1;
    state.shake = 1;
    state.fish.vy = -340;
    spawnParticles(state.fish.x, state.fish.y, 22, { color: '#ff9d76', maxSpeed: 240, maxLife: 0.7 });
    spawnRing(state.fish.x, state.fish.y, 'rgba(255,157,118,.85)');
    beep(200, 0.14, 'sawtooth', 0.04);
    setTimeout(() => beep(130, 0.2, 'sawtooth', 0.04), 90);
  }

  function finalizeGameOver() {
    state.mode = 'over';
    state.overT = 0;
    state.newBest = state.score > best;
    best = Math.max(best, state.score);
    localStorage.swimmyBest = String(best);
    state.medal = medalFor(state.score);
    if (state.newBest) chord([520, 660, 880, 1040], 0.12, 'triangle');
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

  function drawParticles() {
    for (const p of state.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      if (p.ring) {
        ctx.globalAlpha = a * 0.85;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 + a * 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawBg() {
    const bgWidth = img.bg.naturalWidth || 1024;
    const x = -state.bgx;
    const route = routeLevel();
    // The tile's light shafts and rock ridge are transparent pixels, so an
    // ocean gradient must sit underneath or they render as black cutouts.
    const d = Math.min(route, 4);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, `rgb(${Math.max(40, 150 - d * 22)},${Math.max(120, 224 - d * 20)},${Math.max(150, 240 - d * 14)})`);
    sky.addColorStop(0.5, `rgb(${Math.max(8, 38 - d * 6)},${Math.max(60, 128 - d * 13)},${Math.max(90, 160 - d * 12)})`);
    sky.addColorStop(1, `rgb(${Math.max(3, 12 - d * 2)},${Math.max(24, 56 - d * 7)},${Math.max(46, 88 - d * 9)})`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // Draw enough copies to cover the canvas at all offsets. No blank seam, ever.
    for (let tx = x - bgWidth; tx < W + bgWidth; tx += bgWidth) {
      ctx.drawImage(img.bg, Math.floor(tx), 0, bgWidth, H);
    }

    const g = ctx.createLinearGradient(0, 0, 0, H);
    const depth = Math.min(route, 4);
    g.addColorStop(0, `rgba(${Math.max(92, 176 - depth * 24)},${Math.max(178, 248 - depth * 16)},255,${alpha(0.14 + depth * 0.025)})`);
    g.addColorStop(0.55, `rgba(0,${Math.max(34, 72 - depth * 9)},${Math.max(80, 122 - depth * 8)},${alpha(0.04 + depth * 0.035)})`);
    g.addColorStop(1, `rgba(0,${Math.max(6, 15 - depth * 2)},${Math.max(26, 38 - depth * 3)},${alpha(0.26 + depth * 0.055)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    drawLightRays(depth);
    drawFloor(depth);

    for (const m of state.motes) {
      ctx.globalAlpha = 0.16 + (Math.sin(m.drift * 2) + 1) * 0.07;
      ctx.fillStyle = '#cdeffb';
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.s, 0, Math.PI * 2);
      ctx.fill();
    }
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

  function drawLightRays(depth) {
    const now = performance.now() / 1000;
    const strength = Math.max(0.25, 1 - depth * 0.2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const baseX = W * (0.12 + i * 0.26) + Math.sin(now * 0.4 + i * 1.9) * W * 0.05;
      const sway = Math.sin(now * 0.55 + i * 2.4) * 0.22;
      const width = W * (0.055 + i * 0.012);
      const grad = ctx.createLinearGradient(baseX, 0, baseX + sway * H, H * 0.9);
      grad.addColorStop(0, `rgba(150,235,255,${alpha(0.075 * strength)})`);
      grad.addColorStop(1, 'rgba(150,235,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(baseX - width * 0.4, -8);
      ctx.lineTo(baseX + width * 0.4, -8);
      ctx.lineTo(baseX + sway * H + width * 1.4, H * 0.92);
      ctx.lineTo(baseX + sway * H - width * 1.4, H * 0.92);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFloor(depth) {
    const base = H - (H > W ? 26 : 20);
    ctx.save();
    ctx.fillStyle = `rgba(2,${18 - depth * 2},${30 - depth * 3},0.55)`;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 24) {
      const wx = x + state.floorx;
      ctx.lineTo(x, base + Math.sin(wx * 0.018) * 7 + Math.sin(wx * 0.041) * 4);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,10,22,0)');
    g.addColorStop(1, 'rgba(0,10,22,0.34)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
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
    if (state.mode === 'dying') {
      ctx.globalAlpha = 0.75 + Math.sin(state.dyingT * 30) * 0.25;
    }
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
    if (state.splash >= splashNeeded()) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(performance.now() / 140) * 0.25;
      ctx.strokeStyle = '#ffef83';
      ctx.lineWidth = 4;
      ctx.strokeRect(meterX - 3, meterY - 3, meterW + 6, 24);
      ctx.restore();
    }
    ctx.strokeStyle = '#dffcff';
    ctx.lineWidth = 2;
    ctx.strokeRect(meterX, meterY, meterW, 18);
    ctx.fillStyle = '#dffcff';
    ctx.font = '800 14px system-ui, Segoe UI, sans-serif';
    ctx.fillText('Splash', meterX, meterY + 38);
    if (state.streak >= 2 && state.mode === 'play') {
      ctx.fillStyle = '#ffef83';
      ctx.font = '900 18px system-ui, Segoe UI, sans-serif';
      ctx.fillText('Combo x' + state.streak, meterX + (H > W ? 100 : 0), meterY + (H > W ? 38 : 64));
    }
    ctx.fillStyle = '#dffcff';
    ctx.font = '800 14px system-ui, Segoe UI, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(routeName(), W - 26, 48);
    ctx.fillText('Depth ' + (routeLevel() + 1), W - 26, 72);
    ctx.textAlign = 'left';
  }

  function drawPopups() {
    ctx.save();
    ctx.textAlign = 'center';
    for (const p of state.popups) {
      const a = Math.min(1, p.life);
      const popScale = 1 + Math.max(0, p.life - 1) * 1.6;
      ctx.globalAlpha = a;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(popScale, popScale);
      ctx.font = '900 20px system-ui, Segoe UI, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,22,40,.7)';
      ctx.fillStyle = p.color;
      ctx.strokeText(p.text, 0, 0);
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawRouteTransition() {
    if (!state.routeFlash) return;
    const a = Math.min(1, state.routeFlash / 1.2);
    const bandH = H > W ? 124 : 106;
    const y = H * 0.38 - bandH / 2;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,27,50,.74)';
    ctx.fillRect(0, y, W, bandH);
    ctx.strokeStyle = 'rgba(185,255,251,.58)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y + 3);
    ctx.lineTo(W, y + 3);
    ctx.moveTo(0, y + bandH - 3);
    ctx.lineTo(W, y + bandH - 3);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffef83';
    ctx.font = '900 28px system-ui, Segoe UI, sans-serif';
    ctx.fillText('Route gets deeper', W / 2, y + 46);
    ctx.fillStyle = '#dffcff';
    ctx.font = '900 18px system-ui, Segoe UI, sans-serif';
    ctx.fillText(routeName(), W / 2, y + 78);
    ctx.restore();
  }

  function overlay(title, sub, hint) {
    ctx.fillStyle = 'rgba(0,18,36,.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    const waveY = Math.sin(performance.now() / 420) * 5;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 64px system-ui, Segoe UI, sans-serif';
    ctx.strokeStyle = '#00344d';
    ctx.lineWidth = 8;
    ctx.strokeText(title, W / 2, H * 0.35 + waveY);
    ctx.fillText(title, W / 2, H * 0.35 + waveY);
    ctx.font = '800 24px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = '#c8fbff';
    ctx.fillText(sub, W / 2, H * 0.47);
    ctx.font = '700 18px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = '#92e8f3';
    ctx.fillText(hint ?? 'HOLD SPACE / PRESS / TOUCH to swim - R to restart - P to pause', W / 2, H * 0.55);
    ctx.textAlign = 'left';
  }

  function drawGameOver() {
    overlay('Splash Down!', 'Final score: ' + state.score,
      state.overT >= 0.55 ? 'PRESS / TOUCH to swim again - R for title' : ' ');
    ctx.textAlign = 'center';
    if (state.medal) {
      const mx = W / 2;
      const my = H * 0.67;
      const spin = Math.sin(performance.now() / 300) * 0.12;
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(spin);
      ctx.fillStyle = state.medal.ring;
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = state.medal.color;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = state.medal.ring;
      ctx.font = '900 22px system-ui, Segoe UI, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', 0, 2);
      ctx.restore();
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = state.medal.color;
      ctx.font = '900 20px system-ui, Segoe UI, sans-serif';
      ctx.fillText(state.medal.name + ' Medal', mx, my + 62);
    }
    if (state.newBest) {
      ctx.fillStyle = '#ffef83';
      ctx.font = '900 26px system-ui, Segoe UI, sans-serif';
      const pulse = 1 + Math.sin(performance.now() / 180) * 0.06;
      ctx.save();
      ctx.translate(W / 2, H * 0.6 - (state.medal ? 78 : 0));
      ctx.scale(pulse, pulse);
      ctx.fillText('NEW BEST!', 0, 0);
      ctx.restore();
    }
    ctx.textAlign = 'left';
  }

  function loop(ts) {
    const dt = Math.min(0.033, (ts - last) / 1000 || 0);
    last = ts;
    update(dt);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (state.shake > 0) {
      const s = state.shake * 9;
      ctx.translate(rand(-s, s), rand(-s, s));
    }
    drawBg();
    drawObstacles();
    drawCollectibles();
    drawParticles();
    drawFish();
    ctx.restore();
    drawVignette();
    panel();
    drawPopups();
    drawRouteTransition();
    if (state.mode === 'title') overlay('Magikarp Flap', 'Hold to swim up. Release to sink.');
    if (state.mode === 'pause') overlay('Paused', 'Take a breather.', 'PRESS / TOUCH or P to resume');
    if (state.mode === 'over') drawGameOver();
    if (state.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${state.hitFlash * 0.4})`;
      ctx.fillRect(0, 0, W, H);
      state.hitFlash = Math.max(0, state.hitFlash - dt * 2);
    }
    requestAnimationFrame(loop);
  }
})();
