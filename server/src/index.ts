import './env.ts'; // must be first — loads .env before db.ts reads process.env
import express from 'express';
import cors from 'cors';
import { migrate } from './db.ts';
import { verifyRouter } from './routes/verify.ts';
import { sanctionsRouter } from './routes/sanctions.ts';
import { claimsRouter } from './routes/claims.ts';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

const LLM_PROVIDER = (process.env.LLM_PROVIDER ?? 'gemini').toLowerCase();
const KEY_VAR =
  LLM_PROVIDER === 'anthropic' ? 'ANTHROPIC_API_KEY'
  : LLM_PROVIDER === 'openai' ? 'OPENAI_API_KEY'
  : 'GEMINI_API_KEY';
console.log(`[server] LLM provider: ${LLM_PROVIDER} (key: ${KEY_VAR})`);
if (!process.env[KEY_VAR]) {
  console.warn(
    `[server] ${KEY_VAR} is not set — POST /api/verify will fail until it is. ` +
      'Set it in .env, or switch LLM_PROVIDER to a provider whose key you have.',
  );
}
if (!process.env.DATABASE_URL) {
  console.warn(
    '[server] DATABASE_URL is not set — the server cannot start without Postgres. ' +
      'Copy server/.env.example to server/.env and set DATABASE_URL.',
  );
}

app.use(cors());
// Bills are base64-encoded, so allow a generous JSON body limit.
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', verifyRouter);
app.use('/api', sanctionsRouter);
app.use('/api', claimsRouter);

async function start() {
  await migrate();
  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
