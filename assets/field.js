/* =========================================================================
   Intelligent Worlds — the field.

   A space rebuilt out of points, drawn on a 2D canvas with no library and no
   assets. It is atmosphere, not evidence: nothing here is measured, nothing
   is claimed, and the only numbers the page prints are the position of this
   drawing's own camera.

   The scene is bounded and the lens orbits it from above, which is how a
   reconstruction is actually read — the whole volume at once, rather than a
   corridor seen from inside it. Everything static lives in one flat array
   built once; the handful of things that move carry their own small array
   and are drawn after, with a box around them.

   One pass per frame does the rotation, the projection and the draw. The
   warm points are held back and drawn last so they sit on top of the white.
   ========================================================================= */

(function () {
  'use strict';

  var canvas = document.getElementById('field');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- the space ---------- */

  var EXT = 13;             // half-extent of the floor, metres
  var STRIDE = 5;           // x, y, z, brightness, kind (0 white, 1 warm, 2 shining)
  var FOG_NEAR = 9;
  var FOG_FAR = 44;

  var pts = null;           // the static scene
  var count = 0;
  var figs = [];            // the few things that move, and their boxes

  /* Deterministic, so every visitor sees the same room and the picture in a
     link preview is the picture on the page. */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function build(budget) {
    var r = rng(20260918);
    var a = new Float32Array(budget * STRIDE);
    var n = 0;

    function put(x, y, z, b, w) {
      if (n >= budget) return;
      var i = n * STRIDE;
      a[i] = x; a[i + 1] = y; a[i + 2] = z; a[i + 3] = b; a[i + 4] = w;
      n++;
    }

    /* The floor. Thinner toward the edges, the way a sweep from the middle of
       a room returns less of the far corners. */
    var nFloor = Math.round(budget * 0.26);
    for (var g = 0; g < nFloor; g++) {
      var fx = (r() * 2 - 1) * EXT, fz = (r() * 2 - 1) * EXT;
      var d = Math.sqrt(fx * fx + fz * fz) / (EXT * 1.42);
      if (r() < d * 0.55) continue;
      put(fx, (r() - 0.5) * 0.05, fz, 0.34 + (1 - d) * 0.34 + r() * 0.20,
          r() < 0.035 ? 1 : (r() < 0.003 ? 2 : 0));
    }

    /* A metre grid across the floor. Nothing measures it and it means
       nothing, but a ruled plane is what makes the eye read the picture as a
       space being surveyed rather than as a field of dust. */
    var nGrid = Math.round(budget * 0.17);
    for (var q = 0; q < nGrid; q++) {
      var along = (r() * 2 - 1) * EXT;
      var line = (Math.floor(r() * 13) - 6) * 2;
      var gx, gz;
      if (r() < 0.5) { gx = line + (r() - 0.5) * 0.035; gz = along; }
      else           { gx = along; gz = line + (r() - 0.5) * 0.035; }
      var gd = Math.sqrt(gx * gx + gz * gz) / (EXT * 1.42);
      if (gd > 1) continue;
      put(gx, 0.012 + r() * 0.015, gz, 0.58 + (1 - gd) * 0.28 + r() * 0.14, r() < 0.05 ? 1 : 0);
    }

    /* Two walls meeting in a corner, punched through by a grid of windows the
       scan mostly passes straight into. The few it does not are the lit ones,
       and they are the only real highlights in the picture. */
    var nWall = Math.round(budget * 0.20);
    for (var w = 0; w < nWall; w++) {
      var side = r() < 0.5;
      var along2 = (r() * 2 - 1) * EXT;
      var wy = Math.pow(r(), 1.15) * 7.6;
      var wx = side ? -EXT + (r() - 0.5) * 0.3 : along2;
      var wz = side ? along2 : -EXT + (r() - 0.5) * 0.3;

      var fy = wy % 2.8, fa = (along2 + 40) % 3.6;
      var inWindow = fy > 0.9 && fy < 2.2 && fa > 0.9 && fa < 2.7;
      if (inWindow && r() < 0.86) continue;
      var lit = inWindow && r() < 0.36;

      put(wx, wy, wz,
          lit ? 0.80 + r() * 0.20 : 0.28 + r() * 0.42 * (1 - wy / 16),
          lit ? (r() < 0.30 ? 2 : 1) : (r() < 0.03 ? 1 : (r() < 0.004 ? 2 : 0)));
    }

    /* Columns, and the volumes between them: the stacks and vehicles that
       make the space read as a place rather than an empty plane. */
    var nCol = Math.round(budget * 0.07);
    var cols = [];
    for (var c = 0; c < 6; c++) cols.push([(r() * 2 - 1) * EXT * 0.72, (r() * 2 - 1) * EXT * 0.72]);
    for (var ci = 0; ci < nCol; ci++) {
      var cc = cols[(r() * cols.length) | 0];
      var ang = r() * 6.28318, rad = 0.26 + r() * 0.05;
      put(cc[0] + Math.cos(ang) * rad, r() * 6.2, cc[1] + Math.sin(ang) * rad,
          0.34 + r() * 0.32, r() < 0.04 ? 1 : (r() < 0.006 ? 2 : 0));
    }

    var nBlock = Math.round(budget * 0.18);
    var blocks = [];
    for (var bI = 0; bI < 11; bI++) {
      blocks.push({
        x: (r() * 2 - 1) * EXT * 0.78, z: (r() * 2 - 1) * EXT * 0.78,
        w: 0.6 + r() * 1.5, h: 0.5 + r() * 1.6, d: 0.7 + r() * 1.9,
        b: 0.42 + r() * 0.34
      });
    }
    for (var made = 0; made < nBlock; made++) {
      var bx = blocks[(r() * blocks.length) | 0];
      var u = r() * 2 - 1, v = r() * 2 - 1;
      var face = (r() * 5) | 0;   // never the underside
      var px, py, pz;
      if (face === 0)      { px = u * bx.w; py = bx.h;       pz = v * bx.d; }
      else if (face === 1) { px = bx.w;     py = r() * bx.h; pz = v * bx.d; }
      else if (face === 2) { px = -bx.w;    py = r() * bx.h; pz = v * bx.d; }
      else if (face === 3) { px = u * bx.w; py = r() * bx.h; pz = bx.d; }
      else                 { px = u * bx.w; py = r() * bx.h; pz = -bx.d; }
      put(bx.x + px, py, bx.z + pz, bx.b + r() * 0.22,
          r() < 0.04 ? 1 : (r() < 0.006 ? 2 : 0));
    }

    var nDust = Math.min(budget - n, Math.round(budget * 0.04));
    for (var dd = 0; dd < nDust; dd++) {
      put((r() * 2 - 1) * EXT, r() * 7, (r() * 2 - 1) * EXT, 0.09 + r() * 0.14, r() < 0.07 ? 1 : 0);
    }

    count = n;
    return a;
  }

  /* The things that move. Each is a small cloud roughly the size and shape of
     a person, walking its own slow ellipse, with a box drawn around it — the
     one gesture on this page that hints at what the company actually does,
     and it hints at it without saying anything. */
  function buildFigures() {
    var r = rng(4417);
    var out = [];
    for (var i = 0; i < 5; i++) {
      var m = 70;
      var local = new Float32Array(m * 4);   // x, y, z, brightness
      for (var k = 0; k < m; k++) {
        var h = r();
        var wide = h > 0.78 ? 0.16 : (h > 0.34 ? 0.20 : 0.13);
        var ang = r() * 6.28318;
        local[k * 4]     = Math.cos(ang) * wide * (0.4 + r() * 0.6);
        local[k * 4 + 1] = 0.05 + h * 1.72;
        local[k * 4 + 2] = Math.sin(ang) * wide * 0.6 * (0.4 + r() * 0.6);
        local[k * 4 + 3] = 0.5 + r() * 0.5;
      }
      out.push({
        p: local, n: m,
        rx: 3 + r() * 7, rz: 3 + r() * 7,
        speed: (r() < 0.5 ? -1 : 1) * (0.05 + r() * 0.07),
        phase: r() * 6.28318,
        drift: r() * 6.28318
      });
    }
    return out;
  }

  /* ---------- the lens ---------- */

  var W = 0, H = 0, dpr = 1, focal = 0, ppx = 0, ppy = 0;
  var ORBIT_R = 20.5, ORBIT_H = 10.4, LOOK_Y = 1.5;   // radius is set per shape in resize()
  var camX = 0, camY = ORBIT_H, camZ = 0;
  var pointerX = 0, pointerY = 0, driftX = 0, driftY = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = canvas.clientWidth || window.innerWidth;
    var ch = canvas.clientHeight || window.innerHeight;
    W = Math.max(1, Math.round(cw * dpr));
    H = Math.max(1, Math.round(ch * dpr));
    canvas.width = W;
    canvas.height = H;
    focal = (H * 0.5) / Math.tan((50 * Math.PI / 180) / 2);

    /* The lockup sits dead centre, so the room is lifted above it: the mass
       of the cloud lands in the upper third and the words sit in the quiet
       the veil opens underneath it. */
    var wide = cw > ch * 1.1;
    ppx = W * 0.5;
    ppy = H * (wide ? 0.405 : 0.36);

    /* A tall frame sees less of the room across, so the lens steps back until
       the whole volume fits rather than cropping it to a column. */
    ORBIT_R = wide ? 20.5 : 25.5;
    ORBIT_H = wide ? 10.4 : 12.2;

    /* Points are budgeted by area, so a phone does the same work per pixel as
       a display and neither drops a frame for it — with a floor, because a
       thin scatter reads as a star field rather than as a room. */
    var budget = Math.round(Math.max(11000, Math.min(26000, cw * ch * 0.021)));
    if (!pts || Math.abs(budget - count) > 900) {
      pts = build(budget);
      figs = buildFigures();
    }
  }

  /* ---------- the frame ---------- */

  var BG = '#0d0d0f';
  var wX = [], wY = [], wS = [], wA = [];              // warm points
  var sX = [], sY = [], sS = [], sA = [], sP = [];     // the shining few, drawn last
  var started = 0, last = 0, raf = 0;

  function draw(now) {
    if (!started) started = now;
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    var t = (now - started) / 1000;

    driftX += (pointerX - driftX) * Math.min(1, dt * 1.6);
    driftY += (pointerY - driftY) * Math.min(1, dt * 1.6);

    /* One slow revolution every three minutes, plus whatever the pointer
       asks for. Nothing about it is meant to be noticed frame to frame. */
    var theta = (reduced ? 0.7 : t * 0.0345) + driftX * 0.22;
    var height = ORBIT_H + driftY * 2.2 + (reduced ? 0 : Math.sin(t * 0.07) * 0.7);

    camX = Math.sin(theta) * ORBIT_R;
    camZ = Math.cos(theta) * ORBIT_R;
    camY = height;

    var yaw = theta;
    var pitch = Math.atan2(camY - LOOK_Y, ORBIT_R);   // positive looks down
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var cp = Math.cos(pitch), sp = Math.sin(pitch);

    /* The pulse: a ring opening across the floor, brightening whatever it
       passes through, then starting again. */
    var ring = (t * 2.9) % 26;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    var hw = ppx, hh = ppy;
    var warm = 0, shine = 0;
    var minS = dpr * 0.85, maxS = dpr * 2.7;
    var fogSpan = FOG_FAR - FOG_NEAR;

    ctx.fillStyle = '#e9ecf2';

    for (var i = 0; i < count; i++) {
      var o = i * STRIDE;
      var dx = pts[o] - camX;
      var dy = pts[o + 1] - camY;
      var dz = pts[o + 2] - camZ;

      /* yaw about Y, then pitch about X; the lens looks down -Z */
      var rx = dx * cy - dz * sy;
      var rz = dx * sy + dz * cy;
      var ry = dy * cp - rz * sp;
      var depth = -(dy * sp + rz * cp);
      if (depth < 2 || depth > FOG_FAR) continue;

      var inv = focal / depth;
      var sx = hw + rx * inv;
      if (sx < -4 || sx > W + 4) continue;
      var syy = hh - ry * inv;
      if (syy < -4 || syy > H + 4) continue;

      var f = (FOG_FAR - depth) / fogSpan;
      if (f > 1) f = 1;
      var a = pts[o + 3] * f * 1.5;

      /* the ring, on the floor only */
      if (pts[o + 1] < 0.9) {
        var rr = Math.sqrt(pts[o] * pts[o] + pts[o + 2] * pts[o + 2]) - ring;
        if (rr > -1.7 && rr < 1.7) a += (1 - Math.abs(rr) / 1.7) * 0.55 * pts[o + 3];
      }

      var kind = pts[o + 4];
      var pulse = 0;

      /* The shine. Each of these sits quiet most of the time and then flares,
         on a clock derived from its own index — the golden angle spreads the
         phases so no two ever peak together, and it costs nothing to store. */
      if (kind > 1.5) {
        pulse = Math.sin(t * (0.5 + (i % 9) * 0.075) + i * 2.3999632) * 0.5 + 0.5;
        pulse *= pulse * pulse;
        a *= 0.40 + pulse * 1.7;
      }

      if (a < 0.014) continue;
      if (a > 1) a = 1;

      var s = inv * 0.030;
      if (s < minS) s = minS; else if (s > maxS) s = maxS;

      if (kind > 1.5) {
        sX[shine] = sx; sY[shine] = syy; sS[shine] = s; sA[shine] = a; sP[shine] = pulse; shine++;
        continue;
      }
      if (kind > 0.5) {
        wX[warm] = sx; wY[warm] = syy; wS[warm] = s; wA[warm] = a; warm++;
        continue;
      }
      ctx.globalAlpha = a;
      ctx.fillRect(sx, syy, s, s);
    }

    ctx.fillStyle = '#f2bd69';
    for (var k = 0; k < warm; k++) {
      ctx.globalAlpha = wA[k];
      ctx.fillRect(wX[k], wY[k], wS[k] * 1.2, wS[k] * 1.2);
    }

    /* ---- the shining few ----
       A halo, two spikes and a hot core. Drawn over the rest of the cloud,
       and only for the ones that are actually flaring: a star at rest is a
       point like any other. */
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, dpr * 0.55);
    for (var si = 0; si < shine; si++) {
      var x = sX[si], y = sY[si], ss = sS[si], sa = sA[si], pu = sP[si];
      var reach = ss * (1.8 + pu * 6.5);

      if (pu > 0.10) {
        var gr = ctx.createRadialGradient(x, y, 0, x, y, reach * 1.35);
        gr.addColorStop(0, 'rgba(255, 246, 228, ' + (sa * 0.50 * pu).toFixed(3) + ')');
        gr.addColorStop(0.36, 'rgba(255, 238, 206, ' + (sa * 0.16 * pu).toFixed(3) + ')');
        gr.addColorStop(1, 'rgba(255, 238, 206, 0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = gr;
        ctx.fillRect(x - reach * 1.35, y - reach * 1.35, reach * 2.7, reach * 2.7);

        ctx.globalAlpha = sa * 0.55 * pu;
        ctx.strokeStyle = '#fff6e4';
        ctx.beginPath();
        ctx.moveTo(x - reach, y); ctx.lineTo(x + reach, y);
        ctx.moveTo(x, y - reach); ctx.lineTo(x, y + reach);
        ctx.stroke();
      }

      ctx.globalAlpha = sa;
      ctx.fillStyle = '#ffffff';
      var cs = ss * (1 + pu * 0.7);
      ctx.fillRect(x - cs * 0.2, y - cs * 0.2, cs * 1.4, cs * 1.4);
    }

    /* ---- the tracked few ---- */
    ctx.lineWidth = Math.max(1, dpr * 0.8);
    for (var fI = 0; fI < figs.length; fI++) {
      drawFigure(figs[fI], t, cy, sy, cp, sp, hw, hh, minS, maxS, fogSpan);
    }

    ctx.globalAlpha = 1;

    if (!reduced) raf = requestAnimationFrame(draw);
  }

  var EDGES = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  var CORNERS = [[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1],[-1,1,-1],[1,1,-1],[1,1,1],[-1,1,1]];
  var bpx = [], bpy = [];

  function drawFigure(fg, t, cy, sy, cp, sp, hw, hh, minS, maxS, fogSpan) {
    var ang = t * fg.speed + fg.phase;
    var ox = Math.cos(ang) * fg.rx;
    var oz = Math.sin(ang) * fg.rz;

    /* the body */
    ctx.fillStyle = '#eef1f6';
    for (var k = 0; k < fg.n; k++) {
      var j = k * 4;
      var dx = ox + fg.p[j] - camX;
      var dy = fg.p[j + 1] - camY;
      var dz = oz + fg.p[j + 2] - camZ;

      var rx = dx * cy - dz * sy;
      var rz = dx * sy + dz * cy;
      var ry = dy * cp - rz * sp;
      var depth = -(dy * sp + rz * cp);
      if (depth < 2 || depth > FOG_FAR) continue;

      var inv = focal / depth;
      var sx = hw + rx * inv, syy = hh - ry * inv;
      if (sx < -4 || sx > W + 4 || syy < -4 || syy > H + 4) continue;

      var f = (FOG_FAR - depth) / fogSpan;
      if (f > 1) f = 1;
      var a = fg.p[j + 3] * f * 1.5;
      if (a < 0.02) continue;
      if (a > 1) a = 1;

      var s = inv * 0.030;
      if (s < minS) s = minS; else if (s > maxS) s = maxS;
      ctx.globalAlpha = a;
      ctx.fillRect(sx, syy, s, s);
    }

    /* the box around it */
    var ok = true, minDepth = 1e9;
    for (var c = 0; c < 8; c++) {
      var cX = ox + CORNERS[c][0] * 0.34 - camX;
      var cY = CORNERS[c][1] * 1.84 - camY;
      var cZ = oz + CORNERS[c][2] * 0.30 - camZ;

      var rx2 = cX * cy - cZ * sy;
      var rz2 = cX * sy + cZ * cy;
      var ry2 = cY * cp - rz2 * sp;
      var depth2 = -(cY * sp + rz2 * cp);
      if (depth2 < 2.5 || depth2 > FOG_FAR) { ok = false; break; }
      if (depth2 < minDepth) minDepth = depth2;
      var inv2 = focal / depth2;
      bpx[c] = hw + rx2 * inv2;
      bpy[c] = hh - ry2 * inv2;
    }
    if (!ok) return;

    var ff = (FOG_FAR - minDepth) / fogSpan;
    ctx.globalAlpha = Math.min(0.42, ff * 0.5);
    ctx.strokeStyle = '#eca746';
    ctx.beginPath();
    for (var e = 0; e < 12; e++) {
      ctx.moveTo(bpx[EDGES[e][0]], bpy[EDGES[e][0]]);
      ctx.lineTo(bpx[EDGES[e][1]], bpy[EDGES[e][1]]);
    }
    ctx.stroke();
  }

  /* ---------- wiring ---------- */

  function onPointer(e) {
    var t = e.touches ? e.touches[0] : e;
    if (!t) return;
    pointerX = (t.clientX / window.innerWidth) * 2 - 1;
    pointerY = (t.clientY / window.innerHeight) * 2 - 1;
  }

  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointerleave', function () { pointerX = 0; pointerY = 0; }, { passive: true });

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resize();
      if (reduced) draw(performance.now());
    }, 140);
  }, { passive: true });

  /* A tab nobody is looking at gets no frames. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf && !reduced) { last = 0; raf = requestAnimationFrame(draw); }
  });

  resize();
  if (reduced) draw(performance.now());
  else raf = requestAnimationFrame(draw);
})();
