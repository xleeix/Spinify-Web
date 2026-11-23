import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import zlib from 'zlib';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 150 * 1024 * 1024,
  },
});

app.get('/vendor/mp4-muxer.mjs', (_req, res) => {
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'node_modules/mp4-muxer/build/mp4-muxer.mjs'));
});

app.get('/vendor/webm-muxer.mjs', (_req, res) => {
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'node_modules/webm-muxer/build/webm-muxer.mjs'));
});

app.post(
  '/api/export-video',
  upload.fields([
    { name: 'bgImage', maxCount: 1 },
    { name: 'discImage', maxCount: 1 },
    { name: 'sheenImage', maxCount: 1 },
    { name: 'overlayImage', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
    { name: 'ambientAudio', maxCount: 1 },
  ]),
  (req, res) => {
    const files = req.files || {};
    const bgFile = files.bgImage?.[0];
    const discFile = files.discImage?.[0];
    const sheenFile = files.sheenImage?.[0];
    const overlayFile = files.overlayImage?.[0];
    const audioFile = files.audio?.[0];
    const ambientFile = files.ambientAudio?.[0];

    const tempPaths = [
      bgFile?.path,
      discFile?.path,
      sheenFile?.path,
      overlayFile?.path,
      audioFile?.path,
      ambientFile?.path,
    ].filter(Boolean);
    const outPath = path.join(os.tmpdir(), `vinyl-export-${randomUUID()}.mp4`);
    tempPaths.push(outPath);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      for (const p of tempPaths) {
        fs.promises.unlink(p).catch(() => {});
      }
    };

    if (!bgFile || !discFile) {
      cleanup();
      return res.status(400).json({ error: 'Missing required image layers' });
    }

    const rawStart = Number(req.body?.startSec);
    const rawDuration = Number(req.body?.durationSec);
    const rawRotSec = Number(req.body?.rotSec);
    const sizeMode = req.body?.sizeMode === 'under19' ? 'under19' : 'full';
    const aspectRatio = ['9:16', '16:9'].includes(req.body?.aspectRatio) ? req.body.aspectRatio : '1:1';
    const requestedQuality = req.body?.quality === '720' ? 720 : 1080;
    const requestedFps = Number(req.body?.fps) === 60 ? 60 : 30;
    const staticDisc = req.body?.staticDisc === '1' || req.body?.staticDisc === 'true';
    const rawCenterY = Number(req.body?.discCenterY);
    const discCenterY = Number.isFinite(rawCenterY) && rawCenterY > 0.1 && rawCenterY < 0.9 ? rawCenterY : 0.5;

    const startSec = Number.isFinite(rawStart) && rawStart >= 0 ? rawStart : 0;
    const durationSec =
      Number.isFinite(rawDuration) && rawDuration > 0
        ? Math.min(rawDuration, 1800)
        : 60;
    const rotSec =
      Number.isFinite(rawRotSec) && rawRotSec >= 0.5 && rawRotSec <= 30
        ? rawRotSec
        : 5;

    const startStr = startSec.toFixed(3);
    const durStr = durationSec.toFixed(3);
    const rotStr = rotSec.toFixed(3);
    const autoFade = req.body?.autoFade === '1' || req.body?.autoFade === 'true';
    const fadeDur = Math.min(1.0, durationSec * 0.4);
    const fadeDurStr = fadeDur.toFixed(3);
    const fadeOutStartStr = Math.max(0, durationSec - fadeDur).toFixed(3);

    const baseDims =
      aspectRatio === '9:16'
        ? { w: 1080, h: 1920 }
        : aspectRatio === '16:9'
          ? { w: 1920, h: 1080 }
          : { w: 1080, h: 1080 };

    const qScale = requestedQuality === 720 ? 720 / 1080 : 1;
    let outW = Math.round((baseDims.w * qScale) / 2) * 2;
    let outH = Math.round((baseDims.h * qScale) / 2) * 2;
    let outFps = requestedFps;
    let videoKbps = null;
    let audioKbps = 192;

    const hasAnyAudio = Boolean(audioFile || ambientFile);

    if (sizeMode === 'under19') {
      const targetBytes = 17_800_000;
      const totalBps = Math.floor((targetBytes * 8) / durationSec);
      audioKbps = hasAnyAudio
        ? (totalBps > 450_000 ? 128 : totalBps > 250_000 ? 96 : 64)
        : 0;
      videoKbps = Math.max(
        160,
        Math.min(5000, Math.floor((totalBps - audioKbps * 1000 - 24_000) / 1000))
      );
      if (videoKbps < 600) {
        const capScale = 640 / 1080;
        outW = Math.round((baseDims.w * capScale) / 2) * 2;
        outH = Math.round((baseDims.h * capScale) / 2) * 2;
        outFps = 24;
      } else if (videoKbps < 1400) {
        const capScale = 720 / 1080;
        outW = Math.round((baseDims.w * capScale) / 2) * 2;
        outH = Math.round((baseDims.h * capScale) / 2) * 2;
        outFps = 30;
      }
    }

    const fpsStr = String(outFps);

    const args = [
      '-y',
      '-xerror',
      '-loop', '1', '-framerate', fpsStr, '-t', durStr, '-i', bgFile.path,
      '-loop', '1', '-framerate', fpsStr, '-t', durStr, '-i', discFile.path,
    ];

    let nextInputIndex = 2;
    let sheenInputIndex = null;
    if (sheenFile) {
      sheenInputIndex = nextInputIndex++;
      args.push('-loop', '1', '-framerate', fpsStr, '-t', durStr, '-i', sheenFile.path);
    }

    let overlayInputIndex = null;
    if (overlayFile) {
      overlayInputIndex = nextInputIndex++;
      args.push('-loop', '1', '-framerate', fpsStr, '-t', durStr, '-i', overlayFile.path);
    }

    let audioInputIndex = null;
    if (audioFile) {
      audioInputIndex = nextInputIndex++;
      args.push('-ss', startStr, '-t', durStr, '-i', audioFile.path);
    }

    let ambientInputIndex = null;
    if (ambientFile) {
      ambientInputIndex = nextInputIndex++;
      args.push('-stream_loop', '-1', '-t', durStr, '-i', ambientFile.path);
    }

    const needRescale = outW !== baseDims.w || outH !== baseDims.h;
    const scaleSuffix = needRescale ? `,scale=${outW}:${outH}:flags=lanczos` : '';
    const videoFadeSuffix = autoFade
      ? `,fade=t=in:st=0:d=${fadeDurStr}:color=#06070a,fade=t=out:st=${fadeOutStartStr}:d=${fadeDurStr}:color=#06070a`
      : '';
    const audioFadeSuffix = autoFade
      ? `,afade=t=in:st=0:d=${fadeDurStr},afade=t=out:st=${fadeOutStartStr}:d=${fadeDurStr}`
      : '';

    const cyExpr = `${discCenterY.toFixed(4)}*H-h/2`;
    let filterComplex = staticDisc
      ? `[1:v]format=rgba[rot];[0:v][rot]overlay=(W-w)/2:${cyExpr}:shortest=1[cur0]`
      : `[1:v]format=rgba,rotate=2*PI*t/${rotStr}:fillcolor=none:ow=iw:oh=ih[rot];[0:v][rot]overlay=(W-w)/2:${cyExpr}:shortest=1[cur0]`;

    let curLabel = '[cur0]';
    let stepNum = 1;
    if (sheenInputIndex !== null) {
      const nextLbl = `[cur${stepNum++}]`;
      filterComplex += `;${curLabel}[${sheenInputIndex}:v]overlay=(W-w)/2:${cyExpr}:shortest=1${nextLbl}`;
      curLabel = nextLbl;
    }
    if (overlayInputIndex !== null) {
      const nextLbl = `[cur${stepNum++}]`;
      filterComplex += `;${curLabel}[${overlayInputIndex}:v]overlay=0:0:shortest=1${nextLbl}`;
      curLabel = nextLbl;
    }
    filterComplex += `;${curLabel}format=yuv420p${scaleSuffix}${videoFadeSuffix}[outv]`;

    const mixAudio = audioInputIndex !== null && ambientInputIndex !== null;
    let mappedAudioLabel = null;
    if (mixAudio) {
      filterComplex += `;[${audioInputIndex}:a][${ambientInputIndex}:a]amix=inputs=2:duration=first:dropout_transition=0:normalize=0${audioFadeSuffix}[outa]`;
      mappedAudioLabel = '[outa]';
    } else if (audioInputIndex !== null) {
      if (autoFade) {
        filterComplex += `;[${audioInputIndex}:a]afade=t=in:st=0:d=${fadeDurStr},afade=t=out:st=${fadeOutStartStr}:d=${fadeDurStr}[outa]`;
        mappedAudioLabel = '[outa]';
      } else {
        mappedAudioLabel = `${audioInputIndex}:a`;
      }
    } else if (ambientInputIndex !== null) {
      if (autoFade) {
        filterComplex += `;[${ambientInputIndex}:a]afade=t=in:st=0:d=${fadeDurStr},afade=t=out:st=${fadeOutStartStr}:d=${fadeDurStr}[outa]`;
        mappedAudioLabel = '[outa]';
      } else {
        mappedAudioLabel = `${ambientInputIndex}:a`;
      }
    }

    args.push('-filter_complex', filterComplex, '-map', '[outv]');

    if (mappedAudioLabel) {
      args.push('-map', mappedAudioLabel, '-c:a', 'aac', '-b:a', `${audioKbps}k`);
    }

    args.push('-c:v', 'libx264');
    if (videoKbps !== null) {
      args.push(
        '-preset', 'veryfast',
        '-b:v', `${videoKbps}k`,
        '-maxrate', `${Math.round(videoKbps * 1.12)}k`,
        '-bufsize', `${Math.round(videoKbps * 1.5)}k`
      );
    } else {
      args.push('-preset', 'ultrafast', '-crf', '21');
    }

    args.push(
      '-pix_fmt', 'yuv420p',
      '-r', fpsStr,
      '-shortest',
      '-movflags', '+faststart',
      outPath
    );

    const ffmpegProc = spawn('ffmpeg', args);
    let stderrLogs = '';
    let timedOut = false;

    const renderWatchdog = setTimeout(() => {
      timedOut = true;
      if (ffmpegProc.exitCode === null) {
        ffmpegProc.kill('SIGKILL');
      }
    }, Math.max(120_000, Math.round(durationSec * 4000)));

    ffmpegProc.stderr.on('data', (chunk) => {
      if (stderrLogs.length < 4000) {
        stderrLogs += chunk.toString();
      }
    });

    res.on('close', () => {
      if (!res.writableFinished && ffmpegProc.exitCode === null) {
        clearTimeout(renderWatchdog);
        ffmpegProc.kill('SIGKILL');
        cleanup();
      }
    });

    ffmpegProc.on('error', (err) => {
      clearTimeout(renderWatchdog);
      console.error('FFmpeg spawn error:', err);
      cleanup();
      if (!res.headersSent) {
        res.status(500).json({ error: 'FFmpeg execution failed' });
      }
    });

    ffmpegProc.on('close', (code) => {
      clearTimeout(renderWatchdog);
      if (code !== 0 || timedOut) {
        console.error('FFmpeg exited with code:', code, timedOut ? '(timeout)' : '', stderrLogs);
        cleanup();
        if (!res.headersSent) {
          res.status(500).json({ error: timedOut ? 'Video rendering timed out' : 'Video rendering failed' });
        }
        return;
      }

      const dlName = `spinify-${aspectRatio.replace(':', 'x')}.mp4`;
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${dlName}"`);
      const stream = fs.createReadStream(outPath);
      stream.on('error', () => {
        cleanup();
        if (!res.headersSent) {
          res.status(500).end();
        }
      });
      res.on('finish', cleanup);
      res.on('close', cleanup);
      stream.pipe(res);
    });
  }
);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
})();

function crc32Buf(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

function buildZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const raw = entry.data;
    const crc = crc32Buf(raw);
    const compressed = zlib.deflateRawSync(raw, { level: 6 });

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(raw.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(raw.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDir.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, endRecord]);
}

function collectProjectEntries() {
  const fixedFiles = [
    '.gitignore',
    'README.md',
    'HANDOVER.md',
    'index.html',
    'package.json',
    'server.js',
    'metadata.json',
    'capacitor.config.json',
    'scripts/prepare-www.mjs',
    'scripts/android-native/SpinifyMediaPlugin.java',
    '.github/workflows/build-apk.yml',
    '.github/workflows/deploy-web.yml',
    'public/icon.svg',
    'public/manifest.json',
    'public/sw.js',
    'public/spinify-logo.png',
    'public/pwa-192x192.png',
    'public/pwa-512x512.png',
    'public/pwa-maskable-512x512.png',
    'public/apple-touch-icon.png',
  ];

  const entries = [];
  for (const rel of fixedFiles) {
    const abs = path.join(__dirname, rel);
    if (fs.existsSync(abs)) {
      entries.push({ name: rel, data: fs.readFileSync(abs) });
    }
  }

  const walkDir = (dirAbs, prefix) => {
    if (!fs.existsSync(dirAbs)) return;
    for (const item of fs.readdirSync(dirAbs, { withFileTypes: true })) {
      const full = path.join(dirAbs, item.name);
      const relName = `${prefix}/${item.name}`;
      if (item.isDirectory()) {
        walkDir(full, relName);
      } else if (item.isFile()) {
        entries.push({ name: relName, data: fs.readFileSync(full) });
      }
    }
  };

  walkDir(path.join(__dirname, 'www'), 'www');
  return entries;
}

app.get('/api/download-project.zip', (_req, res) => {
  try {
    const entries = collectProjectEntries();
    const zipBuf = buildZipBuffer(entries);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="spinify-project.zip"');
    res.send(zipBuf);
  } catch (err) {
    console.error('Failed to build project zip:', err);
    res.status(500).json({ error: 'Failed to package project files' });
  }
});

app.get('/api/download-index', (_req, res) => {
  res.download(path.join(__dirname, 'index.html'), 'index.html');
});

app.get('/api/download-logo', (_req, res) => {
  res.download(path.join(__dirname, 'public/spinify-logo.png'), 'spinify-logo.png');
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
