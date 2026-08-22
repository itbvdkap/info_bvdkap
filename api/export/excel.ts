import { VercelRequest, VercelResponse } from '@vercel/node';
import { isSupabaseEnabled, supabase, querySqlite } from '../_db';
import XLSX from 'xlsx';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'anphu_info_benhvien_secret_key_2026_safe_jwt';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || (req.query.token as string);
    if (!token) return res.status(401).json({ success: false, message: 'Yêu cầu Token xác thực!' });

    jwt.verify(token, JWT_SECRET);

    const { status, department_id, category_id, priority, keyword } = req.query;

    let items: any[] = [];

    if (isSupabaseEnabled && supabase) {
      let query = supabase.from('feedbacks').select(`
        *,
        department_name:departments(name),
        category_name:categories(name),
        responder_name:users(full_name)
      `);

      if (status && status !== 'all') query = query.eq('status', String(status));
      if (department_id && department_id !== 'all') query = query.eq('department_id', Number(department_id));
      if (category_id && category_id !== 'all') query = query.eq('category_id', Number(category_id));
      if (priority && priority !== 'all') query = query.eq('priority', String(priority));
      if (keyword) {
        query = query.or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%,tracking_code.ilike.%${keyword}%`);
      }

      const { data, error } = await query.order('id', { ascending: false });
      if (error) throw error;

      items = (data || []).map((i: any) => ({
        ...i,
        department_name: i.department_name?.name || 'N/A',
        category_name: i.category_name?.name || 'N/A',
        responder_name: i.responder_name?.full_name || 'N/A',
        sender: i.is_anonymous === 1 ? 'Ẩn danh' : (i.sender_name || 'Không rõ'),
        priority_str: i.priority === 'urgent' ? 'Khẩn cấp' : (i.priority === 'high' ? 'Quan trọng' : 'Bình thường'),
        status_str: i.status === 'pending' ? 'Mới tiếp nhận' : (i.status === 'processing' ? 'Đang xử lý' : (i.status === 'resolved' ? 'Đã giải quyết' : 'Từ chối'))
      }));
    } else {
      let sql = `
        SELECT f.tracking_code,
               CASE WHEN f.is_anonymous = 1 THEN 'Ẩn danh' ELSE IFNULL(f.sender_name, 'Không rõ') END as sender,
               f.sender_phone,
               f.sender_email,
               d.name as department_name,
               c.name as category_name,
               CASE f.priority WHEN 'urgent' THEN 'Khẩn cấp' WHEN 'high' THEN 'Quan trọng' ELSE 'Bình thường' END as priority_str,
               f.title,
               f.content,
               CASE f.status WHEN 'pending' THEN 'Mới tiếp nhận' WHEN 'processing' THEN 'Đang xử lý' WHEN 'resolved' THEN 'Đã giải quyết' ELSE 'Từ chối/Bỏ qua' END as status_str,
               f.response_content,
               u.full_name as responder_name,
               f.responded_at,
               f.created_at
        FROM feedbacks f
        LEFT JOIN departments d ON f.department_id = d.id
        LEFT JOIN categories c ON f.category_id = c.id
        LEFT JOIN users u ON f.responded_by = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status && status !== 'all') { sql += ' AND f.status = ?'; params.push(status); }
      if (department_id && department_id !== 'all') { sql += ' AND f.department_id = ?'; params.push(department_id); }
      if (category_id && category_id !== 'all') { sql += ' AND f.category_id = ?'; params.push(category_id); }
      if (priority && priority !== 'all') { sql += ' AND f.priority = ?'; params.push(priority); }
      if (keyword) {
        sql += ' AND (f.title LIKE ? OR f.content LIKE ? OR f.tracking_code LIKE ?)';
        const kw = `%${keyword}%`;
        params.push(kw, kw, kw);
      }

      sql += ' ORDER BY f.id DESC';
      items = await querySqlite(sql, params);
    }

    const excelData = items.map((item: any, index: number) => ({
      'STT': index + 1,
      'Mã Tra Cứu': item.tracking_code,
      'Người Gửi': item.sender || (item.is_anonymous ? 'Ẩn danh' : item.sender_name),
      'Số Điện Thoại': item.sender_phone || '',
      'Email': item.sender_email || '',
      'Khoa/Phòng Liên Quan': item.department_name || '',
      'Phân Loại': item.category_name || '',
      'Mức Độ': item.priority_str || item.priority,
      'Tiêu Đề': item.title,
      'Nội Dung Chi Tiết': item.content,
      'Trạng Thái Xử Lý': item.status_str || item.status,
      'Nội Dung Phản Hồi CỦa Lãnh Đạo': item.response_content || '',
      'Lãnh Đạo Xử Lý': item.responder_name || '',
      'Thời Gian Phản Hồi': item.responded_at ? new Date(item.responded_at).toLocaleString('vi-VN') : '',
      'Thời Gian Gửi': new Date(item.created_at).toLocaleString('vi-VN')
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    worksheet['!cols'] = [
      { wch: 6 }, { wch: 18 }, { wch: 20 }, { wch: 15 }, { wch: 22 },
      { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 35 }, { wch: 50 },
      { wch: 18 }, { wch: 50 }, { wch: 25 }, { wch: 20 }, { wch: 20 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DS_Ý_Kiến_Báo_Cáo');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const filename = `BAO_CAO_Y_KIEN_AN_PHU_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(buffer);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Lỗi xuất báo cáo Excel.' });
  }
}
