(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const shell = document.getElementById('shell');
  const ctx = canvas.getContext('2d', { alpha: false });
  const muteBtn = document.getElementById('muteBtn');
  let W = canvas.width, H = canvas.height;

  const img = {};
  const files = {
    bg: 'assets/underwater_background_tile.png',
    bubble: 'assets/bubble.png',
    magikarp: 'assets/magikarp_pokeapi_129.png',
    poliwag: 'assets/poliwag_pokeapi_60.png',
    goldeen: 'assets/goldeen_pokeapi_118.png',
    horsea: 'assets/horsea_pokeapi_116.png',
    shellder: 'assets/shellder_pokeapi_90.png',
    starmie: 'assets/starmie_pokeapi_121.png',
    gyarados: 'assets/gyarados_pokeapi_130.png',
    lapras: 'assets/lapras_pokeapi_131.png',
    tentacool: 'assets/tentacool_pokeapi_72.png',
    qwilfish: 'assets/qwilfish_pokeapi_211.png'
  };

  // Depth is a 0..1 fraction of the fishable water column. Deeper = rarer.
  const species = [
    { kind: 'magikarp', name: 'Magikarp', points: 5,   weight: 26, depth: [0.1, 0.9],  speed: [55, 95],   size: 74,  reel: 70 },
    { kind: 'poliwag',  name: 'Poliwag',  points: 10,  weight: 18, depth: [0.1, 0.55], speed: [60, 100],  size: 68,  reel: 85 },
    { kind: 'goldeen',  name: 'Goldeen',  points: 15,  weight: 16, depth: [0.25, 0.7], speed: [70, 115],  size: 72,  reel: 95 },
    { kind: 'horsea',   name: 'Horsea',   points: 20,  weight: 13, depth: [0.3, 0.8],  speed: [45, 80],   size: 66,  reel: 100 },
    { kind: 'shellder', name: 'Shellder', points: 30,  weight: 10, depth: [0.55, 0.95],speed: [30, 55],   size: 62,  reel: 115 },
    { kind: 'starmie',  name: 'Starmie',  points: 40,  weight: 8,  depth: [0.5, 0.9],  speed: [80, 130],  size: 76,  reel: 125 },
    { kind: 'gyarados', name: 'Gyarados', points: 100, weight: 3,  depth: [0.7, 1],    speed: [110, 160], size: 108, reel: 170 },
    { kind: 'lapras',   name: 'Lapras',   points: 150, weight: 2,  depth: [0.78, 1],   speed: [35, 60],   size: 104, reel: 190 }
  ];
  const hazards = [
    { kind: 'tentacool', name: 'Tentacool', depth: [0.25, 0.7], speed: [40, 75], size: 80 },
    { kind: 'qwilfish',  name: 'Qwilfish',  depth: [0.5, 0.95], speed: [55, 95], size: 78 }
  ];

  const rand = (a, b) => a + Math.random() * (b - a);
  let loaded = 0;
  let state;
  let muted = false;
  let best = Math.floor(Number(localStorage.reelBest || 0));
  let rafStarted = false;
  let last = 0;
  const input = { holding: false, keys: { left: false, right: false, up: false, down: false } };

  configureCanvas();
  window.addEventListener('resize', () => configureCanvas('title'));
  window.addEventListener('orientationchange', () => setTimeout(() => configureCanvas('title'), 120));

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

  function surfaceY() {
    return H > W ? 120 : 96;
  }

  function waterTop() {
    return surfaceY() + 46;
  }

  function waterBottom() {
    return H - 30;
  }

  function depthToY(f) {
    return waterTop() + f * (waterBottom() - waterTop());
  }

  function reset(mode = 'title') {
    state = {
      mode,
      t: 0,
      time: 60,
      score: 0,
      caughtTotal: 0,
      catches: {},
      hook: { x: W / 2, y: depthToY(0.35), tx: W / 2, ty: depthToY(0.35), stun: 0 },
      fish: [],
      swimHazards: [],
      catching: null,
      particles: [],
      popups: [],
      motes: [],
      bubbles: [],
      shake: 0,
      hitFlash: 0,
      overT: 0,
      newBest: false,
      lastCatch: null
    };
    for (let i = 0; i < 24; i++) {
      state.bubbles.push({ x: rand(0, W), y: rand(waterTop(), H), s: rand(0.25, 0.9), v: rand(14, 40) });
    }
    for (let i = 0; i < 34; i++) {
      state.motes.push({ x: rand(0, W), y: rand(waterTop(), H), s: rand(1, 2.4), v: rand(4, 12), drift: rand(0, Math.PI * 2) });
    }
    for (let i = 0; i < 6; i++) spawnFish(true);
    spawnHazard(true);
    spawnHazard(true);
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

  function pickSpecies() {
    const total = species.reduce((s, sp) => s + sp.weight, 0);
    let roll = Math.random() * total;
    for (const sp of species) {
      roll -= sp.weight;
      if (roll <= 0) return sp;
    }
    return species[0];
  }

  function spawnFish(anywhere = false) {
    const sp = pickSpecies();
    const dir = Math.random() < 0.5 ? 1 : -1;
    const y = depthToY(rand(sp.depth[0], sp.depth[1]));
    state.fish.push({
      sp,
      x: anywhere ? rand(0, W) : (dir === 1 ? -sp.size : W + sp.size),
      y,
      homeY: y,
      vx: rand(sp.speed[0], sp.speed[1]) * dir,
      phase: rand(0, Math.PI * 2),
      fleeing: 0
    });
  }

  function spawnHazard(anywhere = false) {
    const hz = hazards[Math.floor(rand(0, hazards.length))];
    const dir = Math.random() < 0.5 ? 1 : -1;
    const y = depthToY(rand(hz.depth[0], hz.depth[1]));
    state.swimHazards.push({
      hz,
      x: anywhere ? rand(0, W) : (dir === 1 ? -hz.size : W + hz.size),
      y,
      homeY: y,
      vx: rand(hz.speed[0], hz.speed[1]) * dir,
      phase: rand(0, Math.PI * 2)
    });
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

  function startAction() {
    if (!state) return;
    if (state.mode === 'pause') { state.mode = 'play'; return; }
    if (state.mode === 'over') {
      if (state.overT < 0.55) return;
      reset('play');
      return;
    }
    if (state.mode === 'title') { state.mode = 'play'; return; }
    input.holding = true;
  }

  function stopAction() {
    input.holding = false;
  }

  function togglePause() {
    if (!state) return;
    if (state.mode === 'play') { state.mode = 'pause'; input.holding = false; }
    else if (state.mode === 'pause') state.mode = 'play';
  }

  function moveHookTo(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    state.hook.tx = (clientX - rect.left) / rect.width * W;
    state.hook.ty = (clientY - rect.top) / rect.height * H;
  }

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); startAction(); }
    if (e.code === 'ArrowLeft') { input.keys.left = true; e.preventDefault(); }
    if (e.code === 'ArrowRight') { input.keys.right = true; e.preventDefault(); }
    if (e.code === 'ArrowUp') { input.keys.up = true; e.preventDefault(); }
    if (e.code === 'ArrowDown') { input.keys.down = true; e.preventDefault(); }
    if (e.code === 'KeyR') reset('title');
    if (e.code === 'KeyP') togglePause();
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') { e.preventDefault(); stopAction(); }
    if (e.code === 'ArrowLeft') input.keys.left = false;
    if (e.code === 'ArrowRight') input.keys.right = false;
    if (e.code === 'ArrowUp') input.keys.up = false;
    if (e.code === 'ArrowDown') input.keys.down = false;
  });
  // Touch steers by dragging anywhere on screen (relative, so the finger
  // never has to cover the hook); mouse keeps direct cursor control.
  const drag = { active: false, lastX: 0, lastY: 0 };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    if (e.pointerType === 'mouse') {
      moveHookTo(e.clientX, e.clientY);
    } else {
      drag.active = true;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
    }
    startAction();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!state) return;
    if (e.pointerType === 'mouse') {
      moveHookTo(e.clientX, e.clientY);
      return;
    }
    if (!drag.active) return;
    const rect = canvas.getBoundingClientRect();
    const scale = W / rect.width * 1.35;
    state.hook.tx += (e.clientX - drag.lastX) * scale;
    state.hook.ty += (e.clientY - drag.lastY) * scale;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    state.hook.tx = Math.max(20, Math.min(W - 20, state.hook.tx));
    state.hook.ty = Math.max(waterTop() - 14, Math.min(waterBottom(), state.hook.ty));
  });
  const endPointer = () => { drag.active = false; stopAction(); };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', endPointer);
  window.addEventListener('blur', stopAction);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state?.mode === 'play') { state.mode = 'pause'; input.holding = false; }
  });

  function blockSelection(e) {
    e.preventDefault();
  }
  [canvas, shell].forEach((el) => {
    el.addEventListener('selectstart', blockSelection);
    el.addEventListener('dragstart', blockSelection);
    el.addEventListener('contextmenu', blockSelection);
  });
  muteBtn.onclick = () => {
    muted = !muted;
    muteBtn.textContent = 'Sound: ' + (muted ? 'Off' : 'On');
  };

  function addPopup(text, x, y, color) {
    state.popups.push({ text, x, y, color, life: 1.2 });
    if (state.popups.length > 7) state.popups.shift();
  }

  function spawnParticles(x, y, count, opts = {}) {
    for (let i = 0; i < count; i++) {
      const ang = rand(0, Math.PI * 2);
      const speed = rand(opts.minSpeed ?? 40, opts.maxSpeed ?? 190);
      state.particles.push({
        x, y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - (opts.lift ?? 20),
        s: rand(2, opts.maxSize ?? 5),
        life: rand(0.3, opts.maxLife ?? 0.7),
        maxLife: opts.maxLife ?? 0.7,
        color: opts.color ?? '#b9fffb',
        gravity: opts.gravity ?? 240
      });
    }
    if (state.particles.length > 260) state.particles.splice(0, state.particles.length - 260);
  }

  function spawnRing(x, y, color) {
    state.particles.push({ ring: true, x, y, r: 10, vr: 320, life: 0.45, maxLife: 0.45, color });
  }

  function hookFish(f) {
    state.catching = {
      fish: f,
      progress: 0,
      tension: 30,
      struggling: false,
      phaseT: rand(1.1, 2),
      reelNeed: f.sp.reel
    };
    f.hooked = true;
    addPopup(f.sp.name + ' bit!', f.x, f.y - f.sp.size * 0.7, '#ffef83');
    spawnRing(state.hook.x, state.hook.y, 'rgba(255,239,131,.85)');
    beep(820, 0.07, 'triangle');
    setTimeout(() => beep(980, 0.07, 'triangle'), 80);
  }

  function endCatch(success, reason) {
    const c = state.catching;
    if (!c) return;
    const f = c.fish;
    if (success) {
      const sp = f.sp;
      state.score += sp.points;
      state.caughtTotal++;
      state.catches[sp.kind] = (state.catches[sp.kind] || 0) + 1;
      const bonus = sp.points >= 100 ? 8 : sp.points >= 30 ? 6 : 4;
      state.time = Math.min(99, state.time + bonus);
      state.lastCatch = { kind: sp.kind, name: sp.name, t: 2.2 };
      addPopup('Caught ' + sp.name + '! +' + sp.points, f.x, f.y - 40, '#ffef83');
      addPopup('+' + bonus + 's', W - 90, surfaceY() + 60, '#7eeaff');
      spawnParticles(f.x, f.y, 22, { color: '#ffef83', maxSpeed: 240 });
      spawnRing(f.x, f.y, 'rgba(255,255,255,.9)');
      chord([660, 880, 1100, 1320], 0.11, 'triangle');
      state.fish = state.fish.filter(o => o !== f);
    } else {
      f.hooked = false;
      f.fleeing = 1.4;
      addPopup(reason, f.x, f.y - 40, '#ff9d76');
      state.shake = 0.55;
      beep(170, 0.16, 'sawtooth', 0.04);
      state.hook.stun = 0.8;
    }
    state.catching = null;
  }

  function stingHook(h) {
    if (state.catching) endCatch(false, 'It got away!');
    state.hook.stun = 1.1;
    state.time = Math.max(0, state.time - 3);
    state.shake = 0.7;
    state.hitFlash = 0.4;
    addPopup(h.hz.name + ' sting! -3s', state.hook.x, state.hook.y - 30, '#ff9d76');
    spawnParticles(state.hook.x, state.hook.y, 14, { color: '#c39bff', maxSpeed: 200 });
    beep(210, 0.14, 'sawtooth', 0.04);
  }

  function update(dt) {
    if (!state) return;
    if (state.mode === 'pause') return;
    state.shake = Math.max(0, state.shake - dt * 3.2);
    if (state.lastCatch) {
      state.lastCatch.t -= dt;
      if (state.lastCatch.t <= 0) state.lastCatch = null;
    }

    for (const b of state.bubbles) {
      b.y -= b.v * dt;
      if (b.y < waterTop()) { b.y = H + 20; b.x = rand(0, W); }
    }
    for (const m of state.motes) {
      m.drift += dt * 0.7;
      m.y -= m.v * dt;
      m.x -= Math.sin(m.drift) * 6 * dt;
      if (m.y < waterTop()) { m.y = H + 10; m.x = rand(0, W); }
    }
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
      p.y -= 30 * dt;
      p.life -= dt;
    }
    state.popups = state.popups.filter(p => p.life > 0);

    // Ambient fish keep swimming on title/over screens too.
    const ambient = state.mode !== 'play';
    updateSwimmers(dt, ambient);

    if (state.mode === 'over') {
      state.overT += dt;
      return;
    }
    if (state.mode !== 'play') return;

    state.t += dt;
    state.time -= dt;
    if (state.time <= 0) {
      state.time = 0;
      state.mode = 'over';
      state.overT = 0;
      input.holding = false;
      state.newBest = state.score > best;
      best = Math.max(best, state.score);
      localStorage.reelBest = String(best);
      if (state.catching) { state.catching.fish.hooked = false; state.catching = null; }
      if (state.newBest) chord([520, 660, 880, 1040], 0.12, 'triangle');
      return;
    }

    const hook = state.hook;
    hook.stun = Math.max(0, hook.stun - dt);
    const keySpeed = 420;
    if (input.keys.left) hook.tx -= keySpeed * dt;
    if (input.keys.right) hook.tx += keySpeed * dt;
    if (input.keys.up) hook.ty -= keySpeed * dt;
    if (input.keys.down) hook.ty += keySpeed * dt;
    hook.tx = Math.max(20, Math.min(W - 20, hook.tx));
    hook.ty = Math.max(waterTop() - 14, Math.min(waterBottom(), hook.ty));
    if (!state.catching && hook.stun <= 0) {
      const ease = Math.min(1, dt * 6.5);
      hook.x += (hook.tx - hook.x) * ease;
      hook.y += (hook.ty - hook.y) * ease;
    }

    // Hazards sting the hook.
    if (hook.stun <= 0) {
      for (const h of state.swimHazards) {
        if (Math.hypot(hook.x - h.x, hook.y - h.y) < h.hz.size * 0.42 + 10) {
          stingHook(h);
          break;
        }
      }
    }

    if (state.catching) {
      const c = state.catching;
      const f = c.fish;
      c.phaseT -= dt;
      if (c.phaseT <= 0) {
        c.struggling = !c.struggling;
        c.phaseT = c.struggling ? rand(0.55, 1.0) : rand(1.0, 2.1);
        if (c.struggling) beep(300, 0.09, 'sawtooth', 0.035);
      }
      if (input.holding) {
        c.progress += (c.struggling ? 6 : 30) * dt;
        c.tension += (c.struggling ? 150 : 42) * dt;
      } else {
        c.tension -= 95 * dt;
        c.progress -= 4 * dt;
      }
      c.tension = Math.max(0, c.tension);
      c.progress = Math.max(0, c.progress);
      // Fish tugs downward while fighting; hook follows it.
      const tug = c.struggling ? 46 : 12;
      f.y = Math.min(waterBottom(), f.y + tug * dt * 0.4);
      f.x += Math.sin(state.t * 9 + f.phase) * (c.struggling ? 60 : 14) * dt;
      hook.x = f.x;
      hook.y = f.y;
      if (c.tension >= 100) {
        endCatch(false, 'Line snapped!');
      } else if (c.progress >= c.reelNeed) {
        endCatch(true);
      }
    } else if (hook.stun <= 0) {
      // Bite check.
      for (const f of state.fish) {
        if (f.fleeing > 0) continue;
        if (Math.hypot(hook.x - f.x, hook.y - f.y) < f.sp.size * 0.42 + 8) {
          hookFish(f);
          break;
        }
      }
    }
  }

  function updateSwimmers(dt, ambient) {
    for (const f of state.fish) {
      if (f.hooked) continue;
      f.fleeing = Math.max(0, f.fleeing - dt);
      const speedMul = f.fleeing > 0 ? 2.6 : 1;
      f.x += f.vx * speedMul * dt;
      f.phase += dt * 3;
      f.y = f.homeY + Math.sin(f.phase) * 12;
      if (f.x < -160 || f.x > W + 160) f.dead = true;
    }
    state.fish = state.fish.filter(f => !f.dead);
    const targetFish = 6 + (ambient ? 0 : Math.min(3, Math.floor(state.t / 25)));
    if (state.fish.length < targetFish) spawnFish(false);

    for (const h of state.swimHazards) {
      h.x += h.vx * dt;
      h.phase += dt * 2.4;
      h.y = h.homeY + Math.sin(h.phase) * 20;
      if (h.x < -160 || h.x > W + 160) h.dead = true;
    }
    state.swimHazards = state.swimHazards.filter(h => !h.dead);
    if (state.swimHazards.length < 2) spawnHazard(false);
  }

  function alphaStr(value) {
    return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  }

  function drawBg() {
    const bgWidth = img.bg.naturalWidth || 1024;
    // The tile's light shafts and ridge are transparent, so paint ocean first.
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, 'rgb(136, 212, 232)');
    sky.addColorStop(0.5, 'rgb(30, 116, 148)');
    sky.addColorStop(1, 'rgb(8, 44, 72)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    for (let tx = 0; tx < W + bgWidth; tx += bgWidth) {
      ctx.drawImage(img.bg, tx, 0, bgWidth, H);
    }
    const tint = ctx.createLinearGradient(0, 0, 0, H);
    tint.addColorStop(0, 'rgba(176,248,255,0.12)');
    tint.addColorStop(1, 'rgba(0,15,38,0.3)');
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);

    drawLightRays();
    drawSurface();

    for (const m of state.motes) {
      ctx.globalAlpha = 0.15 + (Math.sin(m.drift * 2) + 1) * 0.07;
      ctx.fillStyle = '#cdeffb';
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.s, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of state.bubbles) {
      ctx.globalAlpha = 0.3 + b.s * 0.3;
      ctx.drawImage(img.bubble, b.x, b.y, 32 * b.s, 32 * b.s);
    }
    ctx.globalAlpha = 1;
  }

  function drawSurface() {
    const sy = surfaceY();
    const now = performance.now() / 1000;
    // Sky band above the waterline.
    const skyG = ctx.createLinearGradient(0, 0, 0, sy);
    skyG.addColorStop(0, '#ffe9b8');
    skyG.addColorStop(1, '#ffc98a');
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, W, sy);
    // Sun.
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#fff3d0';
    ctx.beginPath();
    ctx.arc(W * 0.82, sy * 0.42, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Wavy waterline.
    ctx.fillStyle = 'rgba(220,248,255,.75)';
    ctx.beginPath();
    ctx.moveTo(0, sy);
    for (let x = 0; x <= W; x += 16) {
      ctx.lineTo(x, sy + Math.sin(x * 0.03 + now * 2.2) * 4);
    }
    ctx.lineTo(W, sy + 10);
    ctx.lineTo(0, sy + 10);
    ctx.closePath();
    ctx.fill();
  }

  function drawLightRays() {
    const now = performance.now() / 1000;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const baseX = W * (0.12 + i * 0.26) + Math.sin(now * 0.4 + i * 1.9) * W * 0.05;
      const sway = Math.sin(now * 0.55 + i * 2.4) * 0.22;
      const width = W * (0.055 + i * 0.012);
      const grad = ctx.createLinearGradient(baseX, 0, baseX + sway * H, H * 0.9);
      grad.addColorStop(0, `rgba(150,235,255,${alphaStr(0.07)})`);
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

  function drawVignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,10,22,0)');
    g.addColorStop(1, 'rgba(0,10,22,0.32)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawSwimmer(x, y, image, size, vx, wiggle, highlight) {
    ctx.save();
    ctx.translate(x, y);
    if (vx > 0) ctx.scale(-1, 1);
    ctx.rotate(Math.sin(wiggle) * 0.06);
    if (highlight) {
      ctx.shadowColor = '#ffef83';
      ctx.shadowBlur = 22;
    }
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function drawFishAll() {
    for (const h of state.swimHazards) {
      drawSwimmer(h.x, h.y, img[h.hz.kind], h.hz.size, h.vx, h.phase, false);
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(state.t * 6 + h.phase) * 0.12;
      ctx.strokeStyle = '#c39bff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.hz.size * 0.52, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const f of state.fish) {
      const shakeX = f.hooked && state.catching?.struggling ? rand(-3, 3) : 0;
      drawSwimmer(f.x + shakeX, f.y, img[f.sp.kind], f.sp.size, f.hooked ? 0 : f.vx, f.phase, f.hooked);
    }
  }

  function drawLineAndHook() {
    const hook = state.hook;
    const sy = surfaceY();
    const bobX = hook.x + Math.sin(performance.now() / 700) * 3;
    // Line.
    ctx.save();
    const taut = state.catching && state.catching.struggling;
    ctx.strokeStyle = taut ? 'rgba(255,157,118,.95)' : 'rgba(235,250,255,.75)';
    ctx.lineWidth = taut ? 2.5 : 1.6;
    ctx.beginPath();
    ctx.moveTo(bobX, sy + 4);
    const sag = taut ? 0 : 26;
    ctx.quadraticCurveTo(bobX + (hook.x - bobX) / 2 + sag, (sy + hook.y) / 2, hook.x, hook.y - 12);
    ctx.stroke();
    // Bobber at the surface.
    ctx.translate(bobX, sy + 2);
    ctx.fillStyle = '#f54242';
    ctx.beginPath();
    ctx.arc(0, 0, 9, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#f8fbff';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#10253b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // Hook.
    ctx.save();
    ctx.translate(hook.x, hook.y);
    if (state.hook.stun > 0) ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 60) * 0.3;
    ctx.strokeStyle = '#e8f4ff';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 4);
    ctx.arc(-6, 4, 6, 0, Math.PI * 0.9);
    ctx.stroke();
    // Bait glow so the hook reads on small screens.
    ctx.fillStyle = 'rgba(255,239,131,.85)';
    ctx.beginPath();
    ctx.arc(0, -2, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawReelUI() {
    const c = state.catching;
    if (!c) return;
    const bw = Math.min(320, W * 0.5);
    const x = W / 2 - bw / 2;
    const y = surfaceY() + 26;
    ctx.save();
    ctx.fillStyle = 'rgba(0,25,45,.65)';
    ctx.beginPath();
    ctx.roundRect(x - 14, y - 12, bw + 28, 74, 14);
    ctx.fill();
    // Progress.
    ctx.fillStyle = 'rgba(185,255,251,.22)';
    ctx.fillRect(x, y, bw, 16);
    ctx.fillStyle = '#7de8a8';
    ctx.fillRect(x, y, bw * Math.min(1, c.progress / c.reelNeed), 16);
    ctx.strokeStyle = '#dffcff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, bw, 16);
    // Tension.
    const ty = y + 28;
    ctx.fillStyle = 'rgba(185,255,251,.22)';
    ctx.fillRect(x, ty, bw, 16);
    const tFrac = Math.min(1, c.tension / 100);
    ctx.fillStyle = tFrac > 0.75 ? '#ff7e79' : tFrac > 0.5 ? '#ffb45f' : '#7eeaff';
    ctx.fillRect(x, ty, bw * tFrac, 16);
    ctx.strokeStyle = '#dffcff';
    ctx.strokeRect(x, ty, bw, 16);
    ctx.fillStyle = '#dffcff';
    ctx.font = '800 13px system-ui, Segoe UI, sans-serif';
    ctx.fillText('REEL', x - 4, y - 16);
    ctx.textAlign = 'right';
    ctx.fillText(c.struggling ? 'IT\'S STRUGGLING - LET GO!' : 'HOLD TO REEL', x + bw + 4, y - 16);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function panel() {
    ctx.font = '900 22px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(0,25,45,.55)';
    ctx.beginPath();
    ctx.roundRect(16, 12, 286, 72, 14);
    ctx.fill();
    ctx.fillStyle = '#dffcff';
    ctx.fillText('Score: ' + state.score, 30, 40);
    ctx.font = '800 16px system-ui, Segoe UI, sans-serif';
    ctx.fillText('Best: ' + best + '   Caught: ' + state.caughtTotal, 30, 68);
    // Timer.
    const urgent = state.time <= 10 && state.mode === 'play';
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = '900 30px system-ui, Segoe UI, sans-serif';
    if (urgent) {
      ctx.fillStyle = '#ff7e79';
      const pulse = 1 + Math.sin(performance.now() / 140) * 0.08;
      ctx.translate(W - 30, 46);
      ctx.scale(pulse, pulse);
      ctx.fillText(Math.ceil(state.time) + 's', 0, 0);
    } else {
      ctx.fillStyle = '#dffcff';
      ctx.fillText(Math.ceil(state.time) + 's', W - 30, 46);
    }
    ctx.restore();
    if (state.lastCatch) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, state.lastCatch.t);
      ctx.textAlign = 'center';
      ctx.font = '800 15px system-ui, Segoe UI, sans-serif';
      ctx.fillStyle = '#ffef83';
      ctx.fillText(state.lastCatch.name + ' registered!', W / 2, surfaceY() - 10);
      ctx.restore();
    }
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
      ctx.font = '900 19px system-ui, Segoe UI, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,22,40,.7)';
      ctx.fillStyle = p.color;
      ctx.strokeText(p.text, 0, 0);
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
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

  function overlay(title, sub, hint) {
    ctx.fillStyle = 'rgba(0,18,36,.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    const waveY = Math.sin(performance.now() / 420) * 5;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 58px system-ui, Segoe UI, sans-serif';
    ctx.strokeStyle = '#00344d';
    ctx.lineWidth = 8;
    ctx.strokeText(title, W / 2, H * 0.33 + waveY);
    ctx.fillText(title, W / 2, H * 0.33 + waveY);
    ctx.font = '800 23px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = '#c8fbff';
    ctx.fillText(sub, W / 2, H * 0.44);
    ctx.font = '700 17px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = '#92e8f3';
    ctx.fillText(hint, W / 2, H * 0.52);
    ctx.textAlign = 'left';
  }

  function drawGameOver() {
    overlay('Time\'s Up!', 'Final score: ' + state.score + '  ·  ' + state.caughtTotal + ' caught',
      state.overT >= 0.55 ? 'PRESS / TOUCH to fish again - R for title' : ' ');
    // Pokedex tally of the session.
    const caught = species.filter(sp => state.catches[sp.kind]);
    if (caught.length) {
      const cell = 74;
      const totalW = caught.length * cell;
      let x = W / 2 - totalW / 2 + cell / 2;
      const y = H * 0.66;
      ctx.save();
      ctx.textAlign = 'center';
      for (const sp of caught) {
        ctx.drawImage(img[sp.kind], x - 26, y - 26, 52, 52);
        ctx.font = '900 15px system-ui, Segoe UI, sans-serif';
        ctx.fillStyle = '#dffcff';
        ctx.strokeStyle = 'rgba(0,22,40,.7)';
        ctx.lineWidth = 3;
        ctx.strokeText('x' + state.catches[sp.kind], x, y + 44);
        ctx.fillText('x' + state.catches[sp.kind], x, y + 44);
        x += cell;
      }
      ctx.restore();
    }
    if (state.newBest) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffef83';
      ctx.font = '900 26px system-ui, Segoe UI, sans-serif';
      const pulse = 1 + Math.sin(performance.now() / 180) * 0.06;
      ctx.translate(W / 2, H * 0.585);
      ctx.scale(pulse, pulse);
      ctx.fillText('NEW BEST!', 0, 0);
      ctx.restore();
    }
  }

  function loop(ts) {
    const dt = Math.min(0.033, (ts - last) / 1000 || 0);
    last = ts;
    update(dt);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (state.shake > 0) {
      const s = state.shake * 8;
      ctx.translate(rand(-s, s), rand(-s, s));
    }
    drawBg();
    drawFishAll();
    drawLineAndHook();
    drawParticles();
    ctx.restore();
    drawVignette();
    panel();
    drawReelUI();
    drawPopups();
    if (state.mode === 'title') {
      overlay('Reel \'Em All', 'Hook wild Pokemon. Reel with care. Beat the clock.',
        'DRAG anywhere to steer - HOLD to reel (release when struggling) - dodge Tentacool & Qwilfish');
    }
    if (state.mode === 'pause') overlay('Paused', 'The fish can wait.', 'PRESS / TOUCH or P to resume');
    if (state.mode === 'over') drawGameOver();
    if (state.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${state.hitFlash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
      state.hitFlash = Math.max(0, state.hitFlash - dt * 2);
    }
    requestAnimationFrame(loop);
  }
})();
