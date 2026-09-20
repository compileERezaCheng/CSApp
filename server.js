const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');
const localtunnel = require('localtunnel');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const https = require('https');

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
const LOG_FILE = path.join(process.cwd(), 'logs.txt');

function parseDataSafe(filePath) {
  if (!fs.existsSync(filePath)) return null;
  let content = fs.readFileSync(filePath, 'utf8');
  // Remover UTF-8 BOM (\uFEFF) se presente (comum em ficheiros editados no Notepad)
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  // Remover bytes nulos e espaços em branco desnecessários
  content = content.replace(/\0/g, '').trim();
  if (!content) return {};
  return JSON.parse(content);
}

let savedData = {};
try {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const parsed = parseDataSafe(DATA_FILE);
      if (parsed) savedData = parsed;
    } catch (parseErr) {
      console.error('Erro a ler dados guardados de data.json:', parseErr);
      // Backup do ficheiro com erro para não perder dados originais
      try {
        const corruptBackup = path.join(process.cwd(), `data.corrupted.${Date.now()}.json`);
        fs.copyFileSync(DATA_FILE, corruptBackup);
        console.warn(`[Aviso] Cópia de segurança do ficheiro corrompido guardada em: ${path.basename(corruptBackup)}`);
      } catch (bkErr) {}

      // Tentar recuperar do backup .bak se existir
      if (fs.existsSync(DATA_BAK_FILE)) {
        try {
          const bakParsed = parseDataSafe(DATA_BAK_FILE);
          if (bakParsed) {
            savedData = bakParsed;
            console.log('[Recuperação] Dados recuperados com sucesso a partir de data.json.bak!');
          }
        } catch (bakErr) {
          console.error('Erro ao tentar recuperar de data.json.bak:', bakErr);
        }
      }
    }
  }
} catch (e) { console.error('Erro geral ao processar dados guardados:', e); }

let timerSeconds = savedData.timerSeconds !== undefined ? savedData.timerSeconds : 3600;
let isRunning = false;
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

function saveData() {
  try {
    const payload = JSON.stringify({ timerSeconds, settings, subathonData }, null, 2);
    const tmpFile = DATA_FILE + '.tmp';

    // 1. Escrever primeiro num ficheiro temporário
    fs.writeFile(tmpFile, payload, 'utf8', (err) => {
      if (err) {
        // Fallback para escrita direta caso haja restrições na criação do .tmp
        fs.writeFile(DATA_FILE, payload, 'utf8', (wErr) => {
          if (wErr) console.error('Erro a guardar dados:', wErr);
        });
        return;
      }

      // 2. Fazer backup da versão anterior válida antes de sobrescrever
      if (fs.existsSync(DATA_FILE)) {
        try {
          fs.copyFileSync(DATA_FILE, DATA_BAK_FILE);
        } catch (bErr) {}
      }

      // 3. Substituição atómica do ficheiro
      fs.rename(tmpFile, DATA_FILE, (renameErr) => {
        if (renameErr) {
          // Fallback caso rename encontre bloqueio temporário no Windows
          fs.writeFile(DATA_FILE, payload, 'utf8', (wErr) => {
            if (wErr) console.error('Erro a guardar dados:', wErr);
          });
        }
      });
    });
  } catch (err) {
    console.error('Erro geral ao guardar dados:', err);
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
    '/design', '/design.html', '/design.js'
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
app.use(express.static(path.join(process.cwd(), 'public')));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

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
        kofiTunnel = tunnel;
        currentKofiUrl = tunnel.url;
        io.emit('kofiUrl', currentKofiUrl);
        console.log(`\n[+] Túnel Ko-fi online: ${currentKofiUrl}/kofi-webhook\n`);

        tunnel.on('close', () => {
            if (tunnel.isManualClose) return;
            console.log('Túnel Ko-fi fechado! A tentar reconectar em 5 segundos...');
            setTimeout(() => startLocaltunnel(newName), 5000);
        });
    })
    .catch(err => {
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
  
  const { exec } = require('child_process');
  const tunnelProcess = exec(`"${cfPath}" tunnel --url http://localhost:${PORT}`);
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
    if (tunnelProcess.isManualClose) return;
    console.log('Túnel Cloudflare fechado ou caiu! A tentar reconectar em 5 segundos...');
    setTimeout(() => startCloudflare(newName), 5000);
  });
}

async function startTunnels(newName) {
    startLocaltunnel(newName);
    startCloudflare(newName);
}

setInterval(() => {
  if (isRunning) {
    if (timerSeconds > 0) {
      timerSeconds--;
      io.emit('timeUpdate', timerSeconds);
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
    const oldTunnelName = settings.tunnelName;
    settings = { ...settings, ...data.settings };
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

  socket.on('updateDesign', (d) => {
    if (!settings.designs) settings.designs = {};
    settings.designs[d.mode] = d.data;
    saveData();
    cleanOrphanUploads(true);
    logAction(d.user, `Atualizou o design de: ${d.mode}`);
    io.emit('settingsUpdated', settings);
  });

  socket.on('setTimer', (data) => { 
    timerSeconds = data.seconds; 
    saveData(); 
    logAction(data.user, `Fez reset ao timer para ${data.seconds}s`);
    io.emit('timeUpdate', timerSeconds); 
  });
  
  socket.on('addTime', (data) => { 
    timerSeconds += data.seconds; 
    if(timerSeconds < 0) timerSeconds = 0; 
    saveData(); 
    const acao = data.seconds >= 0 ? `Adicionou ${data.seconds}s` : `Removeu ${Math.abs(data.seconds)}s`;
    logAction(data.user, acao);
    io.emit('timeUpdate', timerSeconds); 
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
    timerSeconds += timeToAdd;
    logAction('StreamElements', `Recebeu evento (${isGifted ? 'gifted sub' : 'subscriber'}) de ${user} e adicionou ${timeToAdd}s`);
    io.emit('timeUpdate', timerSeconds);
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

    if (timeToAdd > 0) {
      timerSeconds += timeToAdd;
      saveData();
      logAction('StreamElements', `Recebeu evento (${data.type}) de ${username} e adicionou ${timeToAdd}s`);
      io.emit('timeUpdate', timerSeconds);
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
        const timeToAdd = 3 * settings.kofiTime;
        timerSeconds += timeToAdd;
        saveData();
        logAction('Ko-fi', `Recebeu doação de TESTE. Adicionou ${timeToAdd}s`);
        io.emit('timeUpdate', timerSeconds);
        io.emit('eventAlert', `[TESTE] Ko-fi adicionou ${timeToAdd}s!`);
        return res.sendStatus(200);
    }
    const amount = parseFloat(dataObj.amount);
    if (!isNaN(amount) && amount > 0) {
      const username = (dataObj.from_name && typeof dataObj.from_name === 'string') ? dataObj.from_name.trim() : 'Anónimo';
      const uStats = getOrCreateUserStats(username);
      uStats.tips += amount;
      
      if (settings.goalTrackingType === 'money') {
          subathonData.currentSubs += amount;
          checkSubathonGoals();
      }
      
      const timeToAdd = amount * settings.kofiTime;
      timerSeconds += timeToAdd;
      saveData();
      logAction('Ko-fi', `Recebeu $${amount}. Adicionou ${timeToAdd}s`);
      io.emit('timeUpdate', timerSeconds);
      io.emit('eventAlert', `Ko-fi $${amount} adicionou +${timeToAdd}s`);
      logToGoogleSheets('Ko-Fi', amount, username);
      io.emit('subathonUpdated', subathonData);
    }
  } catch (err) {
    console.error('[Ko-fi Erro]', err);
  }
  res.sendStatus(200);
});

const PORT = 3000;

function startServer() {
  cleanOrphanUploads(false);
  server.listen(PORT, async () => {
    console.log(`\nServidor em http://localhost:${PORT}`);
    require('child_process').exec(`start http://localhost:${PORT}`);
    await startTunnels(settings.tunnelName);
    if (settings.seToken) {
      connectStreamElements(settings.seToken);
      console.log('A tentar auto-conectar ao StreamElements usando o token guardado...');
    }
  });
}

startServer();

