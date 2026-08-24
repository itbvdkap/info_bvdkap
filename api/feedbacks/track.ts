import { VercelRequest, VercelResponse } from '@vercel/node';
import { isSupabaseEnabled, supabase, getSqlite } from '../_db';
import { applySecurityHeaders, checkRateLimit } from '../_security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applySecurityHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Rate Limiting: Max 20 track requests per minute per IP
  if (!checkRateLimit(req, res, 'tra cứu báo cáo', 20, 60000)) {
    return;
  }

  try {
    const codeParam = (req.query.code || req.query.c || '').toString().trim().toUpperCase();
    if (!codeParam) {
      return res.status(400).json({ success: false, message: 'Yêu cầu nhập Mã Tra Cứu!' });
    }

    let item: any = null;

    if (isSupabaseEnabled && supabase) {
      const { data, error } = await supabase.from('feedbacks').select(`
        id, tracking_code, is_anonymous, priority, title, content, attachment_url,
        status, response_content, responded_at, created_at,
        department_name:departments(name),
        category_name:categories(name)
      `).eq('tracking_code', codeParam).single();

      if (!error && data) {
        const d: any = data;
        item = {
          ...d,
          department_name: d.department_name ? (typeof d.department_name === 'object' ? d.department_name.name : d.department_name) : 'N/A',
          category_name: d.category_name ? (typeof d.category_name === 'object' ? d.category_name.name : d.category_name) : 'N/A'
        };
      }
    } else {
      item = await getSqlite(
        `SELECT f.id, f.tracking_code, f.is_anonymous, f.priority, f.title, f.content, f.attachment_url,
                f.status, f.response_content, f.responded_at, f.created_at,
                d.name as department_name, c.name as category_name
         FROM feedbacks f
         LEFT JOIN departments d ON f.department_id = d.id
         LEFT JOIN categories c ON f.category_id = c.id
         WHERE UPPER(f.tracking_code) = ?`,
        [codeParam]
      );
    }

    if (!item) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo với mã tra cứu này!' });
    }

    return res.status(200).json({ success: true, data: item });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Lỗi tra cứu báo cáo.' });
  }
}
