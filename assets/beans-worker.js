/* DOREAR · granos en un hilo propio: la física y el dibujo no compiten con el scroll ni con los toques. */
importScripts('beans.js');
var B = null;
onmessage = function (e) {
  var m = e.data;
  if (m.t === 'init') {
    B = DorearBeans({ back: m.back, front: m.front, cell: m.cell, maxB: m.maxB, maxSub: m.maxSub, canvas: function (w, h) { return new OffscreenCanvas(w, h); } });
  } else if (m.t === 'load') {
    // los atlas se piden recién cuando el hilo principal avisa que el texto ya se pintó
    Promise.all(m.atlas.map(function (u) { return fetch(u).then(function (r) { return r.blob(); }).then(function (b) { return createImageBitmap(b); }); }))
      .then(function (a) { B.atlas(a); postMessage({ t: 'atlas' }); }, function () { postMessage({ t: 'atlas' }); });
  } else if (B && B[m.t]) B[m.t](m);
};
