import { Router } from 'express';
import { listClaims } from '../db.ts';

export const claimsRouter = Router();

// GET /api/claims → recent claims (summary columns) for the feed / history.
claimsRouter.get('/claims', async (_req, res) => {
  try {
    res.json(await listClaims());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not load claims.';
    res.status(500).json({ error: message });
  }
});
