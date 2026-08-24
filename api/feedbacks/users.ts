import { VercelRequest, VercelResponse } from '@vercel/node';
import { isSupabaseEnabled, supabase, querySqlite, runSqlite } from '../_db';
import { applySecurityHeaders, checkRateLimit } from '../_security';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'anphu_info_benhvien_secret_key_2026_safe_jwt';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applySecurityHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Yêu cầu Token xác thực!' });

    const currentUser: any = jwt.verify(token, JWT_SECRET);

    // 1. GET /api/feedbacks/users (List all users - Admin only)
    if (req.method === 'GET') {
      if (currentUser?.role !== 'admin') {
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

    // 2. POST /api/feedbacks/users (Create or Update User - Admin only)
    if (req.method === 'POST') {
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền quản lý tài khoản!' });
      }

      if (!checkRateLimit(req, res, 'quản lý tài khoản', 20, 60000)) return;

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

    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Lỗi quản lý tài khoản.' });
  }
}
