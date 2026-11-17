# MOTION — Dirección de arte y sistema de movimiento

## 1. Concepto: *Dorear*

**Dorear** es lo que le pasa al pan, a la masa y al grano bajo el calor: pasar de crudo a dorado. La landing cuenta eso con **luz**. Todo empieza a oscuras y la luz va encontrando las cosas: primero el título, después los productos, al final la carta. No hay "animaciones de entrada": hay una **luz que se enciende**.

Referencia de tono: un plano de mesa de producto en un estudio, con una sola luz principal de tungsteno entrando en diagonal. Polvo suspendido en el haz. Lentes largos y movimientos de cámara lentos. Nada rebota y nada brilla de más.

### Guion (el recorrido de scroll como secuencia)

| Plano | Scroll | Qué pasa | Intención |
|---|---|---|---|
| **1. Fundido desde negro** | 0, al cargar | El estudio está a oscuras y el texto ya está ahí, sin luz. El haz entra en diagonal; las líneas del título **se doran** una tras otra (de casi negro a crema) mientras se asientan unos milímetros. | Que lo primero sea un *gesto de luz*, no un spinner. El texto se pinta desde el primer cuadro (LCP inmediato). |
| **2. Encendido** | 0 | Vaso y bolsa pasan de silueta a iluminados (exposición 15 % → 100 %) y empiezan a girar desde parados. Después llueven los granos, que cierran el plano. | El producto es el protagonista: entra segundo, pero entra con peso. |
| **3. Travelling de acercamiento** | 0 → 110 vh | La cámara empuja: los productos van al centro y crecen y el fondo se queda atrás (parallax por capas). El copy **sale en orden inverso a su jerarquía**: primero lo chico (estado, CTA, bajada) y por último el título, con un leve desenfoque. | Anticipación y *follow-through*: lo liviano se va antes y lo pesado lo sigue. |
| **4. Cambio de foco** | 110 → 210 vh | La carta sube como una cortina de papel crema. Detrás, el estudio se desenfoca y se oscurece (*rack focus*) y la atención pasa del producto al papel. | Corte con intención: el mundo oscuro se cierra y se abre el mundo del papel. |
| **5. La carta** | sección | El título se revela por líneas detrás de una máscara. Cada grupo de la carta entra cuando llega al viewport: primero se **dibuja** el filete inferior de cada fila y enseguida suben nombre y precio. | Ritmo de lectura: una fila tras otra, como alguien que escribe la pizarra. |
| **6. Firma** | footer | "DOREAR" se arma letra por letra mientras llegás al final (atado al scroll) y la firma aparece última. | El cierre de los créditos. |

## 2. Curvas propias

No se usan `ease`, `linear` (salvo en movimiento físico continuo, como la deriva del polvo) ni `ease-in-out` por defecto.

| Token | Curva | Uso |
|---|---|---|
| `--ease-gild` / `dorear.gild` | `cubic-bezier(.16, 1, .3, 1)` | Salida exponencial larga. Revelados, luz, todo lo que **llega**. |
| `--ease-settle` / `dorear.settle` | `cubic-bezier(.22, .9, .32, 1.02)` | Llegada con 2 % de sobrepaso: objetos con masa que se asientan (filas de la carta, letras del footer). |
| `--ease-cut` / `dorear.cut` | `cubic-bezier(.76, 0, .24, 1)` | Simétrica y firme. Cortinas, cambios de estado de la nav, telones. |
| `--ease-lift` / `dorear.lift` | `cubic-bezier(.5, 0, .75, 0)` | Aceleración pura. Lo que **se va** (salidas, anticipación). |
| Spring (JS) | `k = 170, c = 26` (crítico ≈ 0,9) | Micro-interacciones con física: flecha del CTA y respuesta del giro al teclado. |

## 3. Duraciones

| Token | ms | Uso |
|---|---|---|
| `--d-micro` | 180 | Color de hover, foco |
| `--d-short` | 420 | Subrayados, flechas, nav |
| `--d-reveal` | 900 | Líneas de texto, filas |
| `--d-scene` | 1600 | Luz, encendido de productos |
| `--d-long` | 2400 | Exposición completa del estudio |

**Stagger:** líneas de título 110 ms · filas de la carta 55 ms · letras del footer: atadas al scroll, 0,06 del tramo.

## 4. Reglas de coreografía

1. **La luz primero, el contenido después y la física al final.** Nunca dos protagonistas entran juntos.
2. **Entra lo pesado y lo liviano acompaña.** El título lidera; bajada y CTA llegan 250–400 ms después y en menos distancia.
3. **Sale primero lo liviano.** En el travelling, los elementos chicos se van antes que el título.
4. **Una sola idea por sección.** Portada: luz. Carta: escritura. Footer: firma. No se repite el mismo efecto en dos secciones.
5. **Siempre desde un estado visible.** Sin JavaScript, todo se ve. Los estados iniciales "a oscuras" sólo existen si JS cargó (clase `.js` en `<html>`).
6. **Solo `transform`, `opacity`, `filter` acotado y `clip-path`.** Nada que dispare layout dentro del loop.
7. **Un solo reloj.** GSAP maneja su ticker, Lenis se engancha a ese ticker y el render de los productos corre en su propio `requestAnimationFrame` leyendo el scroll ya suavizado.

## 5. Principios de cine aplicados

| Principio | Dónde |
|---|---|
| Anticipación | Salida escalonada del copy antes del travelling. La flecha del CTA retrocede 2 px antes de avanzar. |
| Follow-through | El título sale último y con desenfoque. El giro sigue por inercia al soltar el arrastre (ya existía y se mantiene). |
| Profundidad de campo | *Rack focus* hacia la carta: el estudio se desenfoca hasta 8 px mientras sube el papel (sólo en desktop y equipos de gama alta). |
| Parallax por capas | Pared (×0,3), haz (×0,6), productos (×1), polvo cercano (×3), atado al cursor y al scroll. |
| Grano fílmico | Grano animado a 8 fps sobre el estudio y el footer, a 7 % de opacidad. La carta no lleva grano: tiene la textura propia del papel. |
| Movimiento de cámara | Push-in de 14 % con desplazamiento al centro, en vez de un zoom plano. |
| Revelado por máscaras | Título de la carta por líneas; letras del footer. |
| Luz motivada | El haz se mueve con el cursor (la fuente de luz "respira") en vez de oscilar con un keyframe fijo. |

## 6. Herramientas y por qué

| Herramienta | Por qué |
|---|---|
| **GSAP 3.13 core + CustomEase** | Timelines con posiciones relativas (`"<+=.2"`) para la coreografía de apertura y curvas propias con nombre. Es la única forma razonable de orquestar seis elementos con solapamientos precisos sin escribir un motor de timeline a mano. Todos sus plugins son gratis (Webflow). |
| **ScrollTrigger** | Salidas atadas al scroll (`scrub`), revelados por lote en la carta (`batch`) y las letras del footer. Se sincroniza con Lenis. |
| **Lenis 1.1** (sólo con puntero fino) | Desplazamiento con inercia en desktop, que es lo que da la sensación de "cámara". Usa el scroll nativo, así que `position: sticky` y la cortina siguen funcionando. En pantallas táctiles no se carga: el scroll nativo de iOS/Android es mejor que cualquier emulación. |
| **WebGL propio (ya existente)** | Interpolación por flujo óptico entre vistas renderizadas en Cycles. Se mantiene: la calidad de material y luz del render supera lo que una escena Three.js lograría a 60 fps en un celular. |
| **No se usa:** Three.js / R3F, SplitText, ScrollSmoother | Sumarían peso sin mejorar el resultado: el render ya es 3D real, el título ya viene partido en líneas en el HTML, y Lenis cubre el suavizado. |

## 7. Movimiento reducido (`prefers-reduced-motion: reduce`)

No es "apagar todo", es **otra versión** de la secuencia:

- La apertura es un único fundido de 400 ms y el texto ya llega dorado.
- Los productos aparecen quietos en la mejor vista. Arrastrar y usar las flechas sigue funcionando, sin auto-giro.
- Los granos aparecen ya asentados, sin lluvia. No hay polvo ni grano animado (el grano queda estático).
- No hay parallax de cursor ni de scroll, travelling ni *rack focus*. La cortina de la carta sigue subiendo (es scroll del usuario, no animación).
- Los revelados de la carta y del footer pasan a fundidos de opacidad de 300 ms. Hover y foco conservan sus transiciones de color, porque son feedback.
- Sin Lenis.

## 8. Gama baja y mobile

Gama baja = `saveData`, `deviceMemory ≤ 4`, `hardwareConcurrency ≤ 4` o caída sostenida bajo 45 fps.

- Set de vistas `h-sm/` (66 %, −52 % de peso) en pantallas ≤ 820 px o en gama baja.
- Máximo 320 granos (contra 540) y lluvia de 260.
- 24 motas de polvo en lugar de 64. Sin *rack focus* (sólo oscurecimiento).
- El ajuste dinámico existente (`beansLow`) se mantiene como red de seguridad.
