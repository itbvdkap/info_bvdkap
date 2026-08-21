import { Router, Response } from 'express';
import XLSX from 'xlsx';
import { querySql } from '../database/db';
import { authenticateToken, AuthRequest } from './auth.router';

export const exportRouter = Router();

// GET /api/export/excel
exportRouter.get('/excel', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status, department_id, category_id, priority, keyword } = req.query;

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

    if (status && status !== 'all') {
      sql += ' AND f.status = ?';
      params.push(status);
    }
    if (department_id && department_id !== 'all') {
      sql += ' AND f.department_id = ?';
      params.push(department_id);
    }
    if (category_id && category_id !== 'all') {
      sql += ' AND f.category_id = ?';
      params.push(category_id);
    }
    if (priority && priority !== 'all') {
      sql += ' AND f.priority = ?';
      params.push(priority);
    }
    if (keyword) {
      sql += ' AND (f.title LIKE ? OR f.content LIKE ? OR f.tracking_code LIKE ?)';
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw);
    }

    sql += ' ORDER BY f.id DESC';

    const items = await querySql(sql, params);

    // Build worksheet data rows
    const excelData = items.map((item: any, index: number) => ({
      'STT': index + 1,
      'Mã Tra Cứu': item.tracking_code,
      'Người Gửi': item.sender,
      'Số Điện Thoại': item.sender_phone || '',
      'Email': item.sender_email || '',
      'Khoa/Phòng Liên Quan': item.department_name || '',
      'Phân Loại': item.category_name || '',
      'Mức Độ': item.priority_str,
      'Tiêu Đề': item.title,
      'Nội Dung Chi Tiết': item.content,
      'Trạng Thái Xử Lý': item.status_str,
      'Nội Dung Phản Hồi Của Lãnh Đạo': item.response_content || '',
      'Lãnh Đạo Xử Lý': item.responder_name || '',
      'Thời Gian Phản Hồi': item.responded_at ? new Date(item.responded_at).toLocaleString('vi-VN') : '',
      'Thời Gian Gửi': new Date(item.created_at).toLocaleString('vi-VN')
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Auto-fit column widths
    const colWidths = [
      { wch: 6 },  // STT
      { wch: 18 }, // Mã Tra Cứu
      { wch: 20 }, // Người Gửi
      { wch: 15 }, // SĐT
      { wch: 22 }, // Email
      { wch: 25 }, // Khoa/Phòng
      { wch: 30 }, // Phân Loại
      { wch: 15 }, // Mức Độ
      { wch: 35 }, // Tiêu Đề
      { wch: 50 }, // Nội Dung
      { wch: 18 }, // Trạng Thái
      { wch: 50 }, // Phản Hồi
      { wch: 25 }, // Lãnh Đạo
      { wch: 20 }, // TG Phản hồi
      { wch: 20 }  // TG Gửi
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DS_Ý_Kiến_Báo_Cáo');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const filename = `BAO_CAO_Y_KIEN_AN_PHU_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err: any) {
    console.error('Lỗi xuất Excel:', err);
    res.status(500).json({ success: false, message: 'Lỗi xuất báo cáo Excel.' });
  }
});
