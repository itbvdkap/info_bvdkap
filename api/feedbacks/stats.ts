import { VercelRequest, VercelResponse } from '@vercel/node';
import { isSupabaseEnabled, supabase, querySqlite, getSqlite } from '../_db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'anphu_info_benhvien_secret_key_2026_safe_jwt';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Yêu cầu Token xác thực!' });

    jwt.verify(token, JWT_SECRET);

    if (isSupabaseEnabled && supabase) {
      const { count: total } = await supabase.from('feedbacks').select('*', { count: 'exact', head: true });
      const { count: pending } = await supabase.from('feedbacks').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      const { count: processing } = await supabase.from('feedbacks').select('*', { count: 'exact', head: true }).eq('status', 'processing');
      const { count: resolved } = await supabase.from('feedbacks').select('*', { count: 'exact', head: true }).eq('status', 'resolved');
      const { count: urgent } = await supabase.from('feedbacks').select('*', { count: 'exact', head: true }).eq('priority', 'urgent');

      const { data: cats } = await supabase.from('categories').select('id, name');
      const { data: depts } = await supabase.from('departments').select('id, name');
      const { data: allFeedbacks } = await supabase.from('feedbacks').select('category_id, department_id');

      const catMap: Record<number, number> = {};
      const deptMap: Record<number, number> = {};

      (allFeedbacks || []).forEach((f: any) => {
        catMap[f.category_id] = (catMap[f.category_id] || 0) + 1;
        deptMap[f.department_id] = (deptMap[f.department_id] || 0) + 1;
      });

      const byCategory = (cats || []).map((c: any) => ({
        category_name: c.name,
        count: catMap[c.id] || 0
      }));

      const byDepartment = (depts || []).map((d: any) => ({
        department_name: d.name,
        count: deptMap[d.id] || 0
      })).filter(d => d.count > 0).sort((a, b) => b.count - a.count);

      return res.status(200).json({
        success: true,
        data: {
          total: total || 0,
          pending: pending || 0,
          processing: processing || 0,
          resolved: resolved || 0,
          urgent: urgent || 0,
          byCategory,
          byDepartment
        }
      });
    } else {
      const totalRow = await getSqlite<{ total: number }>('SELECT COUNT(*) as total FROM feedbacks');
      const pendingRow = await getSqlite<{ count: number }>('SELECT COUNT(*) as count FROM feedbacks WHERE status = "pending"');
      const processingRow = await getSqlite<{ count: number }>('SELECT COUNT(*) as count FROM feedbacks WHERE status = "processing"');
      const resolvedRow = await getSqlite<{ count: number }>('SELECT COUNT(*) as count FROM feedbacks WHERE status = "resolved"');
      const urgentRow = await getSqlite<{ count: number }>('SELECT COUNT(*) as count FROM feedbacks WHERE priority = "urgent"');

      const byCategory = await querySqlite(
        `SELECT c.name as category_name, COUNT(f.id) as count
         FROM categories c
         LEFT JOIN feedbacks f ON c.id = f.category_id
         GROUP BY c.id`
      );

      const byDepartment = await querySqlite(
        `SELECT d.name as department_name, COUNT(f.id) as count
         FROM departments d
         LEFT JOIN feedbacks f ON d.id = f.department_id
         GROUP BY d.id
         HAVING count > 0
         ORDER BY count DESC`
      );

      return res.status(200).json({
        success: true,
        data: {
          total: totalRow?.total || 0,
          pending: pendingRow?.count || 0,
          processing: processingRow?.count || 0,
          resolved: resolvedRow?.count || 0,
          urgent: urgentRow?.count || 0,
          byCategory,
          byDepartment
        }
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Lỗi thống kê analytics.' });
  }
}
