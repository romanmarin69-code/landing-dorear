/* DOREAR · coreografía (ver MOTION.md)
   Luz primero, contenido después, física al final. Un solo reloj: el ticker de GSAP mueve a Lenis y al estudio. */
(function () {
'use strict';
var root = document.documentElement;
var $ = function (s) { return document.querySelector(s); };
var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
var D = window.Dorear || { expo: 1, spin: 1, ready: Promise.resolve(), rain: function () {} };
var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
var FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
var COARSE = matchMedia('(pointer: coarse)').matches;
var css = getComputedStyle(root), CREAM = css.getPropertyValue('--cream').trim() || '#D5C4AE';

/* ---------- estado del local, en hora de Buenos Aires ---------- */
(function status() {
  var el = $('#status'); if (!el || !window.Intl) return;
  var txt = el.querySelector('span');
  function hm(min) { var h = Math.floor(min / 60), m = min % 60; return h + (m ? ':' + (m < 10 ? '0' : '') + m : '') + ' h'; }
  function hoursOf(d) { return d === 0 || d === 6 ? [510, 1140] : [450, 1200]; } // sáb/dom 8:30–19 · lun–vie 7:30–20
  function tick() {
    var p = {};
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    } catch (_) { return; }
    var d = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), m = (+p.hour % 24) * 60 + (+p.minute);
    if (d < 0) return;
    // sólo se anuncia cuando está abierto; cerrado no se muestra nada (los horarios completos están en el pie)
    var h = hoursOf(d), open = m >= h[0] && m < h[1];
    el.classList.toggle('is-open', open);
    el.hidden = !open;
    if (open) txt.textContent = 'Abierto · hasta las ' + hm(h[1]);
  }
  tick(); setInterval(tick, 60000);
})();

/* ---------- mapa: no captura la rueda ni el arrastre hasta que se lo activa ---------- */
(function mapa() {
  var f = $('#mapFrame'), v = $('#mapVeil'); if (!f || !v) return;
  // fachada: el mapa se pide cuando el pie está a 800 px de entrar en pantalla
  var ifr = f.querySelector('iframe[data-src]');
  function load() { if (ifr && !ifr.src) ifr.src = ifr.getAttribute('data-src'); }
  if (ifr) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { load(); io.disconnect(); } }, { rootMargin: '800px 0px' });
      io.observe(f);
    } else load();
  }
  v.addEventListener('click', function () { load(); f.classList.add('is-live'); if (ifr) ifr.focus(); });
  f.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') f.classList.remove('is-live'); });
})();

var hintT = $('#hintT'), stage = $('#stage');
var HINT = COARSE ? 'Deslizá para girar' : 'Arrastrá para girar';
if (hintT) hintT.textContent = HINT;
if (stage) {
  stage.addEventListener('focus', function () { if (hintT && stage.matches(':focus-visible')) hintT.textContent = 'Usá las flechas para girar'; });
  stage.addEventListener('blur', function () { if (hintT) hintT.textContent = HINT; });
}

if (!window.gsap) { root.classList.remove('js'); D.expo = 1; D.spin = 1; D.beam = 1; D.ready.then(D.rain); return; }
gsap.registerPlugin(ScrollTrigger, CustomEase);
CustomEase.create('gild', '.16,1,.3,1');
CustomEase.create('settle', '.22,.9,.32,1.02');
CustomEase.create('cut', '.76,0,.24,1');
CustomEase.create('lift', '.5,0,.75,0');
var gild = CustomEase.get('gild');

/* ---------- desplazamiento: Lenis sólo con mouse en Windows/Linux ----------
   En Mac el trackpad ya entrega desplazamiento con inercia del sistema; sumarle Lenis lo vuelve pesado
   (el contenido llega tarde respecto del dedo). En táctiles tampoco: el scroll nativo es mejor. */
var lenis = null;
if (FINE && !REDUCED && window.Lenis && !D.mac) {
  lenis = new Lenis({ lerp: .085, wheelMultiplier: .9, smoothWheel: true });
  D.lenis = true;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
  gsap.ticker.lagSmoothing(0);
}
$$('a[href^="#"]').forEach(function (a) {
  a.addEventListener('click', function (e) {
    var id = a.getAttribute('href'), t = id === '#top' ? 0 : $(id);
    if (t === null) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(t, { duration: 1.6, easing: gild });
    else if (t === 0) scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
    else t.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
    if (t) { if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
    history.replaceState(null, '', id);
  });
});

/* ---------- nav: sobre el papel, pasa a tinta con su propia franja ---------- */
var nav = $('#nav');
ScrollTrigger.create({
  trigger: '#carta', start: function () { return 'top ' + nav.offsetHeight; }, end: function () { return 'bottom ' + nav.offsetHeight; },
  toggleClass: { targets: nav, className: 'is-paper' }
});
ScrollTrigger.create({
  trigger: '#visitanos', start: function () { return 'top ' + nav.offsetHeight; }, end: 'max',
  toggleClass: { targets: nav, className: 'is-night' }
});

/* ---------- plano 1–2: fundido desde negro y encendido ---------- */
var lines = $$('.h1 .ln>span, .hero [data-gild]'), ins = $$('.hero [data-in]');
function wait(s) { return new Promise(function (r) { setTimeout(r, s * 1000); }); }
function light() {
  gsap.timeline()
    .to(D, { expo: 1, duration: 2.4, ease: 'gild' }, 0)
    .to(D, { spin: 1, duration: 3.2, ease: 'cut' }, .2)
    .add(function () { D.rain(); }, 1.1);
}
if (REDUCED) {
  gsap.set(lines, { color: CREAM });
  D.beam = 1;
  gsap.to(ins, { opacity: 1, duration: .4, ease: 'none' });
  D.ready.then(function () { gsap.to(D, { expo: 1, duration: .4, ease: 'none' }); D.rain(); });
} else {
  gsap.timeline({ defaults: { ease: 'gild' } })
    .to(D, { beam: 1, duration: 2.4 }, 0)
    .fromTo(lines, { y: '.07em' }, { y: 0, color: CREAM, duration: 1.6, stagger: .11 }, .15)
    .fromTo(ins, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .9, stagger: .1 }, .75);
  // el producto entra segundo: nunca junto con el título, aunque las vistas ya estén en caché
  Promise.all([D.ready, wait(.6)]).then(light);
}
clearTimeout(window.__mfb);   // la apertura quedó armada: ya no hace falta la red de seguridad del <head>

if (REDUCED) { root.classList.add('is-static'); document.fonts && document.fonts.ready.then(function () { ScrollTrigger.refresh(); }); return; }

/* ---------- plano 3: travelling; sale primero lo liviano ---------- */
gsap.timeline({ scrollTrigger: { start: 0, end: function () { return innerHeight * .8; }, scrub: .6 } })
  .to('.hero__foot, .hint', { y: -16, opacity: 0, ease: 'lift', duration: .3 }, 0)
  .to('.hero__copy [data-out]', { y: -28, opacity: 0, ease: 'lift', duration: .35, stagger: -.08 }, .1)
  .to('.h1 .ln', { y: -56, opacity: 0, filter: D.low ? 'none' : 'blur(6px)', ease: 'lift', duration: .45, stagger: .08 }, .32);

/* La carta y el footer están fuera de pantalla al cargar: se preparan cuando el navegador queda libre,
   para no competir con la apertura. Si alguien llega antes, el contenido ya es visible por defecto. */
(window.requestIdleCallback || function (f) { setTimeout(f, 600); })(below, { timeout: 1500 });
function below() {
/* ---------- plano 5: la carta se escribe ---------- */
var h2l = $$('.h2 .ln>span'), sideLead = $('.carta__side .lead');
gsap.set(h2l, { yPercent: 112 });
gsap.set(sideLead, { opacity: 0, y: 16 });
ScrollTrigger.create({
  trigger: '.h2', start: 'top 88%', once: true,
  onEnter: function () {
    gsap.timeline({ defaults: { ease: 'gild' } })
      .to(h2l, { yPercent: 0, duration: 1.15, stagger: .11 })
      .to(sideLead, { opacity: 1, y: 0, duration: .9 }, .4);
  }
});
$$('.grp__t').forEach(function (t) {
  gsap.from(t, { opacity: 0, y: 10, duration: .7, ease: 'gild', scrollTrigger: { trigger: t, start: 'top 92%', once: true } });
});
// cada fila: primero se dibuja su filete, enseguida suben nombre y precio (sólo transform)
var items = $$('.item');
items.forEach(function (i) { var r = document.createElement('i'); r.className = 'rule'; r.setAttribute('aria-hidden', 'true'); i.appendChild(r); i.classList.add('is-ruled'); });
// el filete se dibuja en dorado, como una línea de fuego, y se enfría al tono del papel
var GOLD = css.getPropertyValue('--gold').trim() || '#E0A526', RULE = 'rgba(107,74,34,0.24)';   // = --rule-paper (GSAP interpola rgba clásico)
gsap.set(items.map(function (i) { return i.lastElementChild; }), { backgroundColor: GOLD });
gsap.set(items.map(function (i) { return i.firstElementChild; }), { yPercent: 100 });
ScrollTrigger.batch(items, {
  start: 'top 95%', once: true,
  onEnter: function (b) {
    gsap.to(b.map(function (i) { return i.lastElementChild; }), { scaleX: 1, duration: .9, ease: 'gild', stagger: .055 });
    gsap.to(b.map(function (i) { return i.lastElementChild; }), { backgroundColor: RULE, duration: 1.4, ease: 'cut', stagger: .055, delay: .75 });
    gsap.to(b.map(function (i) { return i.firstElementChild; }), { yPercent: 0, duration: .9, ease: 'settle', stagger: .055, delay: .1 });
  }
});
gsap.from('.carta__note', { opacity: 0, y: 12, duration: .9, ease: 'gild', scrollTrigger: { trigger: '.carta__note', start: 'top 95%', once: true } });

/* ---------- el mapa se abre como un visor: el recorte crece desde el centro, las esquinas encuadran ---------- */
var frame = $('.map__frame');
if (frame) {
  gsap.set(frame, { clipPath: 'inset(14% 10% 14% 10% round 6px)' });
  gsap.set('.map__tick', { opacity: 0, scale: .6 });
  gsap.set('.map__card', { opacity: 0, y: 24 });
  ScrollTrigger.create({ trigger: frame, start: 'top 85%', once: true, onEnter: function () {
    gsap.timeline({ defaults: { ease: 'gild' } })
      .to(frame, { clipPath: 'inset(0% 0% 0% 0% round 6px)', duration: 1.4 })
      .to('.map__tick', { opacity: 1, scale: 1, duration: .7, stagger: .06, ease: 'settle' }, .6)
      .to('.map__card', { opacity: 1, y: 0, duration: .9 }, .45);
  } });
}

/* ---------- plano 6: firma ---------- */
gsap.timeline({ scrollTrigger: { trigger: '.foot', start: 'top 75%', end: 'bottom bottom', scrub: .8 } })
  .fromTo('.foot__word>span>span', { yPercent: 104 }, { yPercent: 0, ease: 'settle', duration: .5, stagger: .06 }, 0)
  .fromTo('.foot__sign', { opacity: 0 }, { opacity: 1, ease: 'none', duration: .2 }, .55);
ScrollTrigger.refresh();
}

if (document.fonts) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });

/* ---------- diagnóstico: ?debug muestra fps y las decisiones tomadas para este equipo ---------- */
if (/(^|&)debug(=|&|$)/.test(location.search.slice(1))) {
  var dbg = document.createElement('div'), fr = [];
  dbg.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:999;padding:8px 10px;background:#000c;color:#E0A526;font:12px/1.5 ui-monospace,Menlo,monospace;white-space:pre;pointer-events:none;border-radius:4px';
  document.body.appendChild(dbg);
  gsap.ticker.add(function (t, dt) { fr.push(dt); if (fr.length > 120) fr.shift(); });
  setInterval(function () {
    var s = fr.slice().sort(function (a, b) { return a - b; }), avg = s.reduce(function (a, b) { return a + b; }, 0) / (s.length || 1);
    dbg.textContent = 'fps ' + Math.round(1000 / avg) + '  peor ' + Math.round(s[s.length - 1] || 0) + ' ms\n' +
      (D.safari ? 'Safari' : 'Chromium/otro') + (D.mac ? ' · Mac' : '') + ' · ' + innerWidth + '×' + innerHeight + ' @' + devicePixelRatio + 'x\n' +
      'lenis ' + !!D.lenis + ' · blur ' + !!D.dof + ' · granos en worker ' + !!D.beansWorker + ' · gama baja ' + !!D.low;
  }, 500);
}
})();
