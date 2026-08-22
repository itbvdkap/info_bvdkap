import { VercelRequest, VercelResponse } from '@vercel/node';
import { isSupabaseEnabled } from './_db';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: 'OK',
    system: 'info.benhvienanphu.vn API Engine (Vercel Serverless)',
    mode: isSupabaseEnabled ? 'Supabase Postgres' : 'SQLite Fallback',
    timestamp: new Date().toISOString()
  });
}
