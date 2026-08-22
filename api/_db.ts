import { createClient } from '@supabase/supabase-js';
import sqlite3 from 'sqlite3';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseEnabled = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseEnabled
  ? createClient(supabaseUrl!, supabaseKey!, { db: { schema: 'info' } })
  : null;

// SQLite Fallback
const dbPath = path.resolve(process.cwd(), 'backend/info_benhvienanphu.sqlite');
let sqliteDb: sqlite3.Database | null = null;

function getSqliteDb() {
  if (!sqliteDb) {
    sqliteDb = new sqlite3.Database(dbPath);
  }
  return sqliteDb;
}

export function querySqlite<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    getSqliteDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export function runSqlite(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    getSqliteDb().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function getSqlite<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    getSqliteDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}
