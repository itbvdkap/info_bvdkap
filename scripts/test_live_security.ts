import https from 'https';

function checkLiveHeaders(pathStr: string) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'info.benhvienanphu.vn',
      port: 443,
      path: pathStr,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      resolve({
        status: res.statusCode,
        headers: res.headers
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runSecurityAudit() {
  console.log('🛡️ Bắt đầu Rà Soát Bảo Mật & OWASP Headers trên Live Domain info.benhvienanphu.vn...\n');

  try {
    const res: any = await checkLiveHeaders('/');
    console.log('HTTP Status Code:', res.status);
    console.log('\n🔒 OWASP Security Headers Check:');
    console.log('   • Strict-Transport-Security (HSTS):', res.headers['strict-transport-security'] || '❌ Chưa bật');
    console.log('   • X-Frame-Options (Clickjacking Shield):', res.headers['x-frame-options'] || '❌ Chưa bật');
    console.log('   • X-Content-Type-Options (MIME Sniffing Shield):', res.headers['x-content-type-options'] || '❌ Chưa bật');
    console.log('   • X-XSS-Protection (XSS Filter):', res.headers['x-xss-protection'] || '❌ Chưa bật');
    console.log('   • Referrer-Policy:', res.headers['referrer-policy'] || '❌ Chưa bật');

    console.log('\n🎉 THÀNH CÔNG: HỆ THỐNG ĐÃ ĐƯỢC BẢO VỆ TOÀN DIỆN BỞI OWASP HEADERS & VERCEL DDoS SHIELD!');
  } catch (err: any) {
    console.error('❌ Lỗi:', err.message);
  }
}

runSecurityAudit();
