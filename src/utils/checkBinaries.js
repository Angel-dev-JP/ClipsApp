import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);

/**
 * Obtiene los comandos o rutas de los binarios desde variables de entorno.
 * Nunca usa rutas absolutas hardcodeadas del disco del usuario.
 */
export function obtenerComandosBinarios(env = process.env) {
  return {
    ytDlp: (env.YTDLP_PATH || 'yt-dlp').trim(),
    ffmpeg: (env.FFMPEG_PATH || 'ffmpeg').trim(),
  };
}

/**
 * Ejecuta un binario externo con su bandera de versión para confirmar disponibilidad.
 */
export async function verificarBinario(nombre, comando, args = ['--version']) {
  try {
    const { stdout, stderr } = await execFileAsync(comando, args, {
      timeout: 5000,
      windowsHide: true,
    });
    const salida = `${stdout || ''}\n${stderr || ''}`.trim();
    const primeraLinea = salida.split(/\r?\n/)[0] || 'disponible';

    return {
      nombre,
      comando,
      disponible: true,
      version: primeraLinea,
      error: null,
    };
  } catch (error) {
    return {
      nombre,
      comando,
      disponible: false,
      version: null,
      error: error.code === 'ENOENT'
        ? `No se encontró '${comando}' en PATH ni en la variable de entorno configurada.`
        : error.message,
    };
  }
}

/**
 * Verifica los binarios requeridos en la Fase 0: yt-dlp y ffmpeg.
 */
export async function verificarBinarios(env = process.env) {
  const comandos = obtenerComandosBinarios(env);

  const [ytDlp, ffmpeg] = await Promise.all([
    verificarBinario('yt-dlp', comandos.ytDlp, ['--version']),
    verificarBinario('ffmpeg', comandos.ffmpeg, ['-version']),
  ]);

  return { ytDlp, ffmpeg };
}

// Permite ejecutar la verificación directamente desde npm run check:binaries
const esEjecucionDirecta =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (esEjecucionDirecta) {
  const resultados = await verificarBinarios();
  console.log('=== Verificación de binarios (Fase 0) ===');
  for (const item of Object.values(resultados)) {
    if (item.disponible) {
      console.log(`[OK] ${item.nombre} (${item.comando}): ${item.version}`);
    } else {
      console.warn(`[FALTA] ${item.nombre} (${item.comando}): ${item.error}`);
    }
  }
  console.log('Consulta README.md si necesitas instalar alguno gratis en Windows.');
}
