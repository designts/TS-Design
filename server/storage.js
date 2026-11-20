// Storage backends.
//  - Data (projects, case studies, asset index): Upstash Redis when its REST credentials are
//    present (Vercel Marketplace sets KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_*),
//    otherwise a JSON file (local dev, Render disk).
//  - Uploaded images: Vercel Blob when BLOB_READ_WRITE_TOKEN is present, otherwise files.
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve('data');
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const DB_KEY = process.env.DB_KEY || 'case-study-builder:db';

export const onVercel = !!process.env.VERCEL;
export const storageInfo = () => ({
  data: REDIS_URL && REDIS_TOKEN ? 'redis' : 'file',
  images: process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'file',
});

// ------------------------------------------------------------------ data
async function redis(command) {
  const res = await fetch(REDIS_URL, { method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || out.error) throw new Error(`Redis error: ${out.error || res.status}`);
  return out.result;
}

export function createDataStore() {
  if (REDIS_URL && REDIS_TOKEN) {
    return {
      kind: 'redis',
      async load() { const raw = await redis(['GET', DB_KEY]); return raw ? JSON.parse(raw) : null; },
      async save(db) { await redis(['SET', DB_KEY, JSON.stringify(db)]); },
    };
  }
  if (onVercel) {
    throw new Error('No database configured. Add Upstash Redis to this Vercel project (Storage tab) so data can be saved.');
  }
  const file = path.join(DATA_DIR, 'db.json');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return {
    kind: 'file',
    async load() { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } },
    async save(db) { const tmp = `${file}.tmp`; fs.writeFileSync(tmp, JSON.stringify(db, null, 1)); fs.renameSync(tmp, file); },
  };
}

// ------------------------------------------------------------------ images
export function createImageStore() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      kind: 'blob',
      async put(id, ext, mime, buf) {
        const { put } = await import('@vercel/blob');
        const blob = await put(`assets/${id}.${ext}`, buf, { access: 'public', contentType: mime, addRandomSuffix: false });
        return blob.url;
      },
      async get() { return null; }, // served straight from the Blob URL
    };
  }
  const dir = path.join(DATA_DIR, 'assets');
  return {
    kind: 'file',
    async put(id, ext, mime, buf) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `${id}.${ext}`), buf); return null; },
    async get(id, ext) { try { return fs.readFileSync(path.join(dir, `${id}.${ext}`)); } catch { return null; } },
  };
}
