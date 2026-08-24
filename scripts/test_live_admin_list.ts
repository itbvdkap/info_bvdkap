import https from 'https';

function getAdminFeedbacks(token: string) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'info.benhvienanphu.vn',
      port: 443,
      path: '/api/feedbacks/admin',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
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
    req.end();
  });
}

async function run() {
  console.log('🧪 Bắt đầu kiểm thử tải danh sách feedbacks admin trên Cổng Live...\n');
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsImZ1bGxfbmFtZSI6IlF14bqjbiBUcuG7iyBI4buHIFRo4buRbmciLCJyb2xlIjoiYWRtaW4iLCJkZXBhcnRtZW50X2lkIjpudWxsLCJpYXQiOjE3ODc1NTgyODksImV4cCI6MTc4ODE2MzA4OX0.QsWZc5Og3eMnpnQwIvylyOAMF64TriYZombHUneNqBw';
  
  const res: any = await getAdminFeedbacks(token);
  console.log(`HTTP Status: ${res.status}`);
  console.log(`Số lượng feedbacks trả về: ${res.data?.data?.length || 0}`);
  if (res.data?.data?.length > 0) {
    console.log('Mẫu item 1:', JSON.stringify(res.data.data[0], null, 2));
  }
}

run();
