import fs from 'node:fs';
import path from 'node:path';

/**
 * Crea un logger liviano que escribe simultáneamente en consola y en archivo.
 * Diseñado para consumir recursos mínimos en hardware modesto.
 */
export function crearLogger(logsDir = process.env.LOGS_DIR || './logs') {
  const rutaLogs = path.resolve(logsDir);
  const archivoLog = path.join(rutaLogs, 'app.log');

  try {
    fs.mkdirSync(rutaLogs, { recursive: true });
  } catch (error) {
    console.error(`[LOGGER] No se pudo crear la carpeta de logs (${rutaLogs}):`, error.message);
  }

  function escribir(nivel, mensaje, detalle) {
    const marcaTiempo = new Date().toISOString();
    const textoExtra = detalle !== undefined ? ` ${formatearDetalle(detalle)}` : '';
    const linea = `[${marcaTiempo}] [${nivel}] ${mensaje}${textoExtra}`;

    if (nivel === 'ERROR') {
      console.error(linea);
    } else if (nivel === 'WARN') {
      console.warn(linea);
    } else {
      console.log(linea);
    }

    try {
      fs.appendFileSync(archivoLog, `${linea}\n`, 'utf8');
    } catch (error) {
      console.error(`[LOGGER] Error escribiendo en ${archivoLog}:`, error.message);
    }
  }

  return {
    archivoLog,
    info: (mensaje, detalle) => escribir('INFO', mensaje, detalle),
    warn: (mensaje, detalle) => escribir('WARN', mensaje, detalle),
    error: (mensaje, detalle) => escribir('ERROR', mensaje, detalle),
  };
}

function formatearDetalle(detalle) {
  if (detalle instanceof Error) {
    return detalle.message;
  }
  if (typeof detalle === 'object' && detalle !== null) {
    try {
      return JSON.stringify(detalle);
    } catch {
      return String(detalle);
    }
  }
  return String(detalle);
}
