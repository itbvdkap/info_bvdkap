import { createClient } from '@supabase/supabase-js';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseEnabled = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseEnabled
  ? createClient(supabaseUrl!, supabaseKey!, { db: { schema: 'info' } })
  : null;

// SQLite Fallback
const dbPath = path.resolve(process.cwd(), 'backend/info_benhvienanphu.sqlite');
let sqliteDb: any = null;

function getSqliteDb() {
  if (!sqliteDb) {
    if (process.env.VERCEL) {
      throw new Error('SQLite fallback is disabled on Vercel. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }
    // Load sqlite3 only for local fallback. Native sqlite binaries are not portable in Vercel serverless bundles.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sqlite3 = require('sqlite3');
    sqliteDb = new sqlite3.Database(dbPath);
  }
  return sqliteDb;
}

export function querySqlite<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    getSqliteDb().all(sql, params, (err: Error | null, rows: unknown[]) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export function runSqlite(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    getSqliteDb().run(sql, params, function (this: { lastID: number; changes: number }, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function getSqlite<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    getSqliteDb().get(sql, params, (err: Error | null, row: unknown) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}
