import { VercelRequest, VercelResponse } from '@vercel/node';
import { isSupabaseEnabled, supabase, querySqlite, runSqlite } from './_db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'anphu_info_benhvien_secret_key_2026_safe_jwt';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      if (isSupabaseEnabled && supabase) {
        const { data, error } = await supabase.from('system_settings').select('key, value, description');
        if (error) throw error;
        const settingsMap: Record<string, string> = {};
        (data || []).forEach((r: any) => { settingsMap[r.key] = r.value || ''; });
        return res.status(200).json({ success: true, data: settingsMap });
      } else {
        const rows = await querySqlite<{ key: string; value: string }>('SELECT key, value FROM system_settings');
        const settingsMap: Record<string, string> = {};
        rows.forEach(r => { settingsMap[r.key] = r.value || ''; });
        return res.status(200).json({ success: true, data: settingsMap });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Lỗi tải cấu hình hệ thống.' });
    }
  }

  if (req.method === 'POST') {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ success: false, message: 'Yêu cầu Token xác thực!' });

      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền cập nhật Cấu hình!' });
      }

      const { settings } = req.body;
      if (!settings) return res.status(400).json({ success: false, message: 'Dữ liệu cấu hình không hợp lệ!' });

      if (isSupabaseEnabled && supabase) {
        for (const [key, value] of Object.entries(settings)) {
          await supabase.from('system_settings').upsert({ key, value: String(value) }, { onConflict: 'key' });
        }
      } else {
        for (const [key, value] of Object.entries(settings)) {
          await runSqlite('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', [key, String(value)]);
        }
      }

      return res.status(200).json({ success: true, message: 'Cập nhật cấu hình hệ thống thành công!' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Lỗi lưu cấu hình.' });
    }
  }

  res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
