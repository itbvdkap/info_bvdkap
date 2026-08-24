import https from 'https';

function testLogin(host: string, username: string, pass: string) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ username, password: pass });
    const options = {
      hostname: host,
      port: 443,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('🧪 Bắt đầu kiểm thử đăng nhập tài khoản admin trên Cổng Live info.benhvienanphu.vn...\n');

  const domains = ['info.benhvienanphu.vn', 'info-bvdkap.vercel.app'];

  for (const domain of domains) {
    try {
      console.log(`🌐 Đang thử đăng nhập tới https://${domain}/api/auth/login ...`);
      const res: any = await testLogin(domain, 'admin', 'admin123');
      console.log(`   HTTP Status: ${res.status}`);
      if (res.data) {
        console.log('   Response Data:', JSON.stringify(res.data, null, 2));
      } else {
        console.log('   Raw Response:', res.raw.substring(0, 200));
      }
    } catch (err: any) {
      console.error(`❌ Lỗi kết nối tới ${domain}:`, err.message);
    }
    console.log('--------------------------------------------------');
  }
}

run();
