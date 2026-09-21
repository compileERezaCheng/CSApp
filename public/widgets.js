let animatingGoals = new Set(); // store IDs of goals currently playing the strike-out animation

function renderSubathonGoals(container, gqConfig) {
    if (!container || !currentSubathonData || !gqConfig) return;
    
    const goals = currentSubathonData.goals || [];
    const visibleCount = currentSubathonData.visibleCount || 3;
    const currentSubs = currentSubathonData.currentSubs || 0;
    
    const borderColor = gqConfig.border || '#8b5cf6';
    const titleText = gqConfig.titleText !== undefined ? gqConfig.titleText : 'Next Goals';
    const titleColor = gqConfig.titleColor || gqConfig.color || '#ffffff';
    const completedColor = gqConfig.completedColor || '#10b981';
    
    container.style.gap = (gqConfig.itemGap !== undefined ? gqConfig.itemGap : 5) + 'px';
    
    let toShow = [];
    let count = 0;
    
    for (const g of goals) {
        if (g.completed) {
            if (animatingGoals.has(g.id)) {
                toShow.push({ ...g, animating: true });
                count++;
            }
        } else {
            if (count < visibleCount) {
                toShow.push(g);
                count++;
            }
        }
    }

    let titleEl = container.querySelector('.gq-title');
    const showTitle = titleText.trim() !== '';
    const borderStyle = (gqConfig.enableTitleLine !== false) ? `1px solid ${borderColor}` : 'none';
    
    if (showTitle) {
        if (!titleEl) {
            titleEl = document.createElement('div');
            titleEl.className = 'gq-title';
            // prepend title
            container.insertBefore(titleEl, container.firstChild);
        }
        titleEl.style.width = '100%';
        titleEl.style.borderBottom = borderStyle;
        titleEl.style.paddingBottom = '5px';
        titleEl.style.fontWeight = 'bold';
        titleEl.style.textAlign = 'center';
        titleEl.style.color = titleColor;
        titleEl.style.transition = 'all 0.3s ease';
        titleEl.innerText = titleText;
    } else if (titleEl) {
        titleEl.remove();
    }
    
    const existingItems = Array.from(container.querySelectorAll('.gq-item'));
    const keepIds = new Set(toShow.map(g => String(g.id)));
    
    let hasExiting = false;
    
    const fadeSpeed = gqConfig.fadeSpeed !== undefined ? parseFloat(gqConfig.fadeSpeed) : 0.5;
    const slideSpeed = gqConfig.slideSpeed !== undefined ? parseFloat(gqConfig.slideSpeed) : 0.5;
    const fadeSpeedMs = fadeSpeed * 1000;
    const slideSpeedMs = slideSpeed * 1000;
    const phase1Wait = fadeSpeedMs * 0.8;
    
    existingItems.forEach(el => {
        if (el._exitTimer1) {
            clearTimeout(el._exitTimer1);
            el._exitTimer1 = null;
        }
        if (el._exitTimer2) {
            clearTimeout(el._exitTimer2);
            el._exitTimer2 = null;
        }

        if (!keepIds.has(el.dataset.id)) {
            hasExiting = true;
            // Lock height
            el.style.maxHeight = el.offsetHeight + 'px';
            el.style.overflow = 'hidden';
            
            // Set transition for Phase 1
            el.style.transition = `opacity ${fadeSpeed}s cubic-bezier(0.4, 0, 0.2, 1), transform ${fadeSpeed}s cubic-bezier(0.4, 0, 0.2, 1)`;
            void el.offsetWidth; // Trigger reflow
            
            // Phase 1: Fade out
            el.style.opacity = '0';
            el.style.transform = 'translateY(-10px)';
            
            // Phase 2: Collapse space (triggers slide up of remaining items)
            el._exitTimer1 = setTimeout(() => {
                el.style.transition = `max-height ${slideSpeed}s cubic-bezier(0.4, 0, 0.2, 1), margin ${slideSpeed}s cubic-bezier(0.4, 0, 0.2, 1), padding ${slideSpeed}s cubic-bezier(0.4, 0, 0.2, 1)`;
                el.style.maxHeight = '0px';
                el.style.margin = '0px';
                el.style.padding = '0px';
                
                // Phase 3: Remove from DOM
                el._exitTimer2 = setTimeout(() => el.remove(), slideSpeedMs);
            }, phase1Wait);
        } else {
            // Apply new transition speed to existing items as well
            el.style.transition = `all ${slideSpeed}s cubic-bezier(0.4, 0, 0.2, 1)`;
        }
    });
    
    const delayNewItems = hasExiting ? phase1Wait : 0;
    
    toShow.forEach((g, idx) => {
        let displaySubs = currentSubs;
        if (currentSubs > g.target) displaySubs = g.target;
        
        let itemEl = container.querySelector(`.gq-item[data-id="${g.id}"]`);
        const isNew = !itemEl;
        
        const itemPadding = gqConfig.itemPadding !== undefined ? gqConfig.itemPadding : 0;
        const itemBg = gqConfig.itemBgImage ? `url("${gqConfig.itemBgImage}")` : 'none';
        const itemHeight = gqConfig.itemHeight ? parseInt(gqConfig.itemHeight) : 0;
        
        let formattedDisplay = displaySubs;
        let formattedTarget = g.target;
        
        // Note: currentSettings is globally available in overlay.js/design.js
        if (typeof currentSettings !== 'undefined' && currentSettings) {
            const prefix = currentSettings.goalPrefix ? currentSettings.goalPrefix + ' ' : '';
            formattedDisplay = prefix + formattedDisplay;
            formattedTarget = prefix + formattedTarget;
        }

        if (isNew) {
            itemEl = document.createElement('div');
            itemEl.className = 'gq-item';
            itemEl.dataset.id = g.id;
            itemEl.style.display = 'flex';
            itemEl.style.justifyContent = 'space-between';
            itemEl.style.width = '100%';
            itemEl.style.boxSizing = 'border-box';
            itemEl.style.padding = itemPadding + 'px';
            if (itemHeight > 0) {
                itemEl.style.minHeight = itemHeight + 'px';
                itemEl.style.alignItems = 'center';
            }
            itemEl.style.backgroundImage = itemBg;
            itemEl.style.backgroundSize = 'cover';
            itemEl.style.backgroundPosition = 'center';
            itemEl.style.opacity = '0';
            itemEl.style.transform = 'translateY(15px)';
            
            itemEl.innerHTML = `<span>${g.title}</span><span>${formattedDisplay} / ${formattedTarget}</span>`;
        } else {
            // Real-time style updates
            itemEl.style.padding = itemPadding + 'px';
            if (itemHeight > 0) {
                itemEl.style.minHeight = itemHeight + 'px';
                itemEl.style.alignItems = 'center';
            } else {
                itemEl.style.minHeight = '0px';
            }
            itemEl.style.backgroundImage = itemBg;
            
            if (g.animating) {
                itemEl.style.textDecoration = 'line-through';
                itemEl.style.opacity = '0.5';
                itemEl.style.color = completedColor;
            } else {
                itemEl.style.textDecoration = 'none';
                itemEl.style.opacity = '1';
                itemEl.style.color = ''; 
                itemEl.style.maxHeight = 'none';
                itemEl.style.overflow = 'visible';
                itemEl.style.transform = 'none';
            }
            itemEl.innerHTML = `<span>${g.title}</span><span>${formattedDisplay} / ${formattedTarget}</span>`;
        }

        // Ensure DOM ordering matches toShow
        let nextEl = null;
        for (let j = idx + 1; j < toShow.length; j++) {
            const nextCandidate = container.querySelector(`.gq-item[data-id="${toShow[j].id}"]`);
            if (nextCandidate) {
                nextEl = nextCandidate;
                break;
            }
        }

        if (nextEl) {
            if (itemEl.nextSibling !== nextEl) {
                container.insertBefore(itemEl, nextEl);
            }
        } else {
            let prevEl = null;
            if (idx > 0) {
                prevEl = container.querySelector(`.gq-item[data-id="${toShow[idx - 1].id}"]`);
            }
            if (prevEl) {
                if (prevEl.nextSibling !== itemEl) {
                    container.insertBefore(itemEl, prevEl.nextSibling);
                }
            } else {
                if (itemEl.parentElement !== container) {
                    container.appendChild(itemEl);
                }
            }
        }

        if (isNew) {
            // Calculate natural height
            itemEl.style.maxHeight = 'none';
            const naturalHeight = itemEl.offsetHeight;
            
            // Set to collapsed state before transition
            itemEl.style.maxHeight = '0px';
            itemEl.style.overflow = 'hidden';
            void itemEl.offsetWidth; // force reflow
            
            // Add transitions
            itemEl.style.transition = `max-height ${slideSpeed}s cubic-bezier(0.4, 0, 0.2, 1), opacity ${fadeSpeed}s cubic-bezier(0.4, 0, 0.2, 1), transform ${slideSpeed}s cubic-bezier(0.4, 0, 0.2, 1)`;
            
            // Phase 2 (Simultaneous with collapse of exited item): Expand and fade in
            setTimeout(() => {
                itemEl.style.opacity = '1';
                itemEl.style.transform = 'translateY(0)';
                itemEl.style.maxHeight = naturalHeight + 'px';
                
                setTimeout(() => {
                    if (itemEl && itemEl.style) {
                        itemEl.style.maxHeight = 'none';
                        itemEl.style.overflow = 'visible';
                    }
                }, Math.max(slideSpeedMs, fadeSpeedMs));
            }, delayNewItems);
        }
    });
}


let currentPodiumCategory = 0; // 0=Subs, 1=Bits, 2=Tips
let podiumInterval = null;

function renderPodiumWidget(container, d, isInterval = false) {
    if (!container || !d) return;

    if (!window.podiumInterval) {
        window.podiumInterval = setInterval(() => {
            const pWidget = document.getElementById('podium-widget');
            if (pWidget && currentMode === 'podium') {
                currentPodiumCategory = (currentPodiumCategory + 1) % 3;
                pWidget.style.opacity = 0;
                pWidget.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    let pConfig = {};
                    if (typeof currentSettings !== 'undefined' && currentSettings) {
                        pConfig = currentSettings.designs?.podium?.podium || {};
                    } else if (typeof designData !== 'undefined' && designData) {
                        pConfig = designData.podium || {};
                    }
                    renderPodiumWidget(pWidget, pConfig, true);
                    pWidget.style.opacity = 1;
                    pWidget.style.transform = 'scale(1)';
                }, 500);
            }
        }, 10000); // cycle every 10 seconds
    }

    const pCount = d.visibleCount || 3;
    let users = [];
    let topSubs = Array(pCount).fill().map(()=>({name:'N/A', val:0}));
    let topBits = Array(pCount).fill().map(()=>({name:'N/A', val:0}));
    let topTips = Array(pCount).fill().map(()=>({name:'N/A', val:0}));

    if (currentSubathonData && currentSubathonData.userStats) {
        const statsList = Object.entries(currentSubathonData.userStats).map(([name, s]) => ({ name, subs: s.subs||0, bits: s.bits||0, tips: s.tips||0 }));
        
        const sList = [...statsList].filter(x => x.subs > 0).sort((a,b) => b.subs - a.subs);
        const bList = [...statsList].filter(x => x.bits > 0).sort((a,b) => b.bits - a.bits);
        const tList = [...statsList].filter(x => x.tips > 0).sort((a,b) => b.tips - a.tips);

        for (let i=0; i<pCount; i++) {
            if (sList[i]) topSubs[i] = { name: sList[i].name, val: sList[i].subs };
            if (bList[i]) topBits[i] = { name: bList[i].name, val: bList[i].bits };
            if (tList[i]) topTips[i] = { name: tList[i].name, val: tList[i].tips };
        }
    }

    let currentList = [];
    let title = '';
    let color = '';
    let suffix = '';

    if (currentPodiumCategory === 0) {
        currentList = topSubs;
        title = d.col1Title || 'Top Subs';
        color = d.col1Color || '#8b5cf6';
        suffix = 'Subs';
    } else if (currentPodiumCategory === 1) {
        currentList = topBits;
        title = d.col2Title || 'Top Bits';
        color = d.col2Color || '#8b5cf6';
        suffix = 'Bits';
    } else {
        currentList = topTips;
        title = d.col3Title || 'Top Dono';
        color = d.col3Color || '#8b5cf6';
        suffix = '$';
    }

    const isHorizontal = d.orientation === 'horizontal';

    if (pCount === 3 && !isHorizontal) {
        // Positions: 2nd place (left), 1st place (center), 3rd place (right)
        users = [
            { rank: 2, name: currentList[1].name, val: currentList[1].val + ' ' + suffix, height: 60 },
            { rank: 1, name: currentList[0].name, val: currentList[0].val + ' ' + suffix, height: 80 },
            { rank: 3, name: currentList[2].name, val: currentList[2].val + ' ' + suffix, height: 40 }
        ];
    } else {
        // Ordered left to right: 1st, 2nd, 3rd, 4th...
        for (let i = 0; i < pCount; i++) {
            let h = Math.max(20, 80 - (i * (60 / Math.max(1, pCount - 1))));
            users.push({ rank: i + 1, name: currentList[i].name, val: currentList[i].val + ' ' + suffix, height: h });
        }
    }

    let finalHtml = `
        <div style="text-align:center; font-size:1.5em; font-weight:bold; color:${color}; text-shadow:0 0 10px rgba(0,0,0,0.8); margin-bottom: 20px;">${title}</div>
        <div style="display:flex; flex:1; flex-direction:${isHorizontal ? 'column' : 'row'}; align-items:${isHorizontal ? 'stretch' : 'flex-end'}; justify-content:${isHorizontal ? 'flex-start' : 'center'}; gap:${d.itemGap !== undefined ? d.itemGap : 20}px; width:100%;">
    `;
    let colsHtml = '';
    users.forEach(u => {
        if (isHorizontal) {
            colsHtml += `
                <div style="display:flex; flex-direction:row; align-items:center; width:100%; flex:1;">
                    <div style="width:40px; font-weight:bold; font-size:1.2em; text-align:center; margin-right:10px;">#${u.rank}</div>
                    <div style="flex-direction:row; width:${u.height}%; min-height:40px; background:linear-gradient(90deg, ${color} 0%, rgba(0,0,0,0.8) 100%); border-radius:0 10px 10px 0; display:flex; justify-content:space-between; align-items:center; padding:0 15px; box-shadow:-5px 0 15px rgba(0,0,0,0.5); position:relative; overflow:hidden;">
                        <div style="position:absolute; top:0; left:0; bottom:0; right:0; background:linear-gradient(90deg, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0) 50%); border-radius:0 10px 10px 0; pointer-events:none;"></div>
                        <span style="font-weight:bold; color:#fff; text-shadow:0 0 8px rgba(0,0,0,0.8); z-index:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:60%; margin-right:10px;">${u.name}</span>
                        <span style="font-size:0.8em; text-shadow:0 0 5px rgba(0,0,0,0.8); z-index:1; color:#fff;">${u.val}</span>
                    </div>
                </div>
            `;
        } else {
            colsHtml += `
                <div style="display:flex; flex-direction:column; align-items:center; flex:1; text-align:center; min-width:0;">
                    <div style="font-weight:bold; font-size:1em; margin-bottom:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; color:${color}; text-shadow:0 0 8px rgba(0,0,0,0.8);">${u.name}</div>
                    <div style="font-size:0.8em; margin-bottom:10px; text-shadow:0 0 5px rgba(0,0,0,0.8);">${u.val}</div>
                    <div style="width:100%; height:${u.height}%; background:linear-gradient(180deg, ${color} 0%, rgba(0,0,0,0.8) 100%); border-radius:10px 10px 0 0; display:flex; justify-content:center; align-items:flex-start; padding-top:10px; font-weight:bold; font-size:1.2em; box-shadow:0 -5px 15px rgba(0,0,0,0.5); position:relative;">
                        #${u.rank}
                        <div style="position:absolute; top:0; left:0; right:0; bottom:0; background:linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0) 50%); border-radius:10px 10px 0 0; pointer-events:none;"></div>
                    </div>
                </div>
            `;
        }
    });
    
    container.innerHTML = finalHtml + colsHtml + '</div>';
}

let currentRouletteRotation = 0;
let isSpinning = false;
let rouletteCanvas = null;

function renderRouletteWidget(container, options, settings = {}) {
    if (!options || options.length === 0) {
        container.innerHTML = '<div style="color:white; font-size:30px; text-align:center; padding-top: 100px;">Adicione opcões na Roleta!</div>';
        return;
    }

    if (!rouletteCanvas) {
        rouletteCanvas = document.createElement('canvas');
        rouletteCanvas.width = 800;
        rouletteCanvas.height = 800;
        rouletteCanvas.style.width = '100%';
        rouletteCanvas.style.height = '100%';
        rouletteCanvas.style.transition = 'transform 5s cubic-bezier(0.25, 0.1, 0.15, 1)';
        rouletteCanvas.style.transform = `rotate(${currentRouletteRotation}deg)`;
    }

    if (!rouletteCanvas.parentElement || rouletteCanvas.parentElement.parentElement !== container) {
        container.innerHTML = '';
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
        container.style.overflow = 'visible';
        
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.width = '100%';
        wrapper.style.height = '100%';
        
        const pointer = document.createElement('div');
        pointer.style.position = 'absolute';
        pointer.style.top = '-2.5%';
        pointer.style.left = '46.875%';
        pointer.style.width = '6.25%';
        pointer.style.height = '6.25%';
        pointer.style.zIndex = '10';
        pointer.style.filter = 'drop-shadow(0px 5px 5px rgba(0,0,0,0.5))';
        pointer.innerHTML = '<svg viewBox="0 0 50 50" width="100%" height="100%"><polygon points="0,0 50,0 25,50" fill="white" class="roulette-pointer-poly" /></svg>';

        wrapper.appendChild(rouletteCanvas);
        wrapper.appendChild(pointer);
        container.appendChild(wrapper);
    }
    
    const poly = container.querySelector('.roulette-pointer-poly');
    if (poly) poly.setAttribute('fill', settings.arrowColor || 'white');

    drawWheel(options, settings);
}

function drawWheel(options, settings = {}) {
    if(!rouletteCanvas) return;
    const ctx = rouletteCanvas.getContext('2d');
    const cw = rouletteCanvas.width;
    const ch = rouletteCanvas.height;
    ctx.clearRect(0, 0, cw, ch);

    const totalWeight = options.reduce((sum, opt) => sum + parseInt(opt.weight || 1), 0);
    let startAngle = -Math.PI / 2; // start at top
    
    const outlineThickness = settings.outlineThickness !== undefined ? settings.outlineThickness : 2;

    options.forEach(opt => {
        const sliceAngle = (parseInt(opt.weight || 1) / totalWeight) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(cw/2, ch/2);
        ctx.arc(cw/2, ch/2, cw/2 - 10, startAngle, startAngle + sliceAngle);
        ctx.fillStyle = opt.color || '#fff';
        ctx.fill();
        ctx.lineWidth = outlineThickness;
        ctx.strokeStyle = settings.outlineColor || '#fff';
        if (outlineThickness > 0) ctx.stroke();

        ctx.save();
        ctx.translate(cw/2, ch/2);
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        const fSize = settings.fontSize || 30;
        ctx.font = `bold ${fSize}px "${settings.fontFamily || 'Arial'}"`;
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.textBaseline = 'middle';
        ctx.fillText(opt.label, cw/2 - 30, 0);
        ctx.restore();

        startAngle += sliceAngle;
    });
}

window.triggerSpin = function(options, settings = {}) {
    if(isSpinning || !rouletteCanvas) return;
    if(!options || options.length === 0) return;
    isSpinning = true;
    
    // Play sound if possible
    try {
        const audio = new Audio('https://www.soundjay.com/misc/sounds/spinning-wheel-1.mp3');
        audio.play();
    } catch(e) {}

    const extraSpins = 5 + Math.random() * 5; 
    const randomAngle = Math.random() * 360;
    currentRouletteRotation += (extraSpins * 360) + randomAngle;
    rouletteCanvas.style.transform = 'rotate(' + currentRouletteRotation + 'deg)';

    const totalWeight = options.reduce((sum, opt) => sum + parseInt(opt.weight || 1), 0);
    const normalizedRot = currentRouletteRotation % 360;
    const pointerAngle = (360 - normalizedRot) % 360;
    
    let currentAngle = 0;
    let winner = null;
    let winnerIndex = -1;
    for(let i=0; i<options.length; i++) {
        const opt = options[i];
        const sliceDeg = (parseInt(opt.weight || 1) / totalWeight) * 360;
        if(pointerAngle >= currentAngle && pointerAngle < currentAngle + sliceDeg) {
            winner = opt;
            winnerIndex = i;
            break;
        }
        currentAngle += sliceDeg;
    }

    setTimeout(() => {
        isSpinning = false;
        const cw = rouletteCanvas.parentElement.clientWidth || 800;
        const scale = cw / 800;
        
        const winnerDiv = document.createElement('div');
        winnerDiv.style.position = 'absolute';
        winnerDiv.style.top = '50%';
        winnerDiv.style.left = '50%';
        winnerDiv.style.transform = 'translate(-50%, -50%) scale(0)';
        winnerDiv.style.background = 'rgba(0,0,0,0.9)';
        winnerDiv.style.color = winner.color || 'white';
        winnerDiv.style.padding = `${30 * scale}px ${60 * scale}px`;
        winnerDiv.style.borderRadius = `${20 * scale}px`;
        winnerDiv.style.fontSize = `${60 * scale}px`;
        winnerDiv.style.fontWeight = 'bold';
        winnerDiv.style.border = `${6 * scale}px solid ${winner.color || 'white'}`;
        winnerDiv.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        winnerDiv.style.zIndex = '100';
        winnerDiv.style.textAlign = 'center';
        winnerDiv.style.textShadow = `0 0 ${15 * scale}px ${winner.color || 'white'}`;
        winnerDiv.style.boxShadow = `0 0 ${30 * scale}px ${winner.color || 'white'}`;
        winnerDiv.innerText = winner.label;
        rouletteCanvas.parentElement.appendChild(winnerDiv);
        
        setTimeout(() => {
            winnerDiv.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 50);

        setTimeout(() => {
            winnerDiv.style.transform = 'translate(-50%, -50%) scale(0)';
            setTimeout(() => winnerDiv.remove(), 500);
        }, 6000);

        window.dispatchEvent(new CustomEvent('rouletteWinner', { detail: { winner, winnerIndex } }));
    }, 5000);
}
