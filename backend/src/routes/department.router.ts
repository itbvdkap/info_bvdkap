import { Router, Request, Response } from 'express';
import { querySql, runSql } from '../database/db';
import { authenticateToken, AuthRequest } from './auth.router';

export const departmentRouter = Router();

// GET /api/departments (public for form dropdown)
departmentRouter.get('/', async (req: Request, res: Response) => {
  try {
    const depts = await querySql('SELECT id, name, code, active FROM departments WHERE active = 1 ORDER BY id ASC');
    res.json({ success: true, data: depts });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách Khoa/Phòng.' });
  }
});

// POST /api/departments (admin create/update)
departmentRouter.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền quản lý Khoa/Phòng!' });
    }
    const { id, name, code, active } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Tên và Mã Khoa/Phòng không được để trống!' });
    }

    if (id) {
      await runSql('UPDATE departments SET name = ?, code = ?, active = ? WHERE id = ?', [name, code, active ?? 1, id]);
      res.json({ success: true, message: 'Cập nhật Khoa/Phòng thành công!' });
    } else {
      await runSql('INSERT INTO departments (name, code, active) VALUES (?, ?, ?)', [name, code, active ?? 1]);
      res.json({ success: true, message: 'Thêm Khoa/Phòng mới thành công!' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Lỗi lưu Khoa/Phòng.' });
  }
});
