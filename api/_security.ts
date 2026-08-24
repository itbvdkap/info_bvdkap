import { VercelRequest, VercelResponse } from '@vercel/node';

// In-Memory Rate Limiter Cache
const rateLimitMap = new Map<string, { count: number; firstRequestTime: number }>();

/**
 * Áp dụng các HTTP Security Headers theo tiêu chuẩn OWASP Security
 */
export function applySecurityHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

/**
 * Trích xuất địa chỉ IP thực của người dùng qua CDN/Vercel Proxy
 */
export function getClientIp(req: VercelRequest): string {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    return ips.split(',')[0].trim();
  }
  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp) {
    return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Thuật toán Giới Hạn Tần Suất Truy Cập (IP Rate Limiting & Anti-DDoS Shield)
 * Trả về false nếu người dùng vượt quá số lượng request cho phép.
 */
export function checkRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  actionName: string,
  maxRequests = 10,
  windowMs = 60000
): boolean {
  const ip = getClientIp(req);
  const key = `${actionName}:${ip}`;
  const now = Date.now();

  const record = rateLimitMap.get(key);

  if (!record) {
    rateLimitMap.set(key, { count: 1, firstRequestTime: now });
    return true;
  }

  if (now - record.firstRequestTime > windowMs) {
    // Cửa sổ thời gian đã hết, reset bộ đếm
    rateLimitMap.set(key, { count: 1, firstRequestTime: now });
    return true;
  }

  if (record.count >= maxRequests) {
    const retryAfter = Math.ceil((windowMs - (now - record.firstRequestTime)) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({
      success: false,
      message: `🛑 Cảnh báo an ninh: Bạn đã thực hiện quá nhiều thao tác liên tiếp (${actionName}). Vui lòng chờ ${retryAfter} giây trước khi thử lại!`
    });
    return false;
  }

  record.count++;
  return true;
}
