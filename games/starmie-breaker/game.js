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
    starmie: 'assets/starmie_pokeapi_121.png',
    bubble: 'assets/bubble.png'
  };

  const brickColors = ['#ff7e79', '#ffb45f', '#ffe071', '#7de8a8', '#6fc9ff', '#c39bff'];
  const rand = (a, b) => a + Math.random() * (b - a);
  let loaded = 0;
  let state;
  let muted = false;
  let best = Math.floor(Number(localStorage.starmieBest || 0));
  let rafStarted = false;
  let last = 0;
  const keys = { left: false, right: false };

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

  function paddleBaseW() {
    return H > W ? 128 : 150;
  }

  function paddleY() {
    return H - (H > W ? 64 : 44);
  }

  function reset(mode = 'title') {
    state = {
      mode,
      t: 0,
      level: 1,
      score: 0,
      lives: 3,
      chain: 0,
      paddle: { x: W / 2, w: paddleBaseW(), h: 16 },
      balls: [],
      bricks: [],
      powerups: [],
      particles: [],
      popups: [],
      motes: [],
      bubbles: [],
      starmie: { x: W / 2, y: 0, phase: rand(0, Math.PI * 2), hidden: 0 },
      wideT: 0,
      slowT: 0,
      shake: 0,
      hitFlash: 0,
      levelFlash: 0,
      overT: 0,
      newBest: false
    };
    for (let i = 0; i < 26; i++) {
      state.bubbles.push({ x: rand(0, W), y: rand(0, H), s: rand(0.25, 0.9), v: rand(14, 40) });
    }
    for (let i = 0; i < 36; i++) {
      state.motes.push({ x: rand(0, W), y: rand(0, H), s: rand(1, 2.4), v: rand(4, 12), drift: rand(0, Math.PI * 2) });
    }
    buildBricks();
    spawnStuckBall();
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

  function ballSpeed() {
    const slow = state.slowT > 0 ? 0.76 : 1;
    return Math.min(540, (H > W ? 320 : 350) + (state.level - 1) * 24) * slow;
  }

  function brickArea() {
    const top = H > W ? 132 : 108;
    const side = H > W ? 16 : 60;
    return { top, side, width: W - side * 2 };
  }

  function buildBricks() {
    state.bricks = [];
    const cols = H > W ? 8 : 12;
    const rows = Math.min(H > W ? 9 : 6, (H > W ? 5 : 4) + Math.floor((state.level - 1) / 2));
    const area = brickArea();
    const gapPx = 6;
    const bw = (area.width - (cols - 1) * gapPx) / cols;
    const bh = H > W ? 30 : 26;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Later levels carve checkerboard holes so walls feel different.
        if (state.level >= 3 && (r + c) % 2 === 1 && r >= rows - 2) continue;
        const hp = state.level >= 2 && r < 2 ? 2 : 1;
        state.bricks.push({
          x: area.side + c * (bw + gapPx),
          y: area.top + r * (bh + gapPx),
          w: bw,
          h: bh,
          hp,
          maxHp: hp,
          color: brickColors[r % brickColors.length]
        });
      }
    }
    state.starmie.hidden = 0;
    state.starmie.phase = rand(0, Math.PI * 2);
  }

  function spawnStuckBall() {
    state.balls = [{ x: state.paddle.x, y: paddleY() - 16, vx: 0, vy: 0, r: 9, stuck: true }];
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

  function launch() {
    if (!state) return;
    if (state.mode === 'pause') { state.mode = 'play'; return; }
    if (state.mode === 'over') {
      if (state.overT < 0.55) return;
      reset('play');
    }
    if (state.mode === 'title') state.mode = 'play';
    if (state.mode !== 'play') return;
    for (const b of state.balls) {
      if (b.stuck) {
        b.stuck = false;
        const ang = rand(-0.45, 0.45) - Math.PI / 2;
        b.vx = Math.cos(ang) * ballSpeed();
        b.vy = Math.sin(ang) * ballSpeed();
        beep(620, 0.05, 'triangle');
      }
    }
  }

  function togglePause() {
    if (!state) return;
    if (state.mode === 'play') state.mode = 'pause';
    else if (state.mode === 'pause') state.mode = 'play';
  }

  function movePaddleTo(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width * W;
    state.paddle.x = Math.max(state.paddle.w / 2, Math.min(W - state.paddle.w / 2, x));
    for (const b of state.balls) if (b.stuck) b.x = state.paddle.x;
  }

  document.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') { keys.left = true; e.preventDefault(); }
    if (e.code === 'ArrowRight') { keys.right = true; e.preventDefault(); }
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); launch(); }
    if (e.code === 'KeyR') reset('title');
    if (e.code === 'KeyP') togglePause();
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'ArrowRight') keys.right = false;
  });
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    movePaddleTo(e.clientX);
    launch();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!state) return;
    movePaddleTo(e.clientX);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state?.mode === 'play') state.mode = 'pause';
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
    state.popups.push({ text, x, y, color, life: 1.15 });
    if (state.popups.length > 6) state.popups.shift();
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

  function dropPowerup(x, y) {
    if (Math.random() > 0.16) return;
    const roll = Math.random();
    const kind = roll < 0.42 ? 'wide' : roll < 0.8 ? 'multi' : roll < 0.94 ? 'slow' : 'life';
    state.powerups.push({ x, y, vy: 120, kind, phase: rand(0, Math.PI * 2) });
  }

  function powerupLabel(kind) {
    return kind === 'wide' ? 'Wide Coral!' : kind === 'multi' ? 'Multi Ball!' : kind === 'slow' ? 'Slow Tide!' : '+1 Life!';
  }

  function applyPowerup(kind) {
    if (kind === 'wide') state.wideT = 10;
    if (kind === 'slow') state.slowT = 8;
    if (kind === 'life') state.lives = Math.min(5, state.lives + 1);
    if (kind === 'multi') {
      const src = state.balls.find(b => !b.stuck) || state.balls[0];
      for (let i = 0; i < 2; i++) {
        const ang = Math.atan2(src.vy || -1, src.vx || 0.3) + (i === 0 ? 0.5 : -0.5);
        state.balls.push({ x: src.x, y: src.y, vx: Math.cos(ang) * ballSpeed(), vy: Math.sin(ang) * ballSpeed(), r: 9, stuck: false });
      }
      if (state.balls.length > 9) state.balls.splice(0, state.balls.length - 9);
    }
    addPopup(powerupLabel(kind), state.paddle.x, paddleY() - 34, '#ffef83');
    chord([760, 980], 0.08, 'square');
  }

  function starmiePos() {
    const area = brickArea();
    const rows = state.bricks.length ? Math.max(...state.bricks.map(b => b.y + b.h)) : area.top;
    const bandTop = rows + 44;
    const bandBot = paddleY() - 130;
    const midY = Math.max(bandTop, Math.min(bandBot, (bandTop + bandBot) / 2));
    const p = state.starmie.phase + state.t * 0.85;
    return {
      x: W / 2 + Math.sin(p) * (W * 0.36),
      y: midY + Math.sin(p * 1.7) * Math.max(10, (bandBot - bandTop) / 2)
    };
  }

  function update(dt) {
    if (!state) return;
    if (state.mode === 'pause') return;
    state.shake = Math.max(0, state.shake - dt * 3.2);
    state.levelFlash = Math.max(0, state.levelFlash - dt);

    for (const b of state.bubbles) {
      b.y -= b.v * dt;
      if (b.y < -40) { b.y = H + 40; b.x = rand(0, W); }
    }
    for (const m of state.motes) {
      m.drift += dt * 0.7;
      m.y -= m.v * dt;
      m.x -= Math.sin(m.drift) * 6 * dt;
      if (m.y < -10) { m.y = H + 10; m.x = rand(0, W); }
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
      p.y -= 34 * dt;
      p.life -= dt;
    }
    state.popups = state.popups.filter(p => p.life > 0);

    if (state.mode === 'over') {
      state.overT += dt;
      return;
    }
    if (state.mode !== 'play') return;

    state.t += dt;
    state.wideT = Math.max(0, state.wideT - dt);
    state.slowT = Math.max(0, state.slowT - dt);
    state.starmie.hidden = Math.max(0, state.starmie.hidden - dt);
    const targetW = paddleBaseW() * (state.wideT > 0 ? 1.55 : 1);
    state.paddle.w += (targetW - state.paddle.w) * Math.min(1, dt * 8);

    const keyboardSpeed = 640;
    if (keys.left) state.paddle.x -= keyboardSpeed * dt;
    if (keys.right) state.paddle.x += keyboardSpeed * dt;
    state.paddle.x = Math.max(state.paddle.w / 2, Math.min(W - state.paddle.w / 2, state.paddle.x));

    for (const pu of state.powerups) {
      pu.y += pu.vy * dt;
      pu.phase += dt * 6;
      const py = paddleY();
      if (pu.y > py - 12 && pu.y < py + 22 && Math.abs(pu.x - state.paddle.x) < state.paddle.w / 2 + 16) {
        pu.caught = true;
        applyPowerup(pu.kind);
      }
    }
    state.powerups = state.powerups.filter(pu => !pu.caught && pu.y < H + 40);

    const sp = starmiePos();
    const speed = ballSpeed();
    for (const ball of state.balls) {
      if (ball.stuck) {
        ball.x = state.paddle.x;
        ball.y = paddleY() - 16;
        continue;
      }
      // Keep speed constant so slow-tide / level pacing stays predictable.
      const mag = Math.hypot(ball.vx, ball.vy) || 1;
      ball.vx = ball.vx / mag * speed;
      ball.vy = ball.vy / mag * speed;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); beep(440, 0.03, 'sine'); }
      if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); beep(440, 0.03, 'sine'); }
      if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); beep(440, 0.03, 'sine'); }

      // Paddle bounce: exit angle follows where the ball lands on the coral.
      const py = paddleY();
      if (ball.vy > 0 && ball.y + ball.r >= py && ball.y + ball.r <= py + state.paddle.h + 14 &&
          Math.abs(ball.x - state.paddle.x) <= state.paddle.w / 2 + ball.r) {
        const offset = Math.max(-1, Math.min(1, (ball.x - state.paddle.x) / (state.paddle.w / 2)));
        const ang = -Math.PI / 2 + offset * 1.05;
        ball.vx = Math.cos(ang) * speed;
        ball.vy = Math.sin(ang) * speed;
        ball.y = py - ball.r;
        state.chain = 0;
        beep(520, 0.04, 'triangle');
      }

      // Starmie bonus target.
      if (state.starmie.hidden <= 0 && Math.hypot(ball.x - sp.x, ball.y - sp.y) < 44) {
        state.starmie.hidden = 6;
        state.score += 75;
        const nx = (ball.x - sp.x) / (Math.hypot(ball.x - sp.x, ball.y - sp.y) || 1);
        const ny = (ball.y - sp.y) / (Math.hypot(ball.x - sp.x, ball.y - sp.y) || 1);
        const dot = ball.vx * nx + ball.vy * ny;
        ball.vx -= 2 * dot * nx;
        ball.vy -= 2 * dot * ny;
        spawnRing(sp.x, sp.y, 'rgba(195,155,255,.85)');
        spawnParticles(sp.x, sp.y, 18, { color: '#c39bff', maxSpeed: 220 });
        addPopup('Starmie! +75', sp.x, sp.y - 30, '#c39bff');
        chord([980, 1240, 1560], 0.1, 'triangle');
      }

      // Bricks.
      for (const brick of state.bricks) {
        if (brick.hp <= 0) continue;
        const cx = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
        const cy = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
        const dx = ball.x - cx;
        const dy = ball.y - cy;
        if (dx * dx + dy * dy > ball.r * ball.r) continue;
        const fromSide = Math.abs(dx) > Math.abs(dy);
        if (fromSide) ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
        else ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
        brick.hp--;
        if (brick.hp <= 0) {
          state.chain++;
          const points = 10 * state.chain;
          state.score += points;
          spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, 12, { color: brick.color, maxSpeed: 180 });
          addPopup('+' + points + (state.chain >= 3 ? '  Chain x' + state.chain : ''), brick.x + brick.w / 2, brick.y, state.chain >= 3 ? '#ffef83' : '#dffcff');
          dropPowerup(brick.x + brick.w / 2, brick.y + brick.h / 2);
          beep(Math.min(1400, 700 + state.chain * 55), 0.045, 'square');
        } else {
          spawnParticles(cx, cy, 5, { color: brick.color, maxSpeed: 120, maxLife: 0.4 });
          beep(600, 0.035, 'square');
        }
        break;
      }

      if (ball.y > H + 30) ball.lost = true;
    }
    state.balls = state.balls.filter(b => !b.lost);

    state.bricks = state.bricks.filter(b => b.hp > 0);
    if (state.bricks.length === 0) {
      state.level++;
      state.levelFlash = 2.2;
      state.shake = 0.5;
      addPopup('Wave ' + state.level + '!', W / 2, H * 0.4, '#ffef83');
      chord([520, 660, 880, 1040], 0.12, 'triangle');
      buildBricks();
      state.powerups = [];
      spawnStuckBall();
      return;
    }

    if (state.balls.length === 0) {
      state.lives--;
      state.chain = 0;
      state.hitFlash = 0.7;
      state.shake = 0.9;
      beep(180, 0.16, 'sawtooth', 0.04);
      if (state.lives <= 0) {
        state.mode = 'over';
        state.overT = 0;
        state.newBest = state.score > best;
        best = Math.max(best, state.score);
        localStorage.starmieBest = String(best);
        if (state.newBest) chord([520, 660, 880, 1040], 0.12, 'triangle');
      } else {
        spawnStuckBall();
      }
    }
  }

  function alphaStr(value) {
    return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  }

  function drawBg() {
    const bgWidth = img.bg.naturalWidth || 1024;
    // The tile's light shafts and ridge are transparent, so paint ocean first.
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, 'rgb(128, 206, 228)');
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

  function drawBricks() {
    for (const brick of state.bricks) {
      const damaged = brick.maxHp > 1 && brick.hp < brick.maxHp;
      ctx.save();
      const g = ctx.createLinearGradient(0, brick.y, 0, brick.y + brick.h);
      g.addColorStop(0, brick.color);
      g.addColorStop(1, shade(brick.color, -34));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 7);
      ctx.fill();
      if (brick.maxHp > 1 && !damaged) {
        ctx.strokeStyle = 'rgba(255,255,255,.55)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.beginPath();
      ctx.roundRect(brick.x + 3, brick.y + 3, brick.w - 6, brick.h * 0.32, 5);
      ctx.fill();
      if (damaged) {
        ctx.strokeStyle = 'rgba(0,20,35,.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(brick.x + brick.w * 0.28, brick.y + 4);
        ctx.lineTo(brick.x + brick.w * 0.45, brick.y + brick.h * 0.55);
        ctx.lineTo(brick.x + brick.w * 0.34, brick.y + brick.h - 4);
        ctx.moveTo(brick.x + brick.w * 0.66, brick.y + 3);
        ctx.lineTo(brick.x + brick.w * 0.58, brick.y + brick.h * 0.5);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (n & 255) + amt));
    return `rgb(${r},${g},${b})`;
  }

  function drawPaddle() {
    const p = state.paddle;
    const py = paddleY();
    ctx.save();
    if (state.wideT > 0 && state.wideT < 2) ctx.globalAlpha = 0.65 + Math.sin(performance.now() / 90) * 0.3;
    const g = ctx.createLinearGradient(0, py, 0, py + p.h + 10);
    g.addColorStop(0, '#ff9d76');
    g.addColorStop(1, '#c25c47');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(p.x - p.w / 2, py, p.w, p.h, 9);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.beginPath();
    ctx.roundRect(p.x - p.w / 2 + 4, py + 3, p.w - 8, 5, 4);
    ctx.fill();
    // Coral polyp nubs along the top edge.
    ctx.fillStyle = '#ffc4a8';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(p.x + i * p.w * 0.18, py - 1, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBall(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate((b.x + b.y) / 40);
    ctx.fillStyle = '#f54242';
    ctx.strokeStyle = '#10253b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, b.r, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI);
    ctx.fillStyle = '#f8fbff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-b.r, 0);
    ctx.lineTo(b.r, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fbff';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawStarmie() {
    if (state.starmie.hidden > 0) return;
    const sp = starmiePos();
    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.rotate(state.t * 1.4);
    ctx.globalAlpha = 0.96;
    ctx.drawImage(img.starmie, -40, -40, 80, 80);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.sin(state.t * 5) * 0.15;
    ctx.strokeStyle = '#c39bff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawPowerups() {
    for (const pu of state.powerups) {
      const bob = Math.sin(pu.phase) * 3;
      ctx.save();
      ctx.translate(pu.x, pu.y + bob);
      ctx.shadowColor = '#ffef83';
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(6,26,44,.9)';
      ctx.strokeStyle = '#7eeaff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-17, -17, 34, 34, 9);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.stroke();
      ctx.fillStyle = '#ffef83';
      ctx.font = '900 18px system-ui, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pu.kind === 'wide' ? '↔' : pu.kind === 'multi' ? '✶' : pu.kind === 'slow' ? '≈' : '♥', 0, 1);
      ctx.restore();
    }
    ctx.textBaseline = 'alphabetic';
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

  function panel() {
    ctx.font = '900 22px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(0,25,45,.52)';
    ctx.beginPath();
    ctx.roundRect(16, 14, 300, 78, 16);
    ctx.fill();
    ctx.fillStyle = '#dffcff';
    ctx.fillText('Score: ' + state.score, 32, 44);
    ctx.fillText('Best: ' + best, 32, 76);
    ctx.textAlign = 'right';
    ctx.font = '800 16px system-ui, Segoe UI, sans-serif';
    ctx.fillText('Wave ' + state.level, W - 26, 40);
    ctx.textAlign = 'left';
    for (let i = 0; i < state.lives; i++) {
      const x = W - 40 - i * 26;
      ctx.save();
      ctx.translate(x, 62);
      ctx.fillStyle = '#f54242';
      ctx.strokeStyle = '#10253b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 9, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI);
      ctx.fillStyle = '#f8fbff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (state.wideT > 0 || state.slowT > 0) {
      ctx.font = '800 14px system-ui, Segoe UI, sans-serif';
      ctx.fillStyle = '#ffef83';
      const bits = [];
      if (state.wideT > 0) bits.push('Wide ' + Math.ceil(state.wideT) + 's');
      if (state.slowT > 0) bits.push('Slow ' + Math.ceil(state.slowT) + 's');
      ctx.fillText(bits.join('  ·  '), 330, 40);
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

  function overlay(title, sub, hint) {
    ctx.fillStyle = 'rgba(0,18,36,.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    const waveY = Math.sin(performance.now() / 420) * 5;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 58px system-ui, Segoe UI, sans-serif';
    ctx.strokeStyle = '#00344d';
    ctx.lineWidth = 8;
    ctx.strokeText(title, W / 2, H * 0.35 + waveY);
    ctx.fillText(title, W / 2, H * 0.35 + waveY);
    ctx.font = '800 24px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = '#c8fbff';
    ctx.fillText(sub, W / 2, H * 0.47);
    ctx.font = '700 18px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = '#92e8f3';
    ctx.fillText(hint, W / 2, H * 0.55);
    ctx.textAlign = 'left';
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
    drawBricks();
    drawStarmie();
    drawPowerups();
    drawParticles();
    drawPaddle();
    for (const b of state.balls) drawBall(b);
    ctx.restore();
    drawVignette();
    panel();
    drawPopups();
    if (state.mode === 'title') {
      overlay('Starmie Breaker', 'Bounce the Pokeball. Smash the coral wall.',
        'MOVE mouse / touch / arrows - SPACE or tap to launch - P to pause');
    }
    if (state.mode === 'pause') overlay('Paused', 'Take a breather.', 'PRESS / TOUCH or P to resume');
    if (state.mode === 'over') {
      overlay('Wiped Out!', 'Final score: ' + state.score,
        state.overT >= 0.55 ? 'PRESS / TOUCH to play again - R for title' : ' ');
      if (state.newBest) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffef83';
        ctx.font = '900 26px system-ui, Segoe UI, sans-serif';
        const pulse = 1 + Math.sin(performance.now() / 180) * 0.06;
        ctx.save();
        ctx.translate(W / 2, H * 0.64);
        ctx.scale(pulse, pulse);
        ctx.fillText('NEW BEST!', 0, 0);
        ctx.restore();
        ctx.textAlign = 'left';
      }
    }
    if (state.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${state.hitFlash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
      state.hitFlash = Math.max(0, state.hitFlash - dt * 2);
    }
    requestAnimationFrame(loop);
  }
})();
