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

### El acento: la chispa (`#E0A526`)

Un solo color de acento, usado como **chispa de luz**: en puntos, flechas, filetes y anillos de foco; nunca en superficies grandes ni en texto corrido (la única superficie dorada es el botón "Cómo llegar").

| Dónde | Por qué |
|---|---|
| Punto final de "todo." | La brasa: arde desde el primer cuadro, antes de que el título se dore. Es lo primero que ve el ojo. |
| Flecha y subrayado del CTA, flecha de la pista de giro, subrayados de enlaces | Lo que se puede tocar lleva chispa. |
| Punto de "Abierto" | Late despacio (2,8 s): el local está encendido. |
| Filetes de la carta | Se dibujan en dorado y se enfrían al tono del papel: una línea de fuego. |
| Segmento sobre títulos de grupo y firma | Marca de inicio, como el corte de una pizarra. |
| Marcas de esquina del mapa, botón "Cómo llegar" | Encuadre de visor; la acción final de la página. |
| Anillo de foco, selección, barra de scroll | Superficies del navegador también llevan la marca. Sobre papel el foco usa `--roast-ink` (contraste ≥ 3:1). |

## 2. Curvas propias

No se usan `ease`, `linear` (salvo en movimiento físico continuo, como la deriva del polvo) ni `ease-in-out` por defecto.

| Token | Curva | Uso |
|---|---|---|
| `--ease-gild` / `dorear.gild` | `cubic-bezier(.16, 1, .3, 1)` | Salida exponencial larga. Revelados, luz, todo lo que **llega**. |
| `--ease-settle` / `dorear.settle` | `cubic-bezier(.22, .9, .32, 1.02)` | Llegada con 2 % de sobrepaso: objetos con masa que se asientan (filas de la carta, letras del footer). |
| `--ease-cut` / `dorear.cut` | `cubic-bezier(.76, 0, .24, 1)` | Simétrica y firme. Cortinas, cambios de estado de la nav, telones. |
| `--ease-lift` / `dorear.lift` | `cubic-bezier(.5, 0, .75, 0)` | Aceleración pura. Lo que **se va** (salidas, anticipación). |
| Física (JS) | impulso + retorno amortiguado `v += (objetivo − v)·min(1, dt·1,4)` | El giro: cada flecha del teclado suma 1,9 rad/s de impulso y el objeto vuelve solo a su velocidad propia; al soltar un arrastre conserva la inercia. |

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
7. **Un solo reloj.** El ticker de GSAP mueve todo: las timelines, Lenis y el loop del estudio (render de productos, física, parallax). Un cuadro, una pasada.
8. **El loop no toca el DOM si nada cambió.** Cada estilo se escribe sólo cuando su valor difiere del anterior; lo que es puramente decorativo y cíclico (respiración del haz, polvo, grano) corre como animación CSS en el compositor.

## 5. Principios de cine aplicados

| Principio | Dónde |
|---|---|
| Anticipación | Salida escalonada del copy antes del travelling. La flecha del CTA retrocede 2 px antes de avanzar (keyframe con `--ease-settle`) mientras su filete se completa. |
| Follow-through | El título sale último y con desenfoque. El giro sigue por inercia al soltar el arrastre (ya existía y se mantiene). |
| Profundidad de campo | *Rack focus* hacia la carta: el estudio se desenfoca hasta 8 px mientras sube el papel (sólo en desktop y equipos de gama alta). |
| Parallax por capas | Desplazamiento máximo con el cursor en el borde de la pantalla: polvo lejano 12 px · pared 10 px · bolsa 18 px · vaso 40 px (más cerca de cámara) · haz 46 px · polvo cercano 120 px. El scroll suma el travelling sobre esto. |
| Grano fílmico | Grano animado a 8 fps sobre el estudio y el footer, a 7 % de opacidad. La carta no lleva grano: tiene la textura propia del papel. |
| Movimiento de cámara | Push-in de 14 % con desplazamiento al centro, en vez de un zoom plano. |
| Revelado por máscaras | Título de la carta por líneas; letras del footer. |
| Luz motivada | La fuente se corre con el cursor (la escena no), y el haz respira lento (9 s, `--ease-cut`, ±18 px y 84–100 % de intensidad). |

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

- El texto llega ya dorado; CTA, estado y pie aparecen con un único fundido de 400 ms.
- Los productos aparecen quietos en su vista inicial. Arrastrar y usar las flechas sigue funcionando, sin auto-giro.
- Los granos aparecen ya asentados, sin lluvia. No hay polvo, el grano queda estático y el haz no respira.
- No hay parallax de cursor ni de scroll, travelling ni *rack focus*. La cortina de la carta sigue subiendo (es scroll del usuario, no animación).
- La carta y el footer se muestran directamente, sin revelados. Hover y foco conservan sus transiciones, porque son feedback.
- Sin Lenis; las anclas saltan sin desplazamiento suave.

## 8. Gama baja y mobile

Gama baja = `saveData`, `deviceMemory ≤ 4`, `hardwareConcurrency ≤ 4` o caída sostenida bajo 45 fps.

- Set de vistas `h-sm/` (66 %, −52 % de peso) en pantallas ≤ 820 px o en gama baja, con canvas a 1,5× de densidad como máximo.
- Atlas de sombras de la bolsa al 50 % (`sh-sm.webp`: de 35 MB a 9 MB en la placa) y atlas de granos al 50 % (`b0/b1-sm.webp`).
- Máximo 320 granos (contra 540), lluvia de 260, física con 2 subpasos por cuadro como máximo.
- Con los granos quietos y sin interacción, se redibujan a 30 Hz.
- 24 motas de polvo en lugar de 64. Sin *rack focus* (sólo oscurecimiento).
- El ajuste dinámico (`beansLow`) sigue como red de seguridad: si el cuadro supera 22 ms durante 3 s, baja la resolución de los granos y apaga el *rack focus*.

## 9. Los granos tienen su propio hilo

La lluvia de granos es el cierre de la apertura y se ve completa en todos los dispositivos. Para que no le cueste fluidez al resto, su física y su dibujo corren en un **Web Worker** con `OffscreenCanvas` (`assets/beans-worker.js` + `assets/beans.js`): el hilo principal sólo le manda, una vez por cuadro, el ángulo y la velocidad de la bolsa, y los empujones del cursor. El scroll, los toques y el render de los productos no compiten con 500 granos chocando entre sí.

En navegadores sin `OffscreenCanvas` el mismo `beans.js` corre en el hilo principal, con idéntico resultado visual.

## 10. Presupuesto de carga

- El texto se pinta desde el primer cuadro, "sin luz" (`--dim-ink`): es el LCP y no depende de JS.
- Las vistas, el flujo óptico, las sombras y los atlas se piden 150 ms después del primer pintado.
- Una sola subida de textura a la GPU por cuadro. La carta y el footer se preparan cuando el navegador está libre (`requestIdleCallback`).
