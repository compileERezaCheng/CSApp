const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const local = [], central = [];
  let offset = 0;
  for (const [name, value] of Object.entries(entries)) {
    const n = Buffer.from(name), data = Buffer.from(value);
    const head = Buffer.alloc(30 + n.length);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4);
    head.writeUInt32LE(crc32(data), 14); head.writeUInt32LE(data.length, 18); head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(n.length, 26); n.copy(head, 30);
    local.push(head, data);
    const record = Buffer.alloc(46 + n.length);
    record.writeUInt32LE(0x02014b50, 0); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6);
    record.writeUInt32LE(crc32(data), 16); record.writeUInt32LE(data.length, 20); record.writeUInt32LE(data.length, 24);
    record.writeUInt16LE(n.length, 28); record.writeUInt32LE(offset, 42); n.copy(record, 46);
    central.push(record); offset += head.length + data.length;
  }
  const size = central.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length, 8); end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(size, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}

test('plugin ZIP installs the example and rejects escaping paths and extra files', () => {
  const project = join(__dirname, '..');
  const cwd = mkdtempSync(join(tmpdir(), 'csapp-plugin-'));
  const previous = process.cwd();
  try {
    process.chdir(cwd);
    const store = require('../plugin-store');
    const files = Object.fromEntries(['plugin.json', 'overlay.html', 'config.html'].map(name => [`time-badge/${name}`, readFileSync(join(project, 'plugins', 'time-badge', name))]));
    assert.equal(store.install(zip(files)).id, 'time-badge');
    assert.throws(() => store.install(zip({ ...files, '../escape.txt': 'bad' })), /Ficheiro inesperado/);
    assert.throws(() => store.install(zip({ ...files, 'time-badge/server.js': 'bad' })), /Ficheiro inesperado/);
  } finally { process.chdir(previous); rmSync(cwd, { recursive: true, force: true }); }
});
