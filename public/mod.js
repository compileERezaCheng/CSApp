
const socket = io({ transports: ['websocket'] });

const els = {
    timerText: document.getElementById('timerText'),
    btnToggle: document.getElementById('btnToggle'),
    btnSet: document.getElementById('btnSet'),
    btnAdd: document.getElementById('btnAdd'),
    btnRemove: document.getElementById('btnRemove'),
    manualSecs: document.getElementById('manualSecs'),
    subTime: document.getElementById('subTime'),
    bitTime: document.getElementById('bitTime'),
    tipTime: document.getElementById('tipTime'),
    kofiTime: document.getElementById('kofiTime'),
    followTime: document.getElementById('followTime'),
    raidTime: document.getElementById('raidTime'),
    enableFlash: document.getElementById('enableFlash'),
    btnSave: document.getElementById('btnSave')
};

let isRunning = false;
let currentUser = 'Desconhecido';
let serverSettings = {}; // to keep settings we don't modify intact

fetch('/api/whoami')
    .then(r => r.json())
    .then(d => { if(d.user) currentUser = d.user; })
    .catch(() => {});

function format(s) {
    const h = Math.floor(s/3600).toString().padStart(2, '0');
    const m = Math.floor((s%3600)/60).toString().padStart(2, '0');
    const sc = (s%60).toString().padStart(2, '0');
    return `${h}:${m}:${sc}`;
}

function parseInput(input) {
    if (!input) return NaN;
    let totalSeconds = 0;
    if (input.includes(':')) {
        const parts = input.split(':').map(n => parseInt(n, 10) || 0);
        if (parts.length === 3) totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        else if (parts.length === 2) totalSeconds = parts[0] * 60 + parts[1];
        else totalSeconds = parts[0];
    } else {
        totalSeconds = parseInt(input, 10);
    }
    return totalSeconds;
}

socket.on('init', (data) => {
    isRunning = data.isRunning;
    els.btnToggle.innerText = isRunning ? 'Pause' : 'Start';
    els.timerText.innerText = format(data.timerSeconds);
    
    serverSettings = data.settings;
    const s = data.settings;
    
    els.subTime.value = s.subTime; els.bitTime.value = s.bitTime;
    els.tipTime.value = s.tipTime; els.kofiTime.value = s.kofiTime;
    els.followTime.value = s.followTime; els.raidTime.value = s.raidTime;
    if (s.enableFlash !== undefined) els.enableFlash.checked = s.enableFlash; else els.enableFlash.checked = true;
});

socket.on('timeUpdate', (s) => els.timerText.innerText = format(s));
socket.on('timerState', (r) => { isRunning = r; els.btnToggle.innerText = isRunning ? 'Pause' : 'Start'; });

socket.on('logEvent', (msg) => {
    const list = document.getElementById('historyList');
    if (list.innerText.includes('Ainda sem atividade') || list.innerText.includes('sem atividade')) list.innerHTML = '';
    const li = document.createElement('li');
    li.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
    li.style.padding = '4px 0';
    li.innerText = msg;
    list.prepend(li);
});

socket.on('eventAlert', (msg) => {
    if (els.enableFlash && !els.enableFlash.checked) return;
    const originalBg = document.body.style.backgroundColor;
    document.body.style.transition = 'background-color 0.2s';
    document.body.style.backgroundColor = '#10b981';

    setTimeout(() => {
        document.body.style.backgroundColor = originalBg;
        setTimeout(() => document.body.style.transition = '', 200);
    }, 300);
});

els.btnToggle.onclick = () => socket.emit('toggleTimer', { state: !isRunning, user: currentUser });

els.btnSet.onclick = () => {
    const input = prompt("Set TOTAL TIME (e.g., 3600 for 1h, or 01:30:00 for 1.5h):");
    const totalSeconds = parseInput(input);
    if (!isNaN(totalSeconds)) socket.emit('setTimer', { seconds: totalSeconds, user: currentUser });
};

els.btnAdd.onclick = () => {
    const s = parseInput(els.manualSecs.value);
    if (!isNaN(s)) { socket.emit('addTime', { seconds: s, user: currentUser }); els.manualSecs.value = ''; }
};

els.btnRemove.onclick = () => {
    const s = parseInput(els.manualSecs.value);
    if (!isNaN(s)) { socket.emit('addTime', { seconds: -s, user: currentUser }); els.manualSecs.value = ''; }
};

els.btnSave.onclick = () => {
    const newSettings = {
        ...serverSettings,
        subTime: parseInt(els.subTime.value, 10) || 0,
        bitTime: parseInt(els.bitTime.value, 10) || 0,
        tipTime: parseInt(els.tipTime.value, 10) || 0,
        kofiTime: parseInt(els.kofiTime.value, 10) || 0,
        followTime: parseInt(els.followTime.value, 10) || 0,
        raidTime: parseInt(els.raidTime.value, 10) || 0,
        enableFlash: els.enableFlash.checked
    };
    
    socket.emit('updateSettings', { settings: newSettings, user: currentUser });
    alert('Settings saved successfully!');
};

socket.on('settingsUpdated', (s) => {
    serverSettings = s;
    els.subTime.value = s.subTime; els.bitTime.value = s.bitTime;
    els.tipTime.value = s.tipTime; els.kofiTime.value = s.kofiTime;
    els.followTime.value = s.followTime; els.raidTime.value = s.raidTime;
    if (s.enableFlash !== undefined) els.enableFlash.checked = s.enableFlash; else els.enableFlash.checked = true;
});
