# Steel Horizon

Demo original de combate blindado en tercera persona hecha con Three.js, TypeScript y Vite. El terreno, los vehículos y los elementos del entorno se generan con geometría y materiales procedurales; el juego no descarga modelos, imágenes, fuentes ni sonidos externos.

## Requisitos

- Node.js 20.19+ o 22.12+
- npm

## Instalar y ejecutar

```bash
npm install
npm run dev
```

Abre la URL local que imprime Vite (normalmente `http://localhost:5173`). Para generar y revisar la versión de producción:

```bash
npm run build
npm run preview
```

## Controles

| Tecla / ratón | Acción |
| --- | --- |
| W / S | Avanzar / retroceder |
| A / D | Girar el casco |
| Ratón | Apuntar la torreta y elevar el cañón |
| Clic izquierdo | Disparar |
| Clic derecho | Zoom de puntería |
| R | Recargar el cargador de cinco proyectiles |
| C | Alternar cámara de persecución y táctica |
| Escape | Pausar / reanudar y liberar / capturar el ratón |

Al iniciar, el navegador solicita la captura del ratón. Si no la permite, haz clic en el campo de batalla para volver a intentarlo.

## Qué incluye

- Menú en español con inicio, controles, calidad gráfica baja/media/alta y volumen.
- Arena de 340 × 340 unidades con relieve, caminos, colinas, edificios, rocas, pinos y barricadas que bloquean vehículos y proyectiles.
- Tanque Bison controlable con casco, torreta, cañón, orugas y ruedas animadas. La aceleración, la inercia, las pendientes y el giro transmiten masa.
- Cinco blindados de IA que se acercan, flanquean, mantienen distancia, buscan una línea de tiro y respetan recarga y precisión.
- Proyectiles balísticos con gravedad y colisiones, daños por partes, rebotes, puntos de vida, cargador recargable, destrucción, victoria y derrota.
- Explosiones animadas con destello, fuego, partículas, humo, escombros, onda expansiva, luz temporal, marca en el suelo y vibración de cámara.
- Trazadoras, fogonazo, polvo, impactos, sonidos sintetizados, minimapa táctico, brújula, vida, velocidad, contactos, avisos y reintento.
- Resolución y sombras ajustables. El ciclo de simulación se suspende cuando la pestaña pierde visibilidad.

## Estructura

- `src/main.ts`: arranque y limpieza del juego.
- `src/game.ts`: ciclo principal, cámara, estados de menú/pausa/resultado y controles.
- `src/world.ts`: luces, terreno procedural, caminos, obstáculos y colisiones.
- `src/vehicle.ts`: modelo geométrico del blindado y animación de piezas.
- `src/controls.ts`: teclado, ratón y captura del puntero.
- `src/ai.ts`: navegación, maniobras, apuntado y disparo de la IA.
- `src/combat.ts`: proyectiles, colisiones, daño, rebotes y destrucciones.
- `src/effects.ts`: partículas, explosiones, polvo y sacudida.
- `src/audio.ts`: motor y efectos de combate sintetizados con Web Audio.
- `src/ui.ts` / `src/style.css`: interfaz, menú y estilos.
- `src/settings.ts`: calidad gráfica y preferencias locales.

## Licencias y recursos

El nombre, la interfaz, los vehículos y el contenido procedural de esta demo son originales. No se utilizan recursos de terceros ni materiales de War Thunder. Three.js se distribuye bajo la licencia MIT; sus avisos de licencia permanecen en `node_modules/three` al instalar dependencias.
