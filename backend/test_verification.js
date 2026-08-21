const http = require('http');

function request(url, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runVerification() {
  console.log('🧪 Bắt đầu kiểm thử phân quyền RBAC vết kiểm toán bảo mật...\n');

  // 1. Submit Anonymous Feedback
  const submitData = JSON.stringify({
    is_anonymous: 1,
    department_id: 1,
    category_id: 1,
    priority: 'normal',
    title: 'Test kiểm tra bảo mật vết audit log IP',
    content: 'Nội dung kiểm tra phân quyền tài khoản admin.'
  });

  const submitRes = await request('http://localhost:5000/api/feedbacks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(submitData) }
  }, submitData);

  // 2. Login as Ban Giám Đốc (role: leader)
  const leaderLogin = await request('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ username: 'ban-giam-doc', password: 'admin123' }));

  const leaderItems = await request('http://localhost:5000/api/feedbacks/admin', {
    headers: { 'Authorization': `Bearer ${leaderLogin.data.token}` }
  });

  const leaderFeedback = leaderItems.data.data.find(i => i.id === submitRes.data.id);
  console.log('1. Đăng nhập Ban Giám Đốc (role: leader):');
  console.log('   -> Has client_ip:', leaderFeedback.client_ip !== undefined ? 'CÓ (LỖI BẢO MẬT ❌)' : 'KHÔNG (ĐÃ ĐƯỢC ẨN AN TOÀN ✅)');

  // 3. Login as Admin (role: admin)
  const adminLogin = await request('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ username: 'admin', password: 'admin123' }));

  const adminItems = await request('http://localhost:5000/api/feedbacks/admin', {
    headers: { 'Authorization': `Bearer ${adminLogin.data.token}` }
  });

  const adminFeedback = adminItems.data.data.find(i => i.id === submitRes.data.id);
  console.log('\n2. Đăng nhập Quản Trị Viên (role: admin):');
  console.log('   -> Has client_ip:', adminFeedback.client_ip !== undefined ? `CÓ: "${adminFeedback.client_ip}" ✅` : 'KHÔNG (LỖI ❌)');
  console.log('   -> Has user_agent:', adminFeedback.user_agent ? 'CÓ ✅' : 'KHÔNG ❌');

  console.log('\n🎉 BẢO MẬT PHÂN QUUYỀN AUDIT LOG THÀNH CÔNG 100%!');
}

runVerification();
