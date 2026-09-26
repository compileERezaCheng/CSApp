const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '..', 'public', 'overlay.js'), 'utf8');
const options = source.slice(source.indexOf('const urlOptions ='), source.indexOf('const timerText ='));
function resolved(mode, query, saved) {
  const context = { URLSearchParams, saved, query, mode };
  return JSON.parse(JSON.stringify(vm.runInNewContext(`const currentMode = mode; const urlParams = new URLSearchParams(query); ${options} overlayConfig(saved)`, context)));
}

test('OBS URL overrides only supported valid values and leaves saved design intact', () => {
  const saved = { fontSize: 70, color: '#abcdef', bg: '#123456', glow: '#998877' };
  assert.deepEqual(resolved('timer', '?fontSize=40&bg=transparent&color=white&glow=false', saved),
    { fontSize: 40, color: 'white', bg: '#123456', glow: 'transparent', enableBg: false });
  assert.deepEqual(saved, { fontSize: 70, color: '#abcdef', bg: '#123456', glow: '#998877' });
  assert.deepEqual(resolved('timer', '?fontSize=999&color=evil&other=1', saved), saved);
  assert.deepEqual(resolved('roulette', '?fontSize=36&arrowColor=%23ffcc00&bg=transparent', {}), { fontSize: 36, arrowColor: '#ffcc00' });
});
