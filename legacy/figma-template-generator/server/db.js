// Tiny JSON-file store with atomic writes. Good for a single-instance internal tool;
// swap for a real database when this needs to scale or run on several hosts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
export const ASSET_DIR = path.join(DATA_DIR, 'assets');
export const EXPORT_DIR = path.join(DATA_DIR, 'exports');
export const THUMB_DIR = path.join(DATA_DIR, 'thumbnails');
const DB_FILE = path.join(DATA_DIR, 'db.json');

for (const d of [DATA_DIR, ASSET_DIR, EXPORT_DIR, THUMB_DIR]) fs.mkdirSync(d, { recursive: true });

const EMPTY = { caseStudies: [], assets: [], templates: {}, sessions: {}, config: {} };

function load() {
  try {
    return { ...EMPTY, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    return structuredClone(EMPTY);
  }
}

export const db = load();

let timer = null;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(flush, 50);
}
export function flush() {
  clearTimeout(timer);
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
process.on('exit', flush);

export const newId = (bytes = 8) => crypto.randomBytes(bytes).toString('hex');

if (!db.config.pluginToken) {
  db.config.pluginToken = newId(18);
  flush();
}
