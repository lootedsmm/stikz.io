// Bot AI and update logic.
(function () {
  const U = window.StikzUtils;

  function createBot(id, config) {
    const spawn = U.randomPosition(config.arenaSize, 50);
    return {
      id,
      name: `Bot-${id + 1}`,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      halfSize: config.playerHalfSize,
      speed: config.botSpeed,
      color: `hsl(${(id * 47) % 360}, 75%, 60%)`,
      spearLength: config.spearBaseLength,
      kills: 0,
      alive: true,
      respawnAt: 0,
      wanderAngle: Math.random() * Math.PI * 2,
      decisionTimer: 0,
      targetType: "wander",
      targetId: null,
      aimX: spawn.x,
      aimY: spawn.y,
    };
  }

  function chooseTarget(bot, state, dt) {
    bot.decisionTimer -= dt;
    if (bot.decisionTimer > 0) return;

    bot.decisionTimer = U.randRange(0.4, 0.95);
    const roll = Math.random();

    if (roll < 0.5 && state.orbs.length > 0) {
      const orb = findNearestOrb(bot, state.orbs, 850);
      if (orb) {
        bot.targetType = "orb";
        bot.targetId = orb.id;
        return;
      }
    }

    if (roll < 0.85) {
      const enemy = findNearestEnemy(bot, state);
      if (enemy && enemy.dist < 650) {
        bot.targetType = enemy.type;
        bot.targetId = enemy.id;
        return;
      }
    }

    bot.targetType = "wander";
    bot.targetId = null;
    bot.wanderAngle += U.randRange(-1.25, 1.25);
  }

  function updateBot(bot, state, dt, config) {
    if (!bot.alive) return;

    chooseTarget(bot, state, dt);

    let steerX = 0;
    let steerY = 0;

    if (bot.targetType === "orb") {
      const orb = state.orbs.find((o) => o.id === bot.targetId);
      if (orb) {
        const n = U.normalize(orb.x - bot.x, orb.y - bot.y);
        steerX += n.x * 1.35;
        steerY += n.y * 1.35;
      } else {
        bot.targetType = "wander";
      }
    }

    if (bot.targetType === "player" || bot.targetType === "bot") {
      const target =
        bot.targetType === "player"
          ? state.player.alive
            ? state.player
            : null
          : state.bots.find((b) => b.id === bot.targetId && b.alive);

      if (target) {
        const toTarget = U.normalize(target.x - bot.x, target.y - bot.y);
        steerX += toTarget.x * 1.1;
        steerY += toTarget.y * 1.1;
        bot.aimX = target.x;
        bot.aimY = target.y;
      } else {
        bot.targetType = "wander";
      }
    }

    if (bot.targetType === "wander") {
      bot.wanderAngle += U.randRange(-0.9, 0.9) * dt;
      steerX += Math.cos(bot.wanderAngle);
      steerY += Math.sin(bot.wanderAngle);
    }

    const borderPad = 180;
    if (bot.x < borderPad) steerX += 1.5;
    if (bot.x > config.arenaSize - borderPad) steerX -= 1.5;
    if (bot.y < borderPad) steerY += 1.5;
    if (bot.y > config.arenaSize - borderPad) steerY -= 1.5;

    const steer = U.normalize(steerX, steerY);
    bot.vx += steer.x * config.botAcceleration * dt * 60;
    bot.vy += steer.y * config.botAcceleration * dt * 60;

    const limited = U.limitVector(bot.vx, bot.vy, bot.speed);
    bot.vx = limited.x * config.botFriction;
    bot.vy = limited.y * config.botFriction;

    bot.x = U.clamp(bot.x + bot.vx * dt * 60, bot.halfSize, config.arenaSize - bot.halfSize);
    bot.y = U.clamp(bot.y + bot.vy * dt * 60, bot.halfSize, config.arenaSize - bot.halfSize);

    if (bot.targetType === "wander") {
      bot.aimX = bot.x + Math.cos(bot.wanderAngle) * 200;
      bot.aimY = bot.y + Math.sin(bot.wanderAngle) * 200;
    }
  }

  function findNearestOrb(bot, orbs, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const orb of orbs) {
      const d = U.distance(bot.x, bot.y, orb.x, orb.y);
      if (d < bestDist) {
        bestDist = d;
        best = orb;
      }
    }
    return best;
  }

  function findNearestEnemy(bot, state) {
    let best = null;

    if (state.player.alive) {
      const d = U.distance(bot.x, bot.y, state.player.x, state.player.y);
      best = { type: "player", id: "player", dist: d };
    }

    for (const other of state.bots) {
      if (!other.alive || other.id === bot.id) continue;
      const d = U.distance(bot.x, bot.y, other.x, other.y);
      if (!best || d < best.dist) {
        best = { type: "bot", id: other.id, dist: d };
      }
    }

    return best;
  }

  window.StikzBots = {
    createBot,
    updateBot,
  };
})();
