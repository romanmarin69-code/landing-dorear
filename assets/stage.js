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
if (SET === 'h-sm') DPR = Math.min(DPR, 1.5);   // más densidad que la textura no suma nitidez, sólo costo

var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

/* Estado compartido con motion.js. expo: exposicion de los productos 0..1; spin: cuanto del auto-giro esta activo. */
var D = window.Dorear = { expo: 0, spin: 0, beam: 0, lenis: false, low: LOW, reduced: REDUCED };
var readyRes; D.ready = new Promise(function (r) { readyRes = r; });
// las descargas pesadas (vistas, flujo, atlas) arrancan después del primer cuadro pintado: el texto no compite con ellas
var afterPaint = new Promise(function (r) {
  var done = false, go = function () { if (!done) { done = true; setTimeout(r, 150); } };
  try { new PerformanceObserver(function (l) { if (l.getEntriesByName('first-contentful-paint').length) go(); }).observe({ type: 'paint', buffered: true }); } catch (_) {}
  setTimeout(go, 1500);   // red de seguridad si el navegador no reporta pintados
});

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
  // atlas de sombras de la bolsa (3904×2216, 35 MB en la placa): en el set chico va al 50 %, tile por tile
  var shFile = m.NS > 1 && SET === 'h-sm' ? 'sh-sm.webp' : 'sh.webp';
  if (shFile === 'sh-sm.webp') m = Object.assign({}, m, { sw: 122, sh: 139, sW: 1952, sH: 1112 });
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
  // flujo y sombras son datos, no color: se decodifican fuera del hilo principal y sin premultiplicar
  if (gl) afterPaint.then(function () {
    [['flow.webp', function (t) { flowTex = t; }], [shFile, function (t) { shTex = t; }]].forEach(function (a) {
      fetch(name + '/' + a[0]).then(function (r) { return r.blob(); })
        .then(function (b) { return createImageBitmap(b, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); })
        .then(function (bm) { a[1](mk(bm)); try { bm.close(); } catch (_) {} o.last = ''; }, function () {});
    });
  });
  // descarga y decodificacion fuera del hilo principal; el orden sigue el sentido del giro desde la vista inicial
  var b0 = lut[Math.floor(((startAngle * K) % P + P) % P)], order = [], dq = autoSpeed >= 0 ? 1 : -1;
  for (var k = 0; k < N; k++) order.push(md(b0 + dq * k));
  var act = 0;
  afterPaint.then(function pump() {
    while (act < 6 && order.length) {
      (function (i) {
        act++;
        fetch(name + '/' + SET + '/' + ('00' + i).slice(-3) + '.webp')
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(toBitmap)
          .then(function (b) { ready.push([i, b]); }, function () {})
          .then(function () { act--; pump(); });
      })(order.shift());
    }
  });
  // subida a la placa: pocas por cuadro, para no trabar el hilo principal
  o.pump = function (n) {
    var did = false;
    while (n-- > 0 && ready.length) {
      var r = ready.shift(), i = r[0], b = r[1];
      if (gl) { tex[i] = mk(b); try { b.close(); } catch (_) {} } else tex[i] = b;
      texN++; o.last = ''; did = true;
    }
    return did;
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

/* ---------- granos: motor en beans.js; en su propio hilo cuando el navegador lo permite ---------- */
var CELL = SET === 'h-sm' ? 48 : 96;   // en el set chico los granos miden ~12 px: atlas a la mitad
var MAXB = LOW || MOB.matches ? 320 : 540, RAIN = LOW || MOB.matches ? 260 : 500, MAXSUB = LOW || MOB.matches ? 2 : 4;
var ATLAS = ['beans/b0', 'beans/b1'].map(function (u) { return new URL(u + (CELL === 48 ? '-sm.webp' : '.webp'), document.baseURI).href; });
var bBack = $('#beansBack'), bFront = $('#beansFront'), raining = false, bagAng = 0, bagW = 0, pushT = 0;
var BE = (function () {
  if ('transferControlToOffscreen' in bFront && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
    try {
      var w = new Worker('assets/beans-worker.js'), back = bBack.transferControlToOffscreen(), front = bFront.transferControlToOffscreen();
      w.postMessage({ t: 'init', back: back, front: front, cell: CELL, maxB: MAXB, maxSub: MAXSUB }, [back, front]);
      afterPaint.then(function () { w.postMessage({ t: 'load', atlas: ATLAS }); });
      D.beansWorker = true;
      return { post: function (m) { w.postMessage(m); } };
    } catch (_) {}
  }
  var B = DorearBeans({ back: bBack, front: bFront, cell: CELL, maxB: MAXB, maxSub: MAXSUB,
    canvas: function (cw, ch) { var c = document.createElement('canvas'); c.width = cw; c.height = ch; return c; } });
  afterPaint.then(function () {
    return Promise.all(ATLAS.map(function (u) { return fetch(u).then(function (r) { return r.blob(); }).then(function (b) { return createImageBitmap(b); }); }));
  }).then(function (a) { B.atlas(a); }, function () {});
  return { post: function (m) { B[m.t](m); } };
})();
// coordenadas de pantalla → píxeles del render de la bolsa (0..1000, 0..1250)
function toRender(x, y) { var r = bag.rect; return r ? { px: (x - r.left) / r.width * 1000, py: (y - r.top) / r.height * 1250 } : null; }
function push(x, y, now) { var p = toRender(x, y); if (p) { BE.post({ t: 'push', px: p.px, py: p.py, tm: now }); pushT = now; } }
function burst(x, y) { var p = toRender(x, y); if (p) BE.post({ t: 'burst', px: p.px, py: p.py }); }

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
var stage = $('#stage'), hero = $('#hero'), mx = 0, my = 0, cmx = 0, cmy = 0, sp = 0, csp = 0, drag = null, lastScrollY = scrollY, scrollV = 0;
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
  // el lienzo de granos se extiende 8 % a los lados y 15 % arriba de la bolsa
  var r = bag.cv.getBoundingClientRect(), bd = beansLow ? 1 : d;
  BE.post({ t: 'size', w: Math.round(r.width * 1.16 * bd), h: Math.round(r.height * 1.25 * bd), scale: r.width * bd / 1000 });
  rects();
}
function rects() { OB.forEach(function (o) { o.rect = o.cv.getBoundingClientRect(); }); }
addEventListener('resize', size);

var cupEl = $('#cup'), bagEl = $('#bagbox'), wall = $('#wall'), beam = $('#beam'), dim = $('#dim');
var prevLook = [null, null], heroOff = false, rectT = 0, rainT = 0;
D.dof = !LOW && !REDUCED; // rack focus sólo donde sobra GPU

// la lluvia arranca cuando motion.js lo pide; si los atlas todavía no llegaron, el motor la guarda para cuando estén
D.rain = function () { if (raining) return; raining = true; rainT = performance.now(); BE.post({ t: 'rain', n: RAIN, reduced: REDUCED }); };

function frame() {
  var now = performance.now(), dt = Math.min(.05, (now - (frame.t || now)) / 1000); frame.t = now;
  // una sola subida de textura por cuadro, alternando objetos: nunca una tarea larga en el hilo principal
  var first = (frame.k = !frame.k) ? cup : bag;
  if (!first.pump(1)) (first === cup ? bag : cup).pump(1);
  if (readyRes && cup.some() && bag.some()) { readyRes(); readyRes = null; }
  var off = scrollY > roomH + innerHeight * 1.05;          // la portada ya no se ve: no se dibuja
  if (off !== heroOff) { heroOff = off; hero.classList.toggle('is-off', off); }
  if (off || !dt) return;
  if (!beansLow && raining) { slowT = dt > .0222 ? slowT + dt : Math.max(0, slowT - dt * 2); if (slowT > 3) { beansLow = true; MAXB = 320; D.dof = false; size(); } }
  if ((rectT -= dt) <= 0) { rects(); rectT = .25; }
  if (lastMove) { var lm = lastMove; lastMove = null; if (!drag) { stage.classList.toggle('is-grab', cup.hit(lm.x, lm.y) || bag.hit(lm.x, lm.y)); if (scrollY < innerHeight && !REDUCED) push(lm.x, lm.y, lm.t); } }
  var kk = 1 - Math.exp(-dt * 3.6); cmx += (mx - cmx) * kk; cmy += (my - cmy) * kk;
  var ks = D.lenis ? 1 : 1 - Math.exp(-dt * 7); csp += (sp - csp) * ks;  // con Lenis el scroll ya llega suavizado
  var sv = (scrollY - lastScrollY) / Math.max(dt, .001); lastScrollY = scrollY; scrollV += (sv - scrollV) * .2;
  OB.forEach(function (o, j) {
    if (!o.drag) { var target = REDUCED ? 0 : o.auto * D.spin; o.v += (target - o.v) * Math.min(1, dt * 1.4); o.a += o.v * dt; }
    var look = REDUCED ? 0 : cmx * (j ? .55 : .9) + csp * Math.PI * (j ? -.6 : .75);
    if (o.drag && o.pl !== undefined) o.a -= look - o.pl; o.pl = look;
    var shown = D.expo > 0 ? o.draw(o.a + look) : o.a + look;   // invisible: no se dibuja
    if (j === 1) { bagW = prevLook[1] === null ? 0 : (shown - prevLook[1]) / Math.max(dt, .001); bagAng = shown; }
    prevLook[j] = shown;
  });
  // granos: un mensaje por cuadro con el estado de la bolsa; la física y el dibujo corren en su hilo.
  // En equipos chicos, con los granos quietos y sin interacción, se redibujan a 30 Hz.
  if (raining) BE.post({ t: 'frame', dt: dt, ang: bagAng, w: bagW, sv: scrollV, top: scrollY < innerHeight, reduced: REDUCED, maxB: MAXB,
    calm: (LOW || MOB.matches) && !drag && now - pushT > 600 && now - rainT > 5000 });
  // Sólo se escribe en el DOM lo que cambió: con el cursor quieto y sin scroll, el loop no toca estilos.
  if (!REDUCED) {
    css(dgs[0], 'transform', 'translate3d(' + (-cmx * 12).toFixed(1) + 'px,' + (-cmy * 6).toFixed(1) + 'px,0)');
    css(dgs[1], 'transform', 'translate3d(' + (-cmx * 32).toFixed(1) + 'px,' + (-cmy * 16).toFixed(1) + 'px,0)');
    css(dgs[2], 'transform', 'translate3d(' + (-cmx * 120).toFixed(1) + 'px,' + (-cmy * 60).toFixed(1) + 'px,0)');
  }
  // cámara: travelling de acercamiento; los productos van al centro y crecen
  var e = REDUCED ? 0 : csp * csp * (3 - 2 * csp);
  css(stage, 'transform', MOB.matches ? 'translate3d(0,' + (-e * 10).toFixed(2) + 'svh,0) scale(' + (1 + e * .1).toFixed(4) + ')' : 'translate3d(' + (-e * 9).toFixed(2) + 'vw,' + (-e * 2).toFixed(2) + 'vh,0) scale(' + (1 + e * .14).toFixed(4) + ')');
  css(cupEl, 'transform', 'translate3d(' + (-cmx * 40).toFixed(1) + 'px,' + (-cmy * 40).toFixed(1) + 'px,0) rotate(' + (cmx * 3).toFixed(2) + 'deg)');
  css(bagEl, 'transform', 'translate3d(' + (-cmx * 18).toFixed(1) + 'px,' + (-cmy * 18).toFixed(1) + 'px,0) rotate(' + (cmx * 1.5).toFixed(2) + 'deg)');
  css(wall, 'transform', 'translate3d(' + (cmx * 10).toFixed(1) + 'px,' + (cmy * 8 - e * 20).toFixed(1) + 'px,0) scale(1.04)');
  // la fuente de luz sigue apenas al cursor (la respiración del haz es una animación CSS en el compositor)
  css(beam, 'transform', 'translate3d(' + (cmx * 46).toFixed(0) + 'px,0,0)');
  css(beam, 'opacity', D.beam.toFixed(3));
  // exposición de los productos + cambio de foco cuando sube la carta
  var over = Math.max(0, Math.min(1, (scrollY - roomH) / innerHeight)), ex = D.expo, op = Math.min(1, ex * 3).toFixed(3);
  css(cupEl, 'opacity', op); css(bagEl, 'opacity', op);
  var bright = (.1 + .9 * Math.pow(ex, 1.4)) * (D.dof ? 1 - over * .35 : 1), blur = D.dof ? over * 8 : 0;
  css(stage, 'filter', (bright > .999 ? '' : 'brightness(' + bright.toFixed(3) + ')') + (blur > .05 ? ' blur(' + blur.toFixed(2) + 'px)' : ''));
  css(dim, 'opacity', (over * (D.dof ? .4 : .6)).toFixed(3));
}
function css(el, prop, v) { var k = '_' + prop; if (el[k] !== v) { el[k] = v; el.style[prop] = v; } }
size();
if (window.gsap) gsap.ticker.add(frame); else (function loop() { requestAnimationFrame(loop); frame(); })();
})();
