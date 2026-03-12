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

  function lerpAngle(a, b, t) {
    return a + angleDelta(a, b) * t;
  }


  function angleDelta(a, b) {
    let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  function rotateToward(current, target, maxStep) {
    const diff = angleDelta(current, target);
    if (Math.abs(diff) <= maxStep) return target;
    return current + Math.sign(diff) * maxStep;
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

  function pointInRect(px, py, rect) {
    return px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom;
  }

  function lineIntersectsRect(x1, y1, x2, y2, rect) {
    // Liang-Barsky line clipping algorithm.
    const dx = x2 - x1;
    const dy = y2 - y1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - rect.left, rect.right - x1, y1 - rect.top, rect.bottom - y1];

    let t0 = 0;
    let t1 = 1;

    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return false;
        continue;
      }

      const t = q[i] / p[i];
      if (p[i] < 0) {
        t0 = Math.max(t0, t);
      } else {
        t1 = Math.min(t1, t);
      }

      if (t0 > t1) return false;
    }

    return true;
  }

  window.StikzUtils = {
    clamp,
    lerp,
    lerpAngle,
    angleDelta,
    rotateToward,
    randRange,
    randInt,
    distance,
    normalize,
    limitVector,
    randomPosition,
    pointInRect,
    lineIntersectsRect,
  };
})();
