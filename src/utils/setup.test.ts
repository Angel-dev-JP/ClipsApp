import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { crearLogger } from './logger.js';
import { obtenerComandosBinarios, verificarBinario } from './checkBinaries.js';
import { conectarMongo } from './db.js';
import { crearApp } from '../server.js';

test('obtenerComandosBinarios usa PATH por defecto y respeta variables de entorno', () => {
  const porDefecto = obtenerComandosBinarios({});
  assert.equal(porDefecto.ytDlp, 'yt-dlp');
  assert.equal(porDefecto.ffmpeg, 'ffmpeg');

  const personalizado = obtenerComandosBinarios({
    YTDLP_PATH: '  custom-yt-dlp  ',
    FFMPEG_PATH: 'custom-ffmpeg',
  });
  assert.equal(personalizado.ytDlp, 'custom-yt-dlp');
  assert.equal(personalizado.ffmpeg, 'custom-ffmpeg');
});

test('verificarBinario detecta un binario existente y reporta error limpio si falta', async () => {
  const existeNode = await verificarBinario('node', process.execPath, ['--version']);
  assert.equal(existeNode.disponible, true);
  assert.match(existeNode.version ?? '', /^v\d+/);

  const inexistente = await verificarBinario('yt-dlp', 'binario-que-no-existe-xyz', ['--version']);
  assert.equal(inexistente.disponible, false);
  assert.equal(inexistente.version, null);
  assert.ok(inexistente.error?.includes('No se encontró'));
});

test('crearLogger escribe líneas formateadas en logs/app.log', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipper-log-'));
  try {
    const logger = crearLogger(tmpDir);
    logger.info('Mensaje de prueba');
    const contenido = fs.readFileSync(logger.archivoLog, 'utf8');
    assert.match(contenido, /\[INFO\] Mensaje de prueba/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('crearApp responde en /health y / mostrando estado de Mongo y binarios', async () => {
  const app = crearApp({
    consultarMongo: () => ({
      conectado: true,
      estado: 'conectado',
      baseDeDatos: 'clipper-alofoke',
      error: null,
    }),
    binarios: {
      ffmpeg: { nombre: 'ffmpeg', comando: 'ffmpeg', disponible: true, version: 'ffmpeg 4.4', error: null },
      ytDlp: { nombre: 'yt-dlp', comando: 'yt-dlp', disponible: false, version: null, error: 'Falta yt-dlp' },
    },
  });

  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;

    const resHealth = await fetch(`${baseUrl}/health`);
    assert.equal(resHealth.status, 200);
    const json = await resHealth.json();
    assert.equal(json.ok, true);
    assert.equal(json.fase, 0);
    assert.equal(json.mongodb.conectado, true);
    assert.equal(json.binarios.ffmpeg.disponible, true);
    assert.equal(json.binarios.ytDlp.disponible, false);

    const resHtml = await fetch(`${baseUrl}/`);
    assert.equal(resHtml.status, 200);
    const html = await resHtml.text();
    assert.match(html, /Clipper Alofoke a Facebook/);
    assert.match(html, /Conectado/);
    assert.match(html, /ffmpeg 4\.4/);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

test('conectarMongo reporta aviso claro si falta MONGODB_URI de Atlas', async () => {
  const resultado = await conectarMongo('');
  assert.equal(resultado.conectado, false);
  assert.match(resultado.error ?? '', /MONGODB_URI/);
  assert.match(resultado.error ?? '', /Atlas/);
});
