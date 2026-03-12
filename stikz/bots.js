// Bot AI and update logic.
(function () {
  const U = window.StikzUtils;

  function createBot(id, config) {
    const spawn = U.randomPosition(config.arenaSize, 50);
    const baseAngle = Math.random() * Math.PI * 2;
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
      wanderAngle: baseAngle,
      wanderTime: U.randRange(1.5, 3.3),
      targetType: "wander",
      targetId: null,
      aimAngle: baseAngle,
      desiredAimAngle: baseAngle,
      aimX: spawn.x + Math.cos(baseAngle),
      aimY: spawn.y + Math.sin(baseAngle),
    };
  }

  function updateBot(bot, state, dt, config) {
    if (!bot.alive) return;

    const target = chooseTarget(bot, state, config);
    let moveAngle = bot.wanderAngle;

    if (target) {
      moveAngle = Math.atan2(target.y - bot.y, target.x - bot.x);
      if (target.type === "player" || target.type === "bot") {
        bot.desiredAimAngle = moveAngle;
      } else if (target.type === "orb") {
        bot.desiredAimAngle = moveAngle;
      }
    } else {
      bot.wanderTime -= dt;
      if (bot.wanderTime <= 0) {
        bot.wanderTime = U.randRange(1.8, 3.6);
        bot.wanderAngle += U.randRange(-1.2, 1.2);
      }
      moveAngle = bot.wanderAngle;
      bot.desiredAimAngle = moveAngle;
    }

    const borderPad = 180;
    let steerX = Math.cos(moveAngle);
    let steerY = Math.sin(moveAngle);

    if (bot.x < borderPad) steerX += 1.6;
    if (bot.x > config.arenaSize - borderPad) steerX -= 1.6;
    if (bot.y < borderPad) steerY += 1.6;
    if (bot.y > config.arenaSize - borderPad) steerY -= 1.6;

    const steer = U.normalize(steerX, steerY);
    bot.vx += steer.x * config.botAcceleration * dt * 60;
    bot.vy += steer.y * config.botAcceleration * dt * 60;

    const limited = U.limitVector(bot.vx, bot.vy, bot.speed);
    bot.vx = limited.x * config.botFriction;
    bot.vy = limited.y * config.botFriction;

    bot.x = U.clamp(bot.x + bot.vx * dt * 60, bot.halfSize, config.arenaSize - bot.halfSize);
    bot.y = U.clamp(bot.y + bot.vy * dt * 60, bot.halfSize, config.arenaSize - bot.halfSize);

    bot.aimAngle = U.lerpAngle(bot.aimAngle, bot.desiredAimAngle, 0.08);
    bot.aimX = bot.x + Math.cos(bot.aimAngle) * 240;
    bot.aimY = bot.y + Math.sin(bot.aimAngle) * 240;
  }

  function chooseTarget(bot, state, config) {
    const playerAlive = state.player.alive;
    const nearestEnemy = findNearestEnemy(bot, state);
    const nearestOrb = findNearestOrb(bot, state.orbs, config.botOrbDetectionRadius);

    if (playerAlive && nearestEnemy && nearestEnemy.dist < config.botPlayerDetectionRadius) {
      if (nearestOrb && nearestOrb.dist < nearestEnemy.dist) {
        bot.targetType = "orb";
        bot.targetId = nearestOrb.id;
        return { x: nearestOrb.x, y: nearestOrb.y, type: "orb", id: nearestOrb.id };
      }

      bot.targetType = nearestEnemy.type;
      bot.targetId = nearestEnemy.id;
      return { x: nearestEnemy.x, y: nearestEnemy.y, type: nearestEnemy.type, id: nearestEnemy.id };
    }

    if (nearestOrb) {
      bot.targetType = "orb";
      bot.targetId = nearestOrb.id;
      return { x: nearestOrb.x, y: nearestOrb.y, type: "orb", id: nearestOrb.id };
    }

    bot.targetType = "wander";
    bot.targetId = null;
    return null;
  }

  function findNearestOrb(bot, orbs, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const orb of orbs) {
      const d = U.distance(bot.x, bot.y, orb.x, orb.y);
      if (d < bestDist) {
        bestDist = d;
        best = { ...orb, dist: d };
      }
    }
    return best;
  }

  function findNearestEnemy(bot, state) {
    let best = null;

    if (state.player.alive) {
      const d = U.distance(bot.x, bot.y, state.player.x, state.player.y);
      best = { type: "player", id: "player", x: state.player.x, y: state.player.y, dist: d };
    }

    for (const other of state.bots) {
      if (!other.alive || other.id === bot.id) continue;
      const d = U.distance(bot.x, bot.y, other.x, other.y);
      if (!best || d < best.dist) {
        best = { type: "bot", id: other.id, x: other.x, y: other.y, dist: d };
      }
    }

    return best;
  }

  window.StikzBots = {
    createBot,
    updateBot,
  };
})();
