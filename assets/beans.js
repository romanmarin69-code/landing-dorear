/* DOREAR · granos
   Cada grano tiene su propia física y se proyecta con la cámara exacta del render de la bolsa
   (Blender: 80 mm, sensor 36 mm, 1000×1250). Unidades = metros de la escena.
   No toca el DOM: corre igual en un Worker (OffscreenCanvas) o en el hilo principal. */
(function (G_) {
'use strict';
var TAU = Math.PI * 2;
var CAM = { c: [0, -18.86466, 5.313759], X: [1, 0, 0], Y: [0, .1191451, .9928768], Z: [0, -.9928768, .1191451], s: 80 / 36 * 1250, W: 1000, H: 1250 };
function proj(x, y, z) {
  var dx = x - CAM.c[0], dy = y - CAM.c[1], dz = z - CAM.c[2];
  var xc = dx * CAM.X[0] + dy * CAM.X[1] + dz * CAM.X[2], yc = dx * CAM.Y[0] + dy * CAM.Y[1] + dz * CAM.Y[2], zc = dx * CAM.Z[0] + dy * CAM.Z[1] + dz * CAM.Z[2], d = -zc;
  return [CAM.W / 2 + CAM.s * xc / d, CAM.H / 2 - CAM.s * yc / d, d];
}
function unproj(px, py) {
  var xc = (px - CAM.W / 2) / CAM.s, yc = -(py - CAM.H / 2) / CAM.s;
  var dx = CAM.X[0] * xc + CAM.Y[0] * yc - CAM.Z[0], dy = CAM.X[1] * xc + CAM.Y[1] * yc - CAM.Z[1], dz = CAM.X[2] * xc + CAM.Y[2] * yc - CAM.Z[2];
  if (dz >= -1e-4) return null; var t = -CAM.c[2] / dz; return [CAM.c[0] + dx * t, CAM.c[1] + dy * t];
}
var BX = 1.47, BY = .82, BH = 6.0;          // base de la bolsa (semiancho, semiprofundidad, alto)
var R = .078, ZS = 1.65, GRAV = 34;         // radio del grano, aplastamiento vertical, gravedad (cámara lenta)
var NY = 24, NR = 16, SPAN = .30;           // atlas: 24 giros × 16 vuelcos, cada celda cubre 0,30 m

/* cfg: { back, front: lienzos (HTMLCanvasElement u OffscreenCanvas), canvas(w,h): fábrica de lienzos auxiliares,
          cell: 96|48, maxB, maxSub } */
G_.DorearBeans = function (cfg) {
  var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  var CELL = cfg.cell, MAXB = cfg.maxB, MAXSUB = cfg.maxSub;
  var bBack = cfg.back, bFront = cfg.front, gB = bBack.getContext('2d'), gF = bFront.getContext('2d');
  var sCv = cfg.canvas(2, 2), gS = sCv.getContext('2d');
  var atlas = null, bScale = 1, bW = 0, bH = 0, beansDirty = true, staticDirty = true;
  var beans = [], bagAng = 0, bagW = 0, raining = false, pendingRain = null, acc = 0, nextDrop = 5, cursorWp = null, cursorT = 0, tick = 0;
  var shadowSpr = (function () {
    var c = cfg.canvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(.45, 'rgba(0,0,0,.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
  })();

  function newBean(x, y, z) {
    return { x: x, y: y, z: z, vx: 0, vy: 0, vz: 0, yaw: rnd() * TAU, roll: rnd() < .72 ? 0 : Math.PI, wy: 0, wr: 0,
      v: rnd() < .5 ? 0 : 1, sc: .88 + rnd() * .24, sleep: false, still: 0, born: 0, fade: 1, dying: false, ground: false };
  }
  function gauss() { return (rnd() + rnd() + rnd() - 1.5) / 1.5; }
  // montones como en el render: uno grande adelante a la derecha, otro atrás a la izquierda, y granos sueltos
  function spawnRing() {
    var u = rnd();
    if (u < .62) return [1.2 + gauss() * .64, -1.7 + gauss() * .42];
    if (u < .86) return [-1.9 + gauss() * .42, .7 + gauss() * .5];
    var a = Math.PI * 1.05 + rnd() * Math.PI * .95, r = 1.9 + rnd() * .9; return [Math.cos(a) * r, Math.sin(a) * r * .85];
  }
  function rain(n, spread) {
    for (var i = 0; i < n; i++) {
      var p = spawnRing(), b = newBean(p[0], p[1], 7 + rnd() * 4 + i / n * 3);
      b.born = i / n * spread; b.vx = (rnd() - .5) * .6; b.vy = (rnd() - .5) * .6; b.wy = (rnd() - .5) * 14; b.wr = (rnd() - .5) * 18; beans.push(b);
    }
  }
  // colisión con la base giratoria de la bolsa (rectángulo rotado); su borde empuja los granos
  function boxPush(b) {
    if (b.z > BH) return; var c = Math.cos(bagAng), s = Math.sin(bagAng);
    var lx = b.x * c + b.y * s, ly = -b.x * s + b.y * c;
    var qx = Math.max(-BX, Math.min(BX, lx)), qy = Math.max(-BY, Math.min(BY, ly)), dx = lx - qx, dy = ly - qy, d2 = dx * dx + dy * dy;
    var nx, ny, pen;
    if (d2 > R * R) return;
    if (d2 > 1e-9) { var d = Math.sqrt(d2); nx = dx / d; ny = dy / d; pen = R - d; }
    else { var ex = BX - Math.abs(lx), ey = BY - Math.abs(ly); if (ex < ey) { nx = lx > 0 ? 1 : -1; ny = 0; pen = ex + R; } else { nx = 0; ny = ly > 0 ? 1 : -1; pen = ey + R; } }
    var wx = nx * c - ny * s, wy = nx * s + ny * c;
    b.x += wx * pen; b.y += wy * pen; if (pen > .003) wake(b);
    var sx = -bagW * b.y, sy = bagW * b.x;
    var rel = (b.vx - sx) * wx + (b.vy - sy) * wy;
    if (rel < 0) { b.vx -= rel * 1.05 * wx; b.vy -= rel * 1.05 * wy; wake(b); b.wy += (rnd() - .5) * Math.min(12, Math.abs(rel) * 6); }
  }
  function wake(b) { if (b.sleep) { b.sleep = false; b.still = 0; } }
  function step(dt) {
    var i, b, n = beans.length;
    for (i = 0; i < n; i++) {
      b = beans[i]; if (b.born > 0) { b.born -= dt; continue; } if (b.sleep) continue;
      if (b.y > .95) { b.vy -= (b.y - .95) * 26 * dt; b.vy *= Math.exp(-2 * dt); }
      var rr = Math.hypot(b.x * .82, b.y); if (rr > 2.9) { var k2 = (rr - 2.9) * 22 * dt / rr; b.vx -= b.x * k2; b.vy -= b.y * k2; }
      b.vz -= GRAV * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.yaw += b.wy * dt; b.roll += b.wr * dt; b.ground = false;
      if (b.z < R / ZS) {
        b.z = R / ZS; b.ground = true;
        if (b.vz < -1.2) { var imp = -b.vz; b.vz = imp * .32; b.wr += (rnd() - .5) * imp * 5; b.wy += (rnd() - .5) * imp * 3; } else b.vz = 0;
        var fr = Math.exp(-5.5 * dt); b.vx *= fr; b.vy *= fr; b.wy *= Math.exp(-4 * dt);
      }
    }
    var awake = 0; for (i = 0; i < n; i++) if (beans[i].born <= 0 && !beans[i].sleep) { awake = 1; break; }
    if (awake) {
      var grid = {}, CS = R * 2.2;
      for (i = 0; i < n; i++) { b = beans[i]; if (b.born > 0) continue; var key = (Math.floor(b.x / CS) + 512) * 1024 + Math.floor(b.y / CS) + 512; (grid[key] || (grid[key] = [])).push(i); }
      for (i = 0; i < n; i++) {
        b = beans[i]; if (b.born > 0 || b.sleep) continue; var gx = Math.floor(b.x / CS) + 512, gy = Math.floor(b.y / CS) + 512;
        for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
          var cell = grid[(gx + ox) * 1024 + gy + oy]; if (!cell) continue;
          for (var c = 0; c < cell.length; c++) {
            var j = cell[c]; if (j === i) continue; var o = beans[j]; if (!o.sleep && j < i) continue; if (b.sleep) break;
            var dx = o.x - b.x, dy = o.y - b.y, dz = (o.z - b.z) * ZS, d2 = dx * dx + dy * dy + dz * dz; if (d2 >= 4 * R * R || d2 < 1e-10) continue;
            var d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d, pen = 2 * R - d;
            var wb = b.sleep ? 0 : 1, wo = o.sleep ? 0 : 1;
            var rv = (o.vx - b.vx) * nx + (o.vy - b.vy) * ny + (o.vz - b.vz) * nz;
            if ((b.sleep || o.sleep) && Math.abs(rv) > 1.1) { wake(b); wake(o); wb = wo = 1; }
            if (wb + wo === 0) continue;
            var kb = wb / (wb + wo), ko = wo / (wb + wo);
            b.x -= nx * pen * kb; b.y -= ny * pen * kb; b.z -= nz * pen * kb / ZS; o.x += nx * pen * ko; o.y += ny * pen * ko; o.z += nz * pen * ko / ZS;
            if (rv < 0) { var jn = -(1.18) * rv; b.vx -= nx * jn * kb; b.vy -= ny * jn * kb; b.vz -= nz * jn * kb; o.vx += nx * jn * ko; o.vy += ny * jn * ko; o.vz += nz * jn * ko; }
            if (nz < -.5 && wb) b.ground = true; if (nz > .5 && wo) o.ground = true;
            var f = Math.exp(-7 * dt); if (wb && b.ground) { b.vx *= f; b.vy *= f; } if (wo && o.ground) { o.vx *= f; o.vy *= f; }
          }
        }
      }
    }
    for (i = 0; i < n; i++) {
      b = beans[i]; if (b.born > 0) continue;
      boxPush(b); if (b.sleep) continue;
      if (b.ground) {
        var target = b.z > R / ZS + .02 ? Math.round(b.roll / (TAU / NR)) * (TAU / NR) : Math.round(b.roll / Math.PI) * Math.PI;
        b.wr *= Math.exp(-9 * dt); b.roll += (target - b.roll) * Math.min(1, dt * 7);
        var sp = b.vx * b.vx + b.vy * b.vy + b.vz * b.vz;
        if (sp < .012 && Math.abs(b.wr) < .4 && Math.abs(b.wy) < .4) { b.still += dt; if (b.still > .35) { b.sleep = true; b.vx = b.vy = b.vz = 0; b.wr = b.wy = 0; b.roll = target; } } else b.still = 0;
      }
    }
  }

  // dibujo: atrás de la bolsa / delante de la bolsa, ordenados por distancia a la cámara
  function behindBag(b) {
    var c = Math.cos(bagAng), s = Math.sin(bagAng), ax = CAM.c[0], ay = CAM.c[1];
    var lx0 = ax * c + ay * s, ly0 = -ax * s + ay * c, lx1 = b.x * c + b.y * s, ly1 = -b.x * s + b.y * c, t0 = 0, t1 = 1, dx = lx1 - lx0, dy = ly1 - ly0;
    for (var k = 0; k < 4; k++) {
      var p = k === 0 ? -dx : k === 1 ? dx : k === 2 ? -dy : dy, q = k === 0 ? lx0 + BX : k === 1 ? BX - lx0 : k === 2 ? ly0 + BY : BY - ly0;
      if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; } var r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return t1 < .999;
  }
  /* Capa estática: los granos dormidos lejos de la base y fuera de la zona que la bolsa puede tapar se pintan una
     sola vez en un lienzo aparte. Por cuadro sólo se dibujan los que pueden cambiar. */
  function isStatic(b) { return b.sleep && !b.dying && Math.hypot(b.x, b.y) > 2.05 && !(b.y > -1 && Math.abs(b.x) < 1.8); }
  function depthList(arr) {
    var list = [];
    for (var i = 0; i < arr.length; i++) { var b = arr[i]; list.push([proj(b.x, b.y, b.z - .046 * Math.cos(b.roll)), proj(b.x, b.y, 0), b]); }
    return list.sort(function (a, c) { return c[0][2] - a[0][2]; });
  }
  function paintBean(g, it) {
    var p = it[0], f = it[1], b = it[2], ox = .08 * bScale * 1000, oy = .15 * bScale * 1250;
    var px = p[0] * bScale + ox, py = p[1] * bScale + oy, size = SPAN * CAM.s / p[2] * bScale * b.sc;
    // sombra de contacto (la luz principal viene de adelante a la izquierda)
    var h = Math.max(0, b.z - R / ZS), sa = Math.max(0, .62 - h * .55) * b.fade;
    if (sa > .01) { var sw = size * .95 * (1 + h * .6), sh = sw * .34; g.globalAlpha = sa; g.drawImage(shadowSpr, f[0] * bScale + ox - sw / 2 + size * .08, f[1] * bScale + oy - sh / 2 - size * .02, sw, sh); }
    var yi = ((Math.round(b.yaw / TAU * NY) % NY) + NY) % NY, ri = ((Math.round(b.roll / TAU * NR) % NR) + NR) % NR;
    g.globalAlpha = b.fade; g.drawImage(atlas[b.v], ri * CELL, yi * CELL, CELL, CELL, px - size / 2, py - size / 2, size, size);
  }
  function draw() {
    if (!atlas) return;
    var dirty = beansDirty, dyn = [], stat = [], i, b;
    for (i = 0; i < beans.length; i++) {
      b = beans[i]; if (b.born > 0) continue;
      var st = isStatic(b); if (st !== b.st) { b.st = st; staticDirty = true; }
      (st ? stat : dyn).push(b);
    }
    if (staticDirty) {
      staticDirty = false; dirty = true;
      gS.setTransform(1, 0, 0, 1, 0, 0); gS.clearRect(0, 0, sCv.width, sCv.height);
      depthList(stat).forEach(function (it) { paintBean(gS, it); }); gS.globalAlpha = 1;
    }
    if (!dirty) for (i = 0; i < dyn.length; i++) { b = dyn[i]; if (!b.sleep || b.dying || behindBag(b) !== b.side) { dirty = true; break; } }
    if (!dirty) return; beansDirty = false;
    gB.setTransform(1, 0, 0, 1, 0, 0); gF.setTransform(1, 0, 0, 1, 0, 0); gB.clearRect(0, 0, bW, bH); gF.clearRect(0, 0, bW, bH);
    gF.globalAlpha = 1; gF.drawImage(sCv, 0, 0);
    depthList(dyn).forEach(function (it) { var bb = it[2], back = behindBag(bb); bb.side = back; paintBean(back ? gB : gF, it); });
    gB.globalAlpha = gF.globalAlpha = 1;
  }

  return {
    atlas: function (a) { atlas = a; beansDirty = staticDirty = true; if (pendingRain) { var r = pendingRain; pendingRain = null; this.rain(r); } },
    // tamaño del lienzo (px de dispositivo) y escala del render de 1000×1250 al lienzo
    size: function (m) { bW = m.w; bH = m.h; bScale = m.scale; bBack.width = bFront.width = sCv.width = bW; bBack.height = bFront.height = sCv.height = bH; beansDirty = staticDirty = true; },
    rain: function (m) {
      if (!atlas) { pendingRain = m; return; }
      if (raining) return; raining = true;
      if (m.reduced) { rain(m.n, 0); beans.forEach(function (b) { b.born = 0; b.z = R / ZS + rnd() * .05; }); for (var i = 0; i < 900; i++) step(1 / 120); }
      else rain(m.n, 3.4);
      beansDirty = true;
    },
    // px, py en coordenadas del render (0..1000, 0..1250); tm: reloj del hilo principal (ms)
    push: function (m) {
      var p = unproj(m.px, m.py); if (!p) return;
      if (cursorWp && m.tm - cursorT < 300) {
        var dt = Math.max(.008, (m.tm - cursorT) / 1000), vx = (p[0] - cursorWp[0]) / dt, vy = (p[1] - cursorWp[1]) / dt, sp = Math.hypot(vx, vy);
        if (sp > .6) {
          var cap = Math.min(1, 3.2 / sp); vx *= cap; vy *= cap;
          for (var i = 0; i < beans.length; i++) {
            var b = beans[i]; if (b.born > 0 || b.z > .5) continue; var dx = b.x - p[0], dy = b.y - p[1], d = Math.hypot(dx, dy); if (d > .42) continue;
            var w = 1 - d / .42; wake(b); b.vx += vx * .55 * w + dx / (d + .05) * .6 * w; b.vy += vy * .55 * w + dy / (d + .05) * .6 * w; b.vz += (1 + Math.min(sp, 7) * .3) * w; b.wy += (rnd() - .5) * 16 * w; b.wr += (rnd() - .5) * 20 * w;
          }
        }
      }
      cursorWp = p; cursorT = m.tm;
    },
    burst: function (m) {
      var p = unproj(m.px, m.py); if (!p) return;
      for (var i = 0; i < beans.length; i++) {
        var b = beans[i]; if (b.born > 0) continue; var dx = b.x - p[0], dy = b.y - p[1], d = Math.hypot(dx, dy); if (d > 1.1) continue;
        var w = 1 - d / 1.1; wake(b); b.vx += dx / (d + .05) * 1.5 * w; b.vy += dy / (d + .05) * 1.2 * w; b.vz += 1.5 + 5.5 * w * (.75 + rnd() * .5); b.wy += (rnd() - .5) * 26; b.wr += (rnd() - .5) * 34;
      }
    },
    /* un cuadro: m = { dt, ang, w (velocidad angular de la bolsa), sv (velocidad de scroll), top (portada a la vista),
                        calm (granos quietos y sin interacción: se redibuja a 30 Hz), reduced, maxB } */
    frame: function (m) {
      bagAng = m.ang; bagW = m.w; if (m.maxB) MAXB = m.maxB;
      if (!raining) return;
      var dt = m.dt;
      if (!m.reduced) {
        acc += dt; var ns = 0; while (acc >= 1 / 120 && ns < MAXSUB) { step(1 / 120); acc -= 1 / 120; ns++; }
        if (ns === MAXSUB) acc = Math.min(acc, 1 / 120);   // si no da el tiempo, cámara lenta en vez de acumular deuda
        nextDrop -= dt;
        if (nextDrop <= 0 && m.top) {
          nextDrop = 3 + rnd() * 3;
          for (var nd = 2 + (rnd() * 3 | 0); nd > 0; nd--) { var p = spawnRing(), nb = newBean(p[0] * .95, p[1] * .95, 8 + rnd() * 3); nb.born = rnd() * .5; nb.wy = (rnd() - .5) * 12; nb.wr = (rnd() - .5) * 16; beans.push(nb); }
        }
        if (Math.abs(m.sv) > 900 && rnd() < .25) { var bb = beans[(rnd() * beans.length) | 0]; if (bb && bb.born <= 0 && bb.z < .3) { wake(bb); bb.vz += .8 + rnd() * 1.2; bb.wy += (rnd() - .5) * 10; bb.wr += (rnd() - .5) * 12; } }
        var alive = 0; for (var i = beans.length - 1; i >= 0; i--) { var b = beans[i]; if (b.dying) { b.fade -= dt; if (b.fade <= 0) beans.splice(i, 1); } else alive++; }
        if (alive > MAXB) { var far = null, fd = 0; for (var i2 = 0; i2 < beans.length; i2++) { var b2 = beans[i2]; if (b2.dying || b2.born > 0) continue; var dd = Math.hypot(b2.x * .8, b2.y); if (dd > fd) { fd = dd; far = b2; } } if (far) far.dying = true; }
      }
      if (!m.calm || (tick++ & 1)) draw();
    }
  };
};
})(typeof self !== 'undefined' ? self : window);
