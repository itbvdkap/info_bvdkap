import { VercelRequest, VercelResponse } from '@vercel/node';
import { isSupabaseEnabled, supabase, runSqlite, querySqlite, getSqlite } from '../_db';
import jwt from 'jsonwebtoken';
import { dispatchMultiChannelNotifications } from '../../backend/src/services/notification.service';

const JWT_SECRET = process.env.JWT_SECRET || 'anphu_info_benhvien_secret_key_2026_safe_jwt';

function generateTrackingCode(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AP-${dateStr}-${randomChars}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. POST /api/feedbacks (Public submit)
  if (req.method === 'POST') {
    try {
      const {
        is_anonymous,
        sender_name,
        sender_phone,
        sender_email,
        department_id,
        category_id,
        priority,
        title,
        content,
        attachment_url
      } = req.body;

      if (!department_id || !category_id || !title || !content) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng điền đầy đủ Khoa/Phòng, Loại báo cáo, Tiêu đề và Nội dung!'
        });
      }

      const tracking_code = generateTrackingCode();
      const isAnon = String(is_anonymous) === 'true' || String(is_anonymous) === '1' ? 1 : 0;

      const rawIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
      const client_ip = rawIp === '::1' || rawIp === '::ffff:127.0.0.1' ? '127.0.0.1 (Localhost)' : rawIp;
      const user_agent = (req.headers['user-agent'] as string) || 'Unknown Browser';
      const device_fingerprint = req.body.device_fingerprint || (req.headers['x-device-fingerprint'] as string) || null;

      let insertedId = 0;

      if (isSupabaseEnabled && supabase) {
        const { data, error } = await supabase.from('feedbacks').insert([{
          tracking_code,
          is_anonymous: isAnon,
          sender_name: isAnon ? null : sender_name || null,
          sender_phone: isAnon ? null : sender_phone || null,
          sender_email: isAnon ? null : sender_email || null,
          department_id: parseInt(department_id),
          category_id: parseInt(category_id),
          priority: priority || 'normal',
          title: title.trim(),
          content: content.trim(),
          attachment_url: attachment_url || null,
          status: 'pending',
          client_ip,
          user_agent,
          device_fingerprint
        }]).select('id').single();

        if (error) throw error;
        insertedId = data.id;
      } else {
        const result = await runSqlite(
          `INSERT INTO feedbacks (
            tracking_code, is_anonymous, sender_name, sender_phone, sender_email,
            department_id, category_id, priority, title, content, attachment_url, status,
            client_ip, user_agent, device_fingerprint
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
          [
            tracking_code,
            isAnon,
            isAnon ? null : sender_name || null,
            isAnon ? null : sender_phone || null,
            isAnon ? null : sender_email || null,
            parseInt(department_id),
            parseInt(category_id),
            priority || 'normal',
            title.trim(),
            content.trim(),
            attachment_url || null,
            client_ip,
            user_agent,
            device_fingerprint
          ]
        );
        insertedId = result.lastID;
      }

      // Fetch department & category names for notification
      let deptName = 'Chưa rõ';
      let catName = 'Chưa rõ';

      if (isSupabaseEnabled && supabase) {
        const { data: d } = await supabase.from('departments').select('name').eq('id', department_id).single();
        const { data: c } = await supabase.from('categories').select('name').eq('id', category_id).single();
        if (d) deptName = d.name;
        if (c) catName = c.name;
      } else {
        const d = await getSqlite<{ name: string }>('SELECT name FROM departments WHERE id = ?', [department_id]);
        const c = await getSqlite<{ name: string }>('SELECT name FROM categories WHERE id = ?', [category_id]);
        if (d) deptName = d.name;
        if (c) catName = c.name;
      }

      // Send multi-channel notifications async
      dispatchMultiChannelNotifications({
        tracking_code,
        title,
        content,
        category_name: catName,
        department_name: deptName,
        priority: priority || 'normal',
        is_anonymous: isAnon === 1,
        sender_name,
        sender_phone
      });

      return res.status(200).json({
        success: true,
        message: 'Gửi báo cáo / ý kiến thành công!',
        tracking_code,
        id: insertedId
      });
    } catch (err: any) {
      console.error('Lỗi gửi feedback:', err);
      return res.status(500).json({ success: false, message: err?.message || 'Lỗi lưu báo cáo.' });
    }
  }

  // 2. GET /api/feedbacks/admin (Protected list with strict RBAC)
  if (req.method === 'GET') {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ success: false, message: 'Yêu cầu Token xác thực!' });

      const user: any = jwt.verify(token, JWT_SECRET);
      const isAdmin = user?.role === 'admin';

      const { status, department_id, category_id, priority, keyword } = req.query;

      let items: any[] = [];

      if (isSupabaseEnabled && supabase) {
        let query = supabase.from('feedbacks').select(`
          *,
          department_name:departments(name),
          category_name:categories(name),
          responder_name:users(full_name)
        `);

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

  res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
