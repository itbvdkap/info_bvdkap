import { VercelRequest, VercelResponse } from '@vercel/node';
import { isSupabaseEnabled, supabase, querySqlite } from './_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    if (isSupabaseEnabled && supabase) {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, code, icon, description')
        .order('id', { ascending: true });

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    } else {
      const cats = await querySqlite('SELECT id, name, code, icon, description FROM categories ORDER BY id ASC');
      return res.status(200).json({ success: true, data: cats });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Lỗi tải danh mục phân loại.' });
  }
}
