import sqlite3 from 'sqlite3';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const dbPath = path.resolve(__dirname, '../backend/info_benhvienanphu.sqlite');
const db = new sqlite3.Database(dbPath);

function querySql<T = any>(sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

async function migrate() {
  console.log('🚀 Bắt đầu chuyển đổi dữ liệu từ SQLite sang Supabase Postgres...\n');

  try {
    // 1. Migrate Users
    const users = await querySql('SELECT * FROM users');
    if (users.length > 0) {
      console.log(`📦 Đang chuyển ${users.length} người dùng...`);
      for (const u of users) {
        await supabase.from('users').upsert({
          username: u.username,
          password_hash: u.password_hash,
          full_name: u.full_name,
          role: u.role,
          department_id: u.department_id,
          created_at: u.created_at
        }, { onConflict: 'username' });
      }
    }

    // 2. Migrate Departments
    const depts = await querySql('SELECT * FROM departments');
    if (depts.length > 0) {
      console.log(`📦 Đang chuyển ${depts.length} khoa/phòng...`);
      for (const d of depts) {
        await supabase.from('departments').upsert({
          name: d.name,
          code: d.code,
          active: d.active
        }, { onConflict: 'code' });
      }
    }

    // 3. Migrate Categories
    const cats = await querySql('SELECT * FROM categories');
    if (cats.length > 0) {
      console.log(`📦 Đang chuyển ${cats.length} phân loại báo cáo...`);
      for (const c of cats) {
        await supabase.from('categories').upsert({
          name: c.name,
          code: c.code,
          icon: c.icon,
          description: c.description
        }, { onConflict: 'code' });
      }
    }

    // 4. Migrate Feedbacks
    const feedbacks = await querySql('SELECT * FROM feedbacks');
    if (feedbacks.length > 0) {
      console.log(`📦 Đang chuyển ${feedbacks.length} ý kiến báo cáo...`);
      for (const f of feedbacks) {
        await supabase.from('feedbacks').upsert({
          tracking_code: f.tracking_code,
          is_anonymous: f.is_anonymous,
          sender_name: f.sender_name,
          sender_phone: f.sender_phone,
          sender_email: f.sender_email,
          department_id: f.department_id,
          category_id: f.category_id,
          priority: f.priority,
          title: f.title,
          content: f.content,
          attachment_url: f.attachment_url,
          status: f.status,
          response_content: f.response_content,
          responded_by: f.responded_by,
          responded_at: f.responded_at,
          created_at: f.created_at,
          client_ip: f.client_ip,
          user_agent: f.user_agent,
          device_fingerprint: f.device_fingerprint
        }, { onConflict: 'tracking_code' });
      }
    }

    // 5. Migrate Settings
    const settings = await querySql('SELECT * FROM system_settings');
    if (settings.length > 0) {
      console.log(`📦 Đang chuyển ${settings.length} cấu hình hệ thống...`);
      for (const s of settings) {
        await supabase.from('system_settings').upsert({
          key: s.key,
          value: s.value,
          description: s.description
        }, { onConflict: 'key' });
      }
    }

    console.log('\n🎉 CHUYỂN ĐỔI DỮ LIỆU SANG SUPABASE POSTGRES THÀNH CÔNG!');
  } catch (err: any) {
    console.error('❌ Lỗi khi migrate dữ liệu:', err?.message || err);
  } finally {
    db.close();
  }
}

migrate();
