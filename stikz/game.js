const CONFIG = {
  arenaSize: 4000,
  playerSpeed: 4,
  botSpeed: 3,
  playerRadius: 20,
  orbCount: 200,
  orbValue: 1,
  spearBaseLength: 60,
  spearGrowthFactor: 3,
  spearMaxLength: 250,
  botCount: 15,
  respawnTime: 3000,
  orbRadius: 6,
  maxDelta: 0.033,
  playerAcceleration: 0.42,
  botAcceleration: 0.3,
  playerFriction: 0.88,
  botFriction: 0.92,
  killScore: 8,
  deathDropOrbs: 8,
  gridSize: 80,
};

(() => {
  const U = window.StikzUtils;
  const B = window.StikzBots;

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const scoreValue = document.getElementById("scoreValue");
  const killsValue = document.getElementById("killsValue");
  const spearValue = document.getElementById("spearValue");
  const leaderboardList = document.getElementById("leaderboardList");

  const state = {
    keys: { w: false, a: false, s: false, d: false },
    mouse: { x: 0, y: 0 },
    camera: { x: 0, y: 0 },
    lastTime: 0,
    orbIdCounter: 1,
    particles: [],
    orbs: [],
    bots: [],
    player: createEntity("You", "#64f7ff"),
  };

  function createEntity(name, color) {
    const spawn = U.randomPosition(CONFIG.arenaSize, 60);
    return {
      name,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      radius: CONFIG.playerRadius,
      score: 0,
      kills: 0,
      alive: true,
      respawnAt: 0,
      aimX: spawn.x + 1,
      aimY: spawn.y,
      color,
    };
  }

  function getSpearLength(entity) {
    return U.clamp(
      CONFIG.spearBaseLength + entity.score * CONFIG.spearGrowthFactor,
      CONFIG.spearBaseLength,
      CONFIG.spearMaxLength
    );
  }

  function spawnOrb(x = null, y = null) {
    const pos = x == null || y == null ? U.randomPosition(CONFIG.arenaSize, 20) : { x, y };
    state.orbs.push({ id: state.orbIdCounter++, x: pos.x, y: pos.y, r: CONFIG.orbRadius });
  }

  function killEntity(victim, killer) {
    victim.alive = false;
    victim.respawnAt = performance.now() + CONFIG.respawnTime;
    victim.vx = 0;
    victim.vy = 0;

    if (killer) {
      killer.kills += 1;
      killer.score += CONFIG.killScore;
    }

    // Death drops create short-term hotspots and keep the arena populated.
    for (let i = 0; i < CONFIG.deathDropOrbs; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = U.randRange(10, 50);
      const ox = U.clamp(victim.x + Math.cos(angle) * dist, 20, CONFIG.arenaSize - 20);
      const oy = U.clamp(victim.y + Math.sin(angle) * dist, 20, CONFIG.arenaSize - 20);
      spawnOrb(ox, oy);
    }

    spawnDeathParticles(victim.x, victim.y, victim.color);
  }

  function respawnEntity(entity) {
    const spawn = U.randomPosition(CONFIG.arenaSize, 80);
    entity.x = spawn.x;
    entity.y = spawn.y;
    entity.score = 0;
    entity.vx = 0;
    entity.vy = 0;
    entity.alive = true;
    entity.aimX = spawn.x + 1;
    entity.aimY = spawn.y;
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

  function setupWorld() {
    for (let i = 0; i < CONFIG.orbCount; i++) spawnOrb();
    for (let i = 0; i < CONFIG.botCount; i++) state.bots.push(B.createBot(i, CONFIG));
    resizeCanvas();
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function bindInput() {
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (k in state.keys) state.keys[k] = true;
    });

    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      if (k in state.keys) state.keys[k] = false;
    });

    canvas.addEventListener("mousemove", (e) => {
      state.mouse.x = e.clientX;
      state.mouse.y = e.clientY;
    });

    window.addEventListener("resize", resizeCanvas);
  }

  function updatePlayer(dt) {
    const p = state.player;
    if (!p.alive) return;

    const inputX = (state.keys.d ? 1 : 0) - (state.keys.a ? 1 : 0);
    const inputY = (state.keys.s ? 1 : 0) - (state.keys.w ? 1 : 0);
    const dir = U.normalize(inputX, inputY);

    p.vx += dir.x * CONFIG.playerAcceleration;
    p.vy += dir.y * CONFIG.playerAcceleration;

    const limited = U.limitVector(p.vx, p.vy, CONFIG.playerSpeed);
    p.vx = limited.x * CONFIG.playerFriction;
    p.vy = limited.y * CONFIG.playerFriction;

    p.x = U.clamp(p.x + p.vx * dt * 60, p.radius, CONFIG.arenaSize - p.radius);
    p.y = U.clamp(p.y + p.vy * dt * 60, p.radius, CONFIG.arenaSize - p.radius);

    // Convert cursor from screen space to world space for spear aiming.
    p.aimX = state.mouse.x + state.camera.x - canvas.width / 2;
    p.aimY = state.mouse.y + state.camera.y - canvas.height / 2;
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

    for (let i = state.orbs.length - 1; i >= 0; i--) {
      const orb = state.orbs[i];
      let collectedBy = null;

      for (const e of entities) {
        if (!e.alive) continue;
        if (U.distance(orb.x, orb.y, e.x, e.y) < e.radius + orb.r + 2) {
          collectedBy = e;
          break;
        }
      }

      if (collectedBy) {
        collectedBy.score += CONFIG.orbValue;
        state.orbs.splice(i, 1);
        spawnOrb();
      }
    }
  }

  function getSpearTip(entity) {
    // Spear math: start at player center and extend a fixed length in aim direction.
    const dir = U.normalize(entity.aimX - entity.x, entity.aimY - entity.y);
    const len = entity.id !== undefined ? B.getBotSpearLength(entity, CONFIG) : getSpearLength(entity);
    return {
      x: entity.x + dir.x * len,
      y: entity.y + dir.y * len,
      dir,
      len,
    };
  }

  function checkCombat() {
    const attackers = [state.player, ...state.bots].filter((e) => e.alive);

    // Collision detection: if spear tip enters target circle, target dies.
    for (const attacker of attackers) {
      const tip = getSpearTip(attacker);

      if (state.player.alive && attacker !== state.player) {
        if (U.distance(tip.x, tip.y, state.player.x, state.player.y) < state.player.radius) {
          killEntity(state.player, attacker);
          continue;
        }
      }

      for (const bot of state.bots) {
        if (!bot.alive || bot === attacker) continue;
        if (U.distance(tip.x, tip.y, bot.x, bot.y) < bot.radius) {
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
    // Camera follows player smoothly. When dead, it stays on last known location.
    const targetX = state.player.x;
    const targetY = state.player.y;
    state.camera.x = U.lerp(state.camera.x, targetX, Math.min(1, dt * 8));
    state.camera.y = U.lerp(state.camera.y, targetY, Math.min(1, dt * 8));
  }

  function worldToScreen(x, y) {
    return {
      x: x - state.camera.x + canvas.width / 2,
      y: y - state.camera.y + canvas.height / 2,
    };
  }

  function renderGrid() {
    ctx.fillStyle = "#070b14";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const grid = CONFIG.gridSize;
    const offsetX = -((state.camera.x - canvas.width / 2) % grid);
    const offsetY = -((state.camera.y - canvas.height / 2) % grid);

    ctx.strokeStyle = "rgba(120, 180, 255, 0.09)";
    ctx.lineWidth = 1;

    for (let x = offsetX; x < canvas.width; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = offsetY; y < canvas.height; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  function renderOrbs() {
    for (const orb of state.orbs) {
      const s = worldToScreen(orb.x, orb.y);
      ctx.beginPath();
      ctx.arc(s.x, s.y, orb.r, 0, Math.PI * 2);
      ctx.fillStyle = "#91f6ff";
      ctx.shadowColor = "#6ce8ff";
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function renderEntity(entity) {
    if (!entity.alive) return;
    const s = worldToScreen(entity.x, entity.y);

    ctx.beginPath();
    ctx.arc(s.x, s.y, entity.radius, 0, Math.PI * 2);
    ctx.fillStyle = entity.color;
    ctx.shadowColor = entity.color;
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;

    const tip = getSpearTip(entity);
    const tipS = worldToScreen(tip.x, tip.y);

    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(tipS.x, tipS.y);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#e2fdff";
    ctx.shadowColor = "#d3fbff";
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(tipS.x, tipS.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }

  function renderParticles() {
    for (const p of state.particles) {
      const s = worldToScreen(p.x, p.y);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.beginPath();
      ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2);
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
    scoreValue.textContent = state.player.score;
    killsValue.textContent = state.player.kills;
    spearValue.textContent = Math.floor(getSpearLength(state.player));

    const board = [state.player, ...state.bots]
      .map((e) => ({ name: e.name, score: e.score, kills: e.kills }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    leaderboardList.innerHTML = board
      .map((e) => `<li>${e.name}: ${e.score} (${e.kills} K)</li>`)
      .join("");
  }

  function tick(time) {
    const dt = Math.min(CONFIG.maxDelta, (time - state.lastTime) / 1000 || 0.016);
    state.lastTime = time;

    updatePlayer(dt);
    updateBots(dt);
    updateOrbs();
    checkCombat();
    updateRespawns();
    updateParticles(dt);
    updateCamera(dt);

    renderGrid();
    renderOrbs();
    for (const bot of state.bots) renderEntity(bot);
    renderEntity(state.player);
    renderParticles();
    renderDeathOverlay();
    updateHUD();

    requestAnimationFrame(tick);
  }

  bindInput();
  setupWorld();
  requestAnimationFrame((t) => {
    state.lastTime = t;
    tick(t);
  });
})();
