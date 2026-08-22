import { VercelRequest, VercelResponse } from '@vercel/node';
import { isSupabaseEnabled, supabase, querySqlite, runSqlite } from './_db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'anphu_info_benhvien_secret_key_2026_safe_jwt';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      if (isSupabaseEnabled && supabase) {
        const { data, error } = await supabase
          .from('departments')
          .select('id, name, code, active')
          .eq('active', 1)
          .order('id', { ascending: true });

        if (error) throw error;
        return res.status(200).json({ success: true, data });
      } else {
        const depts = await querySqlite('SELECT id, name, code, active FROM departments WHERE active = 1 ORDER BY id ASC');
        return res.status(200).json({ success: true, data: depts });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Lỗi tải danh sách Khoa/Phòng.' });
    }
  }

  if (req.method === 'POST') {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ success: false, message: 'Yêu cầu Token xác thực!' });

      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền quản lý Khoa/Phòng!' });
      }

      const { id, name, code, active } = req.body;
      if (!name || !code) {
        return res.status(400).json({ success: false, message: 'Tên và Mã Khoa/Phòng không được để trống!' });
      }

      if (isSupabaseEnabled && supabase) {
        if (id) {
          const { error } = await supabase.from('departments').update({ name, code, active: active ?? 1 }).eq('id', id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('departments').insert([{ name, code, active: active ?? 1 }]);
          if (error) throw error;
        }
      } else {
        if (id) {
          await runSqlite('UPDATE departments SET name = ?, code = ?, active = ? WHERE id = ?', [name, code, active ?? 1, id]);
        } else {
          await runSqlite('INSERT INTO departments (name, code, active) VALUES (?, ?, ?)', [name, code, active ?? 1]);
        }
      }

      return res.status(200).json({ success: true, message: 'Lưu Khoa/Phòng thành công!' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Lỗi lưu Khoa/Phòng.' });
    }
  }

  res.status(455).json({ success: false, message: 'Method Not Allowed' });
}
