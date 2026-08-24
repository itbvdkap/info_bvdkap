import { VercelRequest, VercelResponse } from '@vercel/node';
import { isSupabaseEnabled, supabase } from './_db';
import { applySecurityHeaders, checkRateLimit } from './_security';
import path from 'path';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applySecurityHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Rate Limiting: Max 10 uploads per minute per IP
  if (!checkRateLimit(req, res, 'tải file đính kèm', 10, 60000)) {
    return;
  }

  try {
    const { filename, mimetype, base64 } = req.body;

    if (!filename || !base64) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu tệp hoặc nội dung mã hóa base64!' });
    }

    const ext = path.extname(filename).toLowerCase() || '.bin';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({
        success: false,
        message: `🛑 Định dạng tệp ${ext} không được phép tải lên vì lý do an toàn bảo mật!`
      });
    }

    // Clean base64 string
    const base64Data = base64.replace(/^data:([A-Za-z-+\/]+);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'Dung lượng tệp vượt quá hạn mức tối đa 10MB!' });
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomChars = Math.random().toString(36).substring(2, 7);
    const storagePath = `${dateStr}_${randomChars}${ext}`;
    const contentType = mimetype || 'application/octet-stream';

    // 1. Supabase Storage Mode
    if (isSupabaseEnabled && supabase) {
      try {
        await supabase.storage.createBucket('info-attachments', {
          public: true,
          fileSizeLimit: 10485760
        });
      } catch (e) {
        // Bucket might already exist, ignore error
      }

      const { data, error } = await supabase.storage
        .from('info-attachments')
        .upload(storagePath, buffer, {
          contentType,
          upsert: true
        });

      if (error) {
        console.error('Lỗi upload Supabase Storage:', error);
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('info-attachments')
        .getPublicUrl(storagePath);

      return res.status(200).json({
        success: true,
        message: 'Tải tệp lên Supabase Storage CDN thành công!',
        url: publicUrlData.publicUrl,
        filename: storagePath,
        size: buffer.length
      });
    }

    // 2. Local Fallback Mode
    const uploadDir = path.resolve(process.cwd(), 'backend/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const localFilePath = path.join(uploadDir, storagePath);
    fs.writeFileSync(localFilePath, buffer);

    return res.status(200).json({
      success: true,
      message: 'Tải tệp lên thư mục local thành công!',
      url: `/uploads/${storagePath}`,
      filename: storagePath,
      size: buffer.length
    });
  } catch (err: any) {
    console.error('Lỗi API Upload:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Lỗi hệ thống khi tải tệp lên Cloud Storage.'
    });
  }
}
