import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!, {
  db: { schema: 'info' }
});

async function checkUsers() {
  console.log('🔍 Kiểm tra bảng info.users trên Supabase Postgres...\n');

  try {
    const { data: users, error } = await supabase.from('users').select('*');
    if (error) {
      console.error('❌ Lỗi query Supabase:', error);
      return;
    }

    console.log(`📦 Tìm thấy ${users?.length || 0} tài khoản trong info.users:`);
    console.dir(users, { depth: null });

    // If users is empty or missing admin, seed them right now!
    if (!users || users.length === 0) {
      console.log('\n⚠️ Bảng info.users đang trống. Đang tự động nạp tài khoản admin và ban-giam-doc vào Supabase...');
      
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('admin123', 10);

      const { data: inserted, error: insertErr } = await supabase.from('users').insert([
        { username: 'admin', password_hash: hash, full_name: 'Quản Trị Hệ Thống', role: 'admin' },
        { username: 'ban-giam-doc', password_hash: hash, full_name: 'Ban Giám Đốc Bệnh Viện', role: 'leader' }
      ]).select('*');

      if (insertErr) {
        console.error('❌ Lỗi nạp user:', insertErr);
      } else {
        console.log('✅ Đã nạp thành công các tài khoản vào Supabase Postgres:', inserted);
      }
    }
  } catch (err: any) {
    console.error('❌ Lỗi:', err?.message || err);
  }
}

checkUsers();
