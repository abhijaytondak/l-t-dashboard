import { Router } from 'express';
import { extractBill, isSupportedImageType } from '../llm/extract.ts';
import { buildRecord, round2 } from '../engine.ts';
import { getSanctionByLast6, insertClaim, nextClaimId } from '../db.ts';

export const verifyRouter = Router();

interface VerifyBody {
  base64?: string;
  mediaType?: string;
  isPdf?: boolean;
  fileName?: string;
}

// POST /api/verify
// Body: { base64, mediaType, isPdf, fileName }
// → Gemini extraction (flat contract) → deterministic engine → persisted ClaimRecord.
verifyRouter.post('/verify', async (req, res) => {
  const { base64, mediaType, isPdf } = (req.body ?? {}) as VerifyBody;

  if (typeof base64 !== 'string' || base64.length === 0) {
    return res.status(400).json({ error: 'base64 is required.' });
  }
  if (typeof mediaType !== 'string' || mediaType.length === 0) {
    return res.status(400).json({ error: 'mediaType is required.' });
  }
  if (!isPdf && !isSupportedImageType(mediaType)) {
    return res.status(400).json({
      error: `Image type ${mediaType} is not supported by the selected LLM provider. Use a PDF or a common image type (PNG/JPEG/WebP).`,
    });
  }

  try {
    const ext = await extractBill(base64, mediaType, Boolean(isPdf));
    const sanction = await getSanctionByLast6(ext.service_number);
    const id = await nextClaimId();
    const record = buildRecord(ext, sanction, id);

    // Deterministic reconciliation guard (requirements PART 5/7): the charge
    // lines must sum to the printed gross. If not — a double-counted or missed
    // line — hold for manual rather than pay out a wrong number.
    const gross = Number(ext.gross_bill_amount) || 0;
    const chargeSum = round2((ext.charges || []).reduce((a, c) => a + (Number(c.amount) || 0), 0));
    const reconApplicable = !ext.is_payment_receipt && gross > 0 && (ext.charges || []).length > 0;
    if (reconApplicable && Math.abs(chargeSum - gross) > 2) {
      record.summary.verdict = 'PUSH_TO_MANUAL';
      record.routing.verdict = 'PUSH_TO_MANUAL';
      record.summary.computedPayable = null;
      record.computation.computedPayable = null;
      record.routing.manualReason.push(
        `Charge lines (₹${chargeSum.toFixed(2)}) do not reconcile to the printed bill total (₹${gross.toFixed(2)}) — held for manual review`,
      );
    }

    await insertClaim(record);
    return res.json(record);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed.';
    console.error('[verify] error:', message);
    return res.status(502).json({ error: message });
  }
});
