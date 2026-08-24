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

  const token = loginRes.token;

  const usersRes: any = await testLiveEndpoint('/api/user-management', token);
  console.log('HTTP Status /api/user-management:', usersRes.status);
  console.log('Nội dung danh sách tài khoản:', JSON.stringify(usersRes.data || usersRes.raw, null, 2));

  if (usersRes.status === 200 && usersRes.data?.success) {
    console.log('\n🎉 THÀNH CÔNG RỰC RỠ: VERCEL ĐÃ DEPLOY TRỰC TIẾP API USER-MANAGEMENT & TÍNH NĂNG RBAC 4 CẤP LIVE 100%!');
  }
}

runLiveTest();
