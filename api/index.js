// Vercel serverless function: every /api/* request is rewritten here (see vercel.json).
import { handleApi } from '../server/app.js';

export default async function handler(req, res) {
  // public/brand is deployed with the site, so brand images are served locally.
  return handleApi(req, res, { brandLocal: true });
}
