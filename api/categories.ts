import { VercelRequest, VercelResponse } from '@vercel/node';
import { isSupabaseEnabled, supabase, querySqlite, runSqlite } from './_db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'anphu_info_benhvien_secret_key_2026_safe_jwt';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. GET /api/categories
  if (req.method === 'GET') {
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

  // 2. POST /api/categories (Add or Edit Category - Admin only)
  if (req.method === 'POST') {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ success: false, message: 'Yêu cầu Token xác thực!' });

      const user: any = jwt.verify(token, JWT_SECRET);
      if (user?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền quản lý danh mục!' });
      }

      const { id, name, code, icon, description } = req.body;
      if (!name || !code) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập Tên và Mã phân loại!' });
      }

      const cleanCode = String(code).trim().toUpperCase();
      const cleanName = String(name).trim();
      const cleanIcon = String(icon || 'comments').trim();
      const cleanDesc = String(description || '').trim();

      if (id) {
        // Update existing category
        if (isSupabaseEnabled && supabase) {
          const { error } = await supabase
            .from('categories')
            .update({ name: cleanName, code: cleanCode, icon: cleanIcon, description: cleanDesc })
            .eq('id', Number(id));
          if (error) throw error;
        } else {
          await runSqlite('UPDATE categories SET name = ?, code = ?, icon = ?, description = ? WHERE id = ?', [cleanName, cleanCode, cleanIcon, cleanDesc, id]);
        }
        return res.status(200).json({ success: true, message: 'Cập nhật phân loại thành công!' });
      } else {
        // Create new category
        if (isSupabaseEnabled && supabase) {
          const { error } = await supabase
            .from('categories')
            .insert([{ name: cleanName, code: cleanCode, icon: cleanIcon, description: cleanDesc }]);
          if (error) throw error;
        } else {
          await runSqlite('INSERT INTO categories (name, code, icon, description) VALUES (?, ?, ?, ?)', [cleanName, cleanCode, cleanIcon, cleanDesc]);
        }
        return res.status(200).json({ success: true, message: 'Thêm phân loại mới thành công!' });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Lỗi lưu thông tin phân loại.' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
