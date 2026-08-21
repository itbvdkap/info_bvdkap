import { getSql } from '../database/db';
import http from 'https';

export async function sendTelegramNotification(feedbackData: {
  tracking_code: string;
  title: string;
  content: string;
  category_name: string;
  department_name: string;
  priority: string;
  is_anonymous: boolean;
  sender_name?: string;
  sender_phone?: string;
}): Promise<boolean> {
  try {
    const tokenRow = await getSql<{ value: string }>('SELECT value FROM system_settings WHERE key = "telegram_bot_token"');
    const chatIdRow = await getSql<{ value: string }>('SELECT value FROM system_settings WHERE key = "telegram_chat_id"');

    const botToken = tokenRow?.value || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = chatIdRow?.value || process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.log('⚠️ Telegram Bot Token hoặc Chat ID chưa được cấu hình. Bỏ qua gửi thông báo Telegram.');
      return false;
    }

    let priorityBadge = '📌 BÌNH THƯỜNG';
    if (feedbackData.priority === 'urgent') priorityBadge = '🚨🚨 KHẨN CẤP';
    else if (feedbackData.priority === 'high') priorityBadge = '⚠️ QUAN TRỌNG';

    const senderInfo = feedbackData.is_anonymous
      ? '🔒 Ẩn danh (Nhân viên)'
      : `👤 ${feedbackData.sender_name || 'Không rõ'} ${feedbackData.sender_phone ? `(${feedbackData.sender_phone})` : ''}`;

    const text = `
<b>[BÁO CÁO / Ý KIẾN MỚI] - info.benhvienanphu.vn</b>

Mức độ: ${priorityBadge}
Mã tra cứu: <code>${feedbackData.tracking_code}</code>

📁 <b>Phân loại:</b> ${feedbackData.category_name}
🏥 <b>Khoa / Phòng liên quan:</b> ${feedbackData.department_name}
👤 <b>Người gửi:</b> ${senderInfo}

📝 <b>Tiêu đề:</b> ${escapeHtml(feedbackData.title)}
💬 <b>Nội dung:</b>
<i>${escapeHtml(feedbackData.content.length > 300 ? feedbackData.content.substring(0, 300) + '...' : feedbackData.content)}</i>

⏰ <i>Thời gian: ${new Date().toLocaleString('vi-VN')}</i>
👉 <i>Vui lòng đăng nhập Cổng Quản Trị Lãnh Đạo để xem và xử lý!</i>
    `.trim();

    const postData = JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    return new Promise((resolve) => {
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('✅ Gửi thông báo Telegram thành công!');
            resolve(true);
          } else {
            console.error('❌ Lỗi Telegram API:', body);
            resolve(false);
          }
        });
      });

      req.on('error', (err) => {
        console.error('❌ Lỗi kết nối Telegram:', err.message);
        resolve(false);
      });

      req.write(postData);
      req.end();
    });
  } catch (err: any) {
    console.error('❌ Lỗi gửi Telegram:', err?.message || err);
    return false;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
