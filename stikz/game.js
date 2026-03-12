const CONFIG = {
  arenaSize: 4000,
  playerSpeed: 4,
  boostedPlayerSpeed: 6.8,
  botSpeed: 3,
  orbCount: 190,
  naturalOrbBoostGain: 18,
  bloodOrbBoostGain: 24,
  bloodOrbSpearGain: 8,
  killSpearGain: 24,
  spearBaseLength: 60,
  spearMaxLength: 330,
  spearDisplayMax: 999,
  botCount: 15,
  respawnTime: 3000,
  orbRadius: 6,
  maxDelta: 0.033,
  playerAcceleration: 0.42,
  botAcceleration: 0.3,
  playerFriction: 0.88,
  botFriction: 0.92,
  deathDropOrbs: 8,
  gridSize: 80,
  botPlayerDetectionRadius: 720,
  botOrbDetectionRadius: 420,
  naturalOrbLifetime: 20,
  boostDrainPerSecond: 33,
  boostMax: 100,
  playerGlow: "rgba(255, 218, 173, 0.75)",
  cameraFollow: 8,
  cameraZoom: 1.24,
  mode: {
    classic: "classic",
    pinpoint: "pinpoint",
  },
};

CONFIG.playerSize = CONFIG.gridSize * 0.5;
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
  const uiColorInput = document.getElementById("uiColorInput");
  const hairStyleSelect = document.getElementById("hairStyleSelect");

  const nameValue = document.getElementById("nameValue");
  const modeValue = document.getElementById("modeValue");
  const killsValue = document.getElementById("killsValue");
  const spearValue = document.getElementById("spearValue");
  const leaderboardList = document.getElementById("leaderboardList");
  const boostFill = document.getElementById("boostFill");
  const helpLink = document.getElementById("helpLink");
  const helpOverlay = document.getElementById("helpOverlay");
  const closeHelpButton = document.getElementById("closeHelpButton");

  const NATURAL_COLORS = ["#66f8ff", "#ffe55f", "#ff73c9", "#ca80ff", "#8bff8f"];

  const state = {
    started: false,
    mode: CONFIG.mode.classic,
    keys: { w: false, a: false, s: false, d: false, space: false },
    mouse: { x: 0, y: 0, down: false },
    camera: { x: 0, y: 0, shake: 0 },
    lastTime: 0,
    orbIdCounter: 1,
    particles: [],
    orbs: [],
    bots: [],
    decorations: [],
    settings: {
      uiColor: uiColorInput.value,
      hairStyle: hairStyleSelect.value,
      handedness: "right",
    },
    player: createEntity("You", "#f3c592", true),
  };

  function createEntity(name, color, isPlayer = false) {
    const spawn = U.randomPosition(CONFIG.arenaSize, 60);
    const baseAngle = Math.random() * Math.PI * 2;
    return {
      name,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      halfSize: CONFIG.playerHalfSize,
      spearLength: CONFIG.spearBaseLength,
      kills: 0,
      alive: true,
      respawnAt: 0,
      aimX: spawn.x + 1,
      aimY: spawn.y,
      aimAngle: baseAngle,
      targetAimAngle: baseAngle,
      color,
      isPlayer,
      boost: CONFIG.boostMax,
      boosting: false,
      hairStyle: isPlayer ? "short" : "bald",
      handedness: "right",
    };
  }

  function getDisplaySpearLength(entity) {
    return Math.floor((entity.spearLength / CONFIG.spearMaxLength) * CONFIG.spearDisplayMax);
  }

  function growSpear(entity, gain) {
    entity.spearLength = U.clamp(entity.spearLength + gain, 0, CONFIG.spearMaxLength);
  }

  function addBoost(entity, amount) {
    entity.boost = U.clamp(entity.boost + amount, 0, CONFIG.boostMax);
  }

  function getEntityRect(entity) {
    return {
      left: entity.x - entity.halfSize,
      right: entity.x + entity.halfSize,
      top: entity.y - entity.halfSize,
      bottom: entity.y + entity.halfSize,
    };
  }

  function spawnOrb(type = "natural", x = null, y = null) {
    const pos = x == null || y == null ? U.randomPosition(CONFIG.arenaSize, 20) : { x, y };
    const natural = type === "natural";
    state.orbs.push({
      id: state.orbIdCounter++,
      x: pos.x,
      y: pos.y,
      r: CONFIG.orbRadius,
      type,
      color: natural ? NATURAL_COLORS[U.randInt(0, NATURAL_COLORS.length - 1)] : "#ff364d",
      glow: natural ? 12 : 22,
      expiresAt: natural ? performance.now() + CONFIG.naturalOrbLifetime * 1000 : null,
    });
  }

  function spawnBloodOrbs(x, y, amount) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = U.randRange(10, 52);
      const ox = U.clamp(x + Math.cos(angle) * dist, 20, CONFIG.arenaSize - 20);
      const oy = U.clamp(y + Math.sin(angle) * dist, 20, CONFIG.arenaSize - 20);
      spawnOrb("blood", ox, oy);
    }
  }

  function killEntity(victim, killer) {
    victim.alive = false;
    victim.respawnAt = performance.now() + CONFIG.respawnTime;
    victim.vx = 0;
    victim.vy = 0;

    if (killer) {
      killer.kills += 1;
      growSpear(killer, CONFIG.killSpearGain);
    }

    spawnBloodOrbs(victim.x, victim.y, CONFIG.deathDropOrbs);
    spawnDeathParticles(victim.x, victim.y, "#ff5f66");
    state.camera.shake = 8;
  }

  function respawnEntity(entity) {
    const spawn = U.randomPosition(CONFIG.arenaSize, 80);
    entity.x = spawn.x;
    entity.y = spawn.y;
    entity.spearLength = CONFIG.spearBaseLength;
    entity.boost = CONFIG.boostMax;
    entity.vx = 0;
    entity.vy = 0;
    entity.alive = true;
    entity.aimX = spawn.x + 1;
    entity.aimY = spawn.y;
    entity.aimAngle = 0;
    entity.targetAimAngle = 0;
  }

  function spawnDeathParticles(x, y, color) {
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = U.randRange(1.8, 4.8);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: U.randRange(0.35, 0.8),
        size: U.randRange(2, 5),
        color,
      });
    }
  }

  function spawnCollectParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = U.randRange(0.6, 2.1);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: U.randRange(0.2, 0.45),
        size: U.randRange(1.5, 3.5),
        color,
      });
    }
  }

  function setupWorld() {
    state.orbs = [];
    state.bots = [];
    state.decorations = [];

    for (let i = 0; i < CONFIG.orbCount; i++) spawnOrb("natural");
    for (let i = 0; i < CONFIG.botCount; i++) state.bots.push(B.createBot(i, CONFIG));
    createDecorations();
    resizeCanvas();
  }

  function createDecorations() {
    const count = 180;
    for (let i = 0; i < count; i++) {
      const pos = U.randomPosition(CONFIG.arenaSize, 30);
      const roll = Math.random();
      if (roll < 0.45) {
        state.decorations.push({ type: "grass", x: pos.x, y: pos.y, s: U.randRange(14, 30) });
      } else if (roll < 0.75) {
        state.decorations.push({ type: "rock", x: pos.x, y: pos.y, s: U.randRange(9, 18), rot: U.randRange(0, Math.PI * 2) });
      } else {
        state.decorations.push({ type: "flower", x: pos.x, y: pos.y, s: U.randRange(7, 12), c: NATURAL_COLORS[U.randInt(0, NATURAL_COLORS.length - 1)] });
      }
    }
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function bindInput() {
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (k in state.keys) state.keys[k] = true;
      if (k === " ") state.keys.space = true;
      if (k === "escape") helpOverlay.classList.add("hidden");
    });

    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      if (k in state.keys) state.keys[k] = false;
      if (k === " ") state.keys.space = false;
    });

    canvas.addEventListener("mousemove", (e) => {
      state.mouse.x = e.clientX;
      state.mouse.y = e.clientY;
    });

    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0) state.mouse.down = true;
    });

    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) state.mouse.down = false;
    });

    playButton.addEventListener("click", startGame);
    playerNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") startGame();
    });

    uiColorInput.addEventListener("input", () => {
      state.settings.uiColor = uiColorInput.value;
      document.documentElement.style.setProperty("--ui-accent", state.settings.uiColor);
    });

    hairStyleSelect.addEventListener("change", () => {
      state.settings.hairStyle = hairStyleSelect.value;
      state.player.hairStyle = hairStyleSelect.value;
    });

    document.querySelectorAll('input[name="handedness"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        if (radio.checked) {
          state.settings.handedness = radio.value;
          state.player.handedness = radio.value;
        }
      });
    });

    helpLink.addEventListener("click", () => helpOverlay.classList.remove("hidden"));
    helpLink.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        helpOverlay.classList.remove("hidden");
      }
    });
    closeHelpButton.addEventListener("click", () => helpOverlay.classList.add("hidden"));

    window.addEventListener("resize", resizeCanvas);
  }

  function startGame() {
    const selectedMode = document.querySelector('input[name="mode"]:checked')?.value || CONFIG.mode.classic;
    state.mode = selectedMode;

    const inputName = playerNameInput.value.trim();
    state.player.name = inputName || "You";
    nameValue.textContent = state.player.name;
    modeValue.textContent = state.mode === CONFIG.mode.pinpoint ? "Pinpoint" : "Classic";

    state.player = createEntity(state.player.name, "#f3c592", true);
    state.player.name = inputName || "You";
    state.player.hairStyle = state.settings.hairStyle;
    state.player.handedness = state.settings.handedness;

    state.camera.x = state.player.x;
    state.camera.y = state.player.y;

    setupWorld();
    state.started = true;
    titleScreen.classList.add("hidden");
    gameShell.classList.remove("hidden");
    helpOverlay.classList.add("hidden");
    canvas.focus();
  }

  function updatePlayer(dt) {
    const p = state.player;
    if (!p.alive) return;

    const inputX = (state.keys.d ? 1 : 0) - (state.keys.a ? 1 : 0);
    const inputY = (state.keys.s ? 1 : 0) - (state.keys.w ? 1 : 0);
    const dir = U.normalize(inputX, inputY);

    p.boosting = (state.mouse.down || state.keys.space) && p.boost > 0;
    const speedCap = p.boosting ? CONFIG.boostedPlayerSpeed : CONFIG.playerSpeed;

    if (p.boosting) p.boost = Math.max(0, p.boost - CONFIG.boostDrainPerSecond * dt);

    p.vx += dir.x * CONFIG.playerAcceleration * dt * 60;
    p.vy += dir.y * CONFIG.playerAcceleration * dt * 60;

    const limited = U.limitVector(p.vx, p.vy, speedCap);
    p.vx = limited.x * CONFIG.playerFriction;
    p.vy = limited.y * CONFIG.playerFriction;

    p.x = U.clamp(p.x + p.vx * dt * 60, p.halfSize, CONFIG.arenaSize - p.halfSize);
    p.y = U.clamp(p.y + p.vy * dt * 60, p.halfSize, CONFIG.arenaSize - p.halfSize);

    const worldMouse = screenToWorld(state.mouse.x, state.mouse.y);
    p.aimX = worldMouse.x;
    p.aimY = worldMouse.y;

    p.targetAimAngle = Math.atan2(p.aimY - p.y, p.aimX - p.x);
    p.aimAngle = U.lerpAngle(p.aimAngle, p.targetAimAngle, 0.22);
  }

  function updateBots(dt) {
    for (const bot of state.bots) {
      if (!bot.alive) continue;
      B.updateBot(bot, state, dt, CONFIG);
    }
  }

  function updateRespawns() {
    const now = performance.now();

    if (!state.player.alive && now >= state.player.respawnAt) {
      respawnEntity(state.player);
    }

    for (const bot of state.bots) {
      if (!bot.alive && now >= bot.respawnAt) {
        respawnEntity(bot);
      }
    }
  }

  function updateOrbs() {
    const entities = [state.player, ...state.bots];
    const now = performance.now();

    for (let i = state.orbs.length - 1; i >= 0; i--) {
      const orb = state.orbs[i];
      let collectedBy = null;

      if (orb.expiresAt && now > orb.expiresAt) {
        state.orbs.splice(i, 1);
        spawnOrb("natural");
        continue;
      }

      for (const e of entities) {
        if (!e.alive) continue;
        if (U.distance(orb.x, orb.y, e.x, e.y) < e.halfSize + orb.r + 2) {
          collectedBy = e;
          break;
        }
      }

      if (collectedBy) {
        if (orb.type === "blood") {
          addBoost(collectedBy, CONFIG.bloodOrbBoostGain);
          growSpear(collectedBy, CONFIG.bloodOrbSpearGain);
        } else {
          addBoost(collectedBy, CONFIG.naturalOrbBoostGain);
        }

        spawnCollectParticles(orb.x, orb.y, orb.color);
        state.orbs.splice(i, 1);
        if (orb.type === "natural") spawnOrb("natural");
      }
    }
  }

  function getHandPosition(entity, angle) {
    const handDir = (entity.handedness || "right") === "left" ? -1 : 1;
    const sideX = Math.cos(angle + Math.PI / 2) * entity.halfSize * 0.48 * handDir;
    const sideY = Math.sin(angle + Math.PI / 2) * entity.halfSize * 0.48 * handDir;
    const frontX = Math.cos(angle) * entity.halfSize * 0.16;
    const frontY = Math.sin(angle) * entity.halfSize * 0.16;
    return { x: entity.x + sideX + frontX, y: entity.y + sideY + frontY };
  }

  function getSpearTip(entity) {
    const hand = getHandPosition(entity, entity.aimAngle);
    return {
      x: hand.x + Math.cos(entity.aimAngle) * entity.spearLength,
      y: hand.y + Math.sin(entity.aimAngle) * entity.spearLength,
      hand,
      angle: entity.aimAngle,
      len: entity.spearLength,
    };
  }

  function spearHitsEntity(attacker, target) {
    const tip = getSpearTip(attacker);
    const rect = getEntityRect(target);

    if (state.mode === CONFIG.mode.pinpoint) {
      return U.pointInRect(tip.x, tip.y, rect);
    }

    return U.lineIntersectsRect(tip.hand.x, tip.hand.y, tip.x, tip.y, rect);
  }

  function checkCombat() {
    const attackers = [state.player, ...state.bots].filter((e) => e.alive);

    for (const attacker of attackers) {
      if (state.player.alive && attacker !== state.player && spearHitsEntity(attacker, state.player)) {
        killEntity(state.player, attacker);
        continue;
      }

      for (const bot of state.bots) {
        if (!bot.alive || bot === attacker) continue;
        if (spearHitsEntity(attacker, bot)) {
          killEntity(bot, attacker);
        }
      }
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
  }

  function updateCamera(dt) {
    const targetX = state.player.x;
    const targetY = state.player.y;
    state.camera.x = U.lerp(state.camera.x, targetX, Math.min(1, dt * CONFIG.cameraFollow));
    state.camera.y = U.lerp(state.camera.y, targetY, Math.min(1, dt * CONFIG.cameraFollow));
    state.camera.shake = Math.max(0, state.camera.shake - dt * 20);
  }

  function worldToScreen(x, y) {
    const shakeX = (Math.random() - 0.5) * state.camera.shake;
    const shakeY = (Math.random() - 0.5) * state.camera.shake;
    return {
      x: (x - state.camera.x) * CONFIG.cameraZoom + canvas.width / 2 + shakeX,
      y: (y - state.camera.y) * CONFIG.cameraZoom + canvas.height / 2 + shakeY,
    };
  }

  function screenToWorld(x, y) {
    return {
      x: state.camera.x + (x - canvas.width / 2) / CONFIG.cameraZoom,
      y: state.camera.y + (y - canvas.height / 2) / CONFIG.cameraZoom,
    };
  }

  function renderGround() {
    ctx.fillStyle = "#1e4a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const d of state.decorations) {
      const s = worldToScreen(d.x, d.y);
      if (s.x < -30 || s.y < -30 || s.x > canvas.width + 30 || s.y > canvas.height + 30) continue;

      if (d.type === "grass") {
        ctx.fillStyle = "#28663a";
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, d.s * CONFIG.cameraZoom * 0.55, d.s * CONFIG.cameraZoom * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === "rock") {
        const size = d.s * CONFIG.cameraZoom;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(d.rot);
        ctx.fillStyle = "#84908b";
        ctx.beginPath();
        ctx.moveTo(-size * 0.7, -size * 0.2);
        ctx.lineTo(-size * 0.2, -size * 0.6);
        ctx.lineTo(size * 0.65, -size * 0.3);
        ctx.lineTo(size * 0.5, size * 0.45);
        ctx.lineTo(-size * 0.5, size * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        const size = d.s * CONFIG.cameraZoom;
        ctx.fillStyle = "#f9ffd5";
        ctx.beginPath();
        ctx.arc(s.x, s.y, size * 0.22, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 5; i++) {
          const a = (Math.PI * 2 * i) / 5;
          ctx.beginPath();
          ctx.arc(s.x + Math.cos(a) * size * 0.48, s.y + Math.sin(a) * size * 0.48, size * 0.28, 0, Math.PI * 2);
          ctx.fillStyle = d.c;
          ctx.fill();
        }
      }
    }
  }

  function renderOrbs() {
    for (const orb of state.orbs) {
      const s = worldToScreen(orb.x, orb.y);
      ctx.beginPath();
      ctx.arc(s.x, s.y, orb.r * CONFIG.cameraZoom, 0, Math.PI * 2);
      ctx.fillStyle = orb.color;
      ctx.shadowColor = orb.color;
      ctx.shadowBlur = orb.glow;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function renderHair(entity, sx, sy, size) {
    if (entity.hairStyle === "bald") return;
    const top = sy - size * 0.52;

    ctx.fillStyle = "#4c2e18";
    if (entity.hairStyle === "short") {
      ctx.fillRect(sx - size * 0.32, top, size * 0.64, size * 0.24);
    } else if (entity.hairStyle === "messy") {
      ctx.beginPath();
      ctx.moveTo(sx - size * 0.32, top + size * 0.2);
      ctx.lineTo(sx - size * 0.1, top - size * 0.08);
      ctx.lineTo(sx + size * 0.05, top + size * 0.11);
      ctx.lineTo(sx + size * 0.18, top - size * 0.05);
      ctx.lineTo(sx + size * 0.32, top + size * 0.2);
      ctx.closePath();
      ctx.fill();
    } else if (entity.hairStyle === "spiky") {
      for (let i = -2; i <= 2; i++) {
        const x = sx + i * size * 0.14;
        ctx.beginPath();
        ctx.moveTo(x - size * 0.06, top + size * 0.2);
        ctx.lineTo(x, top - size * 0.16);
        ctx.lineTo(x + size * 0.06, top + size * 0.2);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function renderEntity(entity) {
    if (!entity.alive) return;
    const s = worldToScreen(entity.x, entity.y);

    const size = entity.halfSize * 2 * CONFIG.cameraZoom;
    const radius = size * 0.26;

    ctx.fillStyle = entity.color;
    ctx.shadowColor = entity.isPlayer ? CONFIG.playerGlow : entity.color;
    ctx.shadowBlur = entity.isPlayer ? 28 : 18;
    ctx.beginPath();
    ctx.roundRect(s.x - size / 2, s.y - size / 2, size, size, radius);
    ctx.fill();
    ctx.shadowBlur = 0;

    renderHair(entity, s.x, s.y, size);

    const spear = getSpearTip(entity);
    const handS = worldToScreen(spear.hand.x, spear.hand.y);
    const tipS = worldToScreen(spear.x, spear.y);

    const offHand = getHandPosition(entity, entity.aimAngle + Math.PI);
    const offHandS = worldToScreen(offHand.x, offHand.y);

    ctx.fillStyle = "#e9c18d";
    ctx.beginPath();
    ctx.arc(handS.x, handS.y, 4 * CONFIG.cameraZoom, 0, Math.PI * 2);
    ctx.arc(offHandS.x, offHandS.y, 4 * CONFIG.cameraZoom, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(handS.x, handS.y);
    ctx.lineTo(tipS.x, tipS.y);
    ctx.lineWidth = 5 * CONFIG.cameraZoom;
    ctx.strokeStyle = "#f2f8ff";
    ctx.shadowColor = "#d9f3ff";
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(tipS.x, tipS.y, 5 * CONFIG.cameraZoom, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }

  function renderParticles() {
    for (const p of state.particles) {
      const s = worldToScreen(p.x, p.y);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.beginPath();
      ctx.arc(s.x, s.y, p.size * CONFIG.cameraZoom, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function renderDeathOverlay() {
    if (state.player.alive) return;
    const seconds = Math.max(0, (state.player.respawnAt - performance.now()) / 1000);
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#d6f8ff";
    ctx.font = "700 34px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`Respawning in ${seconds.toFixed(1)}s`, canvas.width / 2, canvas.height / 2);
  }

  function updateHUD() {
    nameValue.textContent = state.player.name;
    killsValue.textContent = state.player.kills;
    spearValue.textContent = getDisplaySpearLength(state.player);

    const boostPct = state.player.boost / CONFIG.boostMax;
    boostFill.style.width = `${Math.round(boostPct * 100)}%`;
    if (boostPct > 0.55) boostFill.style.backgroundColor = "#5cf066";
    else if (boostPct > 0.25) boostFill.style.backgroundColor = "#f2d95f";
    else boostFill.style.backgroundColor = "#ff5968";

    const board = [state.player, ...state.bots]
      .map((e) => ({ name: e.name, kills: e.kills, spear: getDisplaySpearLength(e) }))
      .sort((a, b) => b.kills - a.kills || b.spear - a.spear)
      .slice(0, 6);

    leaderboardList.innerHTML = board
      .map((e) => `<li>${e.name}: ${e.kills} K • ${e.spear} S</li>`)
      .join("");
  }

  function tick(time) {
    if (!state.started) {
      requestAnimationFrame(tick);
      return;
    }

    const dt = Math.min(CONFIG.maxDelta, (time - state.lastTime) / 1000 || 0.016);
    state.lastTime = time;

    updatePlayer(dt);
    updateBots(dt);
    updateOrbs();
    checkCombat();
    updateRespawns();
    updateParticles(dt);
    updateCamera(dt);

    renderGround();
    renderOrbs();
    for (const bot of state.bots) renderEntity(bot);
    renderEntity(state.player);
    renderParticles();
    renderDeathOverlay();
    updateHUD();

    requestAnimationFrame(tick);
  }

  bindInput();
  resizeCanvas();
  document.documentElement.style.setProperty("--ui-accent", state.settings.uiColor);
  requestAnimationFrame((t) => {
    state.lastTime = t;
    tick(t);
  });
})();
