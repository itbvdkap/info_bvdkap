import { VercelRequest, VercelResponse } from '@vercel/node';
import { isSupabaseEnabled, supabase, querySqlite } from '../_db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'anphu_info_benhvien_secret_key_2026_safe_jwt';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Yêu cầu Token xác thực!' });

    const user: any = jwt.verify(token, JWT_SECRET);
    const isAdmin = user?.role === 'admin';

    const { status, department_id, category_id, priority, keyword, from_date, to_date } = req.query;

    let items: any[] = [];

    if (isSupabaseEnabled && supabase) {
      let query = supabase.from('feedbacks').select(`
        *,
        department_name:departments(name),
        category_name:categories(name),
        responder_name:users(full_name)
      `);

      if (from_date && from_date !== 'undefined') {
        query = query.gte('created_at', `${from_date}T00:00:00.000Z`);
      }
      if (to_date && to_date !== 'undefined') {
        query = query.lte('created_at', `${to_date}T23:59:59.999Z`);
      }
      if (status && status !== 'all' && status !== '' && status !== 'undefined') {
        query = query.eq('status', String(status));
      }
      if (department_id && department_id !== 'all' && department_id !== '' && department_id !== 'undefined' && !isNaN(Number(department_id)) && Number(department_id) > 0) {
        query = query.eq('department_id', Number(department_id));
      }
      if (category_id && category_id !== 'all' && category_id !== '' && category_id !== 'undefined' && !isNaN(Number(category_id)) && Number(category_id) > 0) {
        query = query.eq('category_id', Number(category_id));
      }
      if (priority && priority !== 'all' && priority !== '' && priority !== 'undefined') {
        query = query.eq('priority', String(priority));
      }
      if (keyword) {
        query = query.or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%,tracking_code.ilike.%${keyword}%`);
      }

      const { data, error } = await query.order('id', { ascending: false });
      if (error) throw error;

      items = (data || []).map((i: any) => ({
        ...i,
        department_name: i.department_name ? (typeof i.department_name === 'object' ? i.department_name.name : i.department_name) : 'N/A',
        category_name: i.category_name ? (typeof i.category_name === 'object' ? i.category_name.name : i.category_name) : 'N/A',
        responder_name: i.responder_name ? (typeof i.responder_name === 'object' ? i.responder_name.full_name : i.responder_name) : 'N/A'
      }));
    } else {
      let sql = `
        SELECT f.*,
               d.name as department_name,
               c.name as category_name,
               u.full_name as responder_name
        FROM feedbacks f
        LEFT JOIN departments d ON f.department_id = d.id
        LEFT JOIN categories c ON f.category_id = c.id
        LEFT JOIN users u ON f.responded_by = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (from_date && from_date !== 'undefined') { sql += ' AND f.created_at >= ?'; params.push(`${from_date} 00:00:00`); }
      if (to_date && to_date !== 'undefined') { sql += ' AND f.created_at <= ?'; params.push(`${to_date} 23:59:59`); }
      if (status && status !== 'all' && status !== '' && status !== 'undefined') { sql += ' AND f.status = ?'; params.push(status); }
      if (department_id && department_id !== 'all' && department_id !== '' && department_id !== 'undefined' && Number(department_id) > 0) { sql += ' AND f.department_id = ?'; params.push(department_id); }
      if (category_id && category_id !== 'all' && category_id !== '' && category_id !== 'undefined' && Number(category_id) > 0) { sql += ' AND f.category_id = ?'; params.push(category_id); }
      if (priority && priority !== 'all' && priority !== '' && priority !== 'undefined') { sql += ' AND f.priority = ?'; params.push(priority); }
      if (keyword) {
        sql += ' AND (f.title LIKE ? OR f.content LIKE ? OR f.tracking_code LIKE ?)';
        const kw = `%${keyword}%`;
        params.push(kw, kw, kw);
      }

      sql += ' ORDER BY f.id DESC';
      items = await querySqlite(sql, params);
    }

    // Strict RBAC: Only include secret audit fields if user.role === 'admin'
    const sanitizedItems = items.map((item: any) => {
      if (!isAdmin) {
        delete item.client_ip;
        delete item.user_agent;
        delete item.device_fingerprint;
      }
      return item;
    });

    return res.status(200).json({ success: true, data: sanitizedItems });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Lỗi tải danh sách quản trị.' });
  }
}
