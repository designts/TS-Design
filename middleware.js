// Vercel Routing Middleware: optional site-wide password for every page, file and API call.
// Set APP_PASSWORD in the Vercel project's environment variables to turn it on.
import { next } from '@vercel/functions';

export const config = { matcher: '/:path*' };

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default function middleware(request) {
  const want = process.env.APP_PASSWORD || '';
  if (!want) return next();
  const m = /^Basic (.+)$/.exec(request.headers.get('authorization') || '');
  if (m) {
    let decoded = '';
    try { decoded = new TextDecoder().decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0))); } catch { /* malformed */ }
    const given = decoded.split(':').slice(1).join(':');
    if (safeEqual(given, want)) return next();
  }
  return new Response('Password required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Case Study Builder", charset="UTF-8"' } });
}
