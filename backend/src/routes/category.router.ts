import { Router, Request, Response } from 'express';
import { querySql } from '../database/db';

export const categoryRouter = Router();

// GET /api/categories (public for form dropdown)
categoryRouter.get('/', async (req: Request, res: Response) => {
  try {
    const cats = await querySql('SELECT id, name, code, icon, description FROM categories ORDER BY id ASC');
    res.json({ success: true, data: cats });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi tải danh mục Phân loại báo cáo.' });
  }
});
