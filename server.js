const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');
const localtunnel = require('localtunnel');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const https = require('https');
const plugins = require('./plugin-store');

function logToGoogleSheets(type, amount, username) {
  if (!settings.googleSheetUrl || !settings.googleSheetUrl.startsWith('https://script.google.com/')) return;
  
  // Feedback visual no painel
  logAction('Sheets', `A mandar dados de ${type} para o Google Sheets...`);
  
  const d = new Date();
  const dateStr = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth()+1).toString().padStart(2, '0')}-${d.getFullYear()}`;
  const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  const fullDateStr = `${dateStr} ${timeStr}`;
  const payload = JSON.stringify({ date: fullDateStr, day: dateStr, time: timeStr, type: type, amount: amount, username: username || 'Anónimo' });
  try {
    const parsedUrl = new URL(settings.googleSheetUrl);
    const options = { hostname: parsedUrl.hostname, path: parsedUrl.pathname + parsedUrl.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } };
    const req = https.request(options, () => {});
    req.on('error', () => {});
    req.write(payload);
    req.end();
  } catch(e) {}
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DATA_FILE = path.join(process.cwd(), 'data.json');
const DATA_BAK_FILE = path.join(process.cwd(), 'data.json.bak');
const DATA_BAK2_FILE = path.join(process.cwd(), 'data.json.bak2');
const LOG_FILE = path.join(process.cwd(), 'logs.txt');

function isDataValid(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return (
    obj.timerSeconds !== undefined ||
    (obj.settings && typeof obj.settings === 'object' && Object.keys(obj.settings).length > 0) ||
    (obj.subathonData && typeof obj.subathonData === 'object' && Object.keys(obj.subathonData).length > 0)
  );
}

function parseDataSafe(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stats = fs.statSync(filePath);
  if (stats.size === 0) {
    throw new Error(`Ficheiro vazio (0 bytes): ${path.basename(filePath)}`);
  }
  let content = fs.readFileSync(filePath, 'utf8');
  // Remover UTF-8 BOM (\uFEFF) se presente (comum em ficheiros editados no Notepad)
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  // Remover bytes nulos e espaços em branco desnecessários
  content = content.replace(/\0/g, '').trim();
  if (!content) {
    throw new Error(`Ficheiro sem conteúdo legível: ${path.basename(filePath)}`);
  }
  const parsed = JSON.parse(content);
  if (!isDataValid(parsed)) {
    throw new Error(`Ficheiro não contém estrutura de dados válida: ${path.basename(filePath)}`);
  }
  return parsed;
}

let savedData = {};
try {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const parsed = parseDataSafe(DATA_FILE);
      if (parsed) savedData = parsed;
    } catch (parseErr) {
      console.error(`[Aviso Crítico] Falha ao carregar ${path.basename(DATA_FILE)}:`, parseErr.message);
      // Backup do ficheiro com erro para não perder dados originais para análise
      try {
        const corruptBackup = path.join(process.cwd(), `data.corrupted.${Date.now()}.json`);
        fs.copyFileSync(DATA_FILE, corruptBackup);
        console.warn(`[Aviso] Cópia de segurança do ficheiro corrompido guardada em: ${path.basename(corruptBackup)}`);
      } catch (bkErr) {}

      // Tentar recuperar do backup .bak ou .bak2 se existirem
      let recovered = false;
      const backupFiles = [DATA_BAK_FILE, DATA_BAK2_FILE];
      for (const bFile of backupFiles) {
        if (!recovered && fs.existsSync(bFile)) {
          try {
            const bakParsed = parseDataSafe(bFile);
            if (bakParsed) {
              savedData = bakParsed;
              recovered = true;
              console.log(`[Recuperação] Sucesso! Dados recuperados a partir de ${path.basename(bFile)}.`);
              // Restaurar imediatamente o data.json com os dados saudáveis do backup
              try {
                fs.copyFileSync(bFile, DATA_FILE);
                console.log(`[Recuperação] ${path.basename(DATA_FILE)} restaurado e sincronizado a partir de ${path.basename(bFile)}.`);
              } catch (rErr) {}
              break;
            }
          } catch (bakErr) {
            console.error(`[Recuperação] Backup ${path.basename(bFile)} inválido:`, bakErr.message);
          }
        }
      }

      if (!recovered) {
        console.error('[ERRO] Nenhum backup válido encontrado! A iniciar com definições padrão.');
      }
    }
  }
} catch (e) { console.error('Erro geral ao processar dados guardados:', e); }

let timerSeconds = savedData.timerSeconds !== undefined ? savedData.timerSeconds : 3600;
let isRunning = false;
let shuttingDown = false;
const eventHistory = [];
const defaultSettings = {
  seToken: '',
  tunnelName: '',
  subTime: 300, subTimeT2: 600, subTimeT3: 1500, bitTime: 60, tipTime: 60, kofiTime: 60, followTime: 10, raidTime: 5, baseRaidTime: 0,
  goalSubValue: 5,
  designs: {
      timer: {
          timer: { x: 100, y: 100, width: 400, height: 120, fontSize: 70, color: '#ffffff', bg: 'rgba(15,23,42,0.8)', border: '#8b5cf6', glow: '#8b5cf6' },
          images: [], texts: [], fonts: []
      },
      goals: { images: [], texts: [], fonts: [] }
  },
  modPassword: '123'
};

// Migrate old `design` to `designs.timer`
if (savedData.settings && savedData.settings.design && !savedData.settings.designs) {
    savedData.settings.designs = { timer: savedData.settings.design };
    delete savedData.settings.design;
}

let settings = { ...defaultSettings, ...(savedData.settings || {}) };
if (!settings.designs) settings.designs = defaultSettings.designs;
if (!settings.modPassword) settings.modPassword = '123';

let timeEventId = 0;
function emitSound(type) { io.emit('eventSound', { id: ++timeEventId, type }); }
function timerCap() {
  const hours = Number(settings.maxTimerHours);
  return Number.isFinite(hours) && hours > 0 ? Math.floor(hours * 3600) : Infinity;
}
function setTimerSeconds(seconds, eventType) {
  if (!Number.isFinite(seconds)) return false;
  const before = timerSeconds;
  timerSeconds = Math.max(0, Math.min(seconds, timerCap()));
  if (timerSeconds !== before) io.emit('timeUpdate', timerSeconds);
  if (before > 0 && timerSeconds === 0) io.emit('timerEnded', ++timeEventId);
  if (eventType && timerSeconds > before) io.emit('timeAdded', { id: ++timeEventId, type: eventType, seconds: timerSeconds - before });
  return timerSeconds !== before;
}
setTimerSeconds(timerSeconds);

function cleanOrphanUploads(onlyOld = true) {
  try {
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    fs.stat(uploadsDir, (err) => {
      if (err) return;
      
      const usedFiles = new Set();
      if (settings.designs) {
        Object.keys(settings.designs).forEach(mode => {
          const d = settings.designs[mode];
          if (d.images && Array.isArray(d.images)) {
            d.images.forEach(img => {
              if (img.url && typeof img.url === 'string') usedFiles.add(path.basename(img.url));
              if (img.originalUrl && typeof img.originalUrl === 'string') usedFiles.add(path.basename(img.originalUrl));
            });
          }
          if (d.fonts && Array.isArray(d.fonts)) {
            d.fonts.forEach(f => {
              if (f.url && typeof f.url === 'string') usedFiles.add(path.basename(f.url));
            });
          }
          if (d.goalsQueue) {
            if (d.goalsQueue.itemBgImage && typeof d.goalsQueue.itemBgImage === 'string') usedFiles.add(path.basename(d.goalsQueue.itemBgImage));
            if (d.goalsQueue.itemBgOriginalImage && typeof d.goalsQueue.itemBgOriginalImage === 'string') usedFiles.add(path.basename(d.goalsQueue.itemBgOriginalImage));
          }
        });
      }
      
      fs.readdir(uploadsDir, (err, files) => {
        if (err) return;
        const now = Date.now();
        let deletedCount = 0;
        
        files.forEach(file => {
          if (file.startsWith('font_')) return;
          
          if (!usedFiles.has(file)) {
            const filePath = path.join(uploadsDir, file);
            fs.stat(filePath, (err, stats) => {
              if (err) return;
              const isOldEnough = onlyOld ? (now - stats.mtimeMs > 3600000) : true;
              if (isOldEnough) {
                fs.unlink(filePath, (err) => {
                  if (!err) {
                    deletedCount++;
                    // Basic delayed log
                    if (deletedCount === 1) setTimeout(() => console.log(`[Garbage Collector] Limpou imagens não utilizadas.`), 1000);
                  }
                });
              }
            });
          }
        });
      });
    });
  } catch(e) {
    console.error('Erro na limpeza de uploads:', e);
  }
}

let subathonData = savedData.subathonData || {
  currentSubs: 0,
  visibleCount: 3,
  goals: [], // { id, title, target, completed, animated }
  userStats: {}
};
if (!subathonData.userStats) subathonData.userStats = {};

function getOrCreateUserStats(username) {
  if (!subathonData.userStats) subathonData.userStats = {};
  const safeName = (username && typeof username === 'string') ? username.trim() : 'Anónimo';
  if (!safeName) return { subs: 0, bits: 0, tips: 0 };
  
  const existingKey = Object.keys(subathonData.userStats).find(
    k => k.toLowerCase() === safeName.toLowerCase()
  );
  
  const key = existingKey || safeName;
  if (!subathonData.userStats[key]) {
    subathonData.userStats[key] = { subs: 0, bits: 0, tips: 0 };
  }
  return subathonData.userStats[key];
}

function checkSubathonGoals() {
  let changed = false;
  if (subathonData.goals && Array.isArray(subathonData.goals)) {
    subathonData.goals.forEach(g => {
      if (!g.completed && subathonData.currentSubs >= g.target) {
        g.completed = true;
        changed = true;
      }
    });
  }
  return changed;
}

let isSaving = false;
let pendingSave = false;

function saveData() {
  if (isSaving) {
    pendingSave = true;
    return false;
  }
  isSaving = true;
  pendingSave = false;

  try {
    const payload = JSON.stringify({ timerSeconds, settings, subathonData }, null, 2);
    const tmpFile = DATA_FILE + '.tmp';

    // 1. Escrita síncrona no ficheiro temporário com fsync para forçar persistência em disco físico
    let fd;
    try {
      fd = fs.openSync(tmpFile, 'w');
      fs.writeSync(fd, payload, 0, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      if (fd !== undefined) {
        try { fs.closeSync(fd); } catch (e) {}
      }
    }

    // 2. Verificar integridade do .tmp antes de alterar ficheiros existentes
    const tmpStats = fs.statSync(tmpFile);
    if (tmpStats.size < 10) {
      throw new Error('Ficheiro temporário gerado é inválido ou vazio.');
    }

    // 3. Fazer backup da versão anterior válida antes de sobrescrever
    if (fs.existsSync(DATA_FILE)) {
      try {
        const curStats = fs.statSync(DATA_FILE);
        // Só copia se o ficheiro tiver conteúdo (> 10 bytes)
        if (curStats.size > 10) {
          if (fs.existsSync(DATA_BAK_FILE)) {
            try { fs.copyFileSync(DATA_BAK_FILE, DATA_BAK2_FILE); } catch (e2) {}
          }
          fs.copyFileSync(DATA_FILE, DATA_BAK_FILE);
        }
      } catch (bErr) {}
    }

    // 4. Substituição atómica do ficheiro
    let replaced = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        fs.renameSync(tmpFile, DATA_FILE);
        replaced = true;
        break;
      } catch (rErr) {
        // No Windows, pausas breves resolvem bloqueios temporários (ex: OneDrive / Indexer)
        const end = Date.now() + 30;
        while (Date.now() < end) {}
      }
    }

    if (!replaced) {
      // Fallback seguro se renameSync falhar devido a bloqueio do sistema operativo
      fs.copyFileSync(tmpFile, DATA_FILE);
      try { fs.unlinkSync(tmpFile); } catch (uErr) {}
    }
    return true;
  } catch (err) {
    console.error('Erro geral ao guardar dados:', err);
    return false;
  } finally {
    isSaving = false;
    if (pendingSave) {
      pendingSave = false;
      setImmediate(saveData);
    }
  }
}

function logAction(user, action) {
  const time = new Date().toLocaleString('pt-PT');
  const safeUser = user || 'Sistema';
  const msg = `[${time}] ${safeUser}: ${action}`;
  fs.appendFile(LOG_FILE, msg + '\n', () => {});
  console.log(msg);
  eventHistory.push(msg);
  if (eventHistory.length > 50) eventHistory.shift();
  io.emit('logEvent', msg);
}

// Prevenir que os browsers prendam os sockets do localtunnel
app.use((req, res, next) => {
  res.setHeader('Connection', 'close');
  next();
});

// Autenticação
app.use((req, res, next) => {
  const protectedPaths = [
    '/', '/index.html', '/admin.js', '/api/whoami', '/mod.html', '/mod.js',
    '/timer', '/timer.html',
    '/goals', '/goals.html',
    '/podium', '/podium.html',
    '/design', '/design.html', '/design.js', '/plugins', '/plugins.html', '/plugins.js'
  ];
  if (protectedPaths.includes(req.path)) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Painel de Mods"');
      return res.status(401).send('Acesso restrito');
    }
    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    if (auth[1] === settings.modPassword) {
      req.authUsername = auth[0] || 'Desconhecido';
      return next();
    } else {
      res.setHeader('WWW-Authenticate', 'Basic realm="Painel de Mods"');
      return res.status(401).send('Password Incorreta');
    }
  }
  next();
});

app.get('/api/whoami', (req, res) => {
  res.json({ user: req.authUsername });
});

app.get('/', (req, res, next) => {
  const host = req.headers.host || '';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
  } else {
    res.sendFile(path.join(process.cwd(), 'public', 'mod.html'));
  }
});

app.get('/timer', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'timer.html'));
});
app.get('/goals', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'goals.html'));
});
app.get('/podium', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'podium.html'));
});
app.get('/roulette', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'roulette.html'));
});
app.get('/design/:mode', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'design.html'));
});

app.get('/overlay/:mode', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'overlay.html'));
});
app.get('/plugins', (req, res) => res.sendFile(path.join(process.cwd(), 'public', 'plugins.html')));
app.get('/overlay/plugin/:id', (req, res) => {
  if (!plugins.get(req.params.id) || !settings.plugins?.[req.params.id]?.enabled) return res.sendStatus(404);
  res.sendFile(path.join(process.cwd(), 'public', 'plugin-host.html'));
});
app.get('/plugin-file/:id/:file', (req, res) => {
  const plugin = plugins.get(req.params.id);
  if (!plugin || !settings.plugins?.[plugin.id]?.enabled || !['overlay.html', 'config.html'].includes(req.params.file)) return res.sendStatus(404);
  res.set('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src data:; connect-src 'none'; frame-ancestors 'self'");
  res.sendFile(path.join(plugins.root, plugin.id, req.params.file));
});
app.use(express.static(path.join(process.cwd(), 'public')));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/plugins', (req, res, next) => {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return res.sendStatus(403);
  next();
});
app.get('/api/plugins', (req, res) => res.json(plugins.list().map(p => ({ ...p, enabled: !!settings.plugins?.[p.id]?.enabled }))));
app.get('/api/plugins/:id/public', (req, res) => {
  const p = plugins.get(req.params.id);
  if (!p || !settings.plugins?.[p.id]?.enabled) return res.sendStatus(404);
  res.json({ manifest: p, config: settings.plugins[p.id].config || {} });
});
app.post('/api/plugins/install', (req, res) => {
  try {
    const match = /^data:application\/(zip|x-zip-compressed);base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.zipBase64 || '');
    if (!match) return res.status(400).json({ error: 'ZIP inválido' });
    const p = plugins.install(Buffer.from(match[2], 'base64'));
    settings.plugins ||= {};
    settings.plugins[p.id] = { enabled: false, config: {} };
    if (!saveData()) return res.status(500).json({ error: 'Não foi possível guardar o plugin' });
    res.json(p);
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.post('/api/plugins/:id', (req, res) => {
  const p = plugins.get(req.params.id);
  if (!p) return res.sendStatus(404);
  if (typeof req.body?.enabled !== 'boolean') return res.sendStatus(400);
  settings.plugins ||= {};
  const previous = settings.plugins[p.id];
  settings.plugins[p.id] = { ...settings.plugins[p.id], enabled: req.body.enabled };
  if (!saveData()) { settings.plugins[p.id] = previous; return res.status(500).json({ error: 'Não foi possível guardar o plugin' }); }
  io.emit('pluginState', { id: p.id, enabled: req.body.enabled });
  res.json(settings.plugins[p.id]);
});
app.post('/api/plugins/:id/config', (req, res) => {
  const p = plugins.get(req.params.id);
  const config = req.body?.config;
  if (!p) return res.sendStatus(404);
  if (!config || Array.isArray(config) || typeof config !== 'object' || JSON.stringify(config).length > 4096 ||
      Object.entries(config).some(([key, value]) => !/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key) || /(token|password|secret|api_?key)/i.test(key) || !['string', 'number', 'boolean'].includes(typeof value) || String(value).length > 500)) return res.sendStatus(400);
  settings.plugins ||= {};
  const previous = settings.plugins[p.id];
  settings.plugins[p.id] = { ...settings.plugins[p.id], config };
  if (!saveData()) { settings.plugins[p.id] = previous; return res.status(500).json({ error: 'Não foi possível guardar o plugin' }); }
  io.emit('pluginConfig', { id: p.id, config });
  res.json(settings.plugins[p.id]);
});

// Só o launcher local, com o token criado para esta execução, pode controlar a bandeja.
app.use('/api/tray', (req, res, next) => {
  const address = req.socket.remoteAddress;
  if (!process.env.CSAPP_TRAY_TOKEN || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address) ||
      req.get('x-csapp-tray-token') !== process.env.CSAPP_TRAY_TOKEN) return res.sendStatus(403);
  next();
});

app.get('/api/tray', (req, res) => res.json({ isRunning }));
app.post('/api/tray/toggle', (req, res) => {
  isRunning = !isRunning;
  logAction('Bandeja', isRunning ? 'Iniciou o relógio' : 'Pausou o relógio');
  io.emit('timerState', isRunning);
  res.json({ isRunning });
});
app.post('/api/tray/exit', (req, res) => {
  const wasRunning = isRunning;
  isRunning = false;
  if (!saveData()) {
    isRunning = wasRunning;
    return res.status(500).send('Não foi possível guardar o estado.');
  }
  res.sendStatus(200);
  setImmediate(shutdown);
});

app.post('/api/upload', (req, res) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).send('No image');
  
  const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return res.status(400).send('Invalid');
  
  const ext = matches[1].split('/')[1] || 'png';
  const buffer = Buffer.from(matches[2], 'base64');
  
  const outDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  
  const finalName = 'img_' + Date.now() + '.' + ext;
  fs.writeFile(path.join(outDir, finalName), buffer, (err) => {
      if (err) return res.status(500).send('Save error');
      res.json({ url: '/uploads/' + finalName });
  });
});

app.post('/api/upload-font', (req, res) => {
  const { filename, fontBase64 } = req.body;
  if (!fontBase64) return res.status(400).send('No font');
  
  const matches = fontBase64.match(/^data:(.*);base64,(.+)$/);
  if (!matches || matches.length !== 3) return res.status(400).send('Invalid');
  
  const buffer = Buffer.from(matches[2], 'base64');
  
  const outDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  
  const ext = filename.split('.').pop() || 'ttf';
  const finalName = 'font_' + Date.now() + '.' + ext;
  fs.writeFile(path.join(outDir, finalName), buffer, (err) => {
      if (err) return res.status(500).send('Save error');
      res.json({ url: '/uploads/' + finalName });
  });
});

app.post('/api/sounds/:type', (req, res) => {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return res.sendStatus(403);
  if (!['sub', 'gift', 'bits', 'tip', 'kofi', 'follow', 'raid', 'manual'].includes(req.params.type)) return res.sendStatus(400);
  const match = /^data:audio\/(mpeg|mp3|ogg|wav|x-wav|wave|vnd\.wave);base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.audioBase64 || '');
  if (!match) return res.status(400).json({ error: 'Formato inválido (MP3, OGG ou WAV).' });
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 1024 * 1024) return res.status(400).json({ error: 'Máximo: 1 MB.' });
  const kind = bytes.toString('ascii', 0, 4);
  const ext = kind === 'RIFF' && bytes.length >= 44 && bytes.toString('ascii', 8, 12) === 'WAVE' && bytes.toString('ascii', 12, 16) === 'fmt ' && [1, 3].includes(bytes.readUInt16LE(20)) ? 'wav'
    : kind === 'OggS' && bytes.length >= 27 && bytes[4] === 0 ? 'ogg'
    : kind === 'ID3' && bytes.length >= 10 || bytes.length >= 4 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 ? 'mp3' : null;
  if (!ext) return res.status(400).json({ error: 'Áudio inválido.' });
  const dir = path.join(process.cwd(), 'public', 'uploads', 'sounds');
  fs.mkdirSync(dir, { recursive: true });
  const name = `${req.params.type}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(dir, name), bytes);
  res.json({ url: `/uploads/sounds/${name}` });
});

app.get('/api/sync-sheets', (req, res) => {
  if (!settings.googleSheetUrl || !settings.googleSheetUrl.startsWith('https://script.google.com/')) {
      return res.status(400).json({ error: 'URL do Google Sheets não configurado na aba Segurança.' });
  }
  const url = settings.googleSheetUrl;
  
  const fetchSheets = (targetUrl) => {
      https.get(targetUrl, (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
              fetchSheets(response.headers.location);
              return;
          }
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
              try {
                  const users = JSON.parse(data);
                  if (users.error) return res.status(400).json(users);
                  
                  const normalizedUsers = {};
                  Object.entries(users).forEach(([sheetUser, s]) => {
                      const trimmed = (sheetUser && typeof sheetUser === 'string') ? sheetUser.trim() : '';
                      if (!trimmed) return;
                      const existingKey = Object.keys(normalizedUsers).find(k => k.toLowerCase() === trimmed.toLowerCase());
                      const key = existingKey || trimmed;
                      if (!normalizedUsers[key]) normalizedUsers[key] = { subs: 0, bits: 0, tips: 0 };
                      normalizedUsers[key].subs += parseFloat(s.subs) || 0;
                      normalizedUsers[key].bits += parseInt(s.bits) || 0;
                      normalizedUsers[key].tips += parseFloat(s.tips) || 0;
                  });
                  subathonData.userStats = normalizedUsers;
                  saveData();
                  io.emit('subathonUpdated', subathonData);
                  res.json({ success: true, count: Object.keys(normalizedUsers).length });
              } catch (e) {
                  res.status(500).json({ error: 'Erro ao interpretar resposta do Google Sheets.' });
              }
          });
      }).on('error', () => res.status(500).json({ error: 'Erro de rede ao conectar ao Google Sheets.' }));
  };
  
  fetchSheets(url);
});

let seSocket = null;
let currentBaseUrl = '';
let currentTunnel = null;

let kofiTunnel = null;
let currentKofiUrl = '';

async function startLocaltunnel(newName) {
  if (kofiTunnel) {
    try { 
      kofiTunnel.isManualClose = true;
      kofiTunnel.close(); 
    } catch(e) {}
    kofiTunnel = null;
  }
  if (!newName) return;

  console.log(`A iniciar localtunnel (subdomain: ${newName})... Isto pode demorar 1-2 minutos!`);
  localtunnel({ port: PORT, subdomain: newName })
    .then(tunnel => {
        if (shuttingDown) { tunnel.close(); return; }
        kofiTunnel = tunnel;
        currentKofiUrl = tunnel.url;
        io.emit('kofiUrl', currentKofiUrl);
        console.log(`\n[+] Túnel Ko-fi online: ${currentKofiUrl}/kofi-webhook\n`);

        tunnel.on('close', () => {
            if (tunnel.isManualClose || shuttingDown) return;
            console.log('Túnel Ko-fi fechado! A tentar reconectar em 5 segundos...');
            setTimeout(() => startLocaltunnel(newName), 5000);
        });
    })
    .catch(err => {
        if (shuttingDown) return;
        console.error('Erro no localtunnel:', err);
        setTimeout(() => startLocaltunnel(newName), 5000);
    });
}

async function startCloudflare(newName) {
  if (currentTunnel) {
    try { 
        currentTunnel.isManualClose = true;
        currentTunnel.kill(); 
    } catch(e) {}
    currentTunnel = null;
  }
  
  console.log('A iniciar túnel Cloudflare (trycloudflare)...');
  
  const isPkg = typeof process.pkg !== 'undefined';
  const baseDir = isPkg ? path.dirname(process.execPath) : process.cwd();
  const cfPath = path.join(baseDir, 'cloudflared.exe');
  
  const { spawn } = require('child_process');
  const tunnelProcess = spawn(cfPath, ['tunnel', '--url', `http://localhost:${PORT}`], { windowsHide: true });
  currentTunnel = tunnelProcess;
  
  tunnelProcess.stderr.on('data', (data) => {
      const output = data.toString();
      const match = output.match(/(https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com)/);
      if (match && match[1]) {
          if (currentBaseUrl !== match[1]) {
              currentBaseUrl = match[1];
              io.emit('baseUrl', currentBaseUrl);
              console.log(`\n[+] Túnel Cloudflare online (Mods): ${currentBaseUrl}/mod.html\n`);
          }
      }
  });
  
  tunnelProcess.on('close', () => {
    if (tunnelProcess.isManualClose || shuttingDown) return;
    console.log('Túnel Cloudflare fechado ou caiu! A tentar reconectar em 5 segundos...');
    setTimeout(() => startCloudflare(newName), 5000);
  });
  tunnelProcess.on('error', (err) => console.error('Erro no túnel Cloudflare:', err));
}

async function startTunnels(newName) {
    startLocaltunnel(newName);
    startCloudflare(newName);
}

setInterval(() => {
  if (isRunning) {
    if (timerSeconds > 0) {
      setTimerSeconds(timerSeconds - 1);
      if (timerSeconds % 5 === 0) saveData();
    }
    
    if (timerSeconds === 0) {
      isRunning = false;
      io.emit('timerState', isRunning);
      io.emit('eventAlert', 'O TEMPO ACABOU!');
      logAction('Sistema', 'O temporizador chegou a 00:00:00!');
      saveData();
    }
  }
}, 1000);

let currentSeStatus = 'Desconectado';

io.on('connection', (socket) => {
  socket.emit('init', { timerSeconds, isRunning, settings, baseUrl: currentBaseUrl, kofiUrl: currentKofiUrl, subathonData });
  socket.emit('seStatus', currentSeStatus);
  socket.emit('historyInit', eventHistory);

  socket.on('updateSubathon', (d) => {
    if (!d.userStats) d.userStats = subathonData.userStats || {};
    subathonData = d;
    saveData();
    io.emit('subathonUpdated', subathonData);
  });

  socket.on('updateSettings', (data) => {
    if (!data?.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) return;
    const oldTunnelName = settings.tunnelName;
    if (Object.hasOwn(data.settings, 'maxTimerHours')) {
      const hours = Number(data.settings.maxTimerHours);
      if (data.settings.maxTimerHours !== '' && (!Number.isFinite(hours) || hours < 0 || hours > 8760)) return;
    }
    settings = { ...settings, ...data.settings };
    setTimerSeconds(timerSeconds);
    saveData();
    cleanOrphanUploads(true);
    logAction(data.user, 'Alterou as definições do timer');
    io.emit('settingsUpdated', settings);
    if (settings.seToken) connectStreamElements(settings.seToken);
    
    if (settings.tunnelName !== oldTunnelName) {
      logAction('Sistema', `Reiniciou o túnel com o nome: ${settings.tunnelName}`);
      startTunnels(settings.tunnelName);
    }
  });

  socket.on('updateDesign', (d, ack) => {
    const key = { timer: 'timer', goals: 'goalsQueue', podium: 'podium', roulette: 'roulette' }[d?.mode];
    const design = d?.data;
    if (!key || !design || typeof design !== 'object' || Array.isArray(design) ||
        !Array.isArray(design.images) || !Array.isArray(design.texts) || !Array.isArray(design.fonts) ||
        !design[key] || typeof design[key] !== 'object' || JSON.stringify(design).length > 1024 * 1024) {
      if (ack) ack({ error: 'Design inválido' });
      return;
    }
    if (!settings.designs) settings.designs = {};
    const previous = settings.designs[d.mode];
    settings.designs[d.mode] = d.data;
    if (!saveData()) {
      if (previous === undefined) delete settings.designs[d.mode];
      else settings.designs[d.mode] = previous;
      if (ack) ack({ error: 'Não foi possível guardar o design' });
      return;
    }
    cleanOrphanUploads(true);
    logAction(d.user, `Atualizou o design de: ${d.mode}`);
    io.emit('settingsUpdated', settings);
    if (ack) ack({ ok: true });
  });

  socket.on('setTimer', (data) => { 
    const seconds = Number(data?.seconds);
    if (!Number.isFinite(seconds)) return;
    setTimerSeconds(seconds);
    saveData(); 
    logAction(data.user, `Fez reset ao timer para ${data.seconds}s`);
  });
  
  socket.on('addTime', (data) => { 
    const seconds = Number(data.seconds);
    if (!Number.isFinite(seconds)) return;
    if (seconds > 0) emitSound('manual');
    setTimerSeconds(timerSeconds + seconds, seconds > 0 ? 'manual' : null);
    saveData(); 
    const acao = data.seconds >= 0 ? `Adicionou ${data.seconds}s` : `Removeu ${Math.abs(data.seconds)}s`;
    logAction(data.user, acao);
    // Emits alert on manual adds to trigger flash!
    if (data.seconds > 0) io.emit('eventAlert', `Mod/Streamer adicionou ${data.seconds}s`);
  });
  
  socket.on('toggleTimer', (data) => { 
    isRunning = data.state; 
    logAction(data.user, isRunning ? 'Iniciou o relógio' : 'Pausou o relógio');
    io.emit('timerState', isRunning); 
  });

  socket.on('spinRoulette', () => {
    logAction('Streamer', 'Girou a Roleta!');
    io.emit('spinRouletteClient');
  });

  socket.on('rouletteWinner', (data) => {
    io.emit('rouletteWinner', data);
  });
});

function connectStreamElements(token) {
  if (!token) return;
  if (seSocket) seSocket.disconnect();
  currentSeStatus = 'A conectar...';
  io.emit('seStatus', currentSeStatus);
  seSocket = ioClient('https://realtime.streamelements.com', { transports: ['websocket'] });
  seSocket.on('connect', () => seSocket.emit('authenticate', { method: 'jwt', token: token }));
  seSocket.on('authenticated', () => {
    currentSeStatus = 'Conectado';
    io.emit('seStatus', currentSeStatus);
    console.log('[+] Conectado ao StreamElements com sucesso!');
  });
  seSocket.on('unauthorized', () => {
    currentSeStatus = 'Token Inválido';
    io.emit('seStatus', currentSeStatus);
  });
  seSocket.on('disconnect', () => {
    currentSeStatus = 'Desconectado';
    io.emit('seStatus', currentSeStatus);
  });

  let giftAccumulator = {};

function processSubscriber(user, amt, tier, isGifted) {
  emitSound(isGifted ? 'gift' : 'sub');
  let timePerSub = settings.subTime;
  if (tier === '2000' && settings.subTimeT2 !== undefined) {
      timePerSub = settings.subTimeT2;
  } else if (tier === '3000' && settings.subTimeT3 !== undefined) {
      timePerSub = settings.subTimeT3;
  }

  let goalsNeedUpdate = false;
  if (!settings.goalTrackingType || settings.goalTrackingType === 'subs') {
      subathonData.currentSubs += amt;
      goalsNeedUpdate = true;
  } else if (settings.goalTrackingType === 'money') {
      const subValue = settings.goalSubValue !== undefined ? parseFloat(settings.goalSubValue) : 5;
      let moneyAmt = amt * subValue;
      if (tier === '2000') moneyAmt = amt * (subValue * 2);
      if (tier === '3000') moneyAmt = amt * (subValue * 5);
      subathonData.currentSubs += moneyAmt;
      goalsNeedUpdate = true;
  }

  const uStats = getOrCreateUserStats(user);
  uStats.subs += amt;
  
  let timeToAdd = amt * timePerSub;
  const prefix = isGifted ? 'Gift Subs' : 'Subs';
  logToGoogleSheets(`${prefix} T${tier.charAt(0) || '1'}`, amt, user);

  if (timeToAdd > 0) {
    setTimerSeconds(timerSeconds + timeToAdd, isGifted ? 'gift' : 'sub');
    logAction('StreamElements', `Recebeu evento (${isGifted ? 'gifted sub' : 'subscriber'}) de ${user} e adicionou ${timeToAdd}s`);
    io.emit('eventAlert', `StreamElements Adicionou: +${timeToAdd}s`);
  }
  
  if (goalsNeedUpdate) {
    checkSubathonGoals();
  }
  saveData();
  io.emit('subathonUpdated', subathonData);
}

  seSocket.on('event', (data) => {
    if (!data || !data.type) return;
    let timeToAdd = 0;
    const rawUsername = data.data ? (data.data.username || data.data.displayName || data.data.name) : null;
    const username = (rawUsername && typeof rawUsername === 'string' && rawUsername.trim()) ? rawUsername.trim() : 'Anónimo';

    let goalsNeedUpdate = false;

    if (data.type === 'subscriber') {
      const amt = 1; // Um evento de subscriber equivale sempre a 1 sub (amount na SE é o total de meses/streak)
      const tier = String(data.data.tier || '1000');
      const isGift = data.data.gifted === true;
      
      if (isGift) {
          const rawGifter = data.data.sender || data.data.senderUsername || data.data.gifter || data.data.user;
          const gifter = (rawGifter && typeof rawGifter === 'string' && rawGifter.trim()) ? rawGifter.trim() : 'Anónimo';
          const key = `${gifter}_${tier}`;
          
          if (!giftAccumulator[key]) {
              giftAccumulator[key] = { amount: 0, timer: null };
          }
          giftAccumulator[key].amount += amt;
          
          clearTimeout(giftAccumulator[key].timer);
          giftAccumulator[key].timer = setTimeout(() => {
              const finalAmt = giftAccumulator[key].amount;
              delete giftAccumulator[key];
              processSubscriber(gifter, finalAmt, tier, true);
          }, 2500); // 2.5s debounce para agrupar gift bombs
          return;
      } else {
          processSubscriber(username, amt, tier, false);
          return;
      }
    } else if (data.type === 'cheer') {
      const amt = data.data.amount || 0;
      const uStats = getOrCreateUserStats(username);
      uStats.bits += amt;
      if (settings.goalTrackingType === 'money') {
          subathonData.currentSubs += Math.floor(amt / 100);
          goalsNeedUpdate = true;
      }
      timeToAdd = Math.floor(amt / 100) * settings.bitTime;
      logToGoogleSheets('Bits', amt, username);
      saveData();
      io.emit('subathonUpdated', subathonData);
    } else if (data.type === 'tip' || data.type === 'donation') {
      const amt = parseFloat(data.data.amount) || 0;
      if (settings.goalTrackingType === 'money') {
          subathonData.currentSubs += amt;
          goalsNeedUpdate = true;
      }
      const uStats = getOrCreateUserStats(username);
      uStats.tips += amt;
      timeToAdd = amt * settings.tipTime;
      logToGoogleSheets('Tips', amt, username);
      saveData();
      io.emit('subathonUpdated', subathonData);
    } else if (data.type === 'follow' || data.type === 'follower') {
      timeToAdd = settings.followTime || 0;
      logToGoogleSheets('Follow', 1, username);
      if (timeToAdd === 0) {
        logAction('StreamElements', `Recebeu follow de ${username}`);
      }
    } else if (data.type === 'raid' || data.type === 'host') {
      const amt = data.data.amount || 1;
      const baseTime = settings.baseRaidTime !== undefined ? settings.baseRaidTime : 0;
      timeToAdd = baseTime + (amt * settings.raidTime);
      logToGoogleSheets('Raids', amt, data.data.username || username);
    }

    if (['cheer', 'tip', 'donation', 'follow', 'follower', 'raid', 'host'].includes(data.type)) {
      const soundType = data.type === 'cheer' ? 'bits' : data.type === 'tip' || data.type === 'donation' ? 'tip' : data.type === 'follow' || data.type === 'follower' ? 'follow' : 'raid';
      emitSound(soundType);
    }
    if (timeToAdd > 0) {
      const soundType = data.type === 'cheer' ? 'bits' : data.type === 'tip' || data.type === 'donation' ? 'tip' : data.type === 'follow' || data.type === 'follower' ? 'follow' : 'raid';
      setTimerSeconds(timerSeconds + timeToAdd, soundType);
      saveData();
      logAction('StreamElements', `Recebeu evento (${data.type}) de ${username} e adicionou ${timeToAdd}s`);
      io.emit('eventAlert', `StreamElements Adicionou: +${timeToAdd}s`);
    }
    
    if (goalsNeedUpdate) {
      checkSubathonGoals();
      io.emit('subathonUpdated', subathonData);
      saveData();
    }
  });
}

app.post('/kofi-webhook', (req, res) => {
  try {
    const dataObj = req.body.data ? JSON.parse(req.body.data) : req.body;
    if (dataObj.type === 'Test' || dataObj.type === 'Verification') {
        emitSound('kofi');
        const timeToAdd = 3 * settings.kofiTime;
        setTimerSeconds(timerSeconds + timeToAdd, 'kofi');
        saveData();
        logAction('Ko-fi', `Recebeu doação de TESTE. Adicionou ${timeToAdd}s`);
        io.emit('eventAlert', `[TESTE] Ko-fi adicionou ${timeToAdd}s!`);
        return res.sendStatus(200);
    }
    const amount = parseFloat(dataObj.amount);
    if (!isNaN(amount) && amount > 0) {
      emitSound('kofi');
      const username = (dataObj.from_name && typeof dataObj.from_name === 'string') ? dataObj.from_name.trim() : 'Anónimo';
      const uStats = getOrCreateUserStats(username);
      uStats.tips += amount;
      
      if (settings.goalTrackingType === 'money') {
          subathonData.currentSubs += amount;
          checkSubathonGoals();
      }
      
      const timeToAdd = amount * settings.kofiTime;
      setTimerSeconds(timerSeconds + timeToAdd, 'kofi');
      saveData();
      logAction('Ko-fi', `Recebeu $${amount}. Adicionou ${timeToAdd}s`);
      io.emit('eventAlert', `Ko-fi $${amount} adicionou +${timeToAdd}s`);
      logToGoogleSheets('Ko-Fi', amount, username);
      io.emit('subathonUpdated', subathonData);
    }
  } catch (err) {
    console.error('[Ko-fi Erro]', err);
  }
  res.sendStatus(200);
});

const PORT = process.env.PORT || 7331;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  isRunning = false;
  saveData();
  if (seSocket) seSocket.disconnect();
  if (kofiTunnel) {
    kofiTunnel.isManualClose = true;
    try { kofiTunnel.close(); } catch (err) { console.error('Erro ao fechar Ko-fi:', err); }
  }
  if (currentTunnel) {
    currentTunnel.isManualClose = true;
    try { currentTunnel.kill(); } catch (err) { console.error('Erro ao fechar Cloudflare:', err); }
  }
  io.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

function startServer() {
  cleanOrphanUploads(false);
  server.listen(PORT, async () => {
    console.log(`\nServidor em http://localhost:${PORT}`);
    if (!process.env.CSAPP_NO_BROWSER) require('child_process').exec(`start http://localhost:${PORT}`, { windowsHide: true });
    await startTunnels(settings.tunnelName);
    if (settings.seToken) {
      connectStreamElements(settings.seToken);
      console.log('A tentar auto-conectar ao StreamElements usando o token guardado...');
    }
  });
}

startServer();

