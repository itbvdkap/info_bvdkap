import { VercelRequest, VercelResponse } from '@vercel/node';
import { isSupabaseEnabled, supabase, querySqlite, runSqlite } from '../_db';
import jwt from 'jsonwebtoken';
import { applySecurityHeaders, checkRateLimit } from '../_security';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'anphu_info_benhvien_secret_key_2026_safe_jwt';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applySecurityHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Rate Limiting: Max 60 queries per minute per IP
  if (!checkRateLimit(req, res, 'truy vấn quản trị', 60, 60000)) {
    return;
  }

  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Yêu cầu Token xác thực!' });

    const currentUser: any = jwt.verify(token, JWT_SECRET);
    const isAdmin = currentUser?.role === 'admin';

    const { action, status, department_id, category_id, priority, keyword, from_date, to_date } = req.query;

    // =========================================================================
    // 1. USER MANAGEMENT SUB-ACTIONS (Admin Only)
    // =========================================================================

    // GET /api/feedbacks/admin?action=users
    if (req.method === 'GET' && action === 'users') {
      if (!isAdmin) {
        return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền truy cập danh sách tài khoản!' });
      }

      let users: any[] = [];
      if (isSupabaseEnabled && supabase) {
        const { data, error } = await supabase.from('users').select(`
          id, username, full_name, role, department_id, created_at,
          department_name:departments(name)
        `).order('id', { ascending: true });

        if (error) throw error;
        users = (data || []).map((u: any) => ({
          ...u,
          department_name: u.department_name ? (typeof u.department_name === 'object' ? u.department_name.name : u.department_name) : 'Toàn bệnh viện'
        }));
      } else {
        users = await querySqlite(`
          SELECT u.id, u.username, u.full_name, u.role, u.department_id, u.created_at,
                 IFNULL(d.name, 'Toàn bệnh viện') as department_name
          FROM users u
          LEFT JOIN departments d ON u.department_id = d.id
          ORDER BY u.id ASC
        `);
      }

      return res.status(200).json({ success: true, data: users });
    }

    // POST /api/feedbacks/admin (action === 'users' or req.body.action === 'users')
    if (req.method === 'POST' && (action === 'users' || req.body?.action === 'users')) {
      if (!isAdmin) {
        return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền quản lý tài khoản!' });
      }

      const { id, username, password, full_name, role, department_id } = req.body;

      if (!username || !full_name || !role) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ Tên đăng nhập, Họ tên và Vai trò!' });
      }

      const validRoles = ['admin', 'leader', 'dept_head', 'inspector'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ!' });
      }

      const cleanUsername = String(username).trim().toLowerCase();
      const cleanFullName = String(full_name).trim();
      const deptId = role === 'dept_head' && department_id ? Number(department_id) : null;

      if (id) {
        // Update existing user
        let updateData: any = {
          full_name: cleanFullName,
          role,
          department_id: deptId
        };

        if (password && String(password).trim().length > 0) {
          updateData.password_hash = await bcrypt.hash(String(password).trim(), 10);
        }

        if (isSupabaseEnabled && supabase) {
          const { error } = await supabase.from('users').update(updateData).eq('id', Number(id));
          if (error) throw error;
        } else {
          if (updateData.password_hash) {
            await runSqlite('UPDATE users SET full_name = ?, role = ?, department_id = ?, password_hash = ? WHERE id = ?', [cleanFullName, role, deptId, updateData.password_hash, id]);
          } else {
            await runSqlite('UPDATE users SET full_name = ?, role = ?, department_id = ? WHERE id = ?', [cleanFullName, role, deptId, id]);
          }
        }

        return res.status(200).json({ success: true, message: 'Cập nhật tài khoản người dùng thành công!' });
      } else {
        // Create new user
        if (!password || String(password).trim().length === 0) {
          return res.status(400).json({ success: false, message: 'Vui lòng nhập Mật khẩu cho tài khoản mới!' });
        }

        const password_hash = await bcrypt.hash(String(password).trim(), 10);

        if (isSupabaseEnabled && supabase) {
          const { error } = await supabase.from('users').insert([{
            username: cleanUsername,
            password_hash,
            full_name: cleanFullName,
            role,
            department_id: deptId
          }]);
          if (error) throw error;
        } else {
          await runSqlite(
            'INSERT INTO users (username, password_hash, full_name, role, department_id) VALUES (?, ?, ?, ?, ?)',
            [cleanUsername, password_hash, cleanFullName, role, deptId]
          );
        }

        return res.status(200).json({ success: true, message: 'Tạo tài khoản người dùng mới thành công!' });
      }
    }

    // =========================================================================
    // 2. MAIN ADMIN FEEDBACKS QUERY (GET)
    // =========================================================================
    if (req.method !== 'GET') {
      return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    let targetDeptId: number | null = null;
    if (currentUser?.role === 'dept_head' && currentUser?.department_id) {
      targetDeptId = Number(currentUser.department_id);
    } else if (department_id && department_id !== 'all' && department_id !== '' && department_id !== 'undefined' && !isNaN(Number(department_id)) && Number(department_id) > 0) {
      targetDeptId = Number(department_id);
    }

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
      if (targetDeptId) {
        query = query.eq('department_id', targetDeptId);
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
      if (targetDeptId) { sql += ' AND f.department_id = ?'; params.push(targetDeptId); }
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
