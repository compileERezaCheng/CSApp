const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(process.cwd(), 'plugins');
const validId = id => /^[a-z][a-z0-9-]{0,39}$/.test(id);
function manifest(dir) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8'));
  if (!validId(data.id) || !data.name || typeof data.name !== 'string' || data.name.length > 80 ||
      !/^\d+\.\d+\.\d+$/.test(data.version) || data.overlay !== 'overlay.html' || data.config !== 'config.html' ||
      !Array.isArray(data.events) || data.events.some(e => !['timeUpdate', 'timeAdded', 'timerEnded', 'logEvent'].includes(e)) ||
      Object.keys(data).some(k => !['id', 'name', 'version', 'overlay', 'config', 'events'].includes(k))) {
    throw new Error('Manifesto inválido');
  }
  for (const file of ['overlay.html', 'config.html']) if (!fs.statSync(path.join(dir, file)).isFile()) throw new Error('Ficheiro em falta');
  return data;
}
function list() {
  fs.mkdirSync(root, { recursive: true });
  return fs.readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory() && validId(e.name) && !e.name.startsWith('.')).flatMap(e => {
    try { const data = manifest(path.join(root, e.name)); return data.id === e.name ? [data] : []; } catch { return []; }
  });
}
function get(id) { return list().find(p => p.id === id); }

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function unzipPlugin(buffer) {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50 && i + 22 + buffer.readUInt16LE(i + 20) === buffer.length) { end = i; break; }
  }
  if (end < 0 || buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6)) throw new Error('ZIP inválido');
  const count = buffer.readUInt16LE(end + 10);
  const limit = buffer.readUInt32LE(end + 16) + buffer.readUInt32LE(end + 12);
  if (count < 3 || count > 4 || limit > end) throw new Error('ZIP inválido');
  let cursor = buffer.readUInt32LE(end + 16);
  let total = 0;
  let id = null;
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > limit || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('ZIP inválido');
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const checksum = buffer.readUInt32LE(cursor + 16);
    const compressed = buffer.readUInt32LE(cursor + 20);
    const expanded = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const local = buffer.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > limit || flags & 1 || ![0, 8].includes(method) || compressed > 5 * 1024 * 1024 || expanded > 5 * 1024 * 1024) throw new Error('ZIP inválido');
    const rawName = buffer.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = rawName.toString('utf8');
    if (!Buffer.from(name).equals(rawName)) throw new Error('Nome de ficheiro inválido');
    cursor = next;
    if (/^[a-z][a-z0-9-]{0,39}\/$/.test(name)) {
      const directoryId = name.slice(0, -1);
      if (id && id !== directoryId) throw new Error('ZIP contém mais de um plugin');
      id = directoryId;
      continue;
    }
    const match = /^([a-z][a-z0-9-]{0,39})\/(plugin\.json|overlay\.html|config\.html)$/.exec(name);
    if (!match) throw new Error(`Ficheiro inesperado no ZIP: ${name}`);
    if (id && id !== match[1] || files.has(match[2])) throw new Error('ZIP contém plugins ou ficheiros duplicados');
    id = match[1];
    if (local + 30 > limit || buffer.readUInt32LE(local) !== 0x04034b50 ||
        buffer.readUInt16LE(local + 6) !== flags || buffer.readUInt16LE(local + 8) !== method) throw new Error('ZIP inválido');
    const localNameLength = buffer.readUInt16LE(local + 26);
    const start = local + 30 + localNameLength + buffer.readUInt16LE(local + 28);
    if (!buffer.subarray(local + 30, local + 30 + localNameLength).equals(rawName) || start + compressed > limit) throw new Error('ZIP inválido');
    const payload = buffer.subarray(start, start + compressed);
    const bytes = method === 0 ? payload : zlib.inflateRawSync(payload, { maxOutputLength: 5 * 1024 * 1024 + 1 });
    total += bytes.length;
    if (bytes.length !== expanded || total > 5 * 1024 * 1024 || crc32(bytes) !== checksum) throw new Error('ZIP corrompido ou demasiado grande');
    files.set(match[2], bytes);
  }
  if (cursor !== limit || files.size !== 3) throw new Error('ZIP incompleto');
  return { id, files };
}
function install(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer.subarray(0, 2).toString() !== 'PK' || buffer.length > 5 * 1024 * 1024) throw new Error('ZIP inválido ou maior que 5 MB');
  const { id, files } = unzipPlugin(buffer);
  fs.mkdirSync(root, { recursive: true });
  const stage = fs.mkdtempSync(path.join(root, '.install-'));
  try {
    fs.mkdirSync(path.join(stage, id));
    for (const [name, bytes] of files) fs.writeFileSync(path.join(stage, id, name), bytes);
    const data = manifest(path.join(stage, id));
    if (data.id !== id || fs.existsSync(path.join(root, id))) throw new Error('ID inválido ou plugin já instalado');
    fs.renameSync(path.join(stage, id), path.join(root, id));
    return data;
  } finally { fs.rmSync(stage, { recursive: true, force: true }); }
}
module.exports = { root, validId, list, get, install };
