import https from 'https';

async function testLoginPayload() {
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

  console.log('Login Payload:', JSON.stringify(loginRes, null, 2));
}

testLoginPayload();
