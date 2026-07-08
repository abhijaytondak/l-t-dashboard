// db.ts — all PostgreSQL access lives here.
//
// Tables: `sanctions` (employee reference data, the Sanctions tab) and `claims`
// (every verified claim the engine produces, the feed + history). The pool reads
// its connection string from process.env.DATABASE_URL.

import pg from 'pg';
import { last6, type ClaimRecord, type Sanction } from './engine.ts';

const connectionString = process.env.DATABASE_URL;

// Enable SSL for hosted Postgres (Neon, Supabase, RDS, …) without verifying the
// cert chain — opt in via PGSSL=true or sslmode=require in the URL.
const useSsl =
  process.env.PGSSL === 'true' || /sslmode=require/.test(connectionString ?? '');

export const pool = new pg.Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

// pg returns NUMERIC as a string to avoid precision loss; we coerce at the edges.
const toNum = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

/** Camel-case input accepted by POST /api/sanctions. */
export interface SanctionInput {
  declaredNumber: string;
  ps?: string;
  name: string;
  unit?: string;
  grade?: string;
  eligibleLimit?: number | null;
  irSanction?: boolean;
  irSanctionAmount?: number;
  nilSalary?: boolean;
  dosDate?: string;
}

interface SanctionRow {
  declared_number: string;
  ps: string | null;
  name: string;
  unit: string | null;
  grade: string | null;
  eligible_limit: string | null;
  ir_sanction: boolean;
  ir_sanction_amount: string | null;
  nil_salary: boolean;
  dos_date: string | null;
}

/** Map a DB row to the camelCase `Sanction` shape the engine and UI expect. */
function rowToSanction(r: SanctionRow): Sanction {
  return {
    ps: r.ps ?? '',
    name: r.name,
    unit: r.unit ?? '',
    grade: r.grade ?? '',
    declaredNumber: r.declared_number,
    eligibleLimit: toNum(r.eligible_limit),
    irSanction: r.ir_sanction,
    irSanctionAmount: toNum(r.ir_sanction_amount) ?? 0,
    nilSalary: r.nil_salary,
    dosDate: r.dos_date ?? '',
  };
}

// --------------------------- Migration & seed ------------------------------

const MIGRATION_SQL = `
  -- Employee sanction / reference data (the Sanctions tab)
  CREATE TABLE IF NOT EXISTS sanctions (
    declared_number   TEXT PRIMARY KEY,        -- matched against the bill (last-6)
    ps                TEXT,
    name              TEXT NOT NULL,
    unit              TEXT,
    grade             TEXT,
    eligible_limit    NUMERIC,                 -- null = limit not shared
    ir_sanction       BOOLEAN DEFAULT false,
    ir_sanction_amount NUMERIC DEFAULT 0,
    nil_salary        BOOLEAN DEFAULT false,
    dos_date          TEXT DEFAULT '',         -- '' = none
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now()
  );

  -- Every verified claim the engine produces (the feed + history)
  CREATE TABLE IF NOT EXISTS claims (
    id                TEXT PRIMARY KEY,         -- e.g. CLM-UP-0001
    created_at        TIMESTAMPTZ DEFAULT now(),
    employee_name     TEXT,
    ps_number         TEXT,
    claim_type        TEXT,
    vendor            TEXT,
    bill_date         TEXT,
    bill_number       TEXT,
    gross_amount      NUMERIC,
    disallowed_amount NUMERIC,
    payable_amount    NUMERIC,                  -- null when pushed to manual
    verdict           TEXT,                     -- CLEAN / PROCESSED_WITH_DEDUCTION / PUSH_TO_MANUAL
    confidence        TEXT,
    record            JSONB NOT NULL            -- the full ClaimRecord, verbatim
  );

  CREATE INDEX IF NOT EXISTS idx_claims_created ON claims (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_claims_verdict ON claims (verdict);
`;

const SEED_SANCTIONS: SanctionInput[] = [
  { name: 'Sourjyo Roy', ps: 'LT-204471', declaredNumber: '7838514344', eligibleLimit: 1000 },
  { name: 'Aryan Duhan', ps: 'LT-118930', declaredNumber: '20035210793', eligibleLimit: 1200 },
  { name: 'Ashish Pandey', ps: 'LT-256104', declaredNumber: '9599949488', eligibleLimit: 800 },
];

/** Create tables if absent, then seed the sanctions table on first run. */
export async function migrate(): Promise<void> {
  await pool.query(MIGRATION_SQL);
  const { rows } = await pool.query<{ count: string }>('SELECT COUNT(*)::int AS count FROM sanctions');
  if (Number(rows[0]?.count ?? 0) === 0) {
    for (const s of SEED_SANCTIONS) await upsertSanction(s);
    console.log(`[db] seeded ${SEED_SANCTIONS.length} sanction rows`);
  }
}

// ------------------------------ Sanctions ----------------------------------

export async function getSanctions(): Promise<Sanction[]> {
  const { rows } = await pool.query<SanctionRow>(
    'SELECT * FROM sanctions ORDER BY name ASC',
  );
  return rows.map(rowToSanction);
}

export async function upsertSanction(input: SanctionInput): Promise<Sanction> {
  const { rows } = await pool.query<SanctionRow>(
    `INSERT INTO sanctions
       (declared_number, ps, name, unit, grade, eligible_limit,
        ir_sanction, ir_sanction_amount, nil_salary, dos_date, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     ON CONFLICT (declared_number) DO UPDATE SET
       ps = EXCLUDED.ps,
       name = EXCLUDED.name,
       unit = EXCLUDED.unit,
       grade = EXCLUDED.grade,
       eligible_limit = EXCLUDED.eligible_limit,
       ir_sanction = EXCLUDED.ir_sanction,
       ir_sanction_amount = EXCLUDED.ir_sanction_amount,
       nil_salary = EXCLUDED.nil_salary,
       dos_date = EXCLUDED.dos_date,
       updated_at = now()
     RETURNING *`,
    [
      input.declaredNumber,
      input.ps ?? '',
      input.name,
      input.unit ?? '',
      input.grade ?? '',
      input.eligibleLimit ?? null,
      input.irSanction ?? false,
      input.irSanctionAmount ?? 0,
      input.nilSalary ?? false,
      input.dosDate ?? '',
    ],
  );
  return rowToSanction(rows[0]!);
}

/** Find the sanction whose declared number matches the bill number on last-6. */
export async function getSanctionByLast6(serviceNumber: string): Promise<Sanction | null> {
  const target = last6(serviceNumber);
  if (!target) return null;
  const all = await getSanctions();
  return all.find((s) => last6(s.declaredNumber) === target) ?? null;
}

// -------------------------------- Claims -----------------------------------

/** Next sequential claim counter, e.g. 1, 2, 3 → CLM-UP-0001, …, formatted by the engine. */
export async function nextClaimId(): Promise<number> {
  const { rows } = await pool.query<{ next: number }>(
    `SELECT COALESCE(MAX((substring(id from '[0-9]+$'))::int), 0) + 1 AS next FROM claims`,
  );
  return rows[0]?.next ?? 1;
}

/** Persist a finished ClaimRecord (summary columns + the full record as JSONB). */
export async function insertClaim(record: ClaimRecord): Promise<void> {
  const s = record.summary;
  await pool.query(
    `INSERT INTO claims
       (id, employee_name, ps_number, claim_type, vendor, bill_date, bill_number,
        gross_amount, disallowed_amount, payable_amount, verdict, confidence, record)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (id) DO NOTHING`,
    [
      record.id,
      record.identity?.employeeNameOnBill ?? null,
      record.identity?.psNumber ?? null,
      s?.claimType ?? null,
      s?.vendor ?? null,
      s?.billDate ?? null,
      record.billIdentity?.billNumber ?? null,
      s?.grossBillAmount ?? null,
      s?.totalDisallowed ?? null,
      s?.computedPayable ?? null,
      record.routing?.verdict ?? s?.verdict ?? null,
      s?.confidence ?? null,
      JSON.stringify(record),
    ],
  );
}

/**
 * All claims newest-first, returned as the full ClaimRecord (read from the
 * `record` JSONB column) so the dashboard can show complete detail. pg parses
 * JSONB into a JS object for us.
 */
export async function listClaims(): Promise<ClaimRecord[]> {
  const { rows } = await pool.query<{ record: ClaimRecord }>(
    'SELECT record FROM claims ORDER BY created_at DESC',
  );
  return rows.map((r) => r.record);
}
