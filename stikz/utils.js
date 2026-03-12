// Shared utility helpers used by both game.js and bots.js
(function () {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function randRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  function randInt(min, max) {
    return Math.floor(randRange(min, max + 1));
  }

  function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.hypot(dx, dy);
  }

  function normalize(x, y) {
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }

  function limitVector(x, y, max) {
    const mag = Math.hypot(x, y);
    if (mag <= max || mag === 0) return { x, y };
    const scale = max / mag;
    return { x: x * scale, y: y * scale };
  }

  function randomPosition(arenaSize, margin = 0) {
    return {
      x: randRange(margin, arenaSize - margin),
      y: randRange(margin, arenaSize - margin),
    };
  }

  window.StikzUtils = {
    clamp,
    lerp,
    randRange,
    randInt,
    distance,
    normalize,
    limitVector,
    randomPosition,
  };
})();
