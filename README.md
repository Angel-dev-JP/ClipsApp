# Clipper Alofoke a Facebook

Herramienta local y personal para grabar el live de "La Casa de Alofoke 3", detectar momentos candidatos, calificarlos, editarlos y publicarlos en Facebook.

> **Nota sobre uso de contenido:** Alofoke Media Group autorizó a cliperos a compartir y monetizar fragmentos en Facebook, Instagram, TikTok y X. **YouTube queda excluido** de esa autorización; esta herramienta prepara clips únicamente para Facebook.

## Requisitos gratuitos en Windows 10

Pensado para correr de forma liviana (Intel i7-7500U, 16 GB RAM, SSD `C:` para sistema y HDD `D:` para video).

1. **Node.js LTS** (v20 o v22):
   - Descarga gratis desde https://nodejs.org o instala con `winget install OpenJS.NodeJS.LTS`.
2. **MongoDB Atlas** (base de datos en la nube, plan gratuito M0):
   - Crea una cuenta gratuita en https://www.mongodb.com/atlas y despliega un clúster **M0 Free**.
   - En **Database Access**, crea un usuario y contraseña.
   - En **Network Access**, agrega tu IP actual (o `0.0.0.0/0` si tu IP cambia).
   - Copia la cadena de conexión (`Connect` -> `Drivers`) y agrégale el nombre de la base de datos `/clipper-alofoke` antes del `?`.
3. **ffmpeg** (procesamiento de video/audio):
   - En PowerShell: `winget install Gyan.FFmpeg`
   - O descarga la compilación gratuita de https://www.gyan.dev/ffmpeg/builds/ y agrega su carpeta `bin` al `PATH` de Windows.
4. **yt-dlp** (captura de stream):
   - En PowerShell: `winget install yt-dlp.yt-dlp`
   - O descarga `yt-dlp.exe` desde https://github.com/yt-dlp/yt-dlp/releases y colócalo en una carpeta incluida en el `PATH` de Windows.

Reinicia la terminal después de instalar para que Windows reconozca el `PATH`.

## Configuración inicial (Fase 0)

1. Instala las dependencias de Node:

```bash
npm install
```

2. Crea tu archivo `.env` a partir de `.env.example`:

```bash
copy .env.example .env
```

3. En `.env`:
   - Pega tu cadena de conexión de MongoDB Atlas en `MONGODB_URI`.
   - Configura `STORAGE_DIR` apuntando a tu disco `D:` para no llenar el SSD `C:` con videos crudos (por ejemplo `D:/clipper-alofoke/storage`).
   - Si `yt-dlp` o `ffmpeg` no están en el `PATH`, define sus rutas en `YTDLP_PATH` y `FFMPEG_PATH`.

4. Verifica binarios y arranca el servidor de Fase 0:

```bash
npm run check:binaries
npm start
```

El servidor arrancará en `http://localhost:3000` (y `/health`) mostrando el estado de Express, la conexión a MongoDB Atlas y la detección de `ffmpeg` y `yt-dlp`. Los registros se guardan en consola y en `logs/app.log`.
