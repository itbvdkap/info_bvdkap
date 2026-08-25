import { VercelRequest, VercelResponse } from '@vercel/node';
import { isSupabaseEnabled, supabase, getSqlite } from '../_db';
import { applySecurityHeaders, checkRateLimit } from '../_security';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'anphu_info_benhvien_secret_key_2026_safe_jwt';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applySecurityHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Brute-force protection: Max 10 attempts per 5 minutes per IP
  if (!checkRateLimit(req, res, 'đăng nhập hệ thống', 10, 300000)) {
    return;
  }

  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên đăng nhập và mật khẩu!' });
    }

    let user: any = null;

    if (isSupabaseEnabled && supabase) {
      const { data, error } = await supabase.from('users').select('*').eq('username', username.trim()).single();
      if (!error && data) user = data;
    } else {
      user = await getSqlite('SELECT * FROM users WHERE username = ?', [username.trim()]);
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại!' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Mật khẩu không chính xác!' });
    }

    // Ensure role is explicitly set for existing users
    let role = user.role;
    if (!role || role === '') {
      if (user.username === 'admin') role = 'admin';
      else if (user.username === 'ban-giam-doc') role = 'leader';
      else role = 'dept_head';
    }

    const payload = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role,
      department_id: user.department_id
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      user: payload
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Lỗi hệ thống khi đăng nhập.' });
  }
}
