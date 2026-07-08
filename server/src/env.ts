// Load environment variables before any other module reads process.env.
// Imported first in index.ts so this runs during the import phase, ahead of
// db.ts (which reads DATABASE_URL at module load). Reads the server-local .env
// first, then falls back to the monorepo-root .env.
import { config } from 'dotenv';

config({ path: ['.env', '../.env'] });
