# Agente de Desarrollo — Clipper Alofoke a Facebook

Especificación para Codex (o cualquier agente de codificación). Léela completa antes de escribir una sola línea.

## 1. Contexto del proyecto

- **Qué es:** una herramienta local y personal que graba el live 24/7 de "La Casa de Alofoke 3", detecta los momentos con más potencial, los califica, permite editarlos (cortar, subtítulos, stickers, audio) y ayuda a publicarlos en Facebook para monetizar la página del usuario.
- **Quién la usa:** una sola persona (el dueño), en su propia laptop. No es multiusuario, no es un SaaS, no se despliega en la nube.
- **Marco legal/de contenido:** Alofoke Media Group autorizó a cliperos a compartir y monetizar fragmentos de "La Casa de Alofoke 3" en Facebook, Instagram, TikTok y X — **YouTube queda excluido** de esa autorización (la distribución en YouTube es exclusiva del canal oficial). Esta herramienta es solo para capturar la fuente y preparar clips destinados a Facebook.

## 2. Restricciones no negociables

1. **Todo gratis / open source.** Ninguna fase puede depender de un servicio de pago, API con costo, o librería con licencia comercial. Si existe una alternativa gratuita local, se usa esa.
2. **Hardware real del usuario:** CPU Intel i7-7500U (2 núcleos / 4 hilos, sin GPU dedicada), 16 GB RAM, SSD de 128 GB (unidad C:) y HDD de 1 TB (unidad D:), Windows 10. Todo el diseño debe asumir este hardware modesto:
   - Nada de modelos de IA "medium"/"large" corriendo en tiempo real.
   - El video crudo (pesado) se guarda siempre en D:, nunca en C:.
   - Evitar que captura + transcripción + scoring corran simultáneamente a máxima carga.
3. **Desarrollo por fases.** El agente NO debe adelantarse a construir la fase N+1 sin que la fase N esté completa, funcional y explicada. Al terminar cada fase: resumir qué se construyó, qué decisiones se tomaron y qué hace falta probar antes de seguir.
4. **Explicar, no solo volcar código.** Cada fase debe incluir una explicación breve del propósito de los archivos nuevos, no solo el código. El usuario está aprendiendo el proceso, no solo busca un producto terminado.
5. **Manejo de errores básico y logs.** Todo proceso de larga duración (captura, transcripción) debe loggear a archivo además de consola, y recuperarse de errores de red sin caerse por completo.

## 3. Stack tecnológico (fijo, no cambiar sin razón)

| Capa | Herramienta | Notas |
| --- | --- | --- |
| Backend | Node.js (LTS) + Express | Stack que el usuario ya domina |
| Base de datos | MongoDB Community Server (local) + Mongoose | También ya conocido |
| Captura de stream | `yt-dlp` (binario externo) | Invocado vía `child_process` |
| Procesamiento de video/audio | `ffmpeg` (binario externo) | Corte, overlays, subtítulos, detección de escenas/silencios |
| Transcripción | `whisper.cpp` con modelo **tiny** o **base** | Nunca medium/large en este hardware |
| Scheduling | `node-cron` o comparación manual de `Date` | Para horas calientes y ciclo del loop principal |
| Frontend (dashboard local) | HTML/CSS/JS simple servido por Express, o React ligero | Solo para revisar/aprobar clips y editar |
| Publicación | Facebook Graph API (Pages) | Solo en la fase final, cuenta de desarrollador gratuita |

## 4. Estructura de carpetas propuesta

```
clipper-alofoke/
├── config/
│   ├── horas-calientes.json
│   └── estado-bot.json
├── src/
│   ├── captura/
│   ├── transcripcion/
│   ├── deteccion/
│   ├── scoring/
│   ├── editor/
│   ├── publicacion/
│   ├── models/          (schemas de Mongoose)
│   ├── dashboard/       (rutas + vistas del panel local)
│   └── server.js
├── storage/             (symlink o ruta configurable hacia D:)
├── logs/
├── .env
├── package.json
└── README.md
```

## 5. Modelos de datos (Mongoose)

**Clip**

```js
{
  bloqueOrigen: String,       // nombre del archivo de bloque crudo
  inicio: Number,             // segundos dentro del bloque
  fin: Number,
  transcripcion: String,
  score: Number,
  horaCaliente: Boolean,
  estado: String,             // 'pendiente' | 'aprobado' | 'descartado' | 'publicado'
  rutaArchivo: String,        // una vez cortado/exportado
  creadoEn: Date
}
```

**ConfigHorasCalientes** (puede vivir en Mongo o en `config/horas-calientes.json` — decidir en Fase 4)

```js
{ dias: [String], inicio: String, fin: String, bonusScore: Number }
```

**EstadoBot**

```js
{ dormidoHasta: Date | null }
```

## 6. Fases de implementación

### Fase 0 — Setup del proyecto

- Inicializar repo, `package.json`, estructura de carpetas de la sección 4.
- Verificar que `yt-dlp` y `ffmpeg` estén instalados y accesibles desde PATH; si no, documentar en el README cómo instalarlos en Windows (gratis).
- Conexión básica a MongoDB local.
- **Entregable:** servidor Express que arranca y confirma conexión a Mongo. Nada más.

### Fase 1 — Captura del stream en segmentos

- Proceso que usa `yt-dlp` + `ffmpeg` para grabar el live en bloques de 2–5 minutos (duración configurable).
- Guardar siempre en la ruta configurada hacia D: (storage/).
- Nombrar archivos con timestamp.
- Resolución objetivo: 720p (configurable, bajar a 480p si se detecta poca holgura de CPU/disco).
- **Entregable:** el bot graba de forma continua sin caerse por un corte de red; reintenta con backoff.

### Fase 2 — Transcripción automática

- Cada bloque nuevo pasa por `whisper.cpp` (modelo tiny/base) generando un `.srt`.
- La transcripción corre como un proceso separado que consume una cola de bloques pendientes (no en tiempo real, para no competir con la captura).
- Guardar la transcripción asociada en Mongo (o referenciar el archivo `.srt`).
- **Entregable:** por cada bloque capturado, aparece su transcripción en texto, sin bloquear la captura.

### Fase 3 — Detección de momentos candidatos

- Analizar cada bloque transcrito con heurísticas:
  - Picos de volumen (`ffmpeg silencedetect` invertido, o análisis de energía de audio).
  - Cambios de escena (`ffmpeg scdet`).
  - Palabras clave en la transcripción (lista configurable: peleas, nombres de participantes, groserías, risas, etc.).
- Por cada momento candidato, generar un clip corto (15–90s) con margen antes/después, usando `ffmpeg -ss/-to`.
- **Entregable:** de un bloque de 5 minutos salen 0 a N clips candidatos guardados como documentos `Clip` en estado `pendiente`.

### Fase 4 — Sistema de scoring (incluye horas calientes)

- Calcular `score` combinando: intensidad de audio, densidad de palabras clave, duración ideal (15–60s para Reels).
- Cargar `config/horas-calientes.json`, comparar la hora de origen del clip contra las franjas configuradas, y si cae dentro aplicar `bonusScore` y marcar `horaCaliente: true`.
- **Entregable:** cada `Clip` queda con un score numérico y la bandera de hora caliente, consultable por API.

### Fase 5 — Cola de revisión (dashboard local)

- Vista web simple (Express + HTML/JS) que lista los clips ordenados por score, con reproductor, transcripción visible, y botones Aprobar / Descartar.
- **Entregable:** el usuario puede revisar y decidir qué clips pasan a edición, sin tocar la base de datos a mano.

### Fase 6 — Editor básico (cortar, subtítulos, stickers, audio)

- Sobre un clip aprobado: ajustar el corte exacto, quemar subtítulos desde el `.srt` (`ffmpeg subtitles=`), superponer stickers/texto (`drawtext`/`overlay` con PNG), mezclar pista de audio adicional.
- Interfaz mínima: inputs numéricos/sliders para tiempos, selector de stickers, botón "renderizar".
- **Entregable:** un archivo de video final listo, guardado en `storage/salida/`.

### Fase 7 — Control del bot (dormir / horas calientes en vivo)

- Endpoint o comando CLI para fijar `dormidoHasta` (ej. `--dormir 6h`).
- El loop principal de captura/procesamiento revisa `EstadoBot.dormidoHasta` antes de cada ciclo; si está en el futuro, no hace nada y espera.
- Permitir editar `horas-calientes.json` desde el dashboard (opcional, puede quedar manual en Fase 4 y volverse editable aquí).
- **Entregable:** el usuario puede pausar el bot por N horas sin matar el proceso, y ajustar sus horas calientes sin tocar código.

### Fase 8 — Publicación a Facebook

- Integración con Facebook Graph API (Pages) para subir el video final desde `storage/salida/` directamente, o dejarlo listo para subida manual si la API resulta compleja de configurar al inicio.
- Marcar el `Clip` como `publicado` tras la subida exitosa.
- **Entregable:** flujo completo de punta a punta, desde captura hasta publicación.

## 7. Instrucciones de comportamiento para el agente (Codex)

1. Trabaja **una fase a la vez**. Al terminar una fase, detente y resume: qué se construyó, qué archivos se crearon/modificaron, y qué debe probar el usuario antes de aprobar seguir a la siguiente fase.
2. No introduzcas dependencias de pago ni cuentas en la nube salvo las ya mencionadas (Mongo local, Facebook Graph API en la Fase 8).
3. Antes de cada fase, confirma que los binarios externos necesarios (`yt-dlp`, `ffmpeg`, `whisper.cpp`) estén referenciados correctamente vía variables de entorno o configuración, nunca rutas absolutas hardcodeadas al disco del usuario.
4. Comenta el código en español, consistente con el resto del proyecto del usuario.
5. Prioriza siempre el menor consumo de CPU/RAM posible dado el hardware descrito en la sección 2 — ante la duda entre una solución más "elegante" pero pesada y una más simple pero liviana, elige la liviana.
6. Si una fase requiere una decisión de diseño no especificada aquí, proponla explícitamente y espera confirmación antes de implementarla.
