import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey); // Uses default 'public' schema

async function setupPublicSchema() {
  console.log('🚀 Khởi tạo và nạp dữ liệu vào schema public trên Supabase Postgres...\n');

  try {
    // 1. Check or Seed Users in public schema
    console.log('1. Kiểm tra tài khoản trong public.users...');
    const { data: existingUsers, error: userQueryErr } = await supabase.from('users').select('*');

    if (userQueryErr && userQueryErr.code === '42P01') {
      console.log('⚠️ Bảng public.users chưa tồn tại. Vui lòng tạo bảng trên Supabase SQL Editor.');
    } else {
      console.log(`   Tìm thấy ${existingUsers?.length || 0} tài khoản hiện có.`);
    }

    const hash = await bcrypt.hash('admin123', 10);

    const { data: upsertedUsers, error: upsertErr } = await supabase.from('users').upsert([
      { username: 'admin', password_hash: hash, full_name: 'Quản Trị Viên Hệ Thống', role: 'admin' },
      { username: 'ban-giam-doc', password_hash: hash, full_name: 'Ban Giám Đốc Bệnh Viện', role: 'leader' }
    ], { onConflict: 'username' }).select('*');

    if (upsertErr) {
      console.error('❌ Lỗi upsert user:', upsertErr);
    } else {
      console.log('   ✅ Đã nạp/cập nhật thành công tài khoản admin & ban-giam-doc:', upsertedUsers);
    }

  } catch (err: any) {
    console.error('❌ Lỗi:', err?.message || err);
  }
}

setupPublicSchema();
