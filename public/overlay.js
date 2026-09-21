const socket = io({ transports: ['websocket'] });
const urlParams = new URLSearchParams(window.location.search);
const pathMode = window.location.pathname.split('/').pop();
const currentMode = urlParams.get('mode') || (pathMode !== 'overlay' && pathMode !== 'overlay.html' ? pathMode : 'timer');

const timerText = document.getElementById('timerText');
const widget = document.querySelector('.timer-widget');
if (widget) {
    widget.style.position = 'absolute';
    widget.style.display = 'none'; // hidden by default, shown if mode is timer
    widget.style.justifyContent = 'center';
    widget.style.alignItems = 'center';
}

let currentImages = [];

function injectCustomFonts(fonts) {
    let styleEl = document.getElementById('custom-fonts');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'custom-fonts';
        document.head.appendChild(styleEl);
    }
    if (!fonts || fonts.length === 0) {
        styleEl.innerHTML = '';
        return;
    }
    let css = '';
    fonts.forEach(f => {
        css += `@font-face { font-family: "${f.name}"; src: url("${f.url}"); }\n`;
    });
    styleEl.innerHTML = css;
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            if (typeof currentMode === 'undefined' || !currentSettings || !currentSettings.designs) return;
            
            if (currentMode === 'roulette' && typeof renderRouletteWidget === 'function') {
                const rw = document.getElementById('roulette-widget');
                if (rw) renderRouletteWidget(rw, currentSettings.rouletteOptions || [], currentSettings.designs.roulette?.roulette || {});
            }
            
            if (currentMode === 'goals' && typeof renderSubathonGoals === 'function') {
                const gq = document.getElementById('goals-queue-widget');
                if (gq) renderSubathonGoals(gq, currentSettings.designs.goals?.goalsQueue || {});
            }
            
            if (currentMode === 'podium' && typeof renderPodiumWidget === 'function') {
                const pw = document.getElementById('podium-widget');
                if (pw) renderPodiumWidget(pw, currentSettings.designs.podium?.podium || {});
            }
        });
    }
}

function format(s) {
    const h = Math.floor(s/3600).toString().padStart(2, '0');
    const m = Math.floor((s%3600)/60).toString().padStart(2, '0');
    const sc = (s%60).toString().padStart(2, '0');
    return `${h}:${m}:${sc}`;
}

let currentGoals = null;

function applyVariables(text) {
    if (!text || !currentGoals) return text;
    let res = text;
    // Subs
    res = res.replace(/\{subs_current\}/g, currentGoals.subs?.current || 0);
    res = res.replace(/\{subs_target\}/g, currentGoals.subs?.target || 0);
    res = res.replace(/\{subs_title\}/g, currentGoals.subs?.title || '');
    // Bits
    res = res.replace(/\{bits_current\}/g, currentGoals.bits?.current || 0);
    res = res.replace(/\{bits_target\}/g, currentGoals.bits?.target || 0);
    res = res.replace(/\{bits_title\}/g, currentGoals.bits?.title || '');
    // Tips
    res = res.replace(/\{tips_current\}/g, (currentGoals.tips?.current || 0).toFixed(2));
    res = res.replace(/\{tips_target\}/g, (currentGoals.tips?.target || 0).toFixed(2));
    res = res.replace(/\{tips_title\}/g, currentGoals.tips?.title || '');
    // Follows
    res = res.replace(/\{follows_current\}/g, currentGoals.followers?.current || 0);
    res = res.replace(/\{follows_target\}/g, currentGoals.followers?.target || 0);
    res = res.replace(/\{follows_title\}/g, currentGoals.followers?.title || '');
    return res;
}

function updateDynamicTexts() {
    document.querySelectorAll('.canvas-text').forEach(el => {
        if (el.dataset.originalText) {
            el.innerText = applyVariables(el.dataset.originalText);
        }
    });
}
let currentSettings = null;

function applySettings(s) {
    currentSettings = s;
    if(!s || !s.designs) return;
    if(!s.designs[currentMode]) {
        s.designs[currentMode] = { images: [], texts: [], fonts: [] };
        if(currentMode === 'timer') s.designs.timer.timer = {};
        if(currentMode === 'goals') s.designs.goals.goalsQueue = {};
        if(currentMode === 'podium') s.designs.podium.podium = { x: 100, y: 100, width: 900, height: 300, fontSize: 24, color: '#ffffff' };
    }
    const d = s.designs[currentMode];
    
    injectCustomFonts(d.fonts);
    
    // Cleanup old images
    currentImages.forEach(el => el.remove());
    currentImages = [];
    
    // Add images
    if (d.images) {
        d.images.forEach(img => {
            const el = document.createElement('div');
            el.style.position = 'absolute';
            el.style.backgroundImage = `url("${img.url}")`;
            el.style.backgroundSize = '100% 100%';
            el.style.backgroundPosition = 'center';
            el.style.backgroundRepeat = 'no-repeat';
            el.style.left = img.x + 'px';
            el.style.top = img.y + 'px';
            el.style.width = img.width + 'px';
            el.style.height = img.height + 'px';
            el.style.opacity = img.opacity !== undefined ? img.opacity : 1;
            el.style.zIndex = img.zIndex !== undefined ? img.zIndex : 1;
            document.body.appendChild(el);
            currentImages.push(el);
        });
    }

    if(!d.texts) d.texts = [];
    d.texts.forEach(txt => {
        const txtEl = document.createElement('div');
        txtEl.className = 'canvas-text';
        txtEl.style.position = 'absolute';
        txtEl.style.left = txt.x + 'px';
        txtEl.style.top = txt.y + 'px';
        txtEl.style.width = txt.width + 'px';
        txtEl.style.height = 'auto';
        txtEl.style.minHeight = txt.height + 'px';
        txtEl.style.opacity = txt.opacity !== undefined ? txt.opacity : 1;
        txtEl.style.zIndex = txt.zIndex !== undefined ? txt.zIndex : 2;
        txtEl.style.fontSize = txt.fontSize + 'px';
        txtEl.style.color = txt.color || '#ffffff';
        txtEl.style.display = 'flex';
        txtEl.style.alignItems = 'center';
        txtEl.style.wordBreak = 'break-word';
        txtEl.style.whiteSpace = 'pre-wrap';
        
        const align = txt.textAlign || 'center';
        txtEl.style.textAlign = align;
        if (align === 'left') txtEl.style.justifyContent = 'flex-start';
        else if (align === 'right') txtEl.style.justifyContent = 'flex-end';
        else txtEl.style.justifyContent = 'center';
        
        txtEl.style.fontWeight = txt.fontWeight || 'normal';
        txtEl.style.fontStyle = txt.fontStyle || 'normal';
        txtEl.style.textDecoration = txt.textDecoration || 'none';
        
        txtEl.style.fontFamily = `"${txt.fontFamily || 'Arial'}"`;
        const sColor = txt.shadowColor || 'rgba(0,0,0,0.5)';
        const sBlur = txt.shadowBlur !== undefined ? txt.shadowBlur : 10;
        const sOffX = txt.shadowOffsetX !== undefined ? txt.shadowOffsetX : 0;
        const sOffY = txt.shadowOffsetY !== undefined ? txt.shadowOffsetY : 0;
        txtEl.style.textShadow = `${sOffX}px ${sOffY}px ${sBlur}px ${sColor}`;

        txtEl.dataset.originalText = txt.text || '';
        txtEl.innerText = applyVariables(txt.text || '');
        document.body.appendChild(txtEl);
        currentImages.push(txtEl);
    });
    
    // Apply Timer
    if (currentMode === 'timer' && d.timer && widget) {
        widget.style.display = 'flex';
        const t = d.timer;
        widget.style.zIndex = t.zIndex !== undefined ? t.zIndex : 10;
        widget.style.left = t.x + 'px';
        widget.style.top = t.y + 'px';
        widget.style.width = (t.width !== undefined ? t.width : 200) + 'px';
        widget.style.height = (t.height !== undefined ? t.height : 80) + 'px';
        widget.style.fontSize = t.fontSize + 'px';
        widget.style.fontFamily = `"${t.fontFamily || 'Arial'}"`;
        widget.style.color = t.color || '#ffffff';
        widget.style.backgroundColor = t.enableBg !== false ? (t.bg || '#0f172a') : 'transparent';
        widget.style.borderColor = t.enableBg !== false ? (t.border || '#8b5cf6') : 'transparent';
        widget.style.textShadow = `0 0 10px ${t.glow || '#8b5cf6'}`;
    } else if (widget) {
        widget.style.display = 'none';
    }

    // Apply Goals Queue
    let gqWidget = document.getElementById('goals-queue-widget');
    if (currentMode === 'goals' && d.goalsQueue) {
        if (!gqWidget) {
            gqWidget = document.createElement('div');
            gqWidget.id = 'goals-queue-widget';
            gqWidget.classList.add('canvas-overlay-timer'); // steal timer styles for border/rounded
            gqWidget.style.position = 'absolute';
            gqWidget.style.display = 'flex';
            gqWidget.style.flexDirection = 'column';
            gqWidget.style.gap = '5px';
            document.body.appendChild(gqWidget);
        }
        gqWidget.style.display = 'flex';
        const gq = d.goalsQueue;
        gqWidget.style.zIndex = gq.zIndex !== undefined ? gq.zIndex : 10;
        gqWidget.style.left = gq.x + 'px';
        gqWidget.style.top = gq.y + 'px';
        gqWidget.style.width = (gq.width !== undefined ? gq.width : 400) + 'px';
        gqWidget.style.height = (gq.height !== undefined ? gq.height : 300) + 'px';
        gqWidget.style.fontSize = gq.fontSize + 'px';
        gqWidget.style.fontFamily = `"${gq.fontFamily || 'Arial'}"`;
        gqWidget.style.color = gq.color || '#ffffff';
        gqWidget.style.backgroundColor = gq.enableBg !== false ? (gq.bg || 'rgba(15,23,42,0.8)') : 'transparent';
        gqWidget.style.borderColor = gq.enableBg !== false ? (gq.border || '#8b5cf6') : 'transparent';
        
        renderSubathonGoals(gqWidget, gq);
    } else if (gqWidget) {
        gqWidget.style.display = 'none';
    }
    // Apply Roulette
    const rouletteWidget = document.getElementById('roulette-widget');
    if (currentMode === 'roulette') {
        const r = d.roulette || {};
        
        let rw = rouletteWidget;
        if (!rw) {
            rw = document.createElement('div');
            rw.id = 'roulette-widget';
            rw.style.position = 'absolute';
            document.body.appendChild(rw);
            
            socket.on('spinRouletteClient', () => {
                if(typeof triggerSpin === 'function') triggerSpin(currentSettings?.rouletteOptions || [], r);
            });
        }
        
        rw.style.zIndex = r.zIndex !== undefined ? r.zIndex : 10;
        rw.style.left = (r.x !== undefined ? r.x : 560) + 'px';
        rw.style.top = (r.y !== undefined ? r.y : 140) + 'px';
        rw.style.width = (r.width || 800) + 'px';
        rw.style.height = (r.height || 800) + 'px';
        
        if (typeof renderRouletteWidget === 'function') {
            renderRouletteWidget(rw, currentSettings?.rouletteOptions || [], r);
        }
    }

    // Apply Podium
    let pWidget = document.getElementById('podium-widget');
    if (currentMode === 'podium' && d.podium) {
        if (!pWidget) {
            pWidget = document.createElement('div');
            pWidget.id = 'podium-widget';
            pWidget.classList.add('canvas-overlay-timer');
            pWidget.style.position = 'absolute';
            document.body.appendChild(pWidget);
        }
        pWidget.style.display = 'flex';
        const p = d.podium;
        pWidget.style.zIndex = p.zIndex !== undefined ? p.zIndex : 10;
        pWidget.style.left = p.x + 'px';
        pWidget.style.top = p.y + 'px';
        pWidget.style.width = (Math.max(p.width !== undefined ? p.width : 550, 550)) + 'px';
        pWidget.style.height = (Math.max(p.height !== undefined ? p.height : 250, 200)) + 'px';
        pWidget.style.fontSize = p.fontSize + 'px';
        pWidget.style.fontFamily = `"${p.fontFamily || 'Arial'}"`;
        pWidget.style.color = p.color || '#ffffff';
        pWidget.style.backgroundColor = 'transparent';
        pWidget.style.borderColor = 'transparent';
        pWidget.style.border = 'none';
        pWidget.style.flexDirection = 'column';
        pWidget.style.alignItems = 'stretch';
        pWidget.style.justifyContent = 'space-between';
        pWidget.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        if (!pWidget.style.opacity) pWidget.style.opacity = '1';
        
        renderPodiumWidget(pWidget, p);
    } else if (pWidget) {
        pWidget.style.display = 'none';
    }
    
    // Force absolute positioning on body
    document.body.style.display = 'block';
    document.body.style.position = 'relative';
    document.body.style.width = '1920px';
    document.body.style.height = '1080px';
}

let currentSubathonData = null;
socket.on('init', (data) => {
    currentSubathonData = data.subathonData;
    timerText.innerText = format(data.timerSeconds);
    applySettings(data.settings);
});

socket.on('settingsUpdated', (s) => applySettings(s));

socket.on('timeUpdate', (s) => timerText.innerText = format(s));

socket.on('subathonUpdated', (d) => {
    const oldGoals = currentSubathonData ? currentSubathonData.goals : [];
    currentSubathonData = d;
    
    // Find newly completed goals and clean reset goals
    d.goals.forEach(newG => {
        if (!newG.completed && animatingGoals.has(newG.id)) {
            animatingGoals.delete(newG.id);
        }
        const oldG = oldGoals.find(o => o.id === newG.id);
        if (oldG && !oldG.completed && newG.completed) {
            // It just completed!
            animatingGoals.add(newG.id);
            const gqConfig = currentSettings?.designs?.goals?.goalsQueue || {};
            const delaySec = gqConfig.completedDelay !== undefined ? parseFloat(gqConfig.completedDelay) : 3;
            setTimeout(() => {
                animatingGoals.delete(newG.id);
                // re-render to slide it out
                const gqWidget = document.getElementById('goals-queue-widget');
                if (gqWidget) renderSubathonGoals(gqWidget, gqConfig);
            }, delaySec * 1000);
        }
    });

    const gqWidget = document.getElementById('goals-queue-widget');
    if (gqWidget && currentMode === 'goals') {
        const gqConfig = currentSettings?.designs?.goals?.goalsQueue || {};
        renderSubathonGoals(gqWidget, gqConfig);
    }


    const pWidget = document.getElementById('podium-widget');
    if (pWidget && currentMode === 'podium') {
        const pConfig = currentSettings?.designs?.podium?.podium || {};
        renderPodiumWidget(pWidget, pConfig);
    }
});




window.addEventListener('rouletteWinner', (e) => {
    socket.emit('rouletteWinner', e.detail);
});
