const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync, cpSync, mkdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createServer } = require('node:net');
const { once } = require('node:events');
const { io } = require('socket.io-client');

test('timer cap applies to manual adds and reduced caps clamp existing time', { timeout: 10000 }, async () => {
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  probe.close();
  const cwd = mkdtempSync(join(tmpdir(), 'csapp-features-'));
  mkdirSync(join(cwd, 'public'));
  cpSync(join(__dirname, '..', 'public', 'plugin-host.html'), join(cwd, 'public', 'plugin-host.html'));
  cpSync(join(__dirname, '..', 'plugins', 'time-badge'), join(cwd, 'plugins', 'time-badge'), { recursive: true });
  const child = spawn(process.execPath, [join(__dirname, '..', 'server.js')], {
    cwd, env: { ...process.env, PORT: String(port), CSAPP_NO_BROWSER: '1' }, stdio: 'ignore', windowsHide: true
  });
  const socket = io(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
  try {
    await Promise.race([once(socket, 'connect'), new Promise((_, reject) => setTimeout(() => reject(new Error('connection timeout')), 5000))]);
    const update = () => once(socket, 'timeUpdate').then(([seconds]) => seconds);
    let next = update();
    socket.emit('updateSettings', { user: 'Test', settings: { maxTimerHours: 0.01 } });
    assert.equal(await next, 36);
    next = update(); socket.emit('setTimer', { seconds: 30, user: 'Test' }); assert.equal(await next, 30);
    next = update(); socket.emit('addTime', { seconds: 20, user: 'Test' }); assert.equal(await next, 36);
    next = update(); socket.emit('updateSettings', { user: 'Test', settings: { maxTimerHours: 0.005 } }); assert.equal(await next, 18);
    next = update(); socket.emit('addTime', { seconds: -18, user: 'Test' }); assert.equal(await next, 0);
    next = update(); socket.emit('addTime', { seconds: 100, user: 'Test' }); assert.equal(await next, 18);

    const origin = `http://127.0.0.1:${port}`;
    assert.equal((await (await fetch(`${origin}/api/plugins`)).json())[0].id, 'time-badge');
    assert.equal((await fetch(`${origin}/overlay/plugin/time-badge`)).status, 404);
    assert.equal((await fetch(`${origin}/api/plugins/time-badge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }) })).status, 200);
    assert.equal((await fetch(`${origin}/overlay/plugin/time-badge`)).status, 200);
    const pluginFile = await fetch(`${origin}/plugin-file/time-badge/overlay.html`);
    assert.equal(pluginFile.status, 200);
    assert.match(pluginFile.headers.get('content-security-policy'), /connect-src 'none'/);
    assert.equal((await fetch(`${origin}/api/plugins/time-badge/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: { color: '#ff0000' } }) })).status, 200);
    assert.equal((await (await fetch(`${origin}/api/plugins/time-badge/public`)).json()).config.color, '#ff0000');

    const badAudio = await fetch(`${origin}/api/sounds/sub`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audioBase64: 'data:audio/wav;base64,YWJj' }) });
    assert.equal(badAudio.status, 400);
    const wav = Buffer.alloc(46);
    wav.write('RIFF', 0); wav.writeUInt32LE(38, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(8000, 28);
    wav.writeUInt16LE(1, 32); wav.writeUInt16LE(8, 34); wav.write('data', 36); wav.writeUInt32LE(2, 40);
    const uploaded = await fetch(`${origin}/api/sounds/sub`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audioBase64: `data:audio/wav;base64,${wav.toString('base64')}` }) });
    assert.equal(uploaded.status, 200);
    assert.equal((await fetch(origin + (await uploaded.json()).url)).status, 200);

    let ended = 0;
    socket.on('timerEnded', () => ended++);
    let endEvent = once(socket, 'timerEnded');
    next = update(); socket.emit('setTimer', { seconds: 0, user: 'Test' }); assert.equal(await next, 0);
    await endEvent;
    assert.equal(ended, 1);
    socket.emit('addTime', { seconds: -1, user: 'Test' });
    assert.equal(ended, 1);
    const sound = once(socket, 'eventSound');
    next = update();
    assert.equal((await fetch(`${origin}/kofi-webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'Test' }) })).status, 200);
    assert.equal((await sound)[0].type, 'kofi');
    assert.equal(await next, 18);
    endEvent = once(socket, 'timerEnded');
    next = update(); socket.emit('setTimer', { seconds: 0, user: 'Test' }); assert.equal(await next, 0);
    await endEvent;
    assert.equal(ended, 2);
  } finally {
    socket.disconnect();
    if (child.exitCode === null) { child.kill(); await once(child, 'exit'); }
    rmSync(cwd, { recursive: true, force: true });
  }
});
