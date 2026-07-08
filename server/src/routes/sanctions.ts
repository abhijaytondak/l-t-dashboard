import { Router } from 'express';
import { getSanctions, upsertSanction, type SanctionInput } from '../db.ts';

export const sanctionsRouter = Router();

// GET /api/sanctions → all sanctions in the camelCase shape the engine/UI expect.
sanctionsRouter.get('/sanctions', async (_req, res) => {
  try {
    res.json(await getSanctions());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not load sanctions.';
    res.status(500).json({ error: message });
  }
});

// POST /api/sanctions → upsert one sanction by declaredNumber.
sanctionsRouter.post('/sanctions', async (req, res) => {
  const body = (req.body ?? {}) as Partial<SanctionInput>;

  if (typeof body.declaredNumber !== 'string' || body.declaredNumber.trim() === '') {
    return res.status(400).json({ error: 'declaredNumber is required.' });
  }
  if (typeof body.name !== 'string' || body.name.trim() === '') {
    return res.status(400).json({ error: 'name is required.' });
  }

  const input: SanctionInput = {
    declaredNumber: body.declaredNumber.trim(),
    name: body.name.trim(),
    ps: body.ps?.trim() ?? '',
    unit: body.unit?.trim() ?? '',
    grade: body.grade?.trim() ?? '',
    eligibleLimit:
      body.eligibleLimit === null || body.eligibleLimit === undefined
        ? null
        : Number(body.eligibleLimit),
    irSanction: Boolean(body.irSanction),
    irSanctionAmount: Number(body.irSanctionAmount ?? 0),
    nilSalary: Boolean(body.nilSalary),
    dosDate: body.dosDate?.trim() ?? '',
  };

  try {
    const saved = await upsertSanction(input);
    return res.status(201).json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not save sanction.';
    return res.status(500).json({ error: message });
  }
});
