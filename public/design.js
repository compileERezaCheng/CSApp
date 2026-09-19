const socket = io();

const urlParams = new URLSearchParams(window.location.search);
const pathMode = window.location.pathname.split('/').pop();
let currentMode = urlParams.get('mode') || (pathMode !== 'design' && pathMode !== 'design.html' ? pathMode : 'timer');

let designData = { images: [], texts: [], fonts: [] };
if (currentMode === 'timer') designData.timer = {};
if (currentMode === 'goals') designData.goalsQueue = {};
if (currentMode === 'roulette') designData.roulette = {};
if (currentMode === 'podium') {
    if (!designData.podium) designData.podium = {};
    if (!designData.podium.width) {
        designData.podium = { x: 100, y: 100, width: 900, height: 300, fontSize: 24, color: '#ffffff', ...designData.podium };
    }
}

let baseSettings = {};
let currentTimerSeconds = 0;
let currentSubathonData = null;
let currentScale = 1;
let selectedEl = null;

const historyLimit = 30;
let undoStack = [];
let redoStack = [];

window.saveState = () => {
    const currentStateStr = JSON.stringify(designData);
    if (undoStack.length > 0 && JSON.stringify(undoStack[undoStack.length - 1]) === currentStateStr) return;
    undoStack.push(JSON.parse(currentStateStr));
    if (undoStack.length > historyLimit) undoStack.shift();
    redoStack = [];
};

window.undo = () => {
    if (undoStack.length === 0) return;
    redoStack.push(JSON.parse(JSON.stringify(designData)));
    designData = undoStack.pop();
    renderCanvas();
    if(selectedEl && !document.getElementById(selectedEl.id)) selectedEl = null;
    updatePropertiesPanel();
};

window.redo = () => {
    if (redoStack.length === 0) return;
    undoStack.push(JSON.parse(JSON.stringify(designData)));
    designData = redoStack.pop();
    renderCanvas();
    if(selectedEl && !document.getElementById(selectedEl.id)) selectedEl = null;
    updatePropertiesPanel();
};

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) window.redo();
        else window.undo();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        window.redo();
    }
});

function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function showModal({ title, message, type, confirmText, cancelText }, callback) {
    const overlay = document.getElementById('customModal');
    const titleEl = document.getElementById('modalTitle');
    const msgEl = document.getElementById('modalMessage');
    const inpEl = document.getElementById('modalInput');
    const btnCancel = document.getElementById('modalBtnCancel');
    const btnConfirm = document.getElementById('modalBtnConfirm');

    titleEl.innerText = title || 'Aviso';
    msgEl.innerText = message || '';
    btnConfirm.innerText = confirmText || 'OK';
    btnCancel.innerText = cancelText || 'Cancelar';

    btnConfirm.className = 'btn primary';
    msgEl.style.display = message ? 'block' : 'none';
    
    if (type === 'prompt') {
        inpEl.style.display = 'block';
        inpEl.value = '';
        btnCancel.style.display = 'block';
    } else if (type === 'confirm') {
        inpEl.style.display = 'none';
        btnCancel.style.display = 'block';
        btnConfirm.className = 'btn danger';
    } else {
        inpEl.style.display = 'none';
        btnCancel.style.display = 'none';
    }

    overlay.style.display = 'flex';
    if(type === 'prompt') inpEl.focus();

    btnConfirm.onclick = () => {
        overlay.style.display = 'none';
        if (type === 'prompt') callback(inpEl.value);
        else if (callback) callback(true);
    };

    btnCancel.onclick = () => {
        overlay.style.display = 'none';
        if (type === 'prompt') callback(null);
        else if (callback) callback(false);
    };
}

function fitToScreen() {
    const wrapper = document.getElementById('wrapper');
    const canvas = document.getElementById('canvas');
    const scaleX = wrapper.clientWidth / 1920;
    const scaleY = wrapper.clientHeight / 1080;
    currentScale = Math.min(scaleX, scaleY); 
    canvas.style.transform = `scale(${currentScale})`;
}

window.addEventListener('resize', fitToScreen);

function renderCanvas() {
    const canvas = document.getElementById('canvas');
    const layersList = document.getElementById('layersList');
    
    canvas.innerHTML = '';
    if(layersList) {
        layersList.innerHTML = '';
        layersList.ondragover = (e) => {
            if (e.target === layersList) {
                e.preventDefault();
                layersList.style.boxShadow = 'inset 0 -3px 0 #8b5cf6';
            }
        };
        layersList.ondragleave = (e) => {
            if (e.target === layersList) layersList.style.boxShadow = 'none';
        };
        layersList.ondrop = (e) => {
            if (e.target === layersList) {
                e.preventDefault();
                layersList.style.boxShadow = 'none';
                const draggedId = e.dataTransfer.getData('text/plain');
                if (draggedId) {
                    const lastItem = layersList.lastElementChild;
                    if (lastItem && lastItem.dataset.id !== draggedId) {
                        window.reorderLayerByDrop(draggedId, lastItem.dataset.id, false);
                    }
                }
            }
        };
    }

    if (!designData.texts) designData.texts = [];
    if (!designData.images) designData.images = [];
    if (!designData.fonts) designData.fonts = [];

    const sortedElements = [];

if (currentMode === 'timer' && designData.timer) {
    const t = designData.timer;
    sortedElements.push({ id: 'timer-widget', type: 'timer', zIndex: t.zIndex !== undefined ? t.zIndex : 10, data: t, label: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px; vertical-align:middle;"><circle cx="12" cy="14" r="8"/><path d="M12 10v4"/><path d="M10 2h4"/><path d="M18.8 6.2l-2-2"/></svg> Cronómetro' });
}

if (currentMode === 'goals' && designData.goalsQueue) {
    const gq = designData.goalsQueue;
    sortedElements.push({ id: 'goals-queue-widget', type: 'goalsQueue', zIndex: gq.zIndex !== undefined ? gq.zIndex : 10, data: gq, label: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px; vertical-align:middle;"><list cx="12" cy="14" r="8"/><path d="M4 6h16M4 12h16M4 18h16"/></svg> Fila de Objetivos' });
}


if (currentMode === 'roulette' && designData.roulette) {
    const r = designData.roulette;
    sortedElements.push({ id: 'roulette-widget', type: 'roulette', zIndex: r.zIndex !== undefined ? r.zIndex : 10, data: r, label: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px; vertical-align:middle;"><circle cx="12" cy="12" r="10"></circle></svg> Roleta' });
}

if (currentMode === 'podium' && designData.podium) {
    const p = designData.podium;
    sortedElements.push({ id: 'podium-widget', type: 'podium', zIndex: p.zIndex !== undefined ? p.zIndex : 10, data: p, label: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px; vertical-align:middle;"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg> Pódio' });
}

designData.images.forEach((img, idx) => {
        sortedElements.push({ id: img.id, type: 'image', zIndex: img.zIndex !== undefined ? img.zIndex : 1, data: img, label: img.name || `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px; vertical-align:middle;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Imagem ${idx+1}` });
    });

    designData.texts.forEach((txt, idx) => {
        sortedElements.push({ id: txt.id, type: 'text', zIndex: txt.zIndex !== undefined ? txt.zIndex : 2, data: txt, label: txt.name || `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px; vertical-align:middle;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Texto ${idx+1}` });
    });

    sortedElements.sort((a, b) => a.zIndex - b.zIndex);

    sortedElements.forEach(item => {
        renderElementOnCanvas(item, canvas);
    });
    
    [...sortedElements].reverse().forEach(item => {
        addLayerItem(item, layersList);
    });

    // Update Minimum OBS Size Indicator
    let maxX = 0;
    let maxY = 0;
    sortedElements.forEach(item => {
        let w = item.data.width;
        let h = item.data.height;
        if (w === undefined) {
            if (item.type === 'roulette') w = 800;
            else if (item.type === 'timer') w = 200;
            else if (item.type === 'goalsQueue') w = 400;
            else if (item.type === 'podium') w = 550;
            else w = 0;
        }
        if (h === undefined) {
            if (item.type === 'roulette') h = 800;
            else if (item.type === 'timer') h = 80;
            else if (item.type === 'goalsQueue') h = 300;
            else if (item.type === 'podium') h = 250;
            else h = 0;
        }
        
        let x = item.data.x;
        let y = item.data.y;
        if (x === undefined) {
            if (item.type === 'roulette') x = 560;
            else if (item.type === 'podium') x = 100;
            else x = 50;
        }
        if (y === undefined) {
            if (item.type === 'roulette') y = 140;
            else if (item.type === 'podium') y = 100;
            else y = 50;
        }
        
        const right = x + w;
        const bottom = y + h;
        if (right > maxX) maxX = right;
        if (bottom > maxY) maxY = bottom;
    });
    const obsSpan = document.getElementById('minObsSize');
    if(obsSpan) obsSpan.innerText = `Tamanho Mínimo no OBS: ${Math.round(maxX)} x ${Math.round(maxY)}`;
}

function renderElementOnCanvas(item, canvas) {
    const el = document.createElement('div');
    el.id = item.id;
    el.className = 'draggable';
    
    const d = item.data;
    let fallbackX = 50;
    let fallbackY = 50;
    if (item.type === 'roulette') { fallbackX = 560; fallbackY = 140; }
    else if (item.type === 'podium') { fallbackX = 100; fallbackY = 100; }
    
    el.style.left = (d.x !== undefined ? d.x : fallbackX) + 'px';
    el.style.top = (d.y !== undefined ? d.y : fallbackY) + 'px';
    el.style.zIndex = item.zIndex;

    if (item.type === 'timer') {
        el.classList.add('canvas-overlay-timer');
        el.classList.add('resizable-all');
        el.style.width = (d.width !== undefined ? d.width : 200) + 'px';
        el.style.height = (d.height !== undefined ? d.height : 80) + 'px';
        el.style.fontSize = d.fontSize + 'px';
        el.style.color = d.color || '#ffffff';
        el.style.fontFamily = `"${d.fontFamily || 'Arial'}"`;
        el.style.backgroundColor = d.enableBg !== false ? (d.bg || '#0f172a') : 'transparent';
        el.style.borderColor = d.enableBg !== false ? (d.border || '#8b5cf6') : 'transparent';
        el.style.textShadow = `0 0 10px ${d.glow || '#8b5cf6'}`;
        el.innerText = formatTime(currentTimerSeconds);
    } 
    else if (item.type === 'goalsQueue') {
        el.classList.add('canvas-overlay-timer');
        el.classList.add('resizable-all');
        el.style.width = (d.width !== undefined ? d.width : 400) + 'px';
        el.style.height = (d.height !== undefined ? d.height : 300) + 'px';
        el.style.fontSize = d.fontSize + 'px';
        el.style.color = d.color || '#ffffff';
        el.style.fontFamily = `"${d.fontFamily || 'Arial'}"`;
        el.style.backgroundColor = d.enableBg !== false ? (d.bg || 'rgba(15,23,42,0.8)') : 'transparent';
        el.style.borderColor = d.enableBg !== false ? (d.border || '#8b5cf6') : 'transparent';
        el.style.flexDirection = 'column';
        
        el.innerHTML = '';
        if (typeof renderSubathonGoals === 'function') {
            renderSubathonGoals(el, d);
        } else {
            el.innerHTML = '<div style="color:white;text-align:center;margin-top:20px;">[Goals Queue Placeholder]</div>';
        }
    }
    else if (item.type === 'podium') {
        el.classList.add('canvas-overlay-timer');
        el.classList.add('resizable-all');
        el.style.width = (Math.max(d.width !== undefined ? d.width : 550, 550)) + 'px';
        el.style.height = (Math.max(d.height !== undefined ? d.height : 250, 200)) + 'px';
        el.style.fontSize = d.fontSize + 'px';
        el.style.color = d.color || '#ffffff';
        el.style.fontFamily = `"${d.fontFamily || 'Arial'}"`;
        el.style.backgroundColor = 'transparent';
        el.style.border = 'none';
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.alignItems = 'stretch';
        el.style.justifyContent = 'space-between';
        el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        
        if (typeof renderPodiumWidget === 'function') {
            renderPodiumWidget(el, d);
        } else {
            el.innerHTML = '<div style="color:white;text-align:center;margin-top:20px;">[Podium Placeholder]</div>';
        }
    }
        else if (item.type === 'roulette') {
        el.classList.add('canvas-overlay-timer');
        el.classList.add('resizable-roulette');
        el.style.width = (d.width || 800) + 'px';
        el.style.height = (d.height || 800) + 'px';
        el.style.backgroundColor = 'transparent';
        el.style.border = 'none';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        
        if (typeof renderRouletteWidget === 'function') {
            // we don't have current options in design.js easily, just pass dummy
            renderRouletteWidget(el, [{label:'Opção 1', weight:1, color:'#ef4444'}, {label:'Opção 2', weight:1, color:'#3b82f6'}], d);
        } else {
            el.innerHTML = '<div style="color:white;text-align:center;margin-top:20px;">[Roulette Placeholder]</div>';
        }
    }
    else if (item.type === 'image') {
        el.classList.add('canvas-image');
        el.classList.add('resizable-all');
        el.style.width = d.width + 'px';
        el.style.height = d.height + 'px';
        el.style.opacity = d.opacity !== undefined ? d.opacity : 1;
        if(d.url) {
            el.style.backgroundImage = `url("${d.url}")`;
        } else {
            el.style.backgroundColor = 'rgba(255,255,255,0.05)';
            el.style.border = '1px dashed #cbd5e1';
            el.innerText = 'Sem Imagem';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.color = '#cbd5e1';
        }
    }
    else if (item.type === 'text') {
        el.classList.add('txt-element');
        el.classList.add('resizable-x');
        el.style.width = d.width + 'px';
        el.style.minHeight = d.height + 'px';
        el.style.height = 'auto';
        el.style.opacity = d.opacity !== undefined ? d.opacity : 1;
        el.style.fontSize = d.fontSize + 'px';
        el.style.color = d.color || '#ffffff';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        
        const txtSpan = document.createElement('span');
        txtSpan.innerText = d.text || 'Novo Texto';
        txtSpan.style.width = '100%';
        txtSpan.style.height = 'auto';
        txtSpan.style.display = 'flex';
        txtSpan.style.alignItems = 'center';
        txtSpan.style.pointerEvents = 'none';
        txtSpan.style.outline = 'none';
        txtSpan.style.wordBreak = 'break-word';
        txtSpan.style.whiteSpace = 'pre-wrap';
        
        const align = d.textAlign || 'center';
        txtSpan.style.textAlign = align;
        if (align === 'left') txtSpan.style.justifyContent = 'flex-start';
        else if (align === 'right') txtSpan.style.justifyContent = 'flex-end';
        else txtSpan.style.justifyContent = 'center';

        txtSpan.style.fontWeight = d.fontWeight || 'normal';
        txtSpan.style.fontStyle = d.fontStyle || 'normal';
        txtSpan.style.textDecoration = d.textDecoration || 'none';
        
        txtSpan.style.fontFamily = `"${d.fontFamily || 'Arial'}"`;
        const sColor = d.shadowColor || 'rgba(0,0,0,0.5)';
        const sBlur = d.shadowBlur !== undefined ? d.shadowBlur : 10;
        const sOffX = d.shadowOffsetX !== undefined ? d.shadowOffsetX : 0;
        const sOffY = d.shadowOffsetY !== undefined ? d.shadowOffsetY : 0;
        txtSpan.style.textShadow = `${sOffX}px ${sOffY}px ${sBlur}px ${sColor}`;

        el.appendChild(txtSpan);
        
        if(!d.text) {
            el.style.backgroundColor = 'rgba(255,255,255,0.05)';
            el.style.border = '1px dashed #cbd5e1';
        }
        
        el.ondblclick = (e) => {
            e.stopPropagation();
            window.saveState();
            txtSpan.style.pointerEvents = 'auto';
            txtSpan.contentEditable = true;
            el.classList.add('editing-text');
            txtSpan.focus();
            
            // Move cursor to end
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(txtSpan);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        };
        
        txtSpan.onblur = () => {
            txtSpan.contentEditable = false;
            txtSpan.style.pointerEvents = 'none';
            el.classList.remove('editing-text');
            const txt = designData.texts.find(i => i.id === item.id);
            if (txt) { txt.text = txtSpan.innerText; renderCanvas(); }
        };
        
        txtSpan.addEventListener('input', () => {
             const txt = designData.texts.find(i => i.id === item.id);
             if (txt) { 
                 txt.text = txtSpan.innerText; 
                 txt.height = el.getBoundingClientRect().height / currentScale;
             }
        });
    }

    if (d.locked) el.classList.add('locked');

    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    el.appendChild(handle);

    const cfg = document.createElement('div');
    cfg.className = 'config-icon';
    cfg.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    cfg.onmousedown = (e) => e.stopPropagation();
    cfg.onclick = (e) => {
        e.stopPropagation();
        toggleConfigMenu(item.id, el);
    };
    el.appendChild(cfg);

    el.addEventListener('mousedown', () => selectElement(el));
    canvas.appendChild(el);
    
    // Preserve selection state across renders
    if (selectedEl && selectedEl.id === item.id) {
        selectedEl = el;
        el.classList.add('selected');
    }
}

function addLayerItem(item, container) {
    if(!container) return;
    const div = document.createElement('div');
    div.className = 'layer-item';
    div.dataset.id = item.id;
    if(selectedEl && selectedEl.id === item.id) div.classList.add('active');
    
    div.innerHTML = `
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; pointer-events:none;">${item.label}</span>
        <span style="pointer-events:none;">${item.data.locked ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' : ''}</span>
    `;
    div.onclick = () => {
        const el = document.getElementById(item.id);
        if(el) selectElement(el);
    };
    div.ondblclick = (e) => {
        e.stopPropagation();
        if (item.id === 'timer-widget') return; // Timer name can't be changed
        showModal({
            title: "Renomear Camada",
            message: "Introduz o novo nome para esta camada:",
            type: "prompt",
            confirmText: "Guardar"
        }, (newName) => {
            if (newName !== null) {
                window.saveState();
                if (item.id.startsWith('img_')) {
                    const img = designData.images.find(i => i.id === item.id);
                    if (img) img.name = newName;
                } else if (item.id.startsWith('txt_')) {
                    const txt = designData.texts.find(i => i.id === item.id);
                    if (txt) txt.name = newName;
                }
                renderCanvas();
            }
        });
    };
    div.draggable = true;
    div.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', item.id);
        div.style.opacity = '0.4';
    };
    div.ondragend = (e) => {
        div.style.opacity = '1';
        document.querySelectorAll('.layer-item').forEach(l => l.style.boxShadow = 'none');
    };
    div.ondragover = (e) => {
        e.preventDefault();
        const rect = div.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (e.clientY < mid) {
            div.style.boxShadow = '0 -3px 0 #8b5cf6';
        } else {
            div.style.boxShadow = '0 3px 0 #8b5cf6';
        }
    };
    div.ondragleave = (e) => {
        div.style.boxShadow = 'none';
    };
    div.ondrop = (e) => {
        e.preventDefault();
        div.style.boxShadow = 'none';
        const draggedId = e.dataTransfer.getData('text/plain');
        if (!draggedId || draggedId === item.id) return;
        
        const rect = div.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const placeBefore = e.clientY < mid;
        
        window.reorderLayerByDrop(draggedId, item.id, placeBefore);
    };

    container.appendChild(div);
}

window.reorderLayerByDrop = (draggedId, targetId, placeBefore) => {
    window.saveState();
    let elements = [];
    elements.push({ id: 'timer-widget', zIndex: designData.timer.zIndex !== undefined ? designData.timer.zIndex : 10 });
    designData.images.forEach(img => elements.push({ id: img.id, zIndex: img.zIndex !== undefined ? img.zIndex : 1 }));
    designData.texts.forEach(txt => elements.push({ id: txt.id, zIndex: txt.zIndex !== undefined ? txt.zIndex : 2 }));

    elements.sort((a, b) => a.zIndex - b.zIndex);
    
    let visualList = [...elements].reverse();
    
    const draggedIndex = visualList.findIndex(e => e.id === draggedId);
    if (draggedIndex === -1) return;
    const draggedItem = visualList.splice(draggedIndex, 1)[0];
    
    const targetIndex = visualList.findIndex(e => e.id === targetId);
    if (targetIndex === -1) return;
    
    if (placeBefore) {
        visualList.splice(targetIndex, 0, draggedItem);
    } else {
        visualList.splice(targetIndex + 1, 0, draggedItem);
    }
    
    elements = visualList.reverse();
    
    elements.forEach((el, index) => {
        el.zIndex = index + 1;
        if (el.id === 'timer-widget') designData.timer.zIndex = el.zIndex;
        else if (el.id.startsWith('img_')) { const i = designData.images.find(x => x.id === el.id); if(i) i.zIndex = el.zIndex; }
        else if (el.id.startsWith('txt_')) { const t = designData.texts.find(x => x.id === el.id); if(t) t.zIndex = el.zIndex; }
    });
    
    renderCanvas();
    const targetEl = document.getElementById(draggedId);
    if(targetEl) selectElement(targetEl);
};

function selectElement(el) {
    if (selectedEl) selectedEl.classList.remove('selected');
    closeConfigMenu();
    
    selectedEl = el;
    el.classList.add('selected');
    
    // Highlight in layer list without re-rendering everything
    document.querySelectorAll('.layer-item').forEach(l => {
        if(l.dataset.id === el.id) l.classList.add('active');
        else l.classList.remove('active');
    });

    updatePropertiesPanel();
}

function updatePropertiesPanel() {
    const emptyProps = document.getElementById('emptyProps');
    const timerProps = document.getElementById('timerProps');
    const imageProps = document.getElementById('imageProps');
    const textProps = document.getElementById('textProps');
    const sharedProps = document.getElementById('sharedProps');
    const podiumProps = document.getElementById('podiumProps');
    const rouletteProps = document.getElementById('rouletteProps');
    const propTitle = document.getElementById('propTitle');

    emptyProps.style.display = 'none';
    timerProps.style.display = 'none';
    imageProps.style.display = 'none';
    textProps.style.display = 'none';
    sharedProps.style.display = 'none';
    if(podiumProps) podiumProps.style.display = 'none';
    if(rouletteProps) rouletteProps.style.display = 'none';

    if (!selectedEl) {
        emptyProps.style.display = 'block';
        propTitle.innerText = 'Propriedades';
        return;
    }

    sharedProps.style.display = 'flex';
    let elData = null;
    if (selectedEl.id === 'timer-widget') elData = designData.timer;
    else if (selectedEl.id === 'roulette-widget') elData = designData.roulette;
    else if (selectedEl.id === 'goals-queue-widget') elData = designData.goalsQueue;
    else if (selectedEl.id === 'podium-widget') elData = designData.podium;
    else if (selectedEl.id.startsWith('img_')) elData = designData.images.find(i => i.id === selectedEl.id);
    else if (selectedEl.id.startsWith('txt_')) elData = designData.texts.find(i => i.id === selectedEl.id);

    if (elData) {
        document.getElementById('inpSharedWidth').value = Math.round(elData.width || 0);
        document.getElementById('inpSharedHeight').value = Math.round(elData.height || 0);
        document.getElementById('inpSharedX').value = Math.round(elData.x !== undefined ? elData.x : 0);
        document.getElementById('inpSharedY').value = Math.round(elData.y !== undefined ? elData.y : 0);
    }

    if (selectedEl.id === 'timer-widget') {
        propTitle.innerHTML = '<div style="display:flex; align-items:center; gap:5px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="14" r="8"/><path d="M12 10v4"/><path d="M10 2h4"/><path d="M18.8 6.2l-2-2"/></svg> Timer</div>';
        timerProps.style.display = 'flex';
        
        document.getElementById('inpFontSize').value = designData.timer.fontSize;
        document.getElementById('inpTimerFontFamily').value = designData.timer.fontFamily || 'Arial';
        document.getElementById('inpTextColor').value = designData.timer.color || '#ffffff';
        document.getElementById('inpGlowColor').value = designData.timer.glow || '#8b5cf6';
        document.getElementById('inpBorderColor').value = designData.timer.border || '#8b5cf6';
        document.getElementById('inpBgColor').value = designData.timer.bg || '#0f172a';
        
        const enableBg = designData.timer.enableBg !== false;
        document.getElementById('chkEnableBg').checked = enableBg;
        document.getElementById('bgColorContainer').style.display = enableBg ? 'block' : 'none';
        const gp = document.getElementById('goalsPropsContainer');
        if (gp) gp.style.display = 'none';
    } 
    else if (selectedEl.id === 'podium-widget') {
        propTitle.innerHTML = '<div style="display:flex; align-items:center; gap:5px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg> Pódio</div>';
        timerProps.style.display = 'flex';
        if(podiumProps) podiumProps.style.display = 'flex';
        
        const p = designData.podium;
        const oriEl = document.getElementById('inpPodiumOrientation');
        if (oriEl) oriEl.value = p.orientation || 'vertical';
        const visibleEl = document.getElementById('inpPodiumVisibleCount');
        if (visibleEl) visibleEl.value = p.visibleCount || 3;
        document.getElementById('inpFontSize').value = p.fontSize || 30;
        document.getElementById('inpTimerFontFamily').value = p.fontFamily || 'Arial';
        document.getElementById('inpTextColor').value = p.color || '#ffffff';
        
        document.getElementById('inpPodiumTitle1').value = p.col1Title || 'Top Subs';
        document.getElementById('inpPodiumColor1').value = p.col1Color || '#8b5cf6';
        document.getElementById('inpPodiumTitle2').value = p.col2Title || 'Top Bits';
        document.getElementById('inpPodiumColor2').value = p.col2Color || '#8b5cf6';
        document.getElementById('inpPodiumTitle3').value = p.col3Title || 'Top Dono';
        document.getElementById('inpPodiumColor3').value = p.col3Color || '#8b5cf6';
        document.getElementById('inpPodiumGap').value = p.itemGap !== undefined ? p.itemGap : 20;

        document.getElementById('bgColorContainer').style.display = 'none';
        document.getElementById('borderColorContainer').style.display = 'none';
        document.getElementById('glowColorContainer').style.display = 'none';
        const gp = document.getElementById('goalsPropsContainer');
        if (gp) gp.style.display = 'none';
    }
    else if (selectedEl.id === 'roulette-widget') {
        propTitle.innerHTML = '<div style="display:flex; align-items:center; gap:5px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg> Roleta</div>';
        if(rouletteProps) rouletteProps.style.display = 'flex';
        
        const r = designData.roulette;
        document.getElementById('inpRouletteFontSize').value = r.fontSize || 30;
        document.getElementById('inpRouletteFontFamily').value = r.fontFamily || 'Arial';
        document.getElementById('inpRouletteOutlineColor').value = r.outlineColor || '#ffffff';
        document.getElementById('inpRouletteOutlineThickness').value = r.outlineThickness !== undefined ? r.outlineThickness : 2;
        document.getElementById('inpRouletteArrowColor').value = r.arrowColor || '#ffffff';
    }
    else if (selectedEl.id === 'goals-queue-widget') {
        propTitle.innerHTML = '<div style="display:flex; align-items:center; gap:5px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><list cx="12" cy="14" r="8"/><path d="M4 6h16M4 12h16M4 18h16"/></svg> Goals Queue</div>';
        timerProps.style.display = 'flex';
        
        const gq = designData.goalsQueue;
        document.getElementById('inpFontSize').value = gq.fontSize || 30;
        document.getElementById('inpTimerFontFamily').value = gq.fontFamily || 'Arial';
        document.getElementById('inpTextColor').value = gq.color || '#ffffff';
        document.getElementById('inpGlowColor').value = gq.glow || '#8b5cf6';
        document.getElementById('inpBorderColor').value = gq.border || '#8b5cf6';
        document.getElementById('inpBgColor').value = gq.bg || 'rgba(15,23,42,0.8)';
        
        const enableBg = gq.enableBg !== false;
        document.getElementById('chkEnableBg').checked = enableBg;
        document.getElementById('bgColorContainer').style.display = enableBg ? 'block' : 'none';
        
        const gp = document.getElementById('goalsPropsContainer');
        if (gp) {
            gp.style.display = 'flex';
            document.getElementById('inpGoalsTitle').value = designData.goalsQueue.titleText !== undefined ? designData.goalsQueue.titleText : 'Next Goals';
            document.getElementById('chkGoalsTitleLine').checked = designData.goalsQueue.enableTitleLine !== false;
            document.getElementById('inpGoalsCompletedColor').value = gq.completedColor || '#10b981';
            document.getElementById('inpGoalsGap').value = gq.itemGap !== undefined ? gq.itemGap : 5;
            document.getElementById('inpGoalsFadeSpeed').value = gq.fadeSpeed !== undefined ? gq.fadeSpeed : 0.5;
            document.getElementById('inpGoalsSlideSpeed').value = gq.slideSpeed !== undefined ? gq.slideSpeed : 0.5;
            document.getElementById('inpGoalsCompletedDelay').value = gq.completedDelay !== undefined ? gq.completedDelay : 3;
            
            const btnCropBg = document.getElementById('btnCropGoalsBg');
            const imgPreviewGoals = document.getElementById('imgPreviewGoals');
            if (btnCropBg) {
                btnCropBg.style.display = gq.itemBgImage ? 'flex' : 'none';
            }
            if (imgPreviewGoals) {
                imgPreviewGoals.style.backgroundImage = gq.itemBgImage ? `url("${gq.itemBgImage}")` : 'none';
                imgPreviewGoals.innerText = gq.itemBgImage ? '' : 'Sem Imagem';
                imgPreviewGoals.style.display = 'flex';
                imgPreviewGoals.style.alignItems = 'center';
                imgPreviewGoals.style.justifyContent = 'center';
                imgPreviewGoals.style.color = '#cbd5e1';
            }

            document.getElementById('inpGoalsItemPadding').value = gq.itemPadding !== undefined ? gq.itemPadding : 0;
            document.getElementById('inpGoalsItemHeight').value = gq.itemHeight !== undefined ? gq.itemHeight : 0;
        }
    }
    else if (selectedEl.id.startsWith('img_')) {
        propTitle.innerHTML = '<div style="display:flex; align-items:center; gap:5px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Imagem</div>';
        imageProps.style.display = 'flex';
        
        const img = designData.images.find(i => i.id === selectedEl.id);
        if(img) {
            document.getElementById('imgPreview').style.backgroundImage = img.url ? `url("${img.url}")` : 'none';
            document.getElementById('imgPreview').innerText = img.url ? '' : 'Sem Imagem';
            document.getElementById('imgPreview').style.display = 'flex';
            document.getElementById('imgPreview').style.alignItems = 'center';
            document.getElementById('imgPreview').style.justifyContent = 'center';
            document.getElementById('imgPreview').style.color = '#cbd5e1';
            
            document.getElementById('inpOpacity').value = img.opacity !== undefined ? Math.round(img.opacity * 100) : 100;
        }
    }
    else if (selectedEl.id.startsWith('txt_')) {
        propTitle.innerHTML = '<div style="display:flex; align-items:center; gap:5px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Texto</div>';
        textProps.style.display = 'flex';
        
        const txt = designData.texts.find(i => i.id === selectedEl.id);
        if(txt) {
            document.getElementById('inpTextFontFamily').value = txt.fontFamily || 'Arial';
            document.getElementById('inpTextFontSize').value = txt.fontSize || 40;
            document.getElementById('inpTextTextColor').value = txt.color || '#ffffff';
                        
            document.getElementById('inpTextShadowColor').value = txt.shadowColor || '#000000';
            document.getElementById('inpTextShadowBlur').value = txt.shadowBlur !== undefined ? txt.shadowBlur : 10;
            document.getElementById('inpTextShadowOffsetX').value = txt.shadowOffsetX !== undefined ? txt.shadowOffsetX : 0;
            document.getElementById('inpTextShadowOffsetY').value = txt.shadowOffsetY !== undefined ? txt.shadowOffsetY : 0;
            
            document.getElementById('btnAlignLeft').style.background = (txt.textAlign === 'left') ? '#3b82f6' : '';
            document.getElementById('btnAlignCenter').style.background = (!txt.textAlign || txt.textAlign === 'center') ? '#3b82f6' : '';
            document.getElementById('btnAlignRight').style.background = (txt.textAlign === 'right') ? '#3b82f6' : '';
            
            document.getElementById('btnFormatBold').style.background = (txt.fontWeight === 'bold') ? '#3b82f6' : '';
            document.getElementById('btnFormatItalic').style.background = (txt.fontStyle === 'italic') ? '#3b82f6' : '';
            document.getElementById('btnFormatUnderline').style.background = (txt.textDecoration === 'underline') ? '#3b82f6' : '';
        }
    }
}

document.getElementById('canvas').addEventListener('mousedown', (e) => {
    if(e.target === document.getElementById('canvas') || e.target.id === 'wrapper') {
        if(selectedEl) {
            selectedEl.classList.remove('selected');
            closeConfigMenu();
        }
        selectedEl = null;
        renderCanvas();
        updatePropertiesPanel();
    }
});

// Helper for auto-sizing images
function applyImageSize(imgObj, srcUrl) {
    const i = new Image();
    i.onload = () => {
        const maxW = 800;
        const maxH = 800;
        let nw = i.naturalWidth;
        let nh = i.naturalHeight;
        if (nw > maxW || nh > maxH) {
            const ratio = Math.min(maxW / nw, maxH / nh);
            nw = Math.round(nw * ratio);
            nh = Math.round(nh * ratio);
        }
        imgObj.width = nw;
        imgObj.height = nh;
        renderCanvas();
        updatePropertiesPanel();
    };
    i.src = srcUrl;
}

// History Hooks for UI Inputs
document.querySelectorAll('.sidebar input').forEach(inp => {
    inp.addEventListener('focus', () => window.saveState());
    inp.addEventListener('mousedown', () => window.saveState());
});
document.querySelectorAll('.sidebar button').forEach(btn => {
    btn.addEventListener('mousedown', () => window.saveState());
});

// Shared UI Listeners
document.getElementById('inpSharedWidth')?.addEventListener('input', (e) => {
    if (!selectedEl) return;
    let val = parseInt(e.target.value, 10);
    if (isNaN(val)) return;
    if (selectedEl.id === 'podium-widget') {
        val = Math.max(550, val);
    } else if (selectedEl.id !== 'roulette-widget' && !selectedEl.id.startsWith('img_') && !selectedEl.id.startsWith('txt_')) {
        val = Math.max(100, val);
    }
    if (selectedEl.id === 'timer-widget') designData.timer.width = val;
    else if (selectedEl.id === 'goals-queue-widget') designData.goalsQueue.width = val;
    else if (selectedEl.id === 'podium-widget') designData.podium.width = val;
    else if (selectedEl.id === 'roulette-widget') {
        const size = Math.max(100, val);
        designData.roulette.width = size;
        designData.roulette.height = size;
        const hInp = document.getElementById('inpSharedHeight');
        if (hInp) hInp.value = size;
    }
    else if (selectedEl.id.startsWith('img_')) { const i = designData.images.find(a => a.id === selectedEl.id); if(i) i.width = val; }
    else if (selectedEl.id.startsWith('txt_')) { const t = designData.texts.find(a => a.id === selectedEl.id); if(t) t.width = val; }
    renderCanvas();
});
document.getElementById('inpSharedHeight')?.addEventListener('input', (e) => {
    if (!selectedEl) return;
    let val = parseInt(e.target.value, 10);
    if (isNaN(val)) return;
    if (selectedEl.id === 'podium-widget') {
        val = Math.max(200, val);
    } else if (selectedEl.id !== 'roulette-widget' && !selectedEl.id.startsWith('img_') && !selectedEl.id.startsWith('txt_')) {
        val = Math.max(50, val);
    }
    if (selectedEl.id === 'timer-widget') designData.timer.height = val;
    else if (selectedEl.id === 'goals-queue-widget') designData.goalsQueue.height = val;
    else if (selectedEl.id === 'podium-widget') designData.podium.height = val;
    else if (selectedEl.id === 'roulette-widget') {
        const size = Math.max(100, val);
        designData.roulette.width = size;
        designData.roulette.height = size;
        const wInp = document.getElementById('inpSharedWidth');
        if (wInp) wInp.value = size;
    }
    else if (selectedEl.id.startsWith('img_')) { const i = designData.images.find(a => a.id === selectedEl.id); if(i) i.height = val; }
    else if (selectedEl.id.startsWith('txt_')) { const t = designData.texts.find(a => a.id === selectedEl.id); if(t) t.height = val; }
    renderCanvas();
});
document.getElementById('inpSharedX')?.addEventListener('input', (e) => {
    if (!selectedEl) return;
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) return;
    if (selectedEl.id === 'timer-widget') designData.timer.x = val;
    else if (selectedEl.id === 'goals-queue-widget') designData.goalsQueue.x = val;
    else if (selectedEl.id === 'podium-widget') designData.podium.x = val;
    else if (selectedEl.id === 'roulette-widget') designData.roulette.x = val;
    else if (selectedEl.id.startsWith('img_')) { const i = designData.images.find(a => a.id === selectedEl.id); if(i) i.x = val; }
    else if (selectedEl.id.startsWith('txt_')) { const t = designData.texts.find(a => a.id === selectedEl.id); if(t) t.x = val; }
    renderCanvas();
});
document.getElementById('inpSharedY')?.addEventListener('input', (e) => {
    if (!selectedEl) return;
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) return;
    if (selectedEl.id === 'timer-widget') designData.timer.y = val;
    else if (selectedEl.id === 'goals-queue-widget') designData.goalsQueue.y = val;
    else if (selectedEl.id === 'podium-widget') designData.podium.y = val;
    else if (selectedEl.id === 'roulette-widget') designData.roulette.y = val;
    else if (selectedEl.id.startsWith('img_')) { const i = designData.images.find(a => a.id === selectedEl.id); if(i) i.y = val; }
    else if (selectedEl.id.startsWith('txt_')) { const t = designData.texts.find(a => a.id === selectedEl.id); if(t) t.y = val; }
    renderCanvas();
});

// UI Listeners (Timer)
function updateWidgetProp(prop, val) {
    if (!selectedEl) return;
    if (selectedEl.id === 'timer-widget') designData.timer[prop] = val;
    else if (selectedEl.id === 'goals-queue-widget') designData.goalsQueue[prop] = val;
    else if (selectedEl.id === 'podium-widget') designData.podium[prop] = val;
    else if (selectedEl.id === 'roulette-widget') designData.roulette[prop] = val;
    renderCanvas();
}

document.getElementById('inpFontSize').addEventListener('input', (e) => updateWidgetProp('fontSize', parseInt(e.target.value, 10) || (selectedEl?.id === 'goals-queue-widget' ? 30 : 70)));
document.getElementById('inpTimerFontFamily').addEventListener('change', (e) => updateWidgetProp('fontFamily', e.target.value));
document.getElementById('inpTextColor').addEventListener('input', (e) => updateWidgetProp('color', getRgbaInput('inpTextColor')));
document.getElementById('inpTextColor_alpha').addEventListener('input', (e) => updateWidgetProp('color', getRgbaInput('inpTextColor')));
document.getElementById('inpGlowColor').addEventListener('input', (e) => updateWidgetProp('glow', getRgbaInput('inpGlowColor')));
document.getElementById('inpGlowColor_alpha').addEventListener('input', (e) => updateWidgetProp('glow', getRgbaInput('inpGlowColor')));
document.getElementById('inpBorderColor').addEventListener('input', (e) => updateWidgetProp('border', getRgbaInput('inpBorderColor')));
document.getElementById('inpBorderColor_alpha').addEventListener('input', (e) => updateWidgetProp('border', getRgbaInput('inpBorderColor')));
document.getElementById('inpBgColor').addEventListener('input', (e) => updateWidgetProp('bg', getRgbaInput('inpBgColor')));
document.getElementById('inpBgColor_alpha').addEventListener('input', (e) => updateWidgetProp('bg', getRgbaInput('inpBgColor')));
document.getElementById('chkEnableBg').addEventListener('change', (e) => { 
    updateWidgetProp('enableBg', e.target.checked);
    document.getElementById('bgColorContainer').style.display = e.target.checked ? 'block' : 'none';
    renderCanvas();
});
document.getElementById('inpGoalsTitle')?.addEventListener('input', (e) => updateWidgetProp('titleText', e.target.value));
document.getElementById('chkGoalsTitleLine')?.addEventListener('change', (e) => updateWidgetProp('enableTitleLine', e.target.checked));
document.getElementById('inpGoalsCompletedColor')?.addEventListener('input', (e) => updateWidgetProp('completedColor', e.target.value));
document.getElementById('inpGoalsGap')?.addEventListener('input', (e) => updateWidgetProp('itemGap', parseInt(e.target.value, 10) || 0));
document.getElementById('inpGoalsFadeSpeed')?.addEventListener('input', (e) => updateWidgetProp('fadeSpeed', parseFloat(e.target.value) || 0.5));
document.getElementById('inpGoalsSlideSpeed')?.addEventListener('input', (e) => updateWidgetProp('slideSpeed', parseFloat(e.target.value) || 0.5));
document.getElementById('inpGoalsCompletedDelay')?.addEventListener('input', (e) => updateWidgetProp('completedDelay', parseFloat(e.target.value) || 0));

document.getElementById('inpGoalsItemPadding')?.addEventListener('input', (e) => updateWidgetProp('itemPadding', parseInt(e.target.value, 10) || 0));
document.getElementById('inpGoalsItemHeight')?.addEventListener('input', (e) => updateWidgetProp('itemHeight', parseInt(e.target.value, 10) || 0));
document.getElementById('btnGoalsBgImage')?.addEventListener('click', () => {
    const fileInput = document.getElementById('inpFileImage');
    if (fileInput) {
        fileInput.dataset.target = 'goalsBg';
        fileInput.click();
    }
});

// Podium Listeners
document.getElementById('inpPodiumTitle1')?.addEventListener('input', (e) => updateWidgetProp('col1Title', e.target.value));
document.getElementById('inpPodiumColor1')?.addEventListener('input', (e) => updateWidgetProp('col1Color', e.target.value));
document.getElementById('inpPodiumVisibleCount')?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val > 0) updateWidgetProp('visibleCount', val);
});
document.getElementById('inpPodiumOrientation')?.addEventListener('change', (e) => updateWidgetProp('orientation', e.target.value));
document.getElementById('inpPodiumTitle2')?.addEventListener('input', (e) => updateWidgetProp('col2Title', e.target.value));
document.getElementById('inpPodiumColor2')?.addEventListener('input', (e) => updateWidgetProp('col2Color', e.target.value));
document.getElementById('inpPodiumTitle3')?.addEventListener('input', (e) => updateWidgetProp('col3Title', e.target.value));
document.getElementById('inpPodiumColor3')?.addEventListener('input', (e) => updateWidgetProp('col3Color', e.target.value));
document.getElementById('inpPodiumGap')?.addEventListener('input', (e) => updateWidgetProp('itemGap', parseInt(e.target.value, 10) || 0));

// Roulette Listeners
document.getElementById('inpRouletteFontSize')?.addEventListener('input', (e) => updateWidgetProp('fontSize', parseInt(e.target.value, 10) || 30));
document.getElementById('inpRouletteFontFamily')?.addEventListener('change', (e) => updateWidgetProp('fontFamily', e.target.value));
document.getElementById('inpRouletteOutlineColor')?.addEventListener('input', (e) => updateWidgetProp('outlineColor', e.target.value));
document.getElementById('inpRouletteOutlineThickness')?.addEventListener('input', (e) => updateWidgetProp('outlineThickness', parseFloat(e.target.value) || 0));
document.getElementById('inpRouletteArrowColor')?.addEventListener('input', (e) => updateWidgetProp('arrowColor', e.target.value));

// UI Listeners (Image)
document.getElementById('inpOpacity').addEventListener('input', (e) => {
    if (selectedEl && selectedEl.id.startsWith('img_')) {
        const img = designData.images.find(i => i.id === selectedEl.id);
        if(img) { img.opacity = parseFloat(e.target.value !== '' ? e.target.value : '100') / 100; renderCanvas(); }
    }
});
document.getElementById('btnAddImage').addEventListener('click', () => {
    if(!selectedEl || !selectedEl.id.startsWith('img_')) return;
    showModal({ title: "Adicionar Imagem por URL", message: "Introduz o URL direto da imagem (ex: imgur):", type: "prompt", confirmText: "Adicionar" }, (url) => {
        if(url) {
            const img = designData.images.find(i => i.id === selectedEl.id);
            if(img) { 
                img.url = url; 
                delete img.originalUrl;
                delete img.cropData;
                applyImageSize(img, url);
                renderCanvas(); 
                updatePropertiesPanel(); 
            }
        }
    });
});
document.getElementById('inpFileImage').addEventListener('change', (e) => {
    const target = e.target.dataset.target;
    if (target !== 'goalsBg' && (!selectedEl || !selectedEl.id.startsWith('img_'))) return;
    
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            const base64 = evt.target.result;
            fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: file.name, imageBase64: base64 })
            }).then(r => {
                if(!r.ok) throw new Error("Erro no servidor");
                return r.json();
            }).then(data => {
                if(data.url) {
                    if (target === 'goalsBg') {
                        designData.goalsQueue.itemBgOriginalImage = data.url;
                        delete designData.goalsQueue.bgCropData;
                        updateWidgetProp('itemBgImage', data.url);
                        e.target.dataset.target = ''; // Reset
                        
                        const btnCropBg = document.getElementById('btnCropGoalsBg');
                        if (btnCropBg) btnCropBg.style.display = 'flex';
                        updatePropertiesPanel();
                    } else {
                        const img = designData.images.find(i => i.id === selectedEl.id);
                        if(img) { 
                            img.url = data.url; 
                            delete img.originalUrl;
                            delete img.cropData;
                            applyImageSize(img, data.url);
                            renderCanvas(); 
                            updatePropertiesPanel(); 
                        }
                    }
                }
            }).catch(err => {
                console.error(err);
                showModal({ title: "Erro no Envio", message: "Erro ao enviar a imagem. Tenta uma mais pequena.", type: "alert" });
            });
        };
        reader.readAsDataURL(file);
    }
});

// UI Listeners (Crop Image)
document.getElementById('btnCropGoalsBg')?.addEventListener('click', () => {
    const bgUrl = designData.goalsQueue?.itemBgOriginalImage || designData.goalsQueue?.itemBgImage;
    if (!bgUrl) {
        showModal({ title: "Sem Imagem", message: "Carrega primeiro uma imagem de fundo antes de tentar cortar!", type: "alert" });
        return;
    }
    const cropModal = document.getElementById('cropModal');
    cropModal.dataset.target = 'goalsBg';
    openCropModalForUrl(bgUrl, designData.goalsQueue?.bgCropData);
});

function openCropModalForUrl(url, cropData) {
    const cropModal = document.getElementById('cropModal');
    const targetImg = document.getElementById('cropTargetImg');
    const cropBox = document.getElementById('cropBox');
    
    targetImg.crossOrigin = "anonymous";
    targetImg.onload = () => {
        cropModal.style.display = 'flex';
        setTimeout(() => {
            const container = document.getElementById('cropContainer');
            const w = container.clientWidth || targetImg.clientWidth || targetImg.width;
            const h = container.clientHeight || targetImg.clientHeight || targetImg.height;
            
            let boxW = w;
            let boxH = h;
            let boxX = 0;
            let boxY = 0;
            
            if (cropData) {
                boxX = Math.round(w * cropData.normX);
                boxY = Math.round(h * cropData.normY);
                boxW = Math.round(w * cropData.normW);
                boxH = Math.round(h * cropData.normH);
                
                boxX = Math.max(0, Math.min(w - 40, boxX));
                boxY = Math.max(0, Math.min(h - 40, boxY));
                boxW = Math.max(40, Math.min(w - boxX, boxW));
                boxH = Math.max(40, Math.min(h - boxY, boxH));
            } else if (cropModal.dataset.target === 'goalsBg') {
                const gq = designData.goalsQueue || {};
                const widgetW = gq.width || 1000;
                // Estimate item height: either explicit itemHeight, or based on fontSize + padding
                const itemH = gq.itemHeight ? gq.itemHeight : (gq.fontSize || 70) * 1.2 + (gq.itemPadding || 0) * 2;
                
                const targetAspect = widgetW / itemH;
                const imgAspect = w / h;
                
                if (imgAspect > targetAspect) {
                    // Image is too wide (w/h > widgetW/itemH). Match height, crop width.
                    boxH = h;
                    boxW = h * targetAspect;
                    boxY = 0;
                    boxX = (w - boxW) / 2;
                } else {
                    // Image is too tall. Match width, crop height.
                    boxW = w;
                    boxH = w / targetAspect;
                    boxX = 0;
                    boxY = (h - boxH) / 2;
                }
            }
            
            cropBox.style.width = `${boxW}px`;
            cropBox.style.height = `${boxH}px`;
            cropBox.style.left = `${boxX}px`;
            cropBox.style.top = `${boxY}px`;
            cropBox.dataset.x = boxX;
            cropBox.dataset.y = boxY;
        }, 50);
    };
    targetImg.onerror = () => {
        showModal({ title: "Erro de Carregamento", message: "Não foi possível carregar a imagem para o editor de corte.", type: "alert" });
    };
    targetImg.src = url;
}

document.getElementById('btnCropImage').addEventListener('click', () => {
    if(!selectedEl || !selectedEl.id.startsWith('img_')) return;
    const imgData = designData.images.find(i => i.id === selectedEl.id);
    if (!imgData || !imgData.url) {
        showModal({ title: "Sem Imagem", message: "Carrega primeiro uma imagem antes de tentar cortar!", type: "alert" });
        return;
    }
    const cropModal = document.getElementById('cropModal');
    cropModal.dataset.target = 'img';
    openCropModalForUrl(imgData.originalUrl || imgData.url, imgData.cropData);
});

document.getElementById('cropBtnCancel').addEventListener('click', () => {
    document.getElementById('cropModal').style.display = 'none';
});

document.getElementById('cropBtnConfirm').addEventListener('click', () => {
    const targetType = document.getElementById('cropModal').dataset.target;
    if(targetType !== 'goalsBg' && (!selectedEl || !selectedEl.id.startsWith('img_'))) return;
    
    const targetImg = document.getElementById('cropTargetImg');
    const cropBox = document.getElementById('cropBox');
    
    const w = targetImg.clientWidth || targetImg.width;
    const h = targetImg.clientHeight || targetImg.height;
    
    if(!w || !h || !targetImg.naturalWidth || !targetImg.naturalHeight) {
        document.getElementById('cropModal').style.display = 'none';
        return;
    }

    const scaleX = targetImg.naturalWidth / w;
    const scaleY = targetImg.naturalHeight / h;

    const boxX = parseFloat(cropBox.dataset.x) || parseFloat(cropBox.style.left) || 0;
    const boxY = parseFloat(cropBox.dataset.y) || parseFloat(cropBox.style.top) || 0;
    const boxW = parseFloat(cropBox.style.width) || cropBox.clientWidth;
    const boxH = parseFloat(cropBox.style.height) || cropBox.clientHeight;

    const normX = Math.max(0, Math.min(1, boxX / w));
    const normY = Math.max(0, Math.min(1, boxY / h));
    const normW = Math.max(0, Math.min(1 - normX, boxW / w));
    const normH = Math.max(0, Math.min(1 - normY, boxH / h));

    const sx = Math.max(0, Math.round(normX * targetImg.naturalWidth));
    const sy = Math.max(0, Math.round(normY * targetImg.naturalHeight));
    const sw = Math.max(1, Math.min(targetImg.naturalWidth - sx, Math.round(normW * targetImg.naturalWidth)));
    const sh = Math.max(1, Math.min(targetImg.naturalHeight - sy, Math.round(normH * targetImg.naturalHeight)));

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sw;
    tempCanvas.height = sh;
    const ctx = tempCanvas.getContext('2d');
    
    try {
        ctx.drawImage(targetImg, sx, sy, sw, sh, 0, 0, sw, sh);
        const base64 = tempCanvas.toDataURL('image/png');
        
        document.getElementById('cropModal').style.display = 'none';
        
        fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: 'cropped_image.png', imageBase64: base64 })
        }).then(r => {
            if(!r.ok) throw new Error("Erro no servidor");
            return r.json();
        }).then(data => {
            if(data.url) {
                const targetType = document.getElementById('cropModal').dataset.target;
                if (targetType === 'goalsBg') {
                    if (!designData.goalsQueue.itemBgOriginalImage) {
                        designData.goalsQueue.itemBgOriginalImage = designData.goalsQueue.itemBgImage;
                    }
                    designData.goalsQueue.bgCropData = { normX, normY, normW, normH };
                    updateWidgetProp('itemBgImage', data.url);
                    document.getElementById('cropModal').dataset.target = '';
                    updatePropertiesPanel();
                } else {
                    window.saveState();
                    const img = designData.images.find(i => i.id === selectedEl.id);
                    if(img) {
                        if (!img.originalUrl) {
                            img.originalUrl = img.url;
                        }
                        
                        const oldNormW = img.cropData ? img.cropData.normW : 1.0;
                        const oldNormH = img.cropData ? img.cropData.normH : 1.0;
                        
                        img.cropData = { normX, normY, normW, normH };
                        
                        if (oldNormW > 0 && oldNormH > 0) {
                            const newW = (img.width || 300) * (normW / oldNormW);
                            const newH = (img.height || 300) * (normH / oldNormH);
                            img.width = Math.max(50, Math.round(newW));
                            img.height = Math.max(50, Math.round(newH));
                        }
                        
                        img.url = data.url;
                        renderCanvas(); 
                        updatePropertiesPanel(); 
                    }
                }
            }
        }).catch(err => {
            console.error(err);
            showModal({ title: "Erro no Envio", message: "Erro ao guardar a imagem cortada no servidor.", type: "alert" });
        });
    } catch(err) {
        console.error("Erro no corte (CORS):", err);
        document.getElementById('cropModal').style.display = 'none';
        showModal({ 
            title: "Erro de Segurança (CORS)", 
            message: "Não é possível cortar uma imagem com link externo protegido por CORS. Guarda primeiro a imagem no PC e importa em 'Escolher do PC'.", 
            type: "alert" 
        });
    }
});

interact('#cropBox')
    .draggable({
        modifiers: [ interact.modifiers.restrictRect({ restriction: 'parent' }) ],
        listeners: {
            move(event) {
                const target = event.target;
                const x = (parseFloat(target.dataset.x) || parseFloat(target.style.left) || 0) + event.dx;
                const y = (parseFloat(target.dataset.y) || parseFloat(target.style.top) || 0) + event.dy;

                target.style.left = `${x}px`;
                target.style.top = `${y}px`;
                target.dataset.x = x;
                target.dataset.y = y;
            }
        }
    })
    .resizable({
        edges: { left: true, right: true, bottom: true, top: true },
        modifiers: [
            interact.modifiers.restrictEdges({ outer: 'parent' }),
            interact.modifiers.restrictSize({ min: { width: 40, height: 40 } })
        ],
        listeners: {
            move(event) {
                const target = event.target;
                let x = parseFloat(target.dataset.x) || parseFloat(target.style.left) || 0;
                let y = parseFloat(target.dataset.y) || parseFloat(target.style.top) || 0;

                x += event.deltaRect.left;
                y += event.deltaRect.top;

                target.style.width = `${event.rect.width}px`;
                target.style.height = `${event.rect.height}px`;
                target.style.left = `${x}px`;
                target.style.top = `${y}px`;

                target.dataset.x = x;
                target.dataset.y = y;
            }
        }
    });

// UI Listeners (Shared) removed

// UI Listeners (Text)
document.getElementById('inpTextFontSize').addEventListener('input', (e) => {
    if (selectedEl && selectedEl.id.startsWith('txt_')) {
        const txt = designData.texts.find(i => i.id === selectedEl.id);
        if(txt) { txt.fontSize = parseFloat(e.target.value) || 40; renderCanvas(); }
    }
});
document.getElementById('btnTextSizeMinus').addEventListener('click', () => {
    if (selectedEl && selectedEl.id.startsWith('txt_')) {
        const txt = designData.texts.find(i => i.id === selectedEl.id);
        if(txt) { 
            txt.fontSize = (parseFloat(txt.fontSize) || 40) - 0.5; 
            if(txt.fontSize < 1) txt.fontSize = 1;
            renderCanvas();
            updatePropertiesPanel();
        }
    }
});
document.getElementById('btnTextSizePlus').addEventListener('click', () => {
    if (selectedEl && selectedEl.id.startsWith('txt_')) {
        const txt = designData.texts.find(i => i.id === selectedEl.id);
        if(txt) { 
            txt.fontSize = (parseFloat(txt.fontSize) || 40) + 0.5; 
            renderCanvas();
            updatePropertiesPanel();
        }
    }
});
document.getElementById('btnAlignLeft').addEventListener('click', () => {
    if (selectedEl && selectedEl.id.startsWith('txt_')) {
        const txt = designData.texts.find(i => i.id === selectedEl.id);
        if(txt) { txt.textAlign = 'left'; renderCanvas(); updatePropertiesPanel(); }
    }
});
document.getElementById('btnAlignCenter').addEventListener('click', () => {
    if (selectedEl && selectedEl.id.startsWith('txt_')) {
        const txt = designData.texts.find(i => i.id === selectedEl.id);
        if(txt) { txt.textAlign = 'center'; renderCanvas(); updatePropertiesPanel(); }
    }
});
document.getElementById('btnAlignRight').addEventListener('click', () => {
    if (selectedEl && selectedEl.id.startsWith('txt_')) {
        const txt = designData.texts.find(i => i.id === selectedEl.id);
        if(txt) { txt.textAlign = 'right'; renderCanvas(); updatePropertiesPanel(); }
    }
});
document.getElementById('btnFormatBold').addEventListener('click', () => {
    if (selectedEl && selectedEl.id.startsWith('txt_')) {
        const txt = designData.texts.find(i => i.id === selectedEl.id);
        if(txt) { txt.fontWeight = (txt.fontWeight === 'bold') ? 'normal' : 'bold'; renderCanvas(); updatePropertiesPanel(); }
    }
});
document.getElementById('btnFormatItalic').addEventListener('click', () => {
    if (selectedEl && selectedEl.id.startsWith('txt_')) {
        const txt = designData.texts.find(i => i.id === selectedEl.id);
        if(txt) { txt.fontStyle = (txt.fontStyle === 'italic') ? 'normal' : 'italic'; renderCanvas(); updatePropertiesPanel(); }
    }
});
document.getElementById('btnFormatUnderline').addEventListener('click', () => {
    if (selectedEl && selectedEl.id.startsWith('txt_')) {
        const txt = designData.texts.find(i => i.id === selectedEl.id);
        if(txt) { txt.textDecoration = (txt.textDecoration === 'underline') ? 'none' : 'underline'; renderCanvas(); updatePropertiesPanel(); }
    }
});
document.getElementById('inpTextTextColor_alpha').addEventListener('input', (e) => {
    if (selectedEl && selectedEl.id.startsWith('txt_')) {
        const txt = designData.texts.find(i => i.id === selectedEl.id);
        if(txt) { txt.color = getRgbaInput('inpTextTextColor'); renderCanvas(); }
    }
});
document.getElementById('inpTextTextColor').addEventListener('input', (e) => {
    if (selectedEl && selectedEl.id.startsWith('txt_')) {
        const txt = designData.texts.find(i => i.id === selectedEl.id);
        if(txt) { txt.color = getRgbaInput('inpTextTextColor'); renderCanvas(); }
    }
});
document.getElementById('inpTextFontFamily').addEventListener('input', (e) => {
    if (selectedEl && selectedEl.id.startsWith('txt_')) {
        const txt = designData.texts.find(i => i.id === selectedEl.id);
        if(txt) { txt.fontFamily = e.target.value; renderCanvas(); }
    }
});
document.getElementById('inpTextShadowColor_alpha').addEventListener('input', (e) => {
    if (selectedEl && selectedEl.id.startsWith('txt_')) {
        const txt = designData.texts.find(i => i.id === selectedEl.id);
        if(txt) { txt.shadowColor = getRgbaInput('inpTextShadowColor'); renderCanvas(); }
    }
});
document.getElementById('inpTextShadowColor').addEventListener('input', (e) => {
    if (selectedEl && selectedEl.id.startsWith('txt_')) {
        const txt = designData.texts.find(i => i.id === selectedEl.id);
        if(txt) { txt.shadowColor = getRgbaInput('inpTextShadowColor'); renderCanvas(); }
    }
});
document.getElementById('inpTextShadowBlur').addEventListener('input', (e) => {
    if (selectedEl && selectedEl.id.startsWith('txt_')) {
        const txt = designData.texts.find(i => i.id === selectedEl.id);
        if(txt) { txt.shadowBlur = parseInt(e.target.value, 10) || 0; renderCanvas(); }
    }
});
document.getElementById('inpTextShadowOffsetX').addEventListener('input', (e) => {
    if (selectedEl && selectedEl.id.startsWith('txt_')) {
        const txt = designData.texts.find(i => i.id === selectedEl.id);
        if(txt) { txt.shadowOffsetX = parseInt(e.target.value, 10) || 0; renderCanvas(); }
    }
});
document.getElementById('inpTextShadowOffsetY').addEventListener('input', (e) => {
    if (selectedEl && selectedEl.id.startsWith('txt_')) {
        const txt = designData.texts.find(i => i.id === selectedEl.id);
        if(txt) { txt.shadowOffsetY = parseInt(e.target.value, 10) || 0; renderCanvas(); }
    }
});


// ADD Placeholder
document.getElementById('btnShowAddMenu').addEventListener('click', () => {
    const m = document.getElementById('addMenu');
    m.style.display = m.style.display === 'none' ? 'flex' : 'none';
});
window.addPlaceholder = (type) => {
    window.saveState();
    document.getElementById('addMenu').style.display = 'none';
    if(type === 'image') {
        const newImg = { id: 'img_' + Date.now(), url: '', x: 50, y: 50, width: 300, height: 300 };
        designData.images.push(newImg);
        renderCanvas();
        const el = document.getElementById(newImg.id);
        if(el) selectElement(el);
    } else if(type === 'text') {
        const newTxt = { id: 'txt_' + Date.now(), text: '', color: '#ffffff', fontSize: 80, x: 50, y: 50, width: 600, height: 150 };
        designData.texts.push(newTxt);
        renderCanvas();
        const el = document.getElementById(newTxt.id);
        if(el) selectElement(el);
    }
};

// Config Menu
function toggleConfigMenu(id, el) {
    let menu = document.getElementById('config-menu-' + id);
    if (menu) { menu.remove(); return; }
    closeConfigMenu();
    
    let locked = false;
    let isMainWidget = (id === 'timer-widget' || id === 'goals-queue-widget' || id === 'podium-widget');
    if (id === 'timer-widget') locked = designData.timer.locked;
    else if (id === 'goals-queue-widget') locked = designData.goalsQueue?.locked;
    else if (id === 'podium-widget') locked = designData.podium?.locked;
    else if (id.startsWith('img_')) locked = designData.images.find(i => i.id === id)?.locked;
    else if (id.startsWith('txt_')) locked = designData.texts.find(i => i.id === id)?.locked;

    menu = document.createElement('div');
    menu.id = 'config-menu-' + id;
    menu.className = 'config-menu';
    menu.innerHTML = `
        <button class="menu-btn" style="display:flex; align-items:center; gap:5px;" onclick="toggleLock('${id}')">${locked ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9 1"/></svg> Desbloquear' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Bloquear'}</button>
        <button class="menu-btn" style="display:flex; align-items:center; gap:5px;" onclick="moveLayer('${id}', 'front')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg> Para Primeiro</button>
        <button class="menu-btn" style="display:flex; align-items:center; gap:5px;" onclick="moveLayer('${id}', 'forward')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg> Para a Frente</button>
        <button class="menu-btn" style="display:flex; align-items:center; gap:5px;" onclick="moveLayer('${id}', 'backward')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg> Para Trás</button>
        <button class="menu-btn" style="display:flex; align-items:center; gap:5px;" onclick="moveLayer('${id}', 'back')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg> Para Último</button>
        ${!isMainWidget ? `<button class="menu-btn" style="background:#ef4444; display:flex; align-items:center; gap:5px;" onclick="deleteElement('${id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Excluir</button>` : ''}
    `;
    menu.onmousedown = (e) => e.stopPropagation();
    el.appendChild(menu);
}

function closeConfigMenu() {
    document.querySelectorAll('.config-menu').forEach(m => m.remove());
}

window.toggleLock = (id) => {
    window.saveState();
    let menuWasOpen = document.getElementById('config-menu-' + id) !== null;
    
    if (id === 'timer-widget') designData.timer.locked = !designData.timer.locked;
    else if (id === 'goals-queue-widget') designData.goalsQueue.locked = !designData.goalsQueue.locked;
    else if (id === 'podium-widget') designData.podium.locked = !designData.podium.locked;
    else if (id.startsWith('img_')) { const i = designData.images.find(x => x.id === id); if(i) i.locked = !i.locked; }
    else if (id.startsWith('txt_')) { const t = designData.texts.find(x => x.id === id); if(t) t.locked = !t.locked; }
    
    renderCanvas();
    const el = document.getElementById(id);
    if(el) {
        selectElement(el);
        if(menuWasOpen) toggleConfigMenu(id, el);
    }
};

window.moveLayer = (id, action) => {
    window.saveState();
    let menuWasOpen = document.getElementById('config-menu-' + id) !== null;
    
    let elements = [];
    if (designData.timer) elements.push({ id: 'timer-widget', zIndex: designData.timer.zIndex !== undefined ? designData.timer.zIndex : 10 });
    if (designData.goalsQueue) elements.push({ id: 'goals-queue-widget', zIndex: designData.goalsQueue.zIndex !== undefined ? designData.goalsQueue.zIndex : 10 });
    if (designData.podium) elements.push({ id: 'podium-widget', zIndex: designData.podium.zIndex !== undefined ? designData.podium.zIndex : 10 });
    designData.images.forEach(img => elements.push({ id: img.id, zIndex: img.zIndex !== undefined ? img.zIndex : 1 }));
    designData.texts.forEach(txt => elements.push({ id: txt.id, zIndex: txt.zIndex !== undefined ? txt.zIndex : 2 }));

    elements.sort((a, b) => a.zIndex - b.zIndex);
    
    elements.forEach((el, index) => {
        el.zIndex = index + 1;
    });

    const currentIndex = elements.findIndex(e => e.id === id);

    if (action === 'forward' && currentIndex < elements.length - 1) {
        let temp = elements[currentIndex].zIndex;
        elements[currentIndex].zIndex = elements[currentIndex + 1].zIndex;
        elements[currentIndex + 1].zIndex = temp;
    } else if (action === 'backward' && currentIndex > 0) {
        let temp = elements[currentIndex].zIndex;
        elements[currentIndex].zIndex = elements[currentIndex - 1].zIndex;
        elements[currentIndex - 1].zIndex = temp;
    } else if (action === 'front') {
        elements[currentIndex].zIndex = elements.length + 1;
    } else if (action === 'back') {
        elements[currentIndex].zIndex = 0;
    }

    elements.forEach(el => {
        if (el.id === 'timer-widget') designData.timer.zIndex = el.zIndex;
        else if (el.id === 'goals-queue-widget') designData.goalsQueue.zIndex = el.zIndex;
        else if (el.id === 'podium-widget') designData.podium.zIndex = el.zIndex;
        else if (el.id.startsWith('img_')) { const i = designData.images.find(x => x.id === el.id); if(i) i.zIndex = el.zIndex; }
        else if (el.id.startsWith('txt_')) { const t = designData.texts.find(x => x.id === el.id); if(t) t.zIndex = el.zIndex; }
    });
    
    renderCanvas();
    const targetEl = document.getElementById(id);
    if(targetEl) {
        selectElement(targetEl);
        if(menuWasOpen) toggleConfigMenu(id, targetEl);
    }
};

window.deleteElement = (id) => {
    showModal({ title: "Apagar Elemento", message: "Tens a certeza?", type: "confirm", confirmText: "Apagar" }, (confirmed) => {
        if(confirmed) {
            window.saveState();
            if (id.startsWith('img_')) designData.images = designData.images.filter(i => i.id !== id);
            else if (id.startsWith('txt_')) designData.texts = designData.texts.filter(t => t.id !== id);
            
            selectedEl = null;
            renderCanvas();
            updatePropertiesPanel();
        }
    });
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete') {
        if (selectedEl && selectedEl.id !== 'timer-widget') {
            if (e.target.tagName.toLowerCase() === 'input') return;
            deleteElement(selectedEl.id);
        }
    }
});

document.getElementById('btnSaveDesign').addEventListener('click', () => {
    if (selectedEl) {
        selectedEl.classList.remove('selected');
        closeConfigMenu();
        selectedEl = null;
        renderCanvas();
        updatePropertiesPanel();
    }
    socket.emit('updateDesign', { mode: currentMode, data: designData, user: 'Streamer' });
    showModal({ title: "Sucesso!", message: "Design guardado com sucesso! Verifica o OBS.", type: "alert" });
});

// Interact
const draggableConfig = {
    ignoreFrom: '.editing-text, .resize-handle, .config-icon',
    modifiers: [ interact.modifiers.restrictRect({ restriction: 'parent' }) ],
    listeners: {
      start(event) {
          window.saveState();
      },
      move(event) {
        const x = (parseFloat(event.target.style.left) || 0) + (event.dx / currentScale);
        const y = (parseFloat(event.target.style.top) || 0) + (event.dy / currentScale);
        event.target.style.left = `${x}px`;
        event.target.style.top = `${y}px`;

        if (event.target.id === 'timer-widget') { designData.timer.x = x; designData.timer.y = y; }
        else if (event.target.id === 'goals-queue-widget') { designData.goalsQueue.x = x; designData.goalsQueue.y = y; }
        else if (event.target.id === 'podium-widget') { designData.podium.x = x; designData.podium.y = y; }
        else if (event.target.id === 'roulette-widget') { designData.roulette.x = x; designData.roulette.y = y; }
        else if (event.target.id.startsWith('img_')) { const i = designData.images.find(a => a.id === event.target.id); if(i) { i.x = x; i.y = y; } }
        else if (event.target.id.startsWith('txt_')) { const t = designData.texts.find(a => a.id === event.target.id); if(t) { t.x = x; t.y = y; } }
        
        if (selectedEl && selectedEl.id === event.target.id) {
            const inpX = document.getElementById('inpSharedX');
            const inpY = document.getElementById('inpSharedY');
            if (inpX) inpX.value = Math.round(x);
            if (inpY) inpY.value = Math.round(y);
        }
      }
    }
};

const resizableListeners = {
    start(event) {
        window.saveState();
        if (event.target.id.startsWith('img_')) {
            const img = designData.images.find(i => i.id === event.target.id);
            if (img && img.width && img.height) event.target.dataset.ratio = img.width / img.height;
        }
    },
    move(event) {
        let x = (parseFloat(event.target.style.left) || 0) + (event.deltaRect.left / currentScale);
        let y = (parseFloat(event.target.style.top) || 0) + (event.deltaRect.top / currentScale);
        let w = (parseFloat(event.target.style.width) || 0) + (event.deltaRect.width / currentScale);
        let currentH = parseFloat(event.target.style.height);
        if (isNaN(currentH)) currentH = event.target.getBoundingClientRect().height / currentScale;
        let h = currentH + (event.deltaRect.height / currentScale);

        if (event.target.id.startsWith('img_') && event.target.dataset.ratio) {
            let isCorner = event.edges && event.edges.right && event.edges.bottom;
            if (isCorner) {
                const ratio = parseFloat(event.target.dataset.ratio);
                if (Math.abs(event.deltaRect.width) > Math.abs(event.deltaRect.height)) h = w / ratio;
                else w = h * ratio;
            }
        }
        
        if (event.target.classList.contains('resizable-roulette')) {
            const size = Math.max(100, Math.max(w, h));
            w = size;
            h = size;
        } else if (event.target.id === 'timer-widget' || event.target.id === 'goals-queue-widget') {
            w = Math.max(100, w);
            h = Math.max(50, h);
        } else if (event.target.id === 'podium-widget') {
            w = Math.max(550, w);
            h = Math.max(200, h);
        }
        
        if (event.target.id.startsWith('txt_')) {
            h = 'auto';
            y = parseFloat(event.target.style.top) || 0;
        }

        Object.assign(event.target.style, { left: `${x}px`, top: `${y}px`, width: `${w}px` });
        if (h !== 'auto') {
            event.target.style.height = `${h}px`;
        } else {
            event.target.style.height = 'auto';
            h = event.target.getBoundingClientRect().height / currentScale;
        }

        if (event.target.id === 'timer-widget') {
            designData.timer.width = w; designData.timer.height = h;
            designData.timer.x = x; designData.timer.y = y;
        } else if (event.target.id === 'goals-queue-widget') {
            designData.goalsQueue.width = w; designData.goalsQueue.height = h;
            designData.goalsQueue.x = x; designData.goalsQueue.y = y;
        } else if (event.target.id === 'podium-widget') {
            designData.podium.width = w; designData.podium.height = h;
            designData.podium.x = x; designData.podium.y = y;
        } else if (event.target.id === 'roulette-widget') {
            designData.roulette.width = w; designData.roulette.height = h;
            designData.roulette.x = x; designData.roulette.y = y;
        } else if (event.target.id.startsWith('img_')) {
            const i = designData.images.find(a => a.id === event.target.id);
            if(i) { i.width = w; i.height = h; i.x = x; i.y = y; }
        } else if (event.target.id.startsWith('txt_')) {
            const t = designData.texts.find(a => a.id === event.target.id);
            if(t) { t.width = w; t.x = x; t.y = y; }
        }
        
        if (selectedEl && selectedEl.id === event.target.id) {
            const inpW = document.getElementById('inpSharedWidth');
            const inpH = document.getElementById('inpSharedHeight');
            const inpX = document.getElementById('inpSharedX');
            const inpY = document.getElementById('inpSharedY');
            if (inpW) inpW.value = Math.round(w);
            if (inpH && !event.target.classList.contains('resizable-x')) inpH.value = Math.round(h);
            if (inpX) inpX.value = Math.round(x);
            if (inpY) inpY.value = Math.round(y);
        }
    }
};
interact('.resizable-roulette:not(.locked)')
    .draggable(draggableConfig)
    .resizable({
        edges: { left: true, right: true, bottom: true, top: true },
        modifiers: [
          interact.modifiers.aspectRatio({ ratio: 1 }),
          interact.modifiers.restrictEdges({ outer: 'parent' }),
          interact.modifiers.restrictSize({ min: { width: 100, height: 100 }, max: { width: 1080, height: 1080 } })
        ],
        listeners: resizableListeners
    });

interact('.resizable-all:not(.locked)')
    .draggable(draggableConfig)
    .resizable({
        edges: { left: true, right: true, bottom: true, top: true },
        modifiers: [
          interact.modifiers.restrictEdges({ outer: 'parent' }),
          interact.modifiers.restrictSize({ min: { width: 50, height: 50 } })
        ],
        listeners: resizableListeners
    });

interact('.resizable-x:not(.locked)')
    .draggable(draggableConfig)
    .resizable({
        edges: { right: '.resize-handle' },
        modifiers: [
          interact.modifiers.restrictEdges({ outer: 'parent' }),
          interact.modifiers.restrictSize({ min: { width: 50 } })
        ],
        listeners: resizableListeners
    });

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
            if (typeof renderCanvas === 'function') renderCanvas();
        });
    }
}

function loadFontsIntoSelects() {
    const fonts = designData.fonts || [];
    const selects = [document.getElementById('inpTextFontFamily'), document.getElementById('inpTimerFontFamily'), document.getElementById('inpRouletteFontFamily')];
    
    selects.forEach(select => {
        if(!select) return;
        const currentVal = select.value;
        const defaultOptions = `
            <option value="Arial">Arial</option>
            <option value="Verdana">Verdana</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Courier New">Courier New</option>
        `;
        let newOptions = defaultOptions;
        fonts.forEach(f => {
            newOptions += `<option value="${f.name}">${f.name}</option>`;
        });
        select.innerHTML = newOptions;
        
        let hasOption = Array.from(select.options).some(o => o.value === currentVal);
        if (hasOption) select.value = currentVal;
    });
}

document.getElementById('btnUploadTextFont')?.addEventListener('click', () => {
    document.getElementById('inpFileFont').dataset.target = 'text';
    document.getElementById('inpFileFont').click();
});
document.getElementById('btnUploadTimerFont')?.addEventListener('click', () => {
    document.getElementById('inpFileFont').dataset.target = 'timer';
    document.getElementById('inpFileFont').click();
});
document.getElementById('btnUploadRouletteFont')?.addEventListener('click', () => {
    document.getElementById('inpFileFont').dataset.target = 'roulette';
    document.getElementById('inpFileFont').click();
});
document.getElementById('inpFileFont')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            const base64 = evt.target.result;
            const fontName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
            
            fetch('/api/upload-font', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: file.name, fontBase64: base64 })
            }).then(r => {
                if(!r.ok) throw new Error("Erro no servidor");
                return r.json();
            }).then(data => {
                if(data.url) {
                    if(!designData.fonts) designData.fonts = [];
                    let finalName = fontName;
                    let counter = 1;
                    while(designData.fonts.some(f => f.name === finalName)) {
                        finalName = fontName + '_' + counter;
                        counter++;
                    }
                    
                    window.saveState();
                    designData.fonts.push({ name: finalName, url: data.url });
                    injectCustomFonts(designData.fonts);
                    loadFontsIntoSelects();
                    
                    const target = e.target.dataset.target;
                    if(target === 'text' && selectedEl && selectedEl.id.startsWith('txt_')) {
                        const txt = designData.texts.find(i => i.id === selectedEl.id);
                        if(txt) {
                            txt.fontFamily = finalName;
                            document.getElementById('inpTextFontFamily').value = finalName;
                            renderCanvas();
                        }
                    } else if (target === 'timer') {
                        if (selectedEl?.id === 'goals-queue-widget') {
                            designData.goalsQueue.fontFamily = finalName;
                        } else if (selectedEl?.id === 'podium-widget') {
                            designData.podium.fontFamily = finalName;
                        } else {
                            designData.timer.fontFamily = finalName;
                        }
                        document.getElementById('inpTimerFontFamily').value = finalName;
                        renderCanvas();
                    } else if (target === 'roulette') {
                        designData.roulette.fontFamily = finalName;
                        document.getElementById('inpRouletteFontFamily').value = finalName;
                        renderCanvas();
                    }
                }
            }).catch(err => {
                console.error(err);
                showModal({ title: "Erro no Envio", message: "Erro ao enviar a fonte.", type: "alert" });
            });
        };
        reader.readAsDataURL(file);
    }
    e.target.value = '';
});

socket.on('init', (data) => {
    baseSettings = data.settings;
    currentSubathonData = data.subathonData;
    if (data.settings.designs && data.settings.designs[currentMode]) {
        designData = data.settings.designs[currentMode];
        if (currentMode === 'timer' && !designData.timer) designData.timer = {};
        if (currentMode === 'goals' && !designData.goalsQueue) designData.goalsQueue = {};
        if (currentMode === 'roulette' && !designData.roulette) designData.roulette = {};
        if (currentMode === 'podium') {
            if (!designData.podium) designData.podium = {};
            if (!designData.podium.width) {
                designData.podium = { x: 100, y: 100, width: 900, height: 300, fontSize: 24, color: '#ffffff', ...designData.podium };
            }
        }
    } else {
        designData = { images: [], texts: [], fonts: [] };
        if (currentMode === 'timer') designData.timer = {};
        if (currentMode === 'goals') designData.goalsQueue = {};
if (currentMode === 'roulette') designData.roulette = {};
        if (currentMode === 'podium') designData.podium = { x: 100, y: 100, width: 900, height: 300, fontSize: 24, color: '#ffffff' };
    }
    if (!designData.fonts) designData.fonts = [];
    injectCustomFonts(designData.fonts);
    loadFontsIntoSelects();
    currentTimerSeconds = data.timerSeconds;
    renderCanvas();
    updatePropertiesPanel();
    setTimeout(fitToScreen, 100);
});

socket.on('subathonUpdated', (d) => {
    const oldGoals = currentSubathonData ? currentSubathonData.goals : [];
    currentSubathonData = d;
    
    if (d.goals) {
        d.goals.forEach(newG => {
            const oldG = oldGoals.find(o => o.id === newG.id);
            if (oldG && !oldG.completed && newG.completed) {
                animatingGoals.add(newG.id);
                const gqConfig = designData.goalsQueue || {};
                const delaySec = gqConfig.completedDelay !== undefined ? parseFloat(gqConfig.completedDelay) : 3;
                setTimeout(() => {
                    animatingGoals.delete(newG.id);
                    renderCanvas();
                }, delaySec * 1000);
            }
        });
    }
    
    renderCanvas();
});

socket.on('timeUpdate', (s) => {
    currentTimerSeconds = s;
    const tel = document.getElementById('timer-widget');
    if(tel) tel.innerText = formatTime(s);
});






