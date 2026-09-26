const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createServer } = require('node:net');
const { once } = require('node:events');

test('tray controls require the local token and stop the server', async () => {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  probe.close();

  const cwd = mkdtempSync(join(tmpdir(), 'csapp-tray-'));
  const child = spawn(process.execPath, [join(__dirname, '..', 'server.js')], {
    cwd,
    env: { ...process.env, PORT: String(port), CSAPP_TRAY_TOKEN: 'test-token', CSAPP_NO_BROWSER: '1' },
    stdio: 'ignore',
    windowsHide: true
  });
  const url = `http://127.0.0.1:${port}/api/tray`;
  const headers = { 'x-csapp-tray-token': 'test-token' };
  try {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try { await fetch(url); ready = true; break; } catch { await new Promise(r => setTimeout(r, 100)); }
    }
    assert.ok(ready, 'server started');
    assert.equal((await fetch(url)).status, 403);
    assert.equal((await (await fetch(url, { headers })).json()).isRunning, false);
    assert.equal((await (await fetch(`${url}/toggle`, { method: 'POST', headers })).json()).isRunning, true);
    assert.equal((await (await fetch(`${url}/toggle`, { method: 'POST', headers })).json()).isRunning, false);
    assert.equal((await fetch(`${url}/exit`, { method: 'POST', headers })).status, 200);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('server did not exit')), 5000).unref());
    const [code] = await Promise.race([once(child, 'exit'), timeout]);
    assert.equal(code, 0);
  } finally {
    if (child.exitCode === null) child.kill();
    rmSync(cwd, { recursive: true, force: true });
  }
});
