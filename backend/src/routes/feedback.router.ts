import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { runSql, querySql, getSql } from '../database/db';
import { authenticateToken, AuthRequest } from './auth.router';
import { dispatchMultiChannelNotifications } from '../services/notification.service';

export const feedbackRouter = Router();

// Multer storage for uploads
const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'file-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } // Max 15MB
});

// Helper generate tracking code
function generateTrackingCode(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AP-${dateStr}-${randomChars}`;
}

// 1. POST /api/feedbacks (Public submit)
feedbackRouter.post('/', upload.single('attachment'), async (req: Request, res: Response) => {
  try {
    const {
      is_anonymous,
      sender_name,
      sender_phone,
      sender_email,
      department_id,
      category_id,
      priority,
      title,
      content
    } = req.body;

    if (!department_id || !category_id || !title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ Khoa/Phòng, Loại báo cáo, Tiêu đề và Nội dung!'
      });
    }

    const tracking_code = generateTrackingCode();
    const isAnon = String(is_anonymous) === 'true' || String(is_anonymous) === '1' ? 1 : 0;
    const attachment_url = req.file ? `/uploads/${req.file.filename}` : null;

    // Secret Audit Logging: Capture Client IP & Browser Fingerprint / User-Agent
    const rawIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
    const client_ip = rawIp === '::1' || rawIp === '::ffff:127.0.0.1' ? '127.0.0.1 (Localhost)' : rawIp;
    const user_agent = req.headers['user-agent'] || 'Unknown Browser';
    const device_fingerprint = req.body.device_fingerprint || req.headers['x-device-fingerprint'] || null;

    const result = await runSql(
      `INSERT INTO feedbacks (
        tracking_code, is_anonymous, sender_name, sender_phone, sender_email,
        department_id, category_id, priority, title, content, attachment_url, status,
        client_ip, user_agent, device_fingerprint
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        tracking_code,
        isAnon,
        isAnon ? null : sender_name || null,
        isAnon ? null : sender_phone || null,
        isAnon ? null : sender_email || null,
        parseInt(department_id),
        parseInt(category_id),
        priority || 'normal',
        title.trim(),
        content.trim(),
        attachment_url,
        client_ip,
        user_agent,
        device_fingerprint
      ]
    );

    // Fetch department name & category name for notification
    const dept = await getSql<{ name: string }>('SELECT name FROM departments WHERE id = ?', [department_id]);
    const cat = await getSql<{ name: string }>('SELECT name FROM categories WHERE id = ?', [category_id]);

    // Send Multi-Channel Notifications (Telegram, Email/Gmail, Zalo) async
    dispatchMultiChannelNotifications({
      tracking_code,
      title,
      content,
      category_name: cat?.name || 'Chưa rõ',
      department_name: dept?.name || 'Chưa rõ',
      priority: priority || 'normal',
      is_anonymous: isAnon === 1,
      sender_name,
      sender_phone
    });

    res.json({
      success: true,
      message: 'Gửi báo cáo / ý kiến thành công!',
      tracking_code,
      id: result.lastID
    });
  } catch (err: any) {
    console.error('Lỗi gửi feedback:', err);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lưu báo cáo.' });
  }
});

// 2. GET /api/feedbacks/track/:code (Public query status by tracking code)
feedbackRouter.get('/track/:code', async (req: Request, res: Response) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const item = await getSql(
      `SELECT f.id, f.tracking_code, f.is_anonymous, f.priority, f.title, f.content, f.attachment_url,
              f.status, f.response_content, f.responded_at, f.created_at,
              d.name as department_name, c.name as category_name
       FROM feedbacks f
       LEFT JOIN departments d ON f.department_id = d.id
       LEFT JOIN categories c ON f.category_id = c.id
       WHERE UPPER(f.tracking_code) = ?`,
      [code]
    );

    if (!item) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo với mã tra cứu này!' });
    }

    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi tra cứu báo cáo.' });
  }
});

// 3. GET /api/feedbacks/admin (Leader / Admin protected list with filters)
feedbackRouter.get('/admin', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status, department_id, category_id, priority, keyword } = req.query;

    let sql = `
      SELECT f.*,
             d.name as department_name,
             c.name as category_name,
             u.full_name as responder_name
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
      sql += ' AND (f.title LIKE ? OR f.content LIKE ? OR f.tracking_code LIKE ? OR f.sender_name LIKE ?)';
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw, kw);
    }

    const items = await querySql(sql, params);

    // Strict RBAC: Only include secret audit fields if user role === 'admin'
    const isAdmin = req.user?.role === 'admin';
    const sanitizedItems = items.map((item: any) => {
      if (!isAdmin) {
        delete item.client_ip;
        delete item.user_agent;
        delete item.device_fingerprint;
      }
      return item;
    });

    res.json({ success: true, data: sanitizedItems });
  } catch (err: any) {
    console.error('Lỗi lấy danh sách admin:', err);
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách quản trị.' });
  }
});

// 4. PUT /api/feedbacks/:id/respond (Leader respond & change status)
feedbackRouter.put('/:id/respond', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, response_content } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Trạng thái xử lý không được trống!' });
    }

    const responded_by = req.user?.id;
    const responded_at = new Date().toISOString();

    await runSql(
      `UPDATE feedbacks
       SET status = ?, response_content = ?, responded_by = ?, responded_at = ?, updated_at = ?
       WHERE id = ?`,
      [status, response_content || null, responded_by, responded_at, responded_at, id]
    );

    res.json({ success: true, message: 'Cập nhật phản hồi thành công!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi cập nhật phản hồi.' });
  }
});

// 5. GET /api/feedbacks/stats (Analytics stats)
feedbackRouter.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const totalRow = await getSql<{ total: number }>('SELECT COUNT(*) as total FROM feedbacks');
    const pendingRow = await getSql<{ count: number }>('SELECT COUNT(*) as count FROM feedbacks WHERE status = "pending"');
    const processingRow = await getSql<{ count: number }>('SELECT COUNT(*) as count FROM feedbacks WHERE status = "processing"');
    const resolvedRow = await getSql<{ count: number }>('SELECT COUNT(*) as count FROM feedbacks WHERE status = "resolved"');
    const urgentRow = await getSql<{ count: number }>('SELECT COUNT(*) as count FROM feedbacks WHERE priority = "urgent"');

    const byCategory = await querySql(
      `SELECT c.name as category_name, COUNT(f.id) as count
       FROM categories c
       LEFT JOIN feedbacks f ON c.id = f.category_id
       GROUP BY c.id`
    );

    const byDepartment = await querySql(
      `SELECT d.name as department_name, COUNT(f.id) as count
       FROM departments d
       LEFT JOIN feedbacks f ON d.id = f.department_id
       GROUP BY d.id
       HAVING count > 0
       ORDER BY count DESC`
    );

    res.json({
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
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Lỗi tải dữ liệu thống kê.' });
  }
});
