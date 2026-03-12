const CONFIG = {
  arenaSize: 4000,
  playerSpeed: 3.9,
  boostedPlayerSpeed: 6.4,
  botSpeed: 3.1,
  botCount: 15,
  orbCount: 180,
  orbRadius: 6,
  naturalOrbLifetime: 18,
  naturalOrbBoostGain: 13,
  bloodOrbBoostGain: 24,
  bloodOrbScoreGain: 16,
  killScoreGain: 36,
  spearBaseLength: 56,
  spearMaxLength: 330,
  respawnTime: 2200,
  spawnProtection: 1,
  boostMax: 100,
  boostDrainPerSecond: 32,
  boostRegenPerSecond: 1.5,
  maxDelta: 0.033,
  playerAcceleration: 0.42,
  botAcceleration: 0.31,
  playerFriction: 0.88,
  botFriction: 0.92,
  turnRateNormal: 6.3,
  turnRateBoosting: 4.2,
  playerCommitTime: 0.15,
  cameraFollow: 8,
  zoomMin: 1.22,
  zoomMax: 1.36,
  deathDropOrbs: 8,
  botPlayerDetectionRadius: 760,
  botOrbDetectionRadius: 420,
  mode: { classic: "classic", pinpoint: "pinpoint", battleRoyale: "battle-royale", battleRoyaleLives: 3 },
};

CONFIG.playerSize = 46;
CONFIG.playerHalfSize = CONFIG.playerSize / 2;

(() => {
  const U = window.StikzUtils;
  const B = window.StikzBots;

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const titleScreen = document.getElementById("titleScreen");
  const gameShell = document.getElementById("game-shell");
  const playerNameInput = document.getElementById("playerNameInput");
  const playButton = document.getElementById("playButton");
  const nameColorInput = document.getElementById("nameColorInput");
  const spearColorInput = document.getElementById("spearColorInput");
  const skinColorInput = document.getElementById("skinColorInput");

  const nameValue = document.getElementById("nameValue");
  const modeValue = document.getElementById("modeValue");
  const killsValue = document.getElementById("killsValue");
  const scoreValue = document.getElementById("scoreValue");
  const livesValue = document.getElementById("livesValue");
  const leaderboardList = document.getElementById("leaderboardList");
  const boostFill = document.getElementById("boostFill");
  const helpLink = document.getElementById("helpLink");
  const helpOverlay = document.getElementById("helpOverlay");
  const closeHelpButton = document.getElementById("closeHelpButton");
  const pauseOverlay = document.getElementById("pauseOverlay");
  const resumeButton = document.getElementById("resumeButton");
  const leaveButton = document.getElementById("leaveButton");

  const NATURAL_COLORS = ["#66f8ff", "#ffe55f", "#ff73c9", "#ca80ff", "#8bff8f"];

  const state = {
    started: false,
    paused: false,
    mode: CONFIG.mode.classic,
    keys: { w: false, a: false, s: false, d: false, space: false },
    mouse: { x: 0, y: 0, down: false },
    camera: { x: 0, y: 0, zoom: CONFIG.zoomMax, shake: 0 },
    lastTime: 0,
    orbIdCounter: 1,
    particles: [],
    trails: [],
    orbs: [],
    bots: [],
    decorations: [],
    brZone: { active: false, x: 2000, y: 2000, radius: 1900, targetRadius: 1900 },
    settings: {
      nameColor: nameColorInput.value,
      spearColor: spearColorInput.value,
      skinColor: skinColorInput.value,
    },
    player: createEntity("You", true),
  };

  function createEntity(name, isPlayer = false) {
    const spawn = U.randomPosition(CONFIG.arenaSize, 90);
    const angle = Math.random() * Math.PI * 2;
    return {
      name,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      halfSize: CONFIG.playerHalfSize,
      color: isPlayer ? state.settings.skinColor : "#9ca6a8",
      spearColor: isPlayer ? state.settings.spearColor : "#f3f8ff",
      nameColor: isPlayer ? state.settings.nameColor : "#e5ffee",
      aimAngle: angle,
      targetAimAngle: angle,
      currentMoveAngle: angle,
      desiredMoveAngle: angle,
      moveCommitTimer: 0,
      score: 0,
      spearLength: CONFIG.spearBaseLength,
      boost: CONFIG.boostMax,
      boosting: false,
      kills: 0,
      alive: true,
      eliminated: false,
      lives: CONFIG.mode.battleRoyaleLives,
      respawnAt: 0,
      spawnProtectedUntil: 0,
      isPlayer,
      botTagColor: "#fff",
    };
  }

  function setSpearFromScore(entity) {
    const t = entity.score / (entity.score + 220);
    const curved = 1 - Math.pow(1 - t, 2.2);
    entity.spearLength = CONFIG.spearBaseLength + curved * (CONFIG.spearMaxLength - CONFIG.spearBaseLength);
  }

  function addScore(entity, amount) {
    entity.score += amount;
    setSpearFromScore(entity);
  }

  function spawnOrb(type = "natural", x = null, y = null) {
    const pos = x == null || y == null ? U.randomPosition(CONFIG.arenaSize, 30) : { x, y };
    const natural = type === "natural";
    state.orbs.push({
      id: state.orbIdCounter++, x: pos.x, y: pos.y, r: CONFIG.orbRadius, type,
      color: natural ? NATURAL_COLORS[U.randInt(0, NATURAL_COLORS.length - 1)] : "#ff334d",
      glow: natural ? 12 : 24,
      expiresAt: natural ? performance.now() + CONFIG.naturalOrbLifetime * 1000 : null,
    });
  }

  function spawnBloodOrbs(x, y, amount) {
    for (let i = 0; i < amount; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = U.randRange(12, 54);
      spawnOrb("blood", U.clamp(x + Math.cos(a) * d, 20, CONFIG.arenaSize - 20), U.clamp(y + Math.sin(a) * d, 20, CONFIG.arenaSize - 20));
    }
  }

  function createDecorations() {
    state.decorations = [];
    for (let i = 0; i < 180; i++) {
      const p = U.randomPosition(CONFIG.arenaSize, 30);
      const r = Math.random();
      if (r < 0.45) state.decorations.push({ type: "grass", x: p.x, y: p.y, s: U.randRange(16, 30) });
      else if (r < 0.75) state.decorations.push({ type: "rock", x: p.x, y: p.y, s: U.randRange(9, 18), rot: U.randRange(0, Math.PI * 2) });
      else state.decorations.push({ type: "flower", x: p.x, y: p.y, s: U.randRange(7, 11), c: NATURAL_COLORS[U.randInt(0, NATURAL_COLORS.length - 1)] });
    }
  }

  function setupWorld() {
    state.orbs = [];
    state.bots = [];
    state.particles = [];
    state.trails = [];

    const mode = state.mode;
    const botCount = mode === CONFIG.mode.battleRoyale ? U.randInt(9, 24) : CONFIG.botCount;

    for (let i = 0; i < CONFIG.orbCount; i++) spawnOrb("natural");
    for (let i = 0; i < botCount; i++) state.bots.push(B.createBot(i, CONFIG));

    createDecorations();

    state.brZone.active = mode === CONFIG.mode.battleRoyale;
    state.brZone.radius = CONFIG.arenaSize * 0.48;
    state.brZone.targetRadius = CONFIG.arenaSize * 0.48;
  }

  function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }

  function bindInput() {
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (k in state.keys) state.keys[k] = true;
      if (k === " ") state.keys.space = true;
      if (k === "escape") {
        if (!state.started) return;
        if (!helpOverlay.classList.contains("hidden")) {
          helpOverlay.classList.add("hidden");
          return;
        }
        state.paused = !state.paused;
        pauseOverlay.classList.toggle("hidden", !state.paused);
      }
    });
    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      if (k in state.keys) state.keys[k] = false;
      if (k === " ") state.keys.space = false;
    });
    canvas.addEventListener("mousemove", (e) => { state.mouse.x = e.clientX; state.mouse.y = e.clientY; });
    canvas.addEventListener("mousedown", (e) => { if (e.button === 0) state.mouse.down = true; });
    window.addEventListener("mouseup", (e) => { if (e.button === 0) state.mouse.down = false; });

    playButton.addEventListener("click", startGame);
    playerNameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") startGame(); });
    nameColorInput.addEventListener("input", () => (state.settings.nameColor = nameColorInput.value));
    spearColorInput.addEventListener("input", () => (state.settings.spearColor = spearColorInput.value));
    skinColorInput.addEventListener("input", () => (state.settings.skinColor = skinColorInput.value));

    helpLink.addEventListener("click", () => helpOverlay.classList.remove("hidden"));
    closeHelpButton.addEventListener("click", () => helpOverlay.classList.add("hidden"));
    resumeButton.addEventListener("click", () => {
      state.paused = false;
      pauseOverlay.classList.add("hidden");
    });
    leaveButton.addEventListener("click", leaveToTitle);
    window.addEventListener("resize", resizeCanvas);
  }

  function leaveToTitle() {
    state.started = false;
    state.paused = false;
    titleScreen.classList.remove("hidden");
    gameShell.classList.add("hidden");
    pauseOverlay.classList.add("hidden");
    helpOverlay.classList.add("hidden");
  }

  function startGame() {
    state.mode = document.querySelector('input[name="mode"]:checked')?.value || CONFIG.mode.classic;
    const inputName = playerNameInput.value.trim() || "You";

    state.player = createEntity(inputName, true);
    state.player.name = inputName;
    state.player.nameColor = state.settings.nameColor;
    state.player.spearColor = state.settings.spearColor;
    state.player.color = state.settings.skinColor;

    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    setupWorld();

    state.started = true;
    state.paused = false;
    titleScreen.classList.add("hidden");
    gameShell.classList.remove("hidden");
    pauseOverlay.classList.add("hidden");
    helpOverlay.classList.add("hidden");

    modeValue.textContent = state.mode === CONFIG.mode.pinpoint ? "Pinpoint" : state.mode === CONFIG.mode.battleRoyale ? "Battle Royale" : "Classic";
  }

  function updateEntityMovement(entity, inputDir, dt, isBot = false) {
    const wantsBoost = entity.alive && entity.boost > 0 && (isBot ? entity.boosting : state.mouse.down || state.keys.space);
    entity.boosting = wantsBoost;

    if (entity.boosting) {
      entity.boost = Math.max(0, entity.boost - CONFIG.boostDrainPerSecond * dt);
      entity.spawnProtectedUntil = 0;
    } else {
      entity.boost = Math.min(CONFIG.boostMax, entity.boost + CONFIG.boostRegenPerSecond * dt);
    }

    if (inputDir.x || inputDir.y) {
      entity.desiredMoveAngle = Math.atan2(inputDir.y, inputDir.x);
      if (entity.moveCommitTimer <= 0) {
        entity.currentMoveAngle = entity.desiredMoveAngle;
        entity.moveCommitTimer = isBot ? U.randRange(0.3, 0.7) : CONFIG.playerCommitTime;
      }
    }

    entity.moveCommitTimer = Math.max(0, entity.moveCommitTimer - dt);

    const move = U.normalize(Math.cos(entity.currentMoveAngle), Math.sin(entity.currentMoveAngle));
    const speedCap = entity.boosting ? (isBot ? entity.speed * 1.35 : CONFIG.boostedPlayerSpeed) : (isBot ? entity.speed : CONFIG.playerSpeed);

    entity.vx += move.x * (isBot ? CONFIG.botAcceleration : CONFIG.playerAcceleration) * dt * 60;
    entity.vy += move.y * (isBot ? CONFIG.botAcceleration : CONFIG.playerAcceleration) * dt * 60;

    const limited = U.limitVector(entity.vx, entity.vy, speedCap);
    const friction = isBot ? CONFIG.botFriction : CONFIG.playerFriction;
    entity.vx = limited.x * friction;
    entity.vy = limited.y * friction;

    entity.x = U.clamp(entity.x + entity.vx * dt * 60, entity.halfSize, CONFIG.arenaSize - entity.halfSize);
    entity.y = U.clamp(entity.y + entity.vy * dt * 60, entity.halfSize, CONFIG.arenaSize - entity.halfSize);

    if (entity.boosting) {
      state.trails.push({ x: entity.x, y: entity.y, size: entity.halfSize * 1.6, life: 0.22, color: entity.color });
    }
  }

  function updatePlayer(dt) {
    const p = state.player;
    if (!p.alive || p.eliminated) return;

    const inputX = (state.keys.d ? 1 : 0) - (state.keys.a ? 1 : 0);
    const inputY = (state.keys.s ? 1 : 0) - (state.keys.w ? 1 : 0);
    const dir = U.normalize(inputX, inputY);
    updateEntityMovement(p, dir, dt, false);

    const worldMouse = screenToWorld(state.mouse.x, state.mouse.y);
    p.targetAimAngle = Math.atan2(worldMouse.y - p.y, worldMouse.x - p.x);
    const turnRate = p.boosting ? CONFIG.turnRateBoosting : CONFIG.turnRateNormal;
    p.aimAngle = U.rotateToward(p.aimAngle, p.targetAimAngle, turnRate * dt);

    if (state.mouse.down) p.spawnProtectedUntil = 0;
  }

  function updateBots(dt) {
    for (const bot of state.bots) {
      if (!bot.alive || bot.eliminated) continue;
      B.updateBot(bot, state, dt, CONFIG);
      const dir = U.normalize(Math.cos(bot.currentMoveAngle), Math.sin(bot.currentMoveAngle));
      updateEntityMovement(bot, dir, dt, true);
    }
  }

  function applySoftCollisions() {
    const entities = [state.player, ...state.bots].filter((e) => e.alive && !e.eliminated);
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = entities[i];
        const b = entities[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const minDist = a.halfSize + b.halfSize;
        if (dist >= minDist) continue;
        const overlap = (minDist - dist) * 0.5;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;
      }
    }
  }

  function getHandPosition(entity, front = true) {
    const edge = front ? entity.halfSize * 0.6 : -entity.halfSize * 0.45;
    const side = entity.halfSize * 0.38;
    const px = entity.x + Math.cos(entity.aimAngle) * edge;
    const py = entity.y + Math.sin(entity.aimAngle) * edge;
    return {
      x: px + Math.cos(entity.aimAngle + Math.PI / 2) * side,
      y: py + Math.sin(entity.aimAngle + Math.PI / 2) * side,
    };
  }

  function getSpearTip(entity) {
    const hand = getHandPosition(entity, true);
    return { hand, x: hand.x + Math.cos(entity.aimAngle) * entity.spearLength, y: hand.y + Math.sin(entity.aimAngle) * entity.spearLength };
  }

  function getEntityRect(entity) {
    return { left: entity.x - entity.halfSize, right: entity.x + entity.halfSize, top: entity.y - entity.halfSize, bottom: entity.y + entity.halfSize };
  }

  function spearHitsEntity(attacker, target) {
    if (performance.now() < target.spawnProtectedUntil) return false;
    const tip = getSpearTip(attacker);
    const rect = getEntityRect(target);
    if (state.mode === CONFIG.mode.pinpoint) return U.pointInRect(tip.x, tip.y, rect);
    return U.lineIntersectsRect(tip.hand.x, tip.hand.y, tip.x, tip.y, rect);
  }

  function killEntity(victim, killer) {
    victim.alive = false;
    victim.vx = 0;
    victim.vy = 0;

    if (killer) {
      killer.kills += 1;
      addScore(killer, CONFIG.killScoreGain);
    }

    spawnBloodOrbs(victim.x, victim.y, CONFIG.deathDropOrbs);
    spawnBurst(victim.x, victim.y, "#ff5562", 18);

    const victimScreen = worldToScreen(victim.x, victim.y);
    const inView = victimScreen.x > 0 && victimScreen.x < canvas.width && victimScreen.y > 0 && victimScreen.y < canvas.height;
    if (killer === state.player || inView) state.camera.shake = Math.max(state.camera.shake, 8);

    if (state.mode === CONFIG.mode.battleRoyale) {
      victim.lives -= 1;
      if (victim.lives <= 0) {
        victim.eliminated = true;
      } else {
        victim.respawnAt = performance.now() + CONFIG.respawnTime;
      }
    } else {
      victim.respawnAt = performance.now() + CONFIG.respawnTime;
    }
  }

  function respawnEntity(entity) {
    const spawn = U.randomPosition(CONFIG.arenaSize, 90);
    entity.x = spawn.x;
    entity.y = spawn.y;
    entity.alive = true;
    entity.spawnProtectedUntil = performance.now() + CONFIG.spawnProtection * 1000;
    entity.boost = Math.max(entity.boost, 40);
  }

  function updateRespawns() {
    const now = performance.now();
    if (!state.player.alive && !state.player.eliminated && now >= state.player.respawnAt) respawnEntity(state.player);
    for (const bot of state.bots) {
      if (!bot.alive && !bot.eliminated && now >= bot.respawnAt) respawnEntity(bot);
    }
  }

  function updateOrbs() {
    const entities = [state.player, ...state.bots].filter((e) => e.alive && !e.eliminated);
    const now = performance.now();
    for (let i = state.orbs.length - 1; i >= 0; i--) {
      const orb = state.orbs[i];
      if (orb.expiresAt && now > orb.expiresAt) {
        state.orbs.splice(i, 1);
        spawnOrb("natural");
        continue;
      }
      for (const e of entities) {
        if (U.distance(orb.x, orb.y, e.x, e.y) < e.halfSize + orb.r + 2) {
          if (orb.type === "blood") {
            e.boost = Math.min(CONFIG.boostMax, e.boost + CONFIG.bloodOrbBoostGain);
            addScore(e, CONFIG.bloodOrbScoreGain);
          } else {
            e.boost = Math.min(CONFIG.boostMax, e.boost + CONFIG.naturalOrbBoostGain);
          }
          spawnBurst(orb.x, orb.y, orb.color, 8);
          state.orbs.splice(i, 1);
          if (orb.type === "natural") spawnOrb("natural");
          break;
        }
      }
    }
  }

  function spawnBurst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = U.randRange(0.8, 3.4);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.randRange(0.2, 0.7), size: U.randRange(1.6, 4.5), color });
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    for (let i = state.trails.length - 1; i >= 0; i--) {
      state.trails[i].life -= dt;
      if (state.trails[i].life <= 0) state.trails.splice(i, 1);
    }
  }

  function updateBattleRoyaleZone(dt) {
    if (!state.brZone.active) return;
    const aliveCount = [state.player, ...state.bots].filter((e) => e.alive && !e.eliminated).length;
    if (aliveCount <= 1) return;

    state.brZone.targetRadius = Math.max(220, state.brZone.targetRadius - dt * 8);
    state.brZone.radius = U.lerp(state.brZone.radius, state.brZone.targetRadius, Math.min(1, dt * 0.8));

    for (const e of [state.player, ...state.bots]) {
      if (!e.alive || e.eliminated) continue;
      const d = U.distance(e.x, e.y, state.brZone.x, state.brZone.y);
      if (d > state.brZone.radius) {
        e.boost = Math.max(0, e.boost - dt * 12);
        if (Math.random() < 0.05) spawnBurst(e.x, e.y, "#ff4458", 2);
      }
    }
  }

  function checkCombat() {
    const attackers = [state.player, ...state.bots].filter((e) => e.alive && !e.eliminated);
    for (const attacker of attackers) {
      for (const target of attackers) {
        if (target === attacker) continue;
        if (spearHitsEntity(attacker, target)) killEntity(target, attacker);
      }
    }
  }

  function updateCamera(dt) {
    state.camera.x = U.lerp(state.camera.x, state.player.x, Math.min(1, dt * CONFIG.cameraFollow));
    state.camera.y = U.lerp(state.camera.y, state.player.y, Math.min(1, dt * CONFIG.cameraFollow));

    const spearT = U.clamp((state.player.spearLength - CONFIG.spearBaseLength) / (CONFIG.spearMaxLength - CONFIG.spearBaseLength), 0, 1);
    const zoomTarget = CONFIG.zoomMax - spearT * (CONFIG.zoomMax - CONFIG.zoomMin);
    state.camera.zoom = U.lerp(state.camera.zoom, zoomTarget, Math.min(1, dt * 4));

    state.camera.shake = Math.max(0, state.camera.shake - dt * 18);
  }

  function worldToScreen(x, y) {
    const sx = (x - state.camera.x) * state.camera.zoom + canvas.width / 2;
    const sy = (y - state.camera.y) * state.camera.zoom + canvas.height / 2;
    return { x: sx + (Math.random() - 0.5) * state.camera.shake, y: sy + (Math.random() - 0.5) * state.camera.shake };
  }
  function screenToWorld(x, y) {
    return { x: state.camera.x + (x - canvas.width / 2) / state.camera.zoom, y: state.camera.y + (y - canvas.height / 2) / state.camera.zoom };
  }

  function renderGround() {
    ctx.fillStyle = "#0e1a13";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tl = worldToScreen(0, 0);
    const br = worldToScreen(CONFIG.arenaSize, CONFIG.arenaSize);
    const left = Math.min(tl.x, br.x);
    const top = Math.min(tl.y, br.y);
    const width = Math.abs(br.x - tl.x);
    const height = Math.abs(br.y - tl.y);

    ctx.fillStyle = "#1f4f31";
    ctx.fillRect(left, top, width, height);

    ctx.save();
    ctx.fillStyle = "rgba(4,10,8,0.65)";
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.rect(left, top, width, height);
    ctx.fill("evenodd");
    ctx.restore();

    for (const d of state.decorations) {
      const s = worldToScreen(d.x, d.y);
      if (s.x < -30 || s.y < -30 || s.x > canvas.width + 30 || s.y > canvas.height + 30) continue;
      if (d.type === "grass") {
        ctx.fillStyle = "#29643b";
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, d.s * state.camera.zoom * 0.56, d.s * state.camera.zoom * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === "rock") {
        const size = d.s * state.camera.zoom;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(d.rot);
        ctx.fillStyle = "#808b86";
        ctx.beginPath();
        ctx.moveTo(-size * 0.7, -size * 0.2); ctx.lineTo(-size * 0.2, -size * 0.6); ctx.lineTo(size * 0.65, -size * 0.3);
        ctx.lineTo(size * 0.5, size * 0.45); ctx.lineTo(-size * 0.5, size * 0.55); ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        const size = d.s * state.camera.zoom;
        ctx.fillStyle = "#f7ffe1";
        ctx.beginPath(); ctx.arc(s.x, s.y, size * 0.2, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 5; i++) {
          const a = (Math.PI * 2 * i) / 5;
          ctx.beginPath();
          ctx.arc(s.x + Math.cos(a) * size * 0.45, s.y + Math.sin(a) * size * 0.45, size * 0.27, 0, Math.PI * 2);
          ctx.fillStyle = d.c;
          ctx.fill();
        }
      }
    }
  }

  function renderOrbs() {
    for (const o of state.orbs) {
      const s = worldToScreen(o.x, o.y);
      ctx.beginPath();
      ctx.arc(s.x, s.y, o.r * state.camera.zoom, 0, Math.PI * 2);
      ctx.fillStyle = o.color;
      ctx.shadowColor = o.color;
      ctx.shadowBlur = o.glow;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function renderTrails() {
    for (const t of state.trails) {
      const s = worldToScreen(t.x, t.y);
      ctx.globalAlpha = t.life / 0.22;
      ctx.fillStyle = t.color;
      const size = t.size * state.camera.zoom;
      ctx.beginPath();
      ctx.roundRect(s.x - size / 2, s.y - size / 2, size, size, size * 0.25);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function renderEntity(entity) {
    if (!entity.alive || entity.eliminated) return;
    const s = worldToScreen(entity.x, entity.y);
    const size = entity.halfSize * 2 * state.camera.zoom;
    const alpha = performance.now() < entity.spawnProtectedUntil ? 0.62 : 1;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = entity.color;
    ctx.shadowColor = entity.color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.roundRect(s.x - size / 2, s.y - size / 2, size, size, size * 0.24);
    ctx.fill();
    ctx.shadowBlur = 0;

    const front = getHandPosition(entity, true);
    const back = getHandPosition(entity, false);
    const frontS = worldToScreen(front.x, front.y);
    const backS = worldToScreen(back.x, back.y);
    ctx.fillStyle = "#efcca3";
    ctx.beginPath();
    ctx.arc(frontS.x, frontS.y, 4 * state.camera.zoom, 0, Math.PI * 2);
    ctx.arc(backS.x, backS.y, 4 * state.camera.zoom, 0, Math.PI * 2);
    ctx.fill();

    const tip = getSpearTip(entity);
    const tipS = worldToScreen(tip.x, tip.y);
    ctx.beginPath();
    ctx.moveTo(frontS.x, frontS.y);
    ctx.lineTo(tipS.x, tipS.y);
    ctx.lineWidth = 5 * state.camera.zoom;
    ctx.strokeStyle = entity.spearColor;
    ctx.stroke();

    const a = entity.aimAngle;
    const head = 10 * state.camera.zoom;
    const wing = 4 * state.camera.zoom;
    ctx.beginPath();
    ctx.moveTo(tipS.x, tipS.y);
    ctx.lineTo(tipS.x - Math.cos(a) * head + Math.cos(a + Math.PI / 2) * wing, tipS.y - Math.sin(a) * head + Math.sin(a + Math.PI / 2) * wing);
    ctx.lineTo(tipS.x - Math.cos(a) * head - Math.cos(a + Math.PI / 2) * wing, tipS.y - Math.sin(a) * head - Math.sin(a + Math.PI / 2) * wing);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    const nameText = entity.isPlayer ? entity.name : entity.name;
    ctx.textAlign = "center";
    ctx.font = `700 ${12 * state.camera.zoom}px Arial`;
    if (!entity.isPlayer) {
      const idx = entity.name.indexOf("[BOT]");
      const base = idx > 0 ? entity.name.slice(0, idx).trim() : entity.name;
      ctx.fillStyle = "#d8e5dd";
      ctx.fillText(base, s.x, s.y - size * 0.95);
      ctx.fillStyle = entity.botTagColor;
      ctx.fillText("[BOT]", s.x, s.y - size * 0.8);
      ctx.beginPath();
      ctx.fillStyle = entity.botTagColor;
      ctx.arc(s.x, s.y - size * 1.08, 4 * state.camera.zoom, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = entity.nameColor;
      const hearts = state.mode === CONFIG.mode.battleRoyale ? " " + "❤ ".repeat(Math.max(0, entity.lives)).trim() : "";
      ctx.fillText(nameText + hearts, s.x, s.y - size * 0.95);
    }

    ctx.globalAlpha = 1;
  }

  function renderParticles() {
    for (const p of state.particles) {
      const s = worldToScreen(p.x, p.y);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, p.size * state.camera.zoom, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function renderZone() {
    if (!state.brZone.active) return;
    const c = worldToScreen(state.brZone.x, state.brZone.y);
    ctx.beginPath();
    ctx.arc(c.x, c.y, state.brZone.radius * state.camera.zoom, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,90,110,0.8)";
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  function updateHUD() {
    nameValue.textContent = state.player.name;
    killsValue.textContent = state.player.kills;
    scoreValue.textContent = Math.floor(state.player.score);
    livesValue.textContent = state.mode === CONFIG.mode.battleRoyale ? "❤ ".repeat(Math.max(0, state.player.lives)).trim() || "—" : "—";

    const b = state.player.boost / CONFIG.boostMax;
    boostFill.style.width = `${Math.round(b * 100)}%`;
    boostFill.style.backgroundColor = b > 0.55 ? "#5cf066" : b > 0.25 ? "#f2d95f" : "#ff5968";

    const board = [state.player, ...state.bots]
      .filter((e) => !e.eliminated)
      .map((e) => ({ name: e.name, kills: e.kills, botTagColor: e.botTagColor, isPlayer: e.isPlayer }))
      .sort((a, b) => b.kills - a.kills)
      .slice(0, 8);
    leaderboardList.innerHTML = board.map((e) => `<li>${e.name}: ${e.kills} ☠</li>`).join("");
  }

  function checkBattleRoyaleWin() {
    if (state.mode !== CONFIG.mode.battleRoyale) return;
    const alive = [state.player, ...state.bots].filter((e) => e.alive && !e.eliminated);
    if (alive.length === 1) {
      state.paused = true;
      pauseOverlay.classList.remove("hidden");
      pauseOverlay.querySelector("h3").textContent = alive[0].isPlayer ? "Victory!" : `${alive[0].name} wins`;
    }
  }

  function tick(time) {
    if (!state.started) return requestAnimationFrame(tick);
    const dt = Math.min(CONFIG.maxDelta, (time - state.lastTime) / 1000 || 0.016);
    state.lastTime = time;

    if (!state.paused) {
      updatePlayer(dt);
      updateBots(dt);
      applySoftCollisions();
      updateOrbs();
      checkCombat();
      updateRespawns();
      updateParticles(dt);
      updateBattleRoyaleZone(dt);
      updateCamera(dt);
      checkBattleRoyaleWin();
    }

    renderGround();
    renderZone();
    renderTrails();
    renderOrbs();
    for (const bot of state.bots) renderEntity(bot);
    renderEntity(state.player);
    renderParticles();
    updateHUD();

    requestAnimationFrame(tick);
  }

  bindInput();
  resizeCanvas();
  requestAnimationFrame((t) => {
    state.lastTime = t;
    tick(t);
  });
})();
