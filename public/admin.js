const socket = io({ transports: ['websocket'] });

const els = {
    timerText: document.getElementById('timerText'),
    btnToggle: document.getElementById('btnToggle'),
    btnSet: document.getElementById('btnSet'),
    btnAdd: document.getElementById('btnAdd'),
    btnRemove: document.getElementById('btnRemove'),
    manualSecs: document.getElementById('manualSecs'),
    webhookUrlDisplay: document.getElementById('webhookUrlDisplay'),
    adminUrlDisplay: document.getElementById('adminUrlDisplay'),
    seStatus: document.getElementById('seStatus'),
    seToken: document.getElementById('seToken'),
    tunnelName: document.getElementById('tunnelName'),
    googleSheetUrl: document.getElementById('googleSheetUrl'),
    subTime: document.getElementById('subTime'),
    subTimeT2: document.getElementById('subTimeT2'),
    subTimeT3: document.getElementById('subTimeT3'),
    bitTime: document.getElementById('bitTime'),
    tipTime: document.getElementById('tipTime'),
    kofiTime: document.getElementById('kofiTime'),
    followTime: document.getElementById('followTime'),
    raidTime: document.getElementById('raidTime'),
    baseRaidTime: document.getElementById('baseRaidTime'),
    modPassword: document.getElementById('modPassword'),
    btnSave: document.getElementById('btnSave'),
    enableFlash: document.getElementById('enableFlash'),
    sensitiveDataGroup: document.getElementById('sensitiveDataGroup'),
    passwordGroup: document.getElementById('passwordGroup'),
    linksPanel: document.getElementById('linksPanel'),
    designTabBtn: document.getElementById('designTabBtn'),
    localOverlayGroup: document.getElementById('localOverlayGroup'),
    localOverlayLinkGoals: document.getElementById('localOverlayLinkGoals'),
    
    // Goals elements
    goalSubsTitle: document.getElementById('goalSubsTitle'),
    goalSubsCurrent: document.getElementById('goalSubsCurrent'),
    goalSubsTarget: document.getElementById('goalSubsTarget'),
    goalBitsTitle: document.getElementById('goalBitsTitle'),
    goalBitsCurrent: document.getElementById('goalBitsCurrent'),
    goalBitsTarget: document.getElementById('goalBitsTarget'),
    goalTipsTitle: document.getElementById('goalTipsTitle'),
    goalTipsCurrent: document.getElementById('goalTipsCurrent'),
    goalTipsTarget: document.getElementById('goalTipsTarget'),
    goalFollowsTitle: document.getElementById('goalFollowsTitle'),
    goalFollowsCurrent: document.getElementById('goalFollowsCurrent'),
    goalFollowsTarget: document.getElementById('goalFollowsTarget')
};

let isRunning = false;
let currentUser = 'Desconhecido';
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const isMod = !isLocal;

if (isMod) {
    if (els.sensitiveDataGroup) els.sensitiveDataGroup.style.display = 'none';
    if (els.passwordGroup) els.passwordGroup.style.display = 'none';
    if (els.linksPanel) els.linksPanel.style.display = 'none';
    if (els.designTabBtn) els.designTabBtn.style.display = 'none';
    if (els.localOverlayGroup) els.localOverlayGroup.style.display = 'none';
    const secTab = document.getElementById('securityTabBtn');
    if (secTab) secTab.style.display = 'none';
    
    // Translation for mods
    document.title = "Mod view (has delay)";
    const mainTitle = document.getElementById('mainTitle');
    if(mainTitle) mainTitle.innerText = "Mod view (has delay)";
    
    els.btnSet.innerText = "Set Time (Reset)";
    els.btnAdd.innerText = "Add";
    els.btnRemove.innerText = "Remove";
    els.btnSave.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px; vertical-align:middle;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save All Settings';
    els.manualSecs.placeholder = "Ex: 60 or 01:30";
    
    const manualControlTitle = document.getElementById('manualControlTitle');
    if(manualControlTitle) manualControlTitle.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px; vertical-align:middle;"><circle cx="12" cy="14" r="8"/><path d="M12 10v4"/><path d="M10 2h4"/><path d="M18.8 6.2l-2-2"/></svg> Manual Control (Add/Remove)';
    const historyTitle = document.getElementById('historyTitle');
    if(historyTitle) historyTitle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px; vertical-align:middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Action History';
    const tabEventsTitle = document.getElementById('tabEventsTitle');
    if(tabEventsTitle) tabEventsTitle.innerText = "Events & Times";
    
    const lblSub = document.getElementById('lblSub'); if(lblSub) lblSub.innerText = "Secs per Sub T1/Prime:";
    const lblSubT2 = document.getElementById('lblSubT2'); if(lblSubT2) lblSubT2.innerText = "Secs per Sub T2:";
    const lblSubT3 = document.getElementById('lblSubT3'); if(lblSubT3) lblSubT3.innerText = "Secs per Sub T3:";
    const lblBit = document.getElementById('lblBit'); if(lblBit) lblBit.innerText = "Secs per Bit:";
    const lblTip = document.getElementById('lblTip'); if(lblTip) lblTip.innerText = "Secs per $1 SE Tip:";
    const lblKofi = document.getElementById('lblKofi'); if(lblKofi) lblKofi.innerText = "Secs per $1 Ko-fi:";
    const lblFollow = document.getElementById('lblFollow'); if(lblFollow) lblFollow.innerText = "Secs per Follower:";
    const lblRaid = document.getElementById('lblRaid'); if(lblRaid) lblRaid.innerText = "Secs per Raider:";
    const lblBaseRaid = document.getElementById('lblBaseRaid'); if(lblBaseRaid) lblBaseRaid.innerText = "Base Secs per Raid:";
}

// Descobre o username que a pessoa usou para fazer login
fetch('/api/whoami')
    .then(r => r.json())
    .then(d => { if(d.user) currentUser = d.user; })
    .catch(() => {});

function switchView(viewId, btnEl) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sidebar-btn').forEach(el => el.classList.remove('active'));
    
    const view = document.getElementById(viewId);
    if(view) view.classList.add('active');
    
    if(btnEl) btnEl.classList.add('active');
}
window.switchView = switchView;

window.toggleVisibility = function(id) {
    const el = document.getElementById(id);
    if (el.type === 'password') el.type = 'text';
    else el.type = 'password';
};

window.copyValue = function(id) {
    const el = document.getElementById(id);
    if (!el.value) return;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(el.value).then(() => alert("Copiado!")).catch(() => alert("Erro ao copiar."));
    } else {
        el.select();
        document.execCommand("copy");
        alert("Copiado!");
    }
};

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
    if (els.btnToggle) els.btnToggle.innerText = isRunning ? (isMod ? 'Pause' : 'Pausar') : (isMod ? 'Start' : 'Iniciar');
    if (els.timerText) els.timerText.innerText = format(data.timerSeconds);
    
    if (data.kofiUrl) {
        if (els.webhookUrlDisplay) els.webhookUrlDisplay.value = data.kofiUrl + '/kofi-webhook';
    } else if (data.settings && data.settings.tunnelName) {
        if (els.webhookUrlDisplay) els.webhookUrlDisplay.value = "A conectar ao loca.lt (pode demorar 1-2 min)...";
    } else if (data.baseUrl) {
        if (els.webhookUrlDisplay) els.webhookUrlDisplay.value = data.baseUrl + '/kofi-webhook';
    }
    
    if(data.baseUrl) {
        if (els.adminUrlDisplay) els.adminUrlDisplay.value = data.baseUrl + '/mod.html';
    }
    
    const s = data.settings;
    if (isLocal) {
        if (els.seToken) els.seToken.value = s.seToken || '';
        if (els.modPassword) els.modPassword.value = s.modPassword || '123';
        if (data.settings.tunnelName && els.tunnelName) els.tunnelName.value = data.settings.tunnelName;
        if (data.settings.googleSheetUrl && els.googleSheetUrl) els.googleSheetUrl.value = data.settings.googleSheetUrl;
    }
    
    if (els.subTime) els.subTime.value = s.subTime; 
    if (els.subTimeT2) els.subTimeT2.value = s.subTimeT2 !== undefined ? s.subTimeT2 : (s.subTime * 2 || 600); 
    if (els.subTimeT3) els.subTimeT3.value = s.subTimeT3 !== undefined ? s.subTimeT3 : (s.subTime * 5 || 1500);
    if (els.bitTime) els.bitTime.value = s.bitTime;
    if (els.tipTime) els.tipTime.value = s.tipTime; 
    if (els.kofiTime) els.kofiTime.value = s.kofiTime;
    if (els.followTime) els.followTime.value = s.followTime; 
    if (els.raidTime) els.raidTime.value = s.raidTime;
    if (els.baseRaidTime) els.baseRaidTime.value = s.baseRaidTime !== undefined ? s.baseRaidTime : 0;
    
    const goalTrackingTypeEl = document.getElementById('goalTrackingType');
    if (goalTrackingTypeEl && s.goalTrackingType) goalTrackingTypeEl.value = s.goalTrackingType;
    
    const goalPrefixEl = document.getElementById('goalPrefix');
    if (goalPrefixEl && s.goalPrefix !== undefined) goalPrefixEl.value = s.goalPrefix;
    
    const goalSubValueEl = document.getElementById('goalSubValue');
    if (goalSubValueEl && s.goalSubValue !== undefined) goalSubValueEl.value = s.goalSubValue;
    
    if (els.enableFlash) {
        if (s.enableFlash !== undefined) els.enableFlash.checked = s.enableFlash; 
        else els.enableFlash.checked = true;
    }
    
    if (data.subathonData) {
        updateSubathonUI(data.subathonData);
    }
});

let currentSubathonGoals = [];

function updateSubathonUI(d) {
    if(!d) return;
    
    const subsEl = document.getElementById('subathonCurrentSubs');
    const visEl = document.getElementById('subathonVisibleCount');
    if (subsEl) subsEl.value = d.currentSubs || 0;
    if (visEl) visEl.value = d.visibleCount || 3;
    
    currentSubathonGoals = d.goals || [];
    renderGoalsQueue();
}

function renderGoalsQueue() {
    const list = document.getElementById('goalsQueueList');
    if (!list) return;
    list.innerHTML = '';
    
    currentSubathonGoals.forEach((g, idx) => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '10px';
        item.style.background = 'rgba(0,0,0,0.3)';
        item.style.padding = '10px';
        item.style.borderRadius = '5px';
        
        // Status indicator (check)
        const checkColor = g.completed ? '#10b981' : '#475569';
        
        item.innerHTML = `
            <div style="color:${checkColor}; display:flex; align-items:center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <div style="flex:1;">
                <input type="text" class="input" placeholder="Título do Objetivo (ex: Pintar Cabelo)" value="${g.title}" oninput="updateGoalField(${idx}, 'title', this.value)">
            </div>
            <div style="width:100px;">
                <input type="number" step="any" class="input" placeholder="Target" value="${g.target}" oninput="updateGoalField(${idx}, 'target', parseFloat(this.value)||0)">
            </div>
            <button class="btn danger" style="padding: 5px 10px;" onclick="removeGoal(${idx})">X</button>
        `;
        list.appendChild(item);
    });
}

window.updateGoalField = function(idx, field, val) {
    if (currentSubathonGoals[idx]) {
        currentSubathonGoals[idx][field] = val;
    }
};

window.removeGoal = function(idx) {
    currentSubathonGoals.splice(idx, 1);
    renderGoalsQueue();
};

const btnAddGoal = document.getElementById('btnAddGoal');
if (btnAddGoal) {
    btnAddGoal.onclick = () => {
        currentSubathonGoals.push({
            id: Date.now(),
            title: '',
            target: 0,
            completed: false
        });
        renderGoalsQueue();
    };
}

socket.on('subathonUpdated', (d) => {
    updateSubathonUI(d);
});

socket.on('timeUpdate', (s) => { if(els.timerText) els.timerText.innerText = format(s); });
socket.on('timerState', (r) => { 
    isRunning = r; 
    if(els.btnToggle) els.btnToggle.innerText = isRunning ? (isMod ? 'Pause' : 'Pausar') : (isMod ? 'Start' : 'Iniciar'); 
});
socket.on('baseUrl', (url) => {
    if(els.adminUrlDisplay) els.adminUrlDisplay.value = url + '/mod.html';
});
socket.on('kofiUrl', (url) => {
    if(els.webhookUrlDisplay) els.webhookUrlDisplay.value = url + '/kofi-webhook';
});
socket.on('seStatus', (s) => { if(els.seStatus) els.seStatus.innerText = s; });

socket.on('historyInit', (historyList) => {
    const list = document.getElementById('historyList');
    if(!list) return;
    list.innerHTML = '';
    if (historyList.length === 0) {
        list.innerHTML = '<li>Ainda sem atividade...</li>';
        return;
    }
    historyList.forEach(msg => {
        const li = document.createElement('li');
        li.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        li.style.padding = '4px 0';
        li.innerText = msg;
        list.prepend(li);
    });
});

socket.on('logEvent', (msg) => {
    const list = document.getElementById('historyList');
    if(!list) return;
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

if(els.btnToggle) els.btnToggle.onclick = () => socket.emit('toggleTimer', { state: !isRunning, user: currentUser });

if(els.btnSet) els.btnSet.onclick = () => {
    const msg = isMod ? "Set TOTAL TIME (e.g., 3600 for 1h, or 01:30:00 for 1.5h):" : "Coloca o TEMPO TOTAL (ex: 3600 para 1h, ou 01:30:00 para 1h e meia):";
    const input = prompt(msg);
    const totalSeconds = parseInput(input);
    if (!isNaN(totalSeconds)) socket.emit('setTimer', { seconds: totalSeconds, user: currentUser });
};

if(els.btnAdd) els.btnAdd.onclick = () => {
    const s = parseInput(els.manualSecs.value);
    if (!isNaN(s)) { socket.emit('addTime', { seconds: s, user: currentUser }); els.manualSecs.value = ''; }
};

if(els.btnRemove) els.btnRemove.onclick = () => {
    const s = parseInput(els.manualSecs.value);
    if (!isNaN(s)) { socket.emit('addTime', { seconds: -s, user: currentUser }); els.manualSecs.value = ''; }
};

if(els.btnSave) els.btnSave.onclick = () => {
    const newSettings = {};
    
    if (els.subTime) newSettings.subTime = parseInt(els.subTime.value, 10) || 0;
    if (els.subTimeT2) newSettings.subTimeT2 = parseInt(els.subTimeT2.value, 10) || 0;
    if (els.subTimeT3) newSettings.subTimeT3 = parseInt(els.subTimeT3.value, 10) || 0;
    if (els.bitTime) newSettings.bitTime = parseInt(els.bitTime.value, 10) || 0;
    if (els.tipTime) newSettings.tipTime = parseInt(els.tipTime.value, 10) || 0;
    if (els.kofiTime) newSettings.kofiTime = parseInt(els.kofiTime.value, 10) || 0;
    if (els.followTime) newSettings.followTime = parseInt(els.followTime.value, 10) || 0;
    if (els.raidTime) newSettings.raidTime = parseInt(els.raidTime.value, 10) || 0;
    if (els.baseRaidTime) newSettings.baseRaidTime = parseInt(els.baseRaidTime.value, 10) || 0;
    if (els.enableFlash) newSettings.enableFlash = els.enableFlash.checked;
    
    const goalTrackingTypeEl = document.getElementById('goalTrackingType');
    if (goalTrackingTypeEl) newSettings.goalTrackingType = goalTrackingTypeEl.value;
    
    const goalPrefixEl = document.getElementById('goalPrefix');
    if (goalPrefixEl) newSettings.goalPrefix = goalPrefixEl.value;
    
    const goalSubValueEl = document.getElementById('goalSubValue');
    if (goalSubValueEl) newSettings.goalSubValue = parseFloat(goalSubValueEl.value) || 0;
    
    if (isLocal) {
        if (els.modPassword) newSettings.modPassword = els.modPassword.value || '123';
        if (els.seToken) newSettings.seToken = els.seToken.value;
        if (els.tunnelName) newSettings.tunnelName = els.tunnelName.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (els.googleSheetUrl) newSettings.googleSheetUrl = els.googleSheetUrl.value;
    }
    
    if (Object.keys(newSettings).length > 0) {
        socket.emit('updateSettings', { settings: newSettings, user: currentUser });
    }

    const subathonSubsEl = document.getElementById('subathonCurrentSubs');
    const subathonVisEl = document.getElementById('subathonVisibleCount');
    if (subathonSubsEl && subathonVisEl) {
        const newSubathon = {
            currentSubs: parseFloat(subathonSubsEl.value) || 0,
            visibleCount: parseInt(subathonVisEl.value, 10) || 3,
            goals: currentSubathonGoals
        };
        // Ensure previously completed goals aren't reset, and check if newly changed currentSubs completes them
        newSubathon.goals.forEach(g => {
            if (newSubathon.currentSubs >= g.target) {
                g.completed = true;
            } else {
                g.completed = false;
            }
        });
        socket.emit('updateSubathon', newSubathon);
    }
    
    alert(isMod ? 'Settings saved successfully!' : 'Definições guardadas com sucesso!');
};
