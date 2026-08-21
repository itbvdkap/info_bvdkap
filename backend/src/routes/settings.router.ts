import { Router, Request, Response } from 'express';
import { querySql, runSql } from '../database/db';
import { authenticateToken, AuthRequest } from './auth.router';

export const settingsRouter = Router();

// GET /api/settings
settingsRouter.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await querySql<{ key: string; value: string; description: string }>('SELECT key, value, description FROM system_settings');
    const settingsMap: Record<string, string> = {};
    rows.forEach(r => {
      settingsMap[r.key] = r.value || '';
    });
    res.json({ success: true, data: settingsMap });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi tải cấu hình hệ thống.' });
  }
});

// POST /api/settings
settingsRouter.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền cập nhật Cấu hình hệ thống!' });
    }

    const { settings } = req.body; // object { key: value }
    if (!settings) {
      return res.status(400).json({ success: false, message: 'Dữ liệu cấu hình không hợp lệ!' });
    }

    for (const [key, value] of Object.entries(settings)) {
      await runSql('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', [key, String(value)]);
    }

    res.json({ success: true, message: 'Cập nhật cấu hình thành công!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi lưu cấu hình hệ thống.' });
  }
});
