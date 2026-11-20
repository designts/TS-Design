// Vercel build step: the browser imports /shared/*.js, so copy shared/ into the static output.
import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve('shared');
const dest = path.resolve('public', 'shared');
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
for (const f of fs.readdirSync(src)) if (f.endsWith('.js')) fs.copyFileSync(path.join(src, f), path.join(dest, f));
console.log(`Copied ${fs.readdirSync(dest).length} shared modules to public/shared`);
