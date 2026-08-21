import { getSql, querySql } from '../database/db';
import http from 'https';
import nodemailer from 'nodemailer';

export interface FeedbackNotificationData {
  tracking_code: string;
  title: string;
  content: string;
  category_name: string;
  department_name: string;
  priority: string;
  is_anonymous: boolean;
  sender_name?: string;
  sender_phone?: string;
}

export async function dispatchMultiChannelNotifications(data: FeedbackNotificationData) {
  const settingsRows = await querySql<{ key: string; value: string }>('SELECT key, value FROM system_settings');
  const settings: Record<string, string> = {};
  settingsRows.forEach(r => { settings[r.key] = r.value || ''; });

  // Dispatch all enabled channels concurrently
  const promises = [];

  // 1. Telegram Channel
  if (settings.telegram_bot_token && settings.telegram_chat_id && settings.telegram_enabled !== 'false') {
    promises.push(sendTelegram(settings.telegram_bot_token, settings.telegram_chat_id, data));
  }

  // 2. Email / Gmail SMTP Channel
  if (settings.email_enabled === 'true' && settings.email_user && settings.email_pass && settings.email_receiver) {
    promises.push(sendEmail(settings, data));
  }

  // 3. Zalo OA / Webhook Channel
  if (settings.zalo_enabled === 'true' && (settings.zalo_webhook_url || settings.zalo_oa_token)) {
    promises.push(sendZalo(settings, data));
  }

  await Promise.allSettled(promises);
}

// Telegram Implementation
async function sendTelegram(botToken: string, chatId: string, data: FeedbackNotificationData) {
  try {
    let priorityBadge = '📌 BÌNH THƯỜNG';
    if (data.priority === 'urgent') priorityBadge = '🚨🚨 KHẨN CẤP';
    else if (data.priority === 'high') priorityBadge = '⚠️ QUAN TRỌNG';

    const senderInfo = data.is_anonymous
      ? '🔒 Ẩn danh (Nhân viên)'
      : `👤 ${data.sender_name || 'Không rõ'} ${data.sender_phone ? `(${data.sender_phone})` : ''}`;

    const text = `
<b>[BÁO CÁO / Ý KIẾN MỚI] - info.benhvienanphu.vn</b>

Mức độ: ${priorityBadge}
Mã tra cứu: <code>${data.tracking_code}</code>

📁 <b>Phân loại:</b> ${data.category_name}
🏥 <b>Khoa / Phòng liên quan:</b> ${data.department_name}
👤 <b>Người gửi:</b> ${senderInfo}

📝 <b>Tiêu đề:</b> ${escapeHtml(data.title)}
💬 <b>Nội dung:</b>
<i>${escapeHtml(data.content.length > 300 ? data.content.substring(0, 300) + '...' : data.content)}</i>

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
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) console.log('✅ Telegram: Gửi thành công!');
          else console.error('❌ Telegram error:', body);
          resolve(true);
        });
      });
      req.on('error', err => { console.error('❌ Telegram req err:', err.message); resolve(false); });
      req.write(postData);
      req.end();
    });
  } catch (err: any) {
    console.error('Lỗi gửi Telegram:', err?.message || err);
  }
}

// Email / Gmail Implementation
async function sendEmail(settings: Record<string, string>, data: FeedbackNotificationData) {
  try {
    const transporter = nodemailer.createTransport({
      host: settings.email_smtp_host || 'smtp.gmail.com',
      port: parseInt(settings.email_smtp_port || '587'),
      secure: settings.email_smtp_port === '465',
      auth: {
        user: settings.email_user,
        pass: settings.email_pass // App password for Gmail
      }
    });

    let priorityBadge = '📌 BÌNH THƯỜNG';
    if (data.priority === 'urgent') priorityBadge = '🚨🚨 KHẨN CẤP';
    else if (data.priority === 'high') priorityBadge = '⚠️ QUAN TRỌNG';

    const senderInfo = data.is_anonymous
      ? '🔒 Ẩn danh (Nhân viên)'
      : `${data.sender_name || 'Không rõ'} ${data.sender_phone ? `(${data.sender_phone})` : ''}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; background-color: #ffffff;">
        <div style="background-color: #0284c7; padding: 15px; border-radius: 8px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px;">BỆNH VIỆN AN PHÚ - BÁO CÁO MỚI</h2>
          <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">info.benhvienanphu.vn</p>
        </div>

        <div style="margin-top: 20px; font-size: 14px; color: #334155; line-height: 1.6;">
          <p><strong>Mã tra cứu:</strong> <span style="font-size: 16px; font-weight: bold; color: #0284c7;">${data.tracking_code}</span></p>
          <p><strong>Mức độ khẩn:</strong> ${priorityBadge}</p>
          <p><strong>Khoa / Phòng:</strong> ${data.department_name}</p>
          <p><strong>Phân loại:</strong> ${data.category_name}</p>
          <p><strong>Người gửi:</strong> ${senderInfo}</p>
          <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 15px 0;" />
          <p><strong>Tiêu đề:</strong> ${escapeHtml(data.title)}</p>
          <div style="background-color: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #0284c7; margin-top: 10px;">
            <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(data.content)}</p>
          </div>
        </div>

        <div style="margin-top: 25px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px;">
          <p>Vui lòng đăng nhập Cổng Quản Trị Lãnh Đạo để ghi nhận và phản hồi.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Bệnh viện An Phú - Info" <${settings.email_user}>`,
      to: settings.email_receiver,
      subject: `[BÁO CÁO MỚI - ${data.priority === 'urgent' ? '🚨 KHẨN CẤP' : 'Ý KIẾN'}] ${data.title}`,
      html: htmlContent
    });

    console.log('✅ Email/Gmail: Gửi thành công tới', settings.email_receiver);
  } catch (err: any) {
    console.error('❌ Lỗi gửi Email/Gmail:', err?.message || err);
  }
}

// Zalo OA / Webhook Implementation
async function sendZalo(settings: Record<string, string>, data: FeedbackNotificationData) {
  try {
    const webhookUrl = settings.zalo_webhook_url;
    if (!webhookUrl) {
      console.log('⚠️ Zalo Webhook URL chưa cấu hình. Bỏ qua Zalo notification.');
      return;
    }

    let priorityBadge = '📌 BÌNH THƯỜNG';
    if (data.priority === 'urgent') priorityBadge = '🚨🚨 KHẨN CẤP';
    else if (data.priority === 'high') priorityBadge = '⚠️ QUAN TRỌNG';

    const senderInfo = data.is_anonymous ? '🔒 Ẩn danh (Nhân viên)' : `${data.sender_name || 'Không rõ'}`;

    const payload = JSON.stringify({
      event_name: 'new_feedback',
      tracking_code: data.tracking_code,
      title: data.title,
      content: data.content,
      category: data.category_name,
      department: data.department_name,
      priority: priorityBadge,
      sender: senderInfo,
      created_at: new Date().toLocaleString('vi-VN')
    });

    const u = new URL(webhookUrl);
    const options = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    return new Promise((resolve) => {
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          console.log('✅ Zalo Webhook: Gửi HTTP status', res.statusCode);
          resolve(true);
        });
      });
      req.on('error', err => { console.error('❌ Zalo Webhook err:', err.message); resolve(false); });
      req.write(payload);
      req.end();
    });
  } catch (err: any) {
    console.error('❌ Lỗi gửi Zalo:', err?.message || err);
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
