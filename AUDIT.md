# AUDIT — Landing DOREAR

Rama: `landing-cinematic-review` · Base: `b9bb29a` · Fecha: 2026-11-17
Alcance: `index.html` (561 líneas, HTML + CSS + JS inline, sin build) + 226 assets `.webp` (13,2 MB).

---

## 0. Reconocimiento

### Stack real
| Pieza | Qué es |
|---|---|
| Estructura | Un único `index.html`, vanilla JS en IIFE, sin dependencias, sin bundler. Viene envuelto en un *wrapper* de exportación de artifact (`<meta name="claude:viewport-fit-sides">`, `<title>` dentro de `<body>`, un `<style>` base que se pisa con otro). |
| "3D" | **No hay escena 3D en tiempo real.** Vaso (96 vistas) y bolsa (123 vistas) son giros 360° pre-renderizados en Blender (1000×1250). Un shader WebGL interpola entre vistas vecinas con **flujo óptico precalculado** (`flow.webp`) y mezcla sombras (`sh.webp`). Fallback 2D por crossfade. |
| Granos | Física propia (gravedad, colisión grano–grano con grilla espacial, colisión con la base giratoria de la bolsa, sueño/despertar) a 120 Hz; dibujados con dos atlas de sprites (24 giros × 16 vuelcos) proyectados con la cámara exacta del render. |
| Atmósfera | Capas CSS: pared (radial), haz de luz animado, palabra "DOREAR" fantasma, piso, 64 motas de polvo en 3 profundidades, viñeta. Parallax por cursor y scroll en un único `requestAnimationFrame`. |
| Carta | Datos en JS → `innerHTML`. Se superpone a la portada como "cortina" crema (portada `position:sticky`). |
| Tipografía | Cormorant Garamond (titulares), Montserrat (todo lo demás, en mayúsculas tracking .14em), Pinyon Script (máquina de escribir + firma). Google Fonts, bloqueante. |

### Herramientas que uso en esta revisión
| Herramienta | Para qué |
|---|---|
| Skill `impeccable` (audit → luego animate / typeset / layout / polish) | Marco de auditoría, detector automático de anti-patrones, piso de calidad antes de editar UI. |
| Skill `frontend-design` | Dirección de arte y criterios anti-"plantilla" en Fase 2. |
| Skills `gsap-core`, `gsap-timeline`, `gsap-scrolltrigger`, `gsap-plugins` (SplitText, CustomEase), `gsap-performance` | Sistema de motion, coreografía y scroll en Fase 2–3. |
| Skills `threejs-*` (postprocessing, shaders, performance) | Criterios para el compositing del render (grano, grading, DOF) y para decidir si conviene pasar a 3D en tiempo real (conclusión: no, ver §3). |
| Skill `ui-ux-pro-max` | Chequeo cruzado de accesibilidad, tipografía y responsive. |
| Skill `superpowers:verification-before-completion` / `requesting-code-review` | Fase 4: evidencia antes de afirmar, revisión de código final. |
| MCP `blender` | Disponible. Sirve sólo si existen los `.blend` originales (re-render de secuencias a menor resolución / con más luz). Ver decisiones pendientes. |
| `playwright-core` + Chrome del sistema | Capturas antes/después en 1440 / 768 / 390, consola, red, timing de frames durante scroll. |
| `lighthouse` 12 | Métricas antes/después (mobile y desktop). |
| No aplican | Remotion (video), Together AI, data/*, Claude API, docs/pptx/xlsx. |

### Métricas "antes" (servidor local, sin compresión)
| | Mobile (Lighthouse) | Desktop (Lighthouse) |
|---|---|---|
| Performance | **40** | **74** |
| Accessibility | 95 | 95 |
| Best Practices | 93 | 96 |
| SEO | 90 | 90 |
| FCP / LCP | 3,5 s / **15,4 s** | 1,0 s / 2,8 s |
| TBT | **1.700 ms** | 20 ms |
| CLS | 0 | 0,001 |
| Peso total | **12,98 MB** (231 requests) | 12,98 MB |
| Main-thread | 36,4 s | 9,5 s |

Medición propia (Playwright, Chrome headless con GPU): portada visible tras el preloader a los **7,5 s (mobile/tablet) y 12 s (desktop)**; durante un scroll completo, frame medio **20–22 ms (~45–48 fps)**, p95 34 ms, **20–24 % de frames > 33 ms**. Consola: 404 de `favicon.ico`.

Capturas: `scratchpad/shots/before/{desktop,tablet,mobile}-{01-hero … 06-footer}.png`.

---

## 1. Puntaje (impeccable audit)

| # | Dimensión | Puntaje | Hallazgo clave |
|---|---|---|---|
| 1 | Accesibilidad | 2/4 | Texto funcional de 9,5–11 px en mayúsculas en toda la página (Lighthouse: 42 % de texto legible en mobile); sin `lang`; la interacción principal (girar) no tiene alternativa de teclado; `prefers-reduced-motion` deja vivos parallax, máquina de escribir y carrusel de precios. |
| 2 | Performance | 1/4 | Preloader que exige descargar y subir a GPU **las 219 vistas (12 MB)** antes de mostrar nada: LCP 15 s en mobile. |
| 3 | Tokens / theming | 2/4 | Hay 6 tokens de color, pero conviven ~25 hex sueltos con alfa (`#a8846259`, `#d5c4ae1f`…), dos gutters distintos y ninguna escala de tipo ni de espaciado. |
| 4 | Responsive | 2/4 | Mobile sin navegación (sólo el logo); tablet usa el layout mobile y queda medio vacía; gutter de 16 px en carta/footer contra 3 vw en portada. |
| 5 | Integridad de implementación | 2/4 | Técnica de render excelente, pero envuelta en código muerto, wrapper de exportación, copy repetido y animaciones de texto que se disparan fuera de pantalla. |
| **Total** | | **9/20** | **Pobre → requiere una pasada profunda**, no un rediseño: la base visual tiene identidad. |

### Veredicto de integridad: **PASA con reservas**
La portada expresa un sistema propio (estudio oscuro, kraft, haz de luz, granos con física real); no es intercambiable con otro producto. Lo que la baja es todo lo que la rodea: copy duplicado, chips genéricos, carta sin coreografía, una tipografía funcional ilegible y un pipeline de carga que hace esperar 8–15 s.

Detector automático: 13 hallazgos — `undersized-ui-text` ×7 (verificados), `gradient-text` ×2 (verificado: palabra del footer), `hero-eyebrow-chip` ×1 (verificado), `overused-font` (Montserrat), `radial-halo` (motas; **falso positivo**: es polvo en suspensión con intención), `low-contrast` ×1 (la palabra fantasma; **falso positivo**: decorativa y `aria-hidden`).

---

## 2. Hallazgos por severidad

Severidad: **Crítico** (rompe la experiencia o un estándar) · **Alto** (se nota y baja el nivel) · **Medio** · **Bajo**.

### CRÍTICO

**C1. El preloader bloquea hasta descargar 12 MB.** — Performance
`frame()` línea 510: `begin()` sólo corre cuando `cup.ready() && bag.ready()` (las 219 vistas + flujo + sombras + atlas) o a los 30 s. LCP mobile 15,4 s; un visitante en 4G ve un "Preparando · 37 %" durante 10–20 s. Ningún sitio premiado hace esperar así sin dar nada a cambio.
→ Mostrar la portada con la **primera vista** de cada objeto (~60 KB) y streamear el resto mientras el giro arranca lento; el shader ya sabe usar la vista más cercana cargada (`near()`). Preloader breve (≤ 1,2 s) como gesto de marca, no como barra de progreso.

**C2. Mobile descarga resolución de desktop y luego la reduce.** — Performance
Líneas 290–291: en ≤ 820 px cada vista 1000×1250 se baja a 66 % en un canvas **después** de descargarla y decodificarla. Se pagan los 12 MB y además 219 `drawImage` en el hilo principal (TBT 1,7 s).
→ Generar un set `h-sm/` a ~560 px de ancho (≈ 35 % del peso) y elegirlo por viewport/`deviceMemory`/`saveData`.

**C3. El gutter cambia entre secciones.** — Diseño visual
Portada y nav: `max(3vw,16px)` (43 px a 1440). Carta y footer: `.gut` = 16 px. En desktop el título "Café de especialidad" queda pegado al borde, desalineado del logo y del H1 de la portada. Es lo primero que delata un sitio armado por partes.
→ Un único token `--gutter` y una grilla de 12 columnas compartida.

**C4. El texto funcional es ilegible.** — Accesibilidad / Tipografía
`body` = Montserrat 11 px, MAYÚSCULAS, tracking .14em. Párrafos completos ("Este ratito es tuyo. Elegí algo rico para acompañarlo.", la nota de alergias) van en mayúsculas de 9,5–11 px. Lighthouse mobile: 42 % de texto legible. Contraste del `--c1` sobre la crema inferior: **4,20:1** (falla AA a ese tamaño).
→ Escala tipográfica real; mayúsculas tracked sólo para micro-rótulos ≥ 11 px; párrafos en caja normal ≥ 15 px; `--c1` oscurecido a ≥ 4,5:1 sobre ambos extremos del degradé.

### ALTO

**A1. Los productos "flotan" sobre un piso donde los granos están apoyados.** — 3D / dirección de arte
Líneas 541–543: vaso y bolsa oscilan ±5–7 px en Y (`sin(T)`), pero las sombras de contacto y los granos de alrededor están quietos en el piso. Rompe la física que el resto de la escena construye con tanto cuidado. → Eliminar el bob; la vida la dan el giro, la luz y el polvo.

**A2. Ningún tratamiento de "cámara" sobre el render.** — 3D
El render es limpio pero plano: sin grano fílmico, sin grading unificado entre CSS y render, sin profundidad de campo cuando la cámara "se acerca" al hacer scroll (sólo `scale(1.1)`), sin respuesta de la luz al cursor. → Pasada de compositing (grano animado sutil, viñeta+grade unificados, DOF/ blur del fondo ligado al scroll, *light wrap* del haz sobre los objetos).

**A3. Coreografía de entrada: todo a la vez, nada con intención.** — Animación
Al terminar el preloader: el preloader se desvanece (`.8s`, ease por defecto), los canvas aparecen (`.9s`, ease por defecto), el H1 sube por líneas (`1.1s`, una sola curva) y llueven 500 granos. No hay orden (¿qué entra primero, qué acompaña, qué cierra?), y eyebrow, párrafo, CTA, pie y chip aparecen sin animación.

**A4. Las máscaras del título de la carta se animan al cargar, fuera de pantalla.** — Animación (bug)
`body.go .ln>span` dispara también el `h2` de la carta (línea 70) en el mismo instante que el H1. Cuando el visitante llega, el revelado ya ocurrió. La carta (la sección que vende) entra sin ninguna coreografía.

**A5. Copy repetido hasta vaciarlo de sentido.** — Tono / contenido
- "Este ratito es tuyo": máquina de escribir **+** párrafo debajo **+** impreso en la bolsa.
- "Tu pausa, con dedicación": máquina de escribir **+** subtítulo de la carta; "dedicación" aparece 3 veces.
- Horarios: **3 veces** (pie de portada, lateral de carta, footer). Dirección: 2.
- "DOREAR": preloader, nav, palabra fantasma, bolsa, footer gigante (5).
→ Cada idea una sola vez, en el lugar donde rinde más.

**A6. Elementos genéricos de plantilla.** — Diseño visual
- Máquina de escribir en script (`#tw`): cliché de landing; además deja un hueco vacío intermitente bajo el H1 (visible en la captura mobile).
- Chip de precio rotativo arriba a la derecha (`#tag`): lenguaje de e-commerce; compite con el logo y cambia cada 3,2 s sin que nadie lo pida.
- Eyebrow tracked sobre el H1 (detector: `hero-eyebrow-chip`).
- Texto con degradé en "DOREAR" del footer (detector: `gradient-text`), además no ocupa el ancho (el tracking final deja ~200 px vacíos a la derecha en 1440).

**A7. Mobile no tiene navegación; tablet hereda el layout mobile.** — Responsive
≤ 820 px se ocultan "Carta / Ubicación / Horarios" sin reemplazo. A 768 px la portada queda con el texto arriba a la izquierda, los productos chicos abajo y un cuarto superior derecho vacío; la palabra fantasma se corta en "REAR".

**A8. `prefers-reduced-motion` incompleto.** — Accesibilidad
Con reducción activa siguen moviéndose: parallax por cursor y por scroll (`stage`, `wall`, `ghost`, objetos), máquina de escribir (cada 3 s), chip de precios (cada 3,2 s). El `*{transition:none}` global mata también feedback útil (hover/foco).

**A9. La interacción principal no existe para teclado ni lectores.** — Accesibilidad
`#stage` es `role=img` con "Arrastrá para girarlos", pero no es enfocable ni responde a flechas. El "Arrastrá para girar" se muestra igual en desktop con mouse que en trackpad, y en mobile no hay ninguna pista.

### MEDIO

**M1. Carta = lista plana de `div`.** Sin `ul`/`dl`, sin agrupación visible entre "Café", "Adicionales" e "Infusiones" (los rótulos de grupo son de 10 px). 14 ítems en una columna con el mismo peso; la lista no tiene ritmo ni jerarquía. Los puntos guía (`--c2` sobre crema) tienen 1,8:1 — correctos como decoración, pero hacen ruido.

**M2. Hover de ítems genérico:** `translateX(8px)` con `ease` por defecto en 14 filas. Sin intención.

**M3. Banda de la nav sobre la crema** (`nav.on-menu`): un degradé crema→transparente que se lee como mancha sobre la carta (captura desktop-04 y -06).

**M4. Escala tipográfica inexistente:** 22 tamaños distintos (9,5 / 10 / 11 / 13 / 18 / 21 / 22 / 23–31 / 26 / 46–98 / 52–128 / 64–260 …) sin relación entre sí.

**M5. Colores sueltos fuera de sistema:** ~25 hex con alfa inline; `#7a5428`, `#4a3118`, `#24180b`, `#e4d7c4`, `#cdb99f`, `#140d06`, `#120c06` no son tokens.

**M6. Animaciones CSS que nunca se detienen:** 64 motas × 2 animaciones infinitas + haz de luz siguen corriendo con la portada fuera de vista (se compone igual). El loop JS sí corta, el CSS no.

**M7. `pointermove` global hace `getBoundingClientRect` por evento** (`hit()` ×2 + `floorAt`), lectura de layout en cada movimiento.

**M8. Fuentes bloqueantes sin `preconnect`;** Pinyon Script se descarga para dos usos decorativos.

**M9. Contenido: el eyebrow dice "Pastelería de autor" pero la carta no tiene pastelería.** (Requiere decisión tuya, ver §4.)

### BAJO

**B1. Código muerto:** estilos `nav .ig*` (botón de Instagram que no existe; `.r` vacío), `#load` (nunca se actualiza), `o.flow`, `o.lag`, `o.hiCount`, `if(!shTex){}`, `MOBI` y `MOB` (misma media query dos veces), `will-change` duplicado en `#beam`, perfiles `PROF`/`perf` y `window.__dorear` expuestos en producción, `preserveDrawingBuffer` de test.

**B2. Wrapper de exportación:** `<html>` sin `lang`, `<title>` dentro de `<body>`, `meta claude:viewport-fit-sides`, un `<style>` base (`color-scheme:light`, `font:14px -apple-system`) que el segundo pisa. Sin `meta description`, sin Open Graph, sin favicon (404 en consola).

**B3. "Ubicación" y "Horarios" apuntan al mismo ancla** (`#contacto`).

**B4. `@dorearcafe.ar` en el pie de la portada es texto, no enlace.**

---

## 3. Lo que funciona y se conserva

- **El pipeline de render + flujo óptico es de primer nivel.** Gira sin *ghosting*, el texto de la bolsa no se duplica, sombras exactas. Pasarlo a Three.js en tiempo real **empeoraría** la calidad (materiales kraft y arrugas horneadas en Cycles no se igualan en WebGL a 60 fps en mobile). Se mantiene y se le suma compositing.
- La física de granos (colisión con la base giratoria, oclusión delante/detrás de la bolsa con la cámara real) es exactamente el tipo de detalle que separa un sitio premiado de uno correcto.
- La metáfora "estudio oscuro → la carta sube como cortina crema" es buena dramaturgia. Se refuerza, no se reemplaza.
- Paleta de marca (kraft, café, crema) coherente con los productos. Cormorant como voz editorial funciona.
- CLS ≈ 0, sin overflow horizontal en ningún viewport, foco visible definido.

---

## 4. Decisiones que necesito de vos

1. **Pastelería.** El eyebrow promete "Pastelería de autor" pero la carta sólo tiene café. ¿Hay carta de pastelería para sumar (nombres + precios), o saco la mención?
2. **`.blend` originales.** Si los tenés, con el MCP de Blender puedo re-renderizar un set mobile nativo y una pasada de luz más dramática (rim light, DOF real). Si no, genero el set mobile reescalando los `.webp` existentes (calidad suficiente para 390 px).
3. **"Agustina Ramirez" en el footer** como firma: ¿es la pastelera/fundadora y se quiere destacar ("Pastelería de Agustina Ramirez"), o queda como firma discreta?
4. **Dominio final** (para `canonical`, Open Graph e imagen de preview).

---

## 5. Plan de acción priorizado

Cada bloque = un commit (o pocos) en `landing-cinematic-review`.

| # | Bloque | Resuelve | Skills |
|---|---|---|---|
| 1 | **Higiene:** quitar wrapper de exportación, `lang`, `<head>` real, meta/OG/favicon, `preconnect`, código muerto. | B1–B4, parte de M8 | impeccable harden |
| 2 | **Carga progresiva:** portada visible con la 1.ª vista de cada objeto, streaming del resto, set `h-sm/` para mobile, preloader de marca ≤ 1,2 s. | C1, C2 | impeccable optimize, gsap-performance |
| 3 | **Sistema de diseño:** tokens de color (corrigiendo `--c1`), escala tipográfica modular, escala de espaciado, gutter y grilla únicos, radios/sombras. | C3, C4, M4, M5 | impeccable typeset + layout |
| 4 | **Edición de contenido (distill):** fuera máquina de escribir, chip de precio, eyebrow-chip, texto con degradé; cada dato una sola vez; carta semántica y agrupada. | A5, A6, M1, M9 | impeccable distill + clarify |
| 5 | **MOTION.md + sistema de motion** (GSAP + CustomEase + SplitText + ScrollTrigger; Lenis sólo en desktop): entrada coreografiada, revelados por línea al entrar en viewport, transición portada→carta, micro-interacciones con spring. | A3, A4, M2 | gsap-*, impeccable animate |
| 6 | **Compositing 3D:** sin bob, grano fílmico, grade unificado, DOF ligado al scroll, light-wrap, cámara que "empuja" con intención. | A1, A2 | threejs-postprocessing/shaders |
| 7 | **Responsive:** nav mobile, composición específica para tablet, footer que llena el ancho. | A7, M3 | impeccable adapt |
| 8 | **Accesibilidad de interacción y motion:** girar con teclado, pista según puntero, versión reducida intencional, pausa de CSS fuera de vista, pointermove sin layout reads. | A8, A9, M6, M7 | impeccable audit |
| 9 | **Verificación:** capturas después, recorrido de scroll medido, Lighthouse ≥ 90 ×4, consola limpia, pasada de director creativo. | — | verification-before-completion, code-review |

---

## 6. Resultado (después)

Medido el 2026-11-17 en el mismo equipo (Intel HD 520), con los dos sitios servidos igual (gzip + caché larga), Chrome con GPU.

### Métricas
| | Antes | Después |
|---|---|---|
| Lighthouse mobile — Perf / A11y / BP / SEO | 42 / 95 / 93 / 90 | **68–70 / 100 / 100 / 100** |
| Lighthouse desktop — Perf / A11y / BP / SEO | 88 / 95 / 96 / 90 | **98 / 100 / 100 / 100** |
| LCP mobile (simulado por Lighthouse) | 14,0 s | **2,9 s** |
| LCP real observado | 1,5 s (era el preloader) | **1,1 s** (el título) |
| TBT mobile (simulado) | 3.830 ms | **990–1.110 ms** |
| TBT desktop | 240 ms | **10–30 ms** |
| Productos visibles (desktop / tablet / mobile) | 6,2 / 6,1 / 5,7 s | **1,9 / 1,4 / 1,1 s** |
| Recorrido completo de scroll, ms por cuadro (media / p95) | 23–26 / 34–50 | **16,8–17,9 / 17,4 (60 fps)** |
| Cuadros > 33 ms en el recorrido | 46–57 de ~186 | **3–12 de ~240** |
| Peso total (mobile) | 12,96 MB | 6,5 MB |
| Memoria de GPU de la bolsa en mobile (atlas de sombras) | 35 MB | 9 MB |
| CLS | 0–0,001 | 0–0,005 |
| Errores de consola | 1 (favicon 404) | 0 |

**Mobile queda en 68–70 en Lighthouse, con la apertura completa.** Se decidió no recortar la lluvia de granos (es el toque premium) y, en cambio, moverla a un hilo propio (Web Worker + OffscreenCanvas): el TBT simulado bajó de 3,1 s a ~1 s. Lo que resta es la simulación de Lighthouse sobre una apertura animada (Speed Index y TBT de la propia coreografía); los números reales son LCP 0,5–1,1 s y scroll a 60 fps.

### Hallazgos resueltos
| ID | Cómo |
|---|---|
| C1 | Sin preloader. El texto se pinta en el primer cuadro; las vistas se descargan después y el giro arranca con las primeras. |
| C2 | Set `h-sm/` nativo (66 %), atlas de sombras y de granos al 50 %, canvas a 1,5× como máximo. |
| C3 | Token `--gutter` y grilla de 12 columnas compartida por nav, portada, carta y footer. |
| C4 | Escala tipográfica (12 → 116 px); párrafos en Cormorant ≥ 18 px en caja normal; mayúsculas sólo en rótulos de 12 px; `--roast-ink` 5,2:1 sobre papel. |
| A1 | Sin flotación: vaso y bolsa apoyados en el piso. |
| A2 | Grano fílmico, *rack focus* + oscurecimiento al subir la carta, luz que sigue al cursor y respira, encendido de los productos desde silueta. |
| A3 | Coreografía en MOTION.md: luz → título → bajada → producto → granos. |
| A4 | Revelados de la carta atados a ScrollTrigger (al entrar en pantalla). |
| A5 | Cada dato una vez: horarios completos sólo en el footer; en portada, estado en vivo (abierto/cerrado). |
| A6 | Ver eliminaciones. |
| A7 | Nav mobile (Carta · Visitanos); tablet con título y productos más grandes. |
| A8 | Versión reducida intencional (MOTION.md §7). |
| A9 | El visor es enfocable, gira con ← →, la pista cambia a "Usá las flechas para girar" y se muestra un recuadro de foco. |
| M1 | Carta semántica (`section` + `h3` + `ul`), agrupada en Clásicos / De la casa / Infusiones / Adicionales. |
| M3 | La nav sobre el papel tiene su propia franja sólida, que entra con un corte. |
| M4–M5 | Tokens de color, tipo, espacio, forma y motion en `:root`. |
| M6 | Polvo, grano y haz se pausan con la portada fuera de vista. |
| M7 | El `pointermove` sólo guarda coordenadas; rectángulos cacheados. |
| M8 | Fuentes locales con `preload`; Pinyon Script sólo para la firma. |
| B1–B4 | Código muerto fuera; `<head>` real con `lang`, descripción, Open Graph, JSON-LD y favicon; anclas únicas; dirección y @ enlazados. |

### Eliminado y por qué
| Qué | Por qué |
|---|---|
| Preloader con barra de % | Hacía esperar 6–15 s mirando un número. La apertura ahora es la luz. |
| Máquina de escribir en script | Cliché de plantilla; repetía la bajada y dejaba un hueco intermitente bajo el título. |
| Chip de precio rotativo | Lenguaje de e-commerce que competía con el logo y cambiaba sin que nadie lo pidiera. |
| Palabra "DOREAR" fantasma detrás de los productos | Quinta repetición de la marca; en tablet se cortaba en "REAR". |
| Eyebrow sobre el título | Patrón genérico. La descripción pasó a la bajada, donde se lee como frase. |
| Degradé en el "DOREAR" del footer | Texto con degradé es decoración sin significado. Ahora es kraft sólido y ocupa todo el ancho. |
| Flotación de vaso y bolsa | Contradecía la física de la escena. |
| Desplazamiento de las filas de la carta al pasar el mouse | Sugería algo clickeable que no lo es. |
| Horarios en el lateral de la carta y en el pie de la portada | Tercera y segunda repetición. |
| "Hecho con dedicación" en el footer | Tercera aparición de "dedicación". |
| Link "Horarios" de la nav | Apuntaba al mismo lugar que "Ubicación"; quedó un solo "Visitanos". |
| Estilos del botón de Instagram, barra `#load`, perfiles de rendimiento, `window.__dorear`, contador de fps | Código muerto o de depuración. |

### Falsos positivos del detector (verificados)
`radial-halo` (polvo en suspensión, intencional) · `overused-font` Montserrat (es la tipografía impresa en el packaging renderizado; se mantiene por coherencia de marca y sólo para rótulos) · `low-contrast` en la firma y la palabra del footer (texto grande, ≥ 3:1) · `cramped-padding` en la portada (es full-bleed a propósito) · `flat-type-hierarchy` (lee el `h2` oculto para lectores de pantalla).

### Decisiones pendientes
1. **Pastelería**: la bajada dice "Pastelería de autor" y la carta sólo tiene café.
2. **"Adicionales: consultar"** convive con adicionales que sí tienen precio: ¿se aclara o se saca?
3. **Feriados**: el estado abierto/cerrado sólo conoce el horario semanal.
4. **Imagen para compartir (Open Graph) y dominio**: hace falta una imagen 1200×630 y la URL final para `og:image` y `canonical`.
5. **Archivos `.blend`**: con ellos se puede re-renderizar con más contraste de luz (rim light) y generar una versión del giro para mobile nativa.
