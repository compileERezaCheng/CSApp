const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { join } = require('node:path');

test('plugin overlay loads before configuration request finishes', () => {
  const html = readFileSync(join(__dirname, '..', 'public', 'plugin-host.html'), 'utf8');
  assert.match(html, /src="\/socket\.io-client\.min\.js\?v=1"/);
  assert.ok(readFileSync(join(__dirname, '..', 'public', 'socket.io-client.min.js')).length > 1000);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const frame = { src: '', contentWindow: { postMessage() {} } };
  let finishFetch;
  const pending = new Promise(resolve => { finishFetch = resolve; });
  runInNewContext(script, {
    location: { pathname: '/overlay/plugin/time-badge' },
    document: { getElementById: () => frame },
    fetch: () => pending,
    encodeURIComponent,
    io: () => ({ on() {} })
  });
  assert.equal(frame.src, '/plugin-file/time-badge/overlay.html');
  finishFetch({ ok: true, json: async () => ({ manifest: { events: [] }, config: {} }) });
});
