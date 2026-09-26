const list = document.getElementById('pluginList');
const status = document.getElementById('status');
async function api(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Operação falhou');
    return data;
}
function post(url, value) { return api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }); }
async function refresh() {
    list.replaceChildren();
    for (const plugin of await api('/api/plugins')) {
        const card = document.createElement('section'); card.className = 'plugin-card';
        const title = document.createElement('h2'); title.textContent = `${plugin.name} · ${plugin.version}`;
        const toggle = document.createElement('button'); toggle.className = 'btn primary'; toggle.textContent = plugin.enabled ? 'Desativar' : 'Ativar';
        toggle.onclick = async () => { try { await post(`/api/plugins/${plugin.id}`, { enabled: !plugin.enabled }); refresh(); } catch (error) { status.textContent = error.message; } };
        card.append(title, toggle);
        if (plugin.enabled) {
            const url = document.createElement('input'); url.readOnly = true; url.className = 'link-input'; url.value = `${location.origin}/overlay/plugin/${plugin.id}`; url.setAttribute('aria-label', `URL OBS de ${plugin.name}`);
            const frame = document.createElement('iframe'); frame.setAttribute('sandbox', 'allow-scripts'); frame.title = `Configuração de ${plugin.name}`;
            frame.onload = async () => { const { config } = await api(`/api/plugins/${plugin.id}/public`); frame.contentWindow.postMessage({ type: 'csapp:config', config }, '*'); };
            frame.src = `/plugin-file/${plugin.id}/config.html`;
            const receive = async event => {
                if (event.source !== frame.contentWindow || event.data?.type !== 'csapp:saveConfig') return;
                try { await post(`/api/plugins/${plugin.id}/config`, { config: event.data.config }); status.textContent = `${plugin.name}: configuração guardada.`; }
                catch (error) { status.textContent = error.message; }
            };
            window.addEventListener('message', receive);
            card.append(url, frame);
        }
        list.append(card);
    }
}
document.getElementById('pluginZip').onchange = event => {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { status.textContent = 'ZIP excede 5 MB.'; return; }
    const reader = new FileReader();
    reader.onload = async () => { try { const p = await post('/api/plugins/install', { zipBase64: String(reader.result).replace(/^data:[^,]*,/, 'data:application/zip;base64,') }); status.textContent = `${p.name} instalado. Ativa-o abaixo.`; refresh(); } catch (error) { status.textContent = error.message; } };
    reader.readAsDataURL(file);
};
refresh().catch(error => { status.textContent = error.message; });
