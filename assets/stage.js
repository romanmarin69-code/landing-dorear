/* DOREAR · estudio
   Vaso y bolsa: giros renderizados en Blender (Cycles). Entre dos vistas vecinas, la vista intermedia se
   reconstruye en WebGL con el flujo optico precalculado (cada pixel se desplaza por donde realmente se mueve),
   asi el giro es continuo y el texto impreso no se duplica. Las sombras se mezclan de forma exacta.
   Granos: fisica propia, proyectados con la camara exacta del render.
   La coreografia (cuando se enciende la luz, cuando llueven los granos) vive en motion.js; este archivo
   expone window.Dorear y obedece. */
(function () {
'use strict';
var $ = function (s) { return document.querySelector(s); };
var TAU = Math.PI * 2;
var mqReduced = matchMedia('(prefers-reduced-motion: reduce)');
var REDUCED = mqReduced.matches;
var MOB = matchMedia('(max-width:820px)');
var N_ = navigator, conn = N_.connection || {};
var LOW = !!conn.saveData || (N_.deviceMemory && N_.deviceMemory <= 4) || (N_.hardwareConcurrency && N_.hardwareConcurrency <= 4);
var DPR = Math.min(devicePixelRatio || 1, 2);
// set de vistas: 66 % en pantallas chicas o equipos modestos sin pantalla densa
var SET = (MOB.matches || conn.saveData || (LOW && DPR < 1.5)) ? 'h-sm' : 'h';

var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

/* Estado compartido con motion.js. expo: exposicion de los productos 0..1; spin: cuanto del auto-giro esta activo. */
var D = window.Dorear = { expo: 0, spin: 0, beam: 0, lenis: false, low: LOW, reduced: REDUCED };
var readyRes; D.ready = new Promise(function (r) { readyRes = r; });

var META = {"cup":{"N":96,"P":192,"pos":[0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,110,112,114,116,118,120,122,124,126,128,130,132,134,136,138,140,142,144,146,148,150,152,154,156,158,160,162,164,166,168,170,172,174,176,178,180,182,184,186,188,190],"W":1000,"H":1250,"x":16,"y":160,"w":980,"h":1080,"ox":140,"oy":132,"ow":720,"oh":1012,"hit":[0.173,0.1336,0.826,0.888],"fw":90,"fh":127,"fc":16,"fW":1440,"fH":762,"NS":1,"sw":245,"sh":270,"sc":1,"sW":245,"sH":270},"bag":{"N":123,"P":192,"pos":[0,1,2,3,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,91,92,93,94,95,96,98,100,102,104,106,108,110,112,114,116,118,120,122,124,126,128,130,132,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,154,156,158,160,162,164,166,168,170,172,174,176,178,180,182,184,186,187,188,189,190,191],"W":1000,"H":1250,"x":20,"y":136,"w":976,"h":1108,"ox":228,"oy":112,"ow":544,"oh":1052,"hit":[0.261,0.1152,0.738,0.9032],"fw":68,"fh":132,"fc":16,"fW":1088,"fH":1056,"NS":123,"sw":244,"sh":277,"sc":16,"sW":3904,"sH":2216}};

/* ---------- secuencias ---------- */
var VS = 'attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
// A,B: dos vistas vecinas; F: flujo optico entre ellas; S: sombras.
var FS = 'precision highp float;varying vec2 v;uniform sampler2D A,B,F,S;uniform vec4 crop,orect,tile,sa,sb;uniform vec2 fsc,fh,shf,ps,fe;uniform float t,useF;' +
 'void main(){float s=0.;vec2 qs=(v-crop.xy)/crop.zw;' +
 'if(qs.x>0.&&qs.y>0.&&qs.x<1.&&qs.y<1.){vec2 c=clamp(qs,shf,1.-shf);s=mix(texture2D(S,sa.xy+c*sa.zw).r,texture2D(S,sb.xy+c*sb.zw).r,t);}' +
 'vec4 o=vec4(0.,0.,0.,s);vec2 q=(v-orect.xy)/orect.zw;' +
 'if(q.x>0.&&q.y>0.&&q.x<1.&&q.y<1.){' +
 'vec2 fl=useF*(texture2D(F,tile.xy+clamp(q,fh,1.-fh)*tile.zw).rg*255.-128.)/4.*fsc;' +
 'vec2 qa=q-t*fl,qb=q+(1.-t)*fl,e=vec2(ps.x,-ps.y);' +
 'vec4 a=texture2D(A,qa+ps)+texture2D(A,qa-ps)+texture2D(A,qa+e)+texture2D(A,qa-e);' +
 'vec4 b=texture2D(B,qb+ps)+texture2D(B,qb-ps)+texture2D(B,qb+e)+texture2D(B,qb-e);' +
 'float m=smoothstep(0.,fe.x,q.x)*smoothstep(0.,fe.x,1.-q.x)*smoothstep(0.,fe.y,q.y)*smoothstep(0.,fe.y,1.-q.y);' +
 'o=mix(o,((1.-t)*a+t*b)*.25,m);}gl_FragColor=o;}';
var BMO = { premultiplyAlpha: 'premultiply', colorSpaceConversion: 'none' };
function toBitmap(blob) { return createImageBitmap(blob, BMO).catch(function () { return createImageBitmap(blob); }); }

function seq(id, name, autoSpeed, startAngle) {
  var m = META[name], N = m.N, P = m.P, pos = m.pos, cv = document.getElementById(id), K = P / TAU, lut = [];
  for (var li = 0, lj = 0; lj < P; lj++) { while (li + 1 < N && pos[li + 1] <= lj) li++; lut[lj] = li; }
  var tex = new Array(N), ready = [], texN = 0;
  var o = { cv: cv, a: startAngle, v: 0, auto: autoSpeed, drag: false, last: '', lost: false };
  function md(i) { return ((i % N) + N) % N; }
  var gl = null, prog, U = {}, flowTex = null, shTex = null;
  try { gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' }); } catch (_) { gl = null; }
  if (gl) {
    var sh = function (t, s) { var x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(x); return x; };
    try {
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw 'link';
      gl.useProgram(prog);
      var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['A', 'B', 'F', 'S', 'crop', 'orect', 'tile', 'sa', 'sb', 'fsc', 'fh', 'shf', 'ps', 'fe', 't', 'useF'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
      gl.uniform1i(U.A, 0); gl.uniform1i(U.B, 1); gl.uniform1i(U.F, 2); gl.uniform1i(U.S, 3);
      gl.uniform4f(U.crop, m.x / m.W, m.y / m.H, m.w / m.W, m.h / m.H); gl.uniform4f(U.orect, m.ox / m.W, m.oy / m.H, m.ow / m.W, m.oh / m.H);
      gl.uniform2f(U.fsc, 1 / m.ow, 1 / m.oh); gl.uniform2f(U.fh, .5 / m.fw, .5 / m.fh); gl.uniform2f(U.shf, .5 / m.sw, .5 / m.sh); gl.uniform2f(U.fe, 14 / m.ow, 14 / m.oh);
      cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); o.lost = true; });
      cv.addEventListener('webglcontextrestored', function () { location.reload(); });
    } catch (err) { gl = null; }
  }
  function mk(src) {
    var tx = gl.createTexture(); gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tx;
  }
  if (gl) {
    [['flow.webp', function (t) { flowTex = t; }], ['sh.webp', function (t) { shTex = t; }]].forEach(function (a) {
      var im = new Image(); im.onload = function () { a[1](mk(im)); o.last = ''; }; im.src = name + '/' + a[0];
    });
  }
  // descarga y decodificacion fuera del hilo principal; el orden sigue el sentido del giro desde la vista inicial
  var b0 = lut[Math.floor(((startAngle * K) % P + P) % P)], order = [], dq = autoSpeed >= 0 ? 1 : -1;
  for (var k = 0; k < N; k++) order.push(md(b0 + dq * k));
  var act = 0;
  (function pump() {
    while (act < 6 && order.length) {
      (function (i) {
        act++;
        fetch(name + '/' + SET + '/' + ('00' + i).slice(-3) + '.webp')
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(toBitmap)
          .then(function (b) { ready.push([i, b]); }, function () {})
          .then(function () { act--; pump(); });
      })(order.shift());
    }
  })();
  // subida a la placa: pocas por cuadro, para no trabar el hilo principal
  o.pump = function (n) {
    while (n-- > 0 && ready.length) {
      var r = ready.shift(), i = r[0], b = r[1];
      if (gl) { tex[i] = mk(b); try { b.close(); } catch (_) {} } else tex[i] = b;
      texN++; o.last = '';
    }
  };
  var cx = gl ? null : cv.getContext('2d');
  function near(i) { if (tex[i]) return i; for (var d = 1; d <= N / 2; d++) { if (tex[md(i + d)]) return md(i + d); if (tex[md(i - d)]) return md(i - d); } return -1; }
  o.draw = function (angle) {
    if (o.lost) return angle;
    var f = ((angle * K) % P + P) % P, i0 = lut[Math.floor(f) % P], i1 = (i0 + 1) % N, t = Math.min(1, (f - pos[i0]) / (((pos[i1] - pos[i0]) % P + P) % P));
    if (!(tex[i0] && tex[i1])) { i0 = i1 = near(t < .5 ? i0 : i1); t = 0; if (i0 < 0) return angle; }
    var key = i0 + ':' + i1 + ':' + t.toFixed(4); if (key === o.last) return angle; o.last = key;
    if (gl) {
      gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(U.ps, .25 / (cv.width * m.ow / m.W), .25 / (cv.height * m.oh / m.H)); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[i0]); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex[i1]);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, flowTex || tex[i0]); gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, shTex || tex[i0]);
      var c = i0 % m.fc, rr = Math.floor(i0 / m.fc); gl.uniform4f(U.tile, c * m.fw / m.fW, rr * m.fh / m.fH, m.fw / m.fW, m.fh / m.fH);
      var s0 = m.NS > 1 ? i0 : 0, s1 = m.NS > 1 ? i1 : 0;
      gl.uniform4f(U.sa, (s0 % m.sc) * m.sw / m.sW, Math.floor(s0 / m.sc) * m.sh / m.sH, m.sw / m.sW, m.sh / m.sH);
      gl.uniform4f(U.sb, (s1 % m.sc) * m.sw / m.sW, Math.floor(s1 / m.sc) * m.sh / m.sH, m.sw / m.sW, m.sh / m.sH);
      gl.uniform1f(U.t, t); gl.uniform1f(U.useF, flowTex && i0 !== i1 ? 1 : 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      var X = Math.round(m.ox / m.W * cv.width), Y = Math.round(m.oy / m.H * cv.height), Wd = Math.round(m.ow / m.W * cv.width), Hd = Math.round(m.oh / m.H * cv.height);
      cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); cx.globalAlpha = 1 - t; cx.drawImage(tex[i0], X, Y, Wd, Hd);
      if (t > 0) { cx.globalAlpha = t; cx.globalCompositeOperation = 'lighter'; cx.drawImage(tex[i1], X, Y, Wd, Hd); }
      cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
    }
    return angle;
  };
  o.resize = function (W) { W = Math.max(2, W); var H = Math.round(W * m.H / m.W); if (cv.width === W && cv.height === H) return; cv.width = W; cv.height = H; o.last = ''; };
  o.rect = null;
  o.hit = function (x, y) { var r = o.rect, h = m.hit; if (!r) return false; x = (x - r.left) / r.width; y = (y - r.top) / r.height; return x > h[0] && x < h[2] && y > h[1] && y < h[3]; };
  o.some = function () { return texN > 0; };
  return o;
}
var cup = seq('cup', 'cup', .36, .12), bag = seq('bag', 'bag', -.26, -.55), OB = [cup, bag];

/* ---------- granos: cada uno con su propia fisica ----------
   Camara exacta del render de la bolsa (Blender: 80 mm, sensor 36 mm, 1000x1250). Unidades = metros de la escena. */
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
var R = .078, ZS = 1.65, G = 34;            // radio del grano, aplastamiento vertical, gravedad (camara lenta)
var NY = 24, NR = 16, CELL = 96, SPAN = .30; // atlas: 24 giros x 16 vuelcos, cada celda cubre 0,30 m
var MAXB = LOW || MOB.matches ? 320 : 540, RAIN = LOW || MOB.matches ? 260 : 500;
var atlas = [null, null], atlasRes, atlasReady = new Promise(function (r) { atlasRes = r; });
Promise.all(['beans/b0.webp', 'beans/b1.webp'].map(function (u, i) {
  return fetch(u).then(function (r) { return r.blob(); }).then(function (b) { return createImageBitmap(b); }).then(function (b) { atlas[i] = b; });
})).then(atlasRes, function () {});
var shadowSpr = (function () {
  var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(.45, 'rgba(0,0,0,.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
})();

var beans = [], bagAng = 0, bagW = 0, raining = false;
function newBean(x, y, z) {
  return { x: x, y: y, z: z, vx: 0, vy: 0, vz: 0, yaw: rnd() * TAU, roll: rnd() < .72 ? 0 : Math.PI, wy: 0, wr: 0,
    v: rnd() < .5 ? 0 : 1, sc: .88 + rnd() * .24, sleep: false, still: 0, born: 0, fade: 1, dying: false, ground: false };
}
function gauss() { return (rnd() + rnd() + rnd() - 1.5) / 1.5; }
// montones como en el render: uno grande adelante a la derecha, otro atras a la izquierda, y granos sueltos
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
// colision con la base giratoria de la bolsa (rectangulo rotado); su borde empuja los granos
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
    b.vz -= G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.yaw += b.wy * dt; b.roll += b.wr * dt; b.ground = false;
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

// el cursor empuja los granos y un clic los hace saltar
var cursorWp = null, cursorT = 0;
function floorAt(x, y) { var r = bag.rect; if (!r) return null; return unproj((x - r.left) / r.width * 1000, (y - r.top) / r.height * 1250); }
function push(x, y, now) {
  var p = floorAt(x, y); if (!p) return;
  if (cursorWp && now - cursorT < 300) {
    var dt = Math.max(.008, (now - cursorT) / 1000), vx = (p[0] - cursorWp[0]) / dt, vy = (p[1] - cursorWp[1]) / dt, sp = Math.hypot(vx, vy);
    if (sp > .6) {
      var cap = Math.min(1, 3.2 / sp); vx *= cap; vy *= cap;
      for (var i = 0; i < beans.length; i++) {
        var b = beans[i]; if (b.born > 0 || b.z > .5) continue; var dx = b.x - p[0], dy = b.y - p[1], d = Math.hypot(dx, dy); if (d > .42) continue;
        var w = 1 - d / .42; wake(b); b.vx += vx * .55 * w + dx / (d + .05) * .6 * w; b.vy += vy * .55 * w + dy / (d + .05) * .6 * w; b.vz += (1 + Math.min(sp, 7) * .3) * w; b.wy += (rnd() - .5) * 16 * w; b.wr += (rnd() - .5) * 20 * w;
      }
    }
  }
  cursorWp = p; cursorT = now;
}
function burst(x, y) {
  var p = floorAt(x, y); if (!p) return;
  for (var i = 0; i < beans.length; i++) {
    var b = beans[i]; if (b.born > 0) continue; var dx = b.x - p[0], dy = b.y - p[1], d = Math.hypot(dx, dy); if (d > 1.1) continue;
    var w = 1 - d / 1.1; wake(b); b.vx += dx / (d + .05) * 1.5 * w; b.vy += dy / (d + .05) * 1.2 * w; b.vz += 1.5 + 5.5 * w * (.75 + rnd() * .5); b.wy += (rnd() - .5) * 26; b.wr += (rnd() - .5) * 34;
  }
}

// dibujo: atras de la bolsa / delante de la bolsa, ordenados por distancia a la camara
var bBack = $('#beansBack'), bFront = $('#beansFront'), gB = bBack.getContext('2d'), gF = bFront.getContext('2d'), bScale = 1, bW = 0, bH = 0, beansDirty = true, sideMem = [];
function behindBag(b) {
  var c = Math.cos(bagAng), s = Math.sin(bagAng), ax = CAM.c[0], ay = CAM.c[1];
  var lx0 = ax * c + ay * s, ly0 = -ax * s + ay * c, lx1 = b.x * c + b.y * s, ly1 = -b.x * s + b.y * c, t0 = 0, t1 = 1, dx = lx1 - lx0, dy = ly1 - ly0;
  for (var k = 0; k < 4; k++) {
    var p = k === 0 ? -dx : k === 1 ? dx : k === 2 ? -dy : dy, q = k === 0 ? lx0 + BX : k === 1 ? BX - lx0 : k === 2 ? ly0 + BY : BY - ly0;
    if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; } var r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t1 < .999;
}
function drawBeans() {
  if (!atlas[0] || !atlas[1]) return;
  var dirty = beansDirty, i0, bb0, sd;
  for (i0 = 0; i0 < beans.length; i0++) { bb0 = beans[i0]; if (bb0.born > 0) continue; if (!bb0.sleep || bb0.dying) { dirty = true; break; } }
  if (!dirty) { for (i0 = 0; i0 < beans.length; i0++) { bb0 = beans[i0]; if (bb0.born > 0) continue; sd = behindBag(bb0); if (sideMem[i0] !== sd || bb0.side !== sd) { dirty = true; break; } } }
  if (!dirty) return; beansDirty = false;
  gB.setTransform(1, 0, 0, 1, 0, 0); gF.setTransform(1, 0, 0, 1, 0, 0); gB.clearRect(0, 0, bW, bH); gF.clearRect(0, 0, bW, bH);
  var list = []; for (var i = 0; i < beans.length; i++) { var b = beans[i]; if (b.born > 0) continue; var p = proj(b.x, b.y, b.z - .046 * Math.cos(b.roll)), f = proj(b.x, b.y, 0); list.push([p[2], b, p, f]); }
  list.sort(function (a, b) { return b[0] - a[0]; });
  var ox = .08 * bScale * 1000, oy = .15 * bScale * 1250;
  for (var k = 0; k < list.length; k++) {
    var b = list[k][1], p = list[k][2], f = list[k][3], g = behindBag(b) ? gB : gF;
    b.side = g === gB; var px = p[0] * bScale + ox, py = p[1] * bScale + oy, size = SPAN * CAM.s / p[2] * bScale * b.sc;
    // sombra de contacto (la luz principal viene de adelante a la izquierda)
    var h = Math.max(0, b.z - R / ZS), sa = Math.max(0, .62 - h * .55) * b.fade;
    if (sa > .01) { var sw = size * .95 * (1 + h * .6), sh = sw * .34; g.globalAlpha = sa; g.drawImage(shadowSpr, f[0] * bScale + ox - sw / 2 + size * .08, f[1] * bScale + oy - sh / 2 - size * .02, sw, sh); }
    var yi = ((Math.round(b.yaw / TAU * NY) % NY) + NY) % NY, ri = ((Math.round(b.roll / TAU * NR) % NR) + NR) % NR;
    g.globalAlpha = b.fade; g.drawImage(atlas[b.v], ri * CELL, yi * CELL, CELL, CELL, px - size / 2, py - size / 2, size, size);
  }
  gB.globalAlpha = gF.globalAlpha = 1;
  for (var s2 = 0; s2 < beans.length; s2++) sideMem[s2] = beans[s2].born > 0 ? undefined : beans[s2].side;
}

/* ---------- atmosfera: polvo suspendido en tres profundidades ---------- */
var dgs = [0, 1, 2].map(function (k) { var g = document.createElement('div'); g.className = 'dg'; $(k === 2 ? '#dustNear' : '#dustFar').appendChild(g); return g; });
if (!REDUCED) {
  var MOTES = LOW || MOB.matches ? 24 : 64;
  for (var mi = 0; mi < MOTES; mi++) {
    var dep = mi < MOTES * .6 ? 0 : mi < MOTES * .9 ? 1 : 2, me = document.createElement('i'); me.className = 'mote';
    var ms = dep === 0 ? 3 + rnd() * 6 : dep === 1 ? 9 + rnd() * 12 : 80 + rnd() * 120, ma = dep === 0 ? .18 + rnd() * .25 : dep === 1 ? .12 + rnd() * .14 : .05 + rnd() * .06, mdur = 1.12 / ((.004 + rnd() * .01) * (dep + 1)), mt = 4 + rnd() * 5;
    me.style.cssText = 'left:' + (rnd() * 100).toFixed(2) + '%;width:' + ms.toFixed(1) + 'px;height:' + ms.toFixed(1) + 'px;--dx:' + ((rnd() - .5) * 8).toFixed(1) + 'vw;--a0:' + (ma * .5).toFixed(3) + ';--a1:' + ma.toFixed(3) +
      ';animation-duration:' + mdur.toFixed(1) + 's,' + mt.toFixed(1) + 's;animation-delay:-' + (rnd() * mdur).toFixed(1) + 's,-' + (rnd() * mt).toFixed(1) + 's';
    dgs[dep].appendChild(me);
  }
}

/* ---------- control: cursor, arrastre con inercia, teclado ---------- */
var stage = $('#stage'), hero = $('#hero'), mx = 0, my = 0, cmx = 0, cmy = 0, sp = 0, csp = 0, drag = null, T = 0, lastScrollY = scrollY, scrollV = 0;
var lastMove = null, KICK = 1.9; // impulso de giro por tecla (rad/s); luego vuelve a su velocidad propia con amortiguacion
addEventListener('pointermove', function (e) {
  if (!REDUCED) { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }
  if (drag) {
    var now = performance.now(), dx = e.clientX - drag.x, dt = Math.max(8, now - drag.t);
    drag.o.a += dx * .0105; drag.o.v = dx * .0105 / dt * 1000; drag.x = e.clientX; drag.t = now;
  } else if (e.target === stage || stage.contains(e.target)) lastMove = { x: e.clientX, y: e.clientY, t: performance.now() };
}, { passive: true });
stage.addEventListener('pointerdown', function (e) {
  var o = cup.hit(e.clientX, e.clientY) ? cup : bag.hit(e.clientX, e.clientY) ? bag : null;
  if (!o) { burst(e.clientX, e.clientY); return; }
  o.v = 0; drag = { o: o, x: e.clientX, t: performance.now() }; o.drag = true; stage.classList.add('is-grabbing');
  try { stage.setPointerCapture(e.pointerId); } catch (_) {}
});
function up() { if (drag) { drag.o.drag = false; drag = null; } stage.classList.remove('is-grabbing'); }
stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up); stage.addEventListener('lostpointercapture', up); addEventListener('blur', up);
stage.addEventListener('keydown', function (e) {
  var k = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0; if (!k) return;
  e.preventDefault(); OB.forEach(function (o, j) { o.v += k * KICK * (j ? .8 : 1); });
});
addEventListener('scroll', function () { sp = Math.min(1, Math.max(0, scrollY / roomH)); }, { passive: true });

// tamanos (nunca mas que la resolucion del render) y rectangulos cacheados: el loop no lee layout
var room = $('#room'), roomH = innerHeight, beansLow = false, slowT = 0;
function size() {
  roomH = room.offsetHeight || innerHeight;
  var d = DPR;
  OB.forEach(function (o) { var r = o.cv.getBoundingClientRect(); o.resize(Math.min(Math.round(r.width * d), 1000)); });
  var r = bag.cv.getBoundingClientRect(), bd = beansLow ? 1 : d; bScale = r.width * bd / 1000;
  bW = Math.round(r.width * 1.16 * bd); bH = Math.round(r.height * 1.25 * bd); bBack.width = bFront.width = bW; bBack.height = bFront.height = bH;
  beansDirty = true; rects();
}
function rects() { OB.forEach(function (o) { o.rect = o.cv.getBoundingClientRect(); }); }
addEventListener('resize', size);

var cupEl = $('#cup'), bagEl = $('#bagbox'), wall = $('#wall'), beam = $('#beam'), dim = $('#dim');
var prevLook = [null, null], acc = 0, nextDrop = 5, lastFilter = '', lastOp = '', heroOff = false, rectT = 0;
D.dof = !LOW && !REDUCED; // rack focus sólo donde sobra GPU

D.rain = function () {
  return atlasReady.then(function () {
    if (raining) return; raining = true;
    if (REDUCED) { rain(RAIN, 0); beans.forEach(function (b) { b.born = 0; b.z = R / ZS + rnd() * .05; }); for (var i = 0; i < 900; i++) step(1 / 120); }
    else rain(RAIN, 3.4);
    beansDirty = true;
  });
};

function frame() {
  var now = performance.now(), dt = Math.min(.05, (now - (frame.t || now)) / 1000); frame.t = now;
  cup.pump(2); bag.pump(2);
  if (readyRes && cup.some() && bag.some()) { readyRes(); readyRes = null; }
  var off = scrollY > roomH + innerHeight * 1.05;          // la portada ya no se ve: no se dibuja
  if (off !== heroOff) { heroOff = off; hero.classList.toggle('is-off', off); }
  if (off || !dt) return;
  if (!beansLow && raining) { slowT = dt > .0222 ? slowT + dt : Math.max(0, slowT - dt * 2); if (slowT > 3) { beansLow = true; MAXB = 320; D.dof = false; size(); } }
  if ((rectT -= dt) <= 0) { rects(); rectT = .25; }
  if (lastMove) { var lm = lastMove; lastMove = null; if (!drag) { stage.classList.toggle('is-grab', cup.hit(lm.x, lm.y) || bag.hit(lm.x, lm.y)); if (scrollY < innerHeight && !REDUCED) push(lm.x, lm.y, lm.t); } }
  T += dt; var kk = 1 - Math.exp(-dt * 3.6); cmx += (mx - cmx) * kk; cmy += (my - cmy) * kk;
  var ks = D.lenis ? 1 : 1 - Math.exp(-dt * 7); csp += (sp - csp) * ks;  // con Lenis el scroll ya llega suavizado
  var sv = (scrollY - lastScrollY) / Math.max(dt, .001); lastScrollY = scrollY; scrollV += (sv - scrollV) * .2;
  OB.forEach(function (o, j) {
    if (!o.drag) { var target = REDUCED ? 0 : o.auto * D.spin; o.v += (target - o.v) * Math.min(1, dt * 1.4); o.a += o.v * dt; }
    var look = REDUCED ? 0 : cmx * (j ? .55 : .9) + csp * Math.PI * (j ? -.6 : .75);
    if (o.drag && o.pl !== undefined) o.a -= look - o.pl; o.pl = look;
    var shown = o.draw(o.a + look);
    if (j === 1) { bagW = prevLook[1] === null ? 0 : (shown - prevLook[1]) / Math.max(dt, .001); bagAng = shown; }
    prevLook[j] = shown;
  });
  if (raining && !REDUCED) {
    acc += dt; var ns = 0; while (acc >= 1 / 120 && ns < 4) { step(1 / 120); acc -= 1 / 120; ns++; }
    nextDrop -= dt;
    if (nextDrop <= 0 && scrollY < innerHeight) {
      nextDrop = 3 + rnd() * 3;
      for (var nd = 2 + (rnd() * 3 | 0); nd > 0; nd--) { var p = spawnRing(), nb = newBean(p[0] * .95, p[1] * .95, 8 + rnd() * 3); nb.born = rnd() * .5; nb.wy = (rnd() - .5) * 12; nb.wr = (rnd() - .5) * 16; beans.push(nb); }
    }
    if (Math.abs(scrollV) > 900 && rnd() < .25) { var bb = beans[(rnd() * beans.length) | 0]; if (bb && bb.born <= 0 && bb.z < .3) { wake(bb); bb.vz += .8 + rnd() * 1.2; bb.wy += (rnd() - .5) * 10; bb.wr += (rnd() - .5) * 12; } }
    var alive = 0; for (var i = beans.length - 1; i >= 0; i--) { var b = beans[i]; if (b.dying) { b.fade -= dt; if (b.fade <= 0) beans.splice(i, 1); } else alive++; }
    if (alive > MAXB) { var far = null, fd = 0; for (var i2 = 0; i2 < beans.length; i2++) { var b2 = beans[i2]; if (b2.dying || b2.born > 0) continue; var dd = Math.hypot(b2.x * .8, b2.y); if (dd > fd) { fd = dd; far = b2; } } if (far) far.dying = true; }
  }
  if (raining) drawBeans();
  if (!REDUCED) {
    dgs[0].style.transform = 'translate3d(' + (-cmx * 12).toFixed(1) + 'px,' + (-cmy * 6).toFixed(1) + 'px,0)';
    dgs[1].style.transform = 'translate3d(' + (-cmx * 32).toFixed(1) + 'px,' + (-cmy * 16).toFixed(1) + 'px,0)';
    dgs[2].style.transform = 'translate3d(' + (-cmx * 120).toFixed(1) + 'px,' + (-cmy * 60).toFixed(1) + 'px,0)';
  }
  // camara: travelling de acercamiento; los productos van al centro y crecen
  var mob = MOB.matches, e = REDUCED ? 0 : csp * csp * (3 - 2 * csp);
  stage.style.transform = mob ? 'translate3d(0,' + (-e * 10).toFixed(2) + 'svh,0) scale(' + (1 + e * .1).toFixed(4) + ')' : 'translate3d(' + (-e * 9).toFixed(2) + 'vw,' + (-e * 2).toFixed(2) + 'vh,0) scale(' + (1 + e * .14).toFixed(4) + ')';
  cupEl.style.transform = 'translate3d(' + (-cmx * 40).toFixed(1) + 'px,' + (-cmy * 40).toFixed(1) + 'px,0) rotate(' + (cmx * 3).toFixed(2) + 'deg)';
  bagEl.style.transform = 'translate3d(' + (-cmx * 18).toFixed(1) + 'px,' + (-cmy * 18).toFixed(1) + 'px,0) rotate(' + (cmx * 1.5).toFixed(2) + 'deg)';
  wall.style.transform = 'translate3d(' + (cmx * 10).toFixed(1) + 'px,' + (cmy * 8 - e * 20).toFixed(1) + 'px,0) scale(1.04)';
  // la luz respira y sigue apenas al cursor: la fuente se mueve, no la escena
  var bx = REDUCED ? 0 : cmx * 46 + Math.sin(T * .23) * 18, bo = REDUCED ? 1 : .86 + Math.sin(T * .31 + 1) * .14;
  beam.style.transform = 'translate3d(' + bx.toFixed(1) + 'px,0,0)'; beam.style.opacity = (D.beam * bo).toFixed(3);
  // exposicion de los productos + cambio de foco cuando sube la carta
  var over = Math.max(0, Math.min(1, (scrollY - roomH) / innerHeight)), ex = D.expo;
  var op = Math.min(1, ex * 3).toFixed(3);
  if (op !== lastOp) { lastOp = op; cupEl.style.opacity = bagEl.style.opacity = op; }
  var bright = (.1 + .9 * Math.pow(ex, 1.4)) * (D.dof ? 1 - over * .35 : 1), blur = D.dof ? over * 8 : 0;
  var fil = (bright > .999 ? '' : 'brightness(' + bright.toFixed(3) + ')') + (blur > .05 ? ' blur(' + blur.toFixed(2) + 'px)' : '');
  if (fil !== lastFilter) { lastFilter = fil; stage.style.filter = fil; }
  dim.style.opacity = (over * (D.dof ? .4 : .6)).toFixed(3);
}
size();
if (window.gsap) gsap.ticker.add(frame); else (function loop() { requestAnimationFrame(loop); frame(); })();
})();
