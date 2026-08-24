import https from 'https';

function testExcelDownload(token: string) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'info.benhvienanphu.vn',
      port: 443,
      path: `/api/export/excel?token=${encodeURIComponent(token)}`,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let dataLength = 0;
      res.on('data', chunk => dataLength += chunk.length);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          contentType: res.headers['content-type'],
          contentDisposition: res.headers['content-disposition'],
          size: dataLength
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('🧪 Bắt đầu kiểm thử tải Báo Cáo Excel trên Cổng Live info.benhvienanphu.vn...\n');
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsImZ1bGxfbmFtZSI6IlF14bqjbiBUcuG7iyBI4buHIFRo4buRbmciLCJyb2xlIjoiYWRtaW4iLCJkZXBhcnRtZW50X2lkIjpudWxsLCJpYXQiOjE3ODc1NTgyODksImV4cCI6MTc4ODE2MzA4OX0.QsWZc5Og3eMnpnQwIvylyOAMF64TriYZombHUneNqBw';

  const res: any = await testExcelDownload(token);
  console.log('   HTTP Status:', res.status);
  console.log('   Content-Type:', res.contentType);
  console.log('   Content-Disposition:', res.contentDisposition);
  console.log('   Dung lượng file Excel tải về:', res.size, 'bytes');

  if (res.status === 200 && res.contentType.includes('spreadsheetml')) {
    console.log('\n🎉 THÀNH CÔNG: XUẤT FILE BÁO CÁO EXCEL TRỰC TIẾP HOẠT ĐỘNG HOÀN HẢO!');
  }
}

run();
