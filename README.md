# LT Verify

**TurboRepo + Yarn-workspaces monorepo** for bill-verification.

```
lt-verify/
├── apps/
│   └── web/            # Next.js (App Router) reviewer console  →  @lt/web
├── packages/
│   ├── ui/             # design tokens + reusable atoms + icons →  @lt/ui
│   ├── shared/         # types + axios apiClient/safeApiCall/services → @lt/shared
│   └── config/         # shared tsconfig bases                 →  @lt/config
├── server/             # Express + TypeScript API (unchanged)
├── turbo.json
└── package.json        # yarn workspaces + turbo
```

- **`apps/web`** — Next.js App Router reviewer console. Reads the verified feed
  from `GET /api/claims`; a table-first dashboard (KPI row, insights charts,
  filter/sort, slide-over detail drawer, reviewer approve/hold/reject actions).
  `next.config.js` **rewrites `/api/*` to the Express server** (`API_PROXY_TARGET`),
  so the backend integration is unchanged. Falls back to a sample feed when the
  API is unreachable so the UI always renders. Accented on L&T blue `#23459C`.
- **`/server`** — Express + TypeScript. `POST /api/verify` accepts a base64 bill
  (PDF or image), calls the Google Gemini API (`gemini-2.5-flash`) with a vision
  request, parses the JSON reply into an `Extraction`, runs the deterministic
  engine (`buildRecord`), persists the `ClaimRecord`, and returns it. Storage is
  **PostgreSQL** (`pg`), connection from `DATABASE_URL`; tables are created and
  seeded on startup. The Gemini API key is read from
  `process.env.GEMINI_API_KEY` on the server only and is **never sent to the
  client** (get a free key at https://aistudio.google.com/apikey).
- **`/client`** — Vite + React + TypeScript **reviewer console**. Reads the
  verified feed from `GET /api/claims` (polled every 15s) and renders each
  `ClaimRecord` as a scannable list + decision-first detail. Bills are submitted
  upstream from the employee application (which POSTs to `/api/verify`); this
  console has **no upload** and **no Sanctions tab**. Code is organised to the
  team monorepo convention within the Vite app: `src/shared` (types + `apiClient`
  / `safeApiCall` / per-domain services), `src/ui` (reusable atoms + design
  tokens), `src/components` (app-specific composition). Design tokens are derived
  from a dashboard-pattern study, accented on L&T blue `#23459C`.

## The asset files (do not rewrite)

The two deterministic pieces are dropped in verbatim and own the types:

| Piece | File |
|---|---|
| Extraction prompt (`EXTRACTION_PROMPT`) | `server/src/extraction-prompt.ts` |
| Deterministic engine (`buildRecord`, types) | `server/src/engine.ts` |

`engine.ts` exports `Extraction`, `ExtractedCharge`, `Sanction`, and
`ClaimRecord`; everything else imports those.

The reviewer app renders against the `ClaimRecord` shape (mirrored in
`packages/shared/src/types/claim.ts`); render seams live in
`apps/web/components/` and the reusable atoms + tokens in `packages/ui/src/`.

## Setup

```bash
corepack enable                  # yarn 1.x via packageManager field
yarn install                     # installs all workspaces
cp .env.example .env
# edit .env: add GEMINI_API_KEY and DATABASE_URL
createdb ltverify                # or point DATABASE_URL at any Postgres
```

Tables are created and (on first run) seeded automatically on server startup.

## Run (dev)

```bash
npm run dev          # server on :3001, client on :5173 (proxies /api → :3001)
```

Or individually: `npm run dev:server`, `npm run dev:client`.

## Other scripts

```bash
npm run typecheck    # typecheck both workspaces
npm run build        # client production build (+ server typecheck)
```

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/api/verify` | `{ base64, mediaType, isPdf, fileName? }` | `ClaimRecord` |
| `GET` | `/api/sanctions` | — | `Sanction[]` (camelCase) |
| `POST` | `/api/sanctions` | `{ declaredNumber, name, ... }` | `Sanction` (upsert) |
| `GET` | `/api/claims` | — | recent claim summaries (feed) |
| `GET` | `/api/health` | — | `{ ok: true }` |

For non-PDF uploads, `mediaType` must be `image/{png,jpeg,gif,webp}`; set
`isPdf: true` for PDFs.

## Notes

- The server executes TypeScript directly (via `tsx` in dev, Node's type
  stripping for `npm --workspace server start`) — there is no separate JS build
  step. `npm run build` for the server is a typecheck.
- All DB access is in `server/src/db.ts`. NUMERIC columns are coerced to JS
  numbers at the edges (pg returns them as strings).
- A bill is linked to a sanction by matching the last 6 digits of
  `service_number_on_bill` against `declared_number`. No match → the engine runs
  with `sanction = null` and pushes to manual.
