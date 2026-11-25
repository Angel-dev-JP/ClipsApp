import 'dotenv/config';
import express from 'express';
import { pathToFileURL } from 'node:url';
import { crearLogger } from './utils/logger.js';
import { verificarBinarios } from './utils/checkBinaries.js';
import { conectarMongo, obtenerEstadoMongo } from './utils/db.js';

/**
 * Escapa caracteres especiales para mostrar texto seguro en HTML.
 */
function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @typedef {Object} EstadoBinario
 * @property {string} nombre
 * @property {string} comando
 * @property {boolean} disponible
 * @property {string|null} version
 * @property {string|null} error
 */

/**
 * Crea la instancia de Express para la Fase 0.
 * Solo expone confirmación de arranque, estado de MongoDB y estado de binarios.
 * @param {{ consultarMongo?: () => any, binarios?: { ytDlp?: EstadoBinario|null, ffmpeg?: EstadoBinario|null } }} [opciones]
 */
export function crearApp(opciones = {}) {
  const {
    consultarMongo = () => obtenerEstadoMongo(),
    binarios = {},
  } = opciones;
  const app = express();

  app.get('/health', (_req, res) => {
    const mongodb = consultarMongo();
    res.json({
      ok: true,
      fase: 0,
      servidor: 'activo',
      mongodb,
      binarios,
    });
  });

  app.get('/', (_req, res) => {
    const mongodb = consultarMongo();
    const ytDlp = binarios.ytDlp || { disponible: false, comando: 'yt-dlp', version: null, error: 'No verificado' };
    const ffmpeg = binarios.ffmpeg || { disponible: false, comando: 'ffmpeg', version: null, error: 'No verificado' };

    res.status(200).type('html').send(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Clipper Alofoke a Facebook — Fase 0</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #18181b; background: #fafafa; }
      h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
      p.sub { color: #52525b; margin-top: 0; }
      section { background: #fff; border: 1px solid #e4e4e7; border-radius: 8px; padding: 1rem 1.25rem; margin-top: 1rem; }
      h2 { font-size: 1rem; margin: 0 0 0.5rem; }
      .ok { color: #15803d; font-weight: 600; }
      .fail { color: #b91c1c; font-weight: 600; }
      code { background: #f4f4f5; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.9em; }
    </style>
  </head>
  <body>
    <main>
      <h1>Clipper Alofoke a Facebook</h1>
      <p class="sub">Fase 0 — Setup del proyecto</p>

      <section>
        <h2>Servidor Express</h2>
        <p><span class="ok">Activo</span> — El servidor respondió correctamente.</p>
      </section>

      <section>
        <h2>MongoDB Atlas</h2>
        ${
          mongodb.conectado
            ? `<p><span class="ok">Conectado</span> — Base de datos: <code>${escaparHtml(mongodb.baseDeDatos || 'clipper-alofoke')}</code></p>`
            : `<p><span class="fail">No conectado (${escaparHtml(mongodb.estado)})</span>${mongodb.error ? ` — ${escaparHtml(mongodb.error)}` : ''}</p>`
        }
      </section>

      <section>
        <h2>Binarios externos</h2>
        <ul>
          <li>
            <strong>ffmpeg</strong> (<code>${escaparHtml(ffmpeg.comando)}</code>):
            ${
              ffmpeg.disponible
                ? `<span class="ok">Disponible</span> (${escaparHtml(ffmpeg.version)})`
                : `<span class="fail">No encontrado</span> — ${escaparHtml(ffmpeg.error)}`
            }
          </li>
          <li>
            <strong>yt-dlp</strong> (<code>${escaparHtml(ytDlp.comando)}</code>):
            ${
              ytDlp.disponible
                ? `<span class="ok">Disponible</span> (${escaparHtml(ytDlp.version)})`
                : `<span class="fail">No encontrado</span> — ${escaparHtml(ytDlp.error)}`
            }
          </li>
        </ul>
      </section>
    </main>
  </body>
</html>`);
  });

  return app;
}

/**
 * Arranca el servidor Express, verifica binarios y conecta a MongoDB Atlas.
 */
export async function iniciarServidor() {
  const logger = crearLogger(process.env.LOGS_DIR || './logs');
  const puerto = Number(process.env.PORT) || 3000;

  logger.info('Iniciando Clipper Alofoke a Facebook (Fase 0)...');

  let ultimoErrorMongo = null;
  const binarios = { ytDlp: null, ffmpeg: null };

  const app = crearApp({
    consultarMongo: () => obtenerEstadoMongo(ultimoErrorMongo),
    binarios,
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(puerto, '0.0.0.0', () => {
      logger.info(`Servidor Express escuchando en http://localhost:${puerto}`);
      resolve(s);
    });
  });

  const resultadosBinarios = await verificarBinarios(process.env);
  binarios.ffmpeg = resultadosBinarios.ffmpeg;
  binarios.ytDlp = resultadosBinarios.ytDlp;

  for (const item of [binarios.ffmpeg, binarios.ytDlp]) {
    if (item.disponible) {
      logger.info(`Binario ${item.nombre} listo (${item.comando}): ${item.version}`);
    } else {
      logger.warn(`Binario ${item.nombre} no disponible (${item.comando}): ${item.error}`);
    }
  }

  const resultadoMongo = await conectarMongo(process.env.MONGODB_URI, logger);
  if (!resultadoMongo.conectado) {
    ultimoErrorMongo = resultadoMongo.error;
  }

  return { app, server, binarios, resultadoMongo };
}

const esEjecucionDirecta =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (esEjecucionDirecta) {
  iniciarServidor();
}
