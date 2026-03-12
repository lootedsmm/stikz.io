(function () {
  const U = window.StikzUtils;

  const BOT_NAMES = [
    "Stick Norris",
    "SharpBot",
    "Point Break",
    "Stabby McStab",
    "NeedleLord",
    "PokeMaster",
    "Skewer Stewart",
    "Prick Fury",
    "Lance-a-lot",
    "Jabba",
    "Spindle",
    "Pokeahontas",
  ];

  const DIFFICULTIES = [
    { key: "easy", color: "#55e56f", reactionMin: 0.12, reactionMax: 0.2, commitMin: 0.45, commitMax: 0.75, speedMul: 0.9, wanderBias: 0.48 },
    { key: "medium", color: "#f6dd53", reactionMin: 0.09, reactionMax: 0.15, commitMin: 0.35, commitMax: 0.6, speedMul: 1, wanderBias: 0.28 },
    { key: "hard", color: "#ff5959", reactionMin: 0.08, reactionMax: 0.12, commitMin: 0.3, commitMax: 0.52, speedMul: 1.08, wanderBias: 0.12 },
  ];

  function createBot(id, config) {
    const spawn = U.randomPosition(config.arenaSize, 60);
    const diff = DIFFICULTIES[id % DIFFICULTIES.length];
    const angle = Math.random() * Math.PI * 2;
    return {
      id,
      name: `${BOT_NAMES[id % BOT_NAMES.length]} [BOT]`,
      botTagColor: diff.color,
      difficulty: diff,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      halfSize: config.playerHalfSize,
      speed: config.botSpeed * diff.speedMul,
      color: "#9ca6a8",
      spearLength: config.spearBaseLength,
      score: 0,
      kills: 0,
      alive: true,
      respawnAt: 0,
      lives: config.mode.battleRoyaleLives,
      spawnProtectedUntil: 0,
      aimAngle: angle,
      targetAimAngle: angle,
      currentMoveAngle: angle,
      desiredMoveAngle: angle,
      boost: config.boostMax,
      boosting: false,
      targetType: "wander",
      targetId: null,
      reactionTimer: U.randRange(diff.reactionMin, diff.reactionMax),
      moveCommitTimer: U.randRange(diff.commitMin, diff.commitMax),
      wanderAngle: angle,
    };
  }

  function updateBot(bot, state, dt, config) {
    if (!bot.alive) return;

    bot.reactionTimer -= dt;
    bot.moveCommitTimer -= dt;

    if (bot.reactionTimer <= 0) {
      bot.reactionTimer = U.randRange(bot.difficulty.reactionMin, bot.difficulty.reactionMax);
      selectTarget(bot, state, config);
    }

    if (bot.moveCommitTimer <= 0) {
      bot.moveCommitTimer = U.randRange(bot.difficulty.commitMin, bot.difficulty.commitMax);
      bot.currentMoveAngle = bot.desiredMoveAngle;
      bot.currentMoveAngle += U.randRange(-0.2, 0.2);
    }

    const target = resolveTarget(bot, state);
    if (target) {
      const a = Math.atan2(target.y - bot.y, target.x - bot.x);
      bot.desiredMoveAngle = a;
      bot.targetAimAngle = a + U.randRange(-0.05, 0.05);
      bot.boosting = target.type !== "orb" && bot.boost > 10 && Math.random() < 0.05;
    } else {
      bot.targetType = "wander";
      bot.wanderAngle += U.randRange(-0.75, 0.75) * dt * 60;
      bot.desiredMoveAngle = bot.wanderAngle;
      bot.targetAimAngle = bot.wanderAngle;
      bot.boosting = false;
    }

    const turnRate = bot.boosting ? config.turnRateBoosting : config.turnRateNormal;
    bot.aimAngle = U.rotateToward(bot.aimAngle, bot.targetAimAngle, turnRate * dt);

    const moveDir = U.normalize(Math.cos(bot.currentMoveAngle), Math.sin(bot.currentMoveAngle));
    const speedCap = bot.boosting ? bot.speed * 1.35 : bot.speed;
    if (bot.boosting) bot.boost = Math.max(0, bot.boost - config.boostDrainPerSecond * dt * 0.75);

    const borderPad = 170;
    let steerX = moveDir.x;
    let steerY = moveDir.y;
    if (bot.x < borderPad) steerX += 1.3;
    if (bot.x > config.arenaSize - borderPad) steerX -= 1.3;
    if (bot.y < borderPad) steerY += 1.3;
    if (bot.y > config.arenaSize - borderPad) steerY -= 1.3;

    const steer = U.normalize(steerX, steerY);
    bot.vx += steer.x * config.botAcceleration * dt * 60;
    bot.vy += steer.y * config.botAcceleration * dt * 60;
    const limited = U.limitVector(bot.vx, bot.vy, speedCap);
    bot.vx = limited.x * config.botFriction;
    bot.vy = limited.y * config.botFriction;
    bot.x = U.clamp(bot.x + bot.vx * dt * 60, bot.halfSize, config.arenaSize - bot.halfSize);
    bot.y = U.clamp(bot.y + bot.vy * dt * 60, bot.halfSize, config.arenaSize - bot.halfSize);

    bot.aimX = bot.x + Math.cos(bot.aimAngle) * 250;
    bot.aimY = bot.y + Math.sin(bot.aimAngle) * 250;
  }

  function selectTarget(bot, state, config) {
    const nearestEnemy = findNearestEnemy(bot, state);
    const nearestOrb = findNearestOrb(bot, state.orbs, config.botOrbDetectionRadius);

    if (nearestEnemy && nearestEnemy.dist < config.botPlayerDetectionRadius && Math.random() > bot.difficulty.wanderBias) {
      bot.targetType = nearestEnemy.type;
      bot.targetId = nearestEnemy.id;
      return;
    }

    if (nearestOrb) {
      bot.targetType = "orb";
      bot.targetId = nearestOrb.id;
      return;
    }

    bot.targetType = "wander";
    bot.targetId = null;
  }

  function resolveTarget(bot, state) {
    if (bot.targetType === "orb") {
      const orb = state.orbs.find((o) => o.id === bot.targetId);
      if (orb) return { x: orb.x, y: orb.y, type: "orb" };
    }

    if (bot.targetType === "player" && state.player.alive) {
      return { x: state.player.x, y: state.player.y, type: "player" };
    }

    if (bot.targetType === "bot") {
      const enemy = state.bots.find((b) => b.id === bot.targetId && b.alive);
      if (enemy) return { x: enemy.x, y: enemy.y, type: "bot" };
    }

    return null;
  }

  function findNearestOrb(bot, orbs, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const orb of orbs) {
      const d = U.distance(bot.x, bot.y, orb.x, orb.y);
      if (d < bestDist) {
        bestDist = d;
        best = { id: orb.id, dist: d };
      }
    }
    return best;
  }

  function findNearestEnemy(bot, state) {
    let best = null;

    if (state.player.alive && state.player !== bot) {
      const d = U.distance(bot.x, bot.y, state.player.x, state.player.y);
      best = { type: "player", id: "player", x: state.player.x, y: state.player.y, dist: d };
    }

    for (const other of state.bots) {
      if (!other.alive || other.id === bot.id) continue;
      const d = U.distance(bot.x, bot.y, other.x, other.y);
      if (!best || d < best.dist) best = { type: "bot", id: other.id, dist: d };
    }

    return best;
  }

  window.StikzBots = { createBot, updateBot };
})();
