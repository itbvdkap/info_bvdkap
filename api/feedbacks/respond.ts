import { VercelRequest, VercelResponse } from '@vercel/node';
import { isSupabaseEnabled, supabase, runSqlite } from '../_db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'anphu_info_benhvien_secret_key_2026_safe_jwt';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Yêu cầu Token xác thực!' });

    const user: any = jwt.verify(token, JWT_SECRET);
    const { id, status, response_content } = req.body;

    if (!id || !status) {
      return res.status(400).json({ success: false, message: 'Thiếu ID hoặc Trạng thái xử lý!' });
    }

    const responded_at = new Date().toISOString();

    if (isSupabaseEnabled && supabase) {
      const { error } = await supabase.from('feedbacks').update({
        status,
        response_content: response_content || null,
        responded_by: user.id,
        responded_at,
        updated_at: responded_at
      }).eq('id', id);

      if (error) throw error;
    } else {
      await runSqlite(
        `UPDATE feedbacks
         SET status = ?, response_content = ?, responded_by = ?, responded_at = ?, updated_at = ?
         WHERE id = ?`,
        [status, response_content || null, user.id, responded_at, responded_at, id]
      );
    }

    return res.status(200).json({ success: true, message: 'Cập nhật phản hồi thành công!' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Lỗi cập nhật phản hồi.' });
  }
}
