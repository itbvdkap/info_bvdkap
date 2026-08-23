import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStorageUpload() {
  console.log('🧪 Bắt đầu kiểm thử Supabase Storage Bucket info-attachments...\n');

  try {
    // 1. Check or create bucket 'info-attachments'
    console.log('📦 1. Khởi tạo/Kiểm tra Bucket info-attachments...');
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === 'info-attachments');

    if (!exists) {
      const { error: createErr } = await supabase.storage.createBucket('info-attachments', {
        public: true,
        fileSizeLimit: 10485760
      });
      if (createErr) console.log('   Notice createBucket:', createErr.message);
      else console.log('   ✅ Đã tạo Bucket info-attachments (Public)');
    } else {
      console.log('   ✅ Bucket info-attachments đã sẵn sàng');
    }

    // 2. Upload test file
    console.log('\n📤 2. Tải tệp mẫu lên Supabase Storage CDN...');
    const dummyBuffer = Buffer.from('Bệnh viện An Phú - File đính kèm kiểm thử Supabase Storage CDN', 'utf8');
    const testFileName = `test_${Date.now()}.txt`;

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('info-attachments')
      .upload(testFileName, dummyBuffer, {
        contentType: 'text/plain',
        upsert: true
      });

    if (uploadErr) {
      throw uploadErr;
    }

    console.log('   ✅ Đã tải tệp lên thành công! Path:', uploadData.path);

    // 3. Get Public CDN URL
    console.log('\n🌐 3. Lấy URL Cloud CDN công khai:');
    const { data: urlData } = supabase.storage
      .from('info-attachments')
      .getPublicUrl(testFileName);

    console.log('   👉 Public CDN URL:', urlData.publicUrl);

    console.log('\n🎉 THÀNH CÔNG: HẠNG MỤC SUPABASE STORAGE BUCKET HOÀN THÀNH 100%!');
  } catch (err: any) {
    console.error('❌ Lỗi kiểm thử Storage:', err?.message || err);
  }
}

testStorageUpload();
