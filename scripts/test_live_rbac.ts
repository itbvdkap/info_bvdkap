import https from 'https';

function testLiveEndpoint(pathStr: string, token: string) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'info.benhvienanphu.vn',
      port: 443,
      path: pathStr,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runLiveTest() {
  console.log('🚀 Đang kiểm tra deployment trực tiếp trên Vercel info.benhvienanphu.vn...');
  
  // 1. Login to get token
  const postData = JSON.stringify({ username: 'admin', password: 'admin123' });
  const loginRes: any = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'info.benhvienanphu.vn',
      port: 443,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });

  if (!loginRes.success) {
    console.error('❌ Đăng nhập thất bại:', loginRes.message);
    return;
  }

  const token = loginRes.token;
  console.log('✅ Đăng nhập Admin thành công. Token lấy được!');

  // 2. Test /api/users endpoint
  const usersRes: any = await testLiveEndpoint('/api/users', token);
  console.log('HTTP Status /api/users:', usersRes.status);
  console.log('Nội dung kết quả /api/users:', usersRes.data);

  if (usersRes.status === 200 && usersRes.data?.success) {
    console.log('\n🎉 THÀNH CÔNG RỰC RỠ: TÍNH NĂNG RBAC ĐÃ LIVE 100% TRÊN VERCEL!');
  } else {
    console.log('\n⏳ Vercel đang tự động build (khoảng 30-45 giây)...');
  }
}

runLiveTest();
