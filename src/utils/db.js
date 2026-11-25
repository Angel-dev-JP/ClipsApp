import mongoose from 'mongoose';

const ESTADOS_MONGOOSE = {
  0: 'desconectado',
  1: 'conectado',
  2: 'conectando',
  3: 'desconectando',
};

/**
 * Devuelve el estado actual de la conexión de Mongoose sin lanzar excepciones.
 */
export function obtenerEstadoMongo(ultimoError = null) {
  const readyState = mongoose.connection.readyState;
  return {
    conectado: readyState === 1,
    estado: ESTADOS_MONGOOSE[readyState] || 'desconocido',
    baseDeDatos: mongoose.connection.name || null,
    host: mongoose.connection.host || null,
    error: readyState === 1 ? null : ultimoError,
  };
}

/**
 * Intenta conectar a MongoDB Atlas usando MONGODB_URI.
 * Si falta la URI o falla la red, registra el error sin exponer credenciales ni tumbar Express.
 */
export async function conectarMongo(uri, logger) {
  const uriFinal = (uri ?? process.env.MONGODB_URI ?? '').trim();

  if (!uriFinal) {
    const mensaje = 'Falta configurar MONGODB_URI en .env con la cadena de conexión de MongoDB Atlas.';
    logger?.warn(mensaje);
    return { conectado: false, error: mensaje };
  }

  try {
    await mongoose.connect(uriFinal, {
      serverSelectionTimeoutMS: 10000,
    });
    logger?.info(`Conexión a MongoDB Atlas confirmada (${mongoose.connection.name}).`);
    return { conectado: true, error: null };
  } catch (error) {
    logger?.error('No se pudo conectar a MongoDB Atlas:', error.message);
    return { conectado: false, error: error.message };
  }
}
