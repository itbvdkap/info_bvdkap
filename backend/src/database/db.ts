import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const dbPath = path.resolve(__dirname, '../../info_benhvienanphu.sqlite');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Lỗi kết nối CSDL SQLite:', err.message);
  } else {
    console.log(`✅ Kết nối CSDL SQLite thành công: ${dbPath}`);
  }
});

// Helper run SQL async
export function runSql(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// Helper query get all rows async
export function querySql<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

// Helper query get single row async
export function getSql<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

export async function initDatabase() {
  db.serialize(async () => {
    // 1. Table users
    await runSql(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'leader',
        department_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Table departments
    await runSql(`
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        active INTEGER DEFAULT 1
      )
    `);

    // 3. Table categories
    await runSql(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        icon TEXT,
        description TEXT
      )
    `);

    // 4. Table feedbacks
    await runSql(`
      CREATE TABLE IF NOT EXISTS feedbacks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tracking_code TEXT UNIQUE NOT NULL,
        is_anonymous INTEGER DEFAULT 1,
        sender_name TEXT,
        sender_phone TEXT,
        sender_email TEXT,
        department_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        priority TEXT DEFAULT 'normal',
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        attachment_url TEXT,
        status TEXT DEFAULT 'pending',
        response_content TEXT,
        responded_by INTEGER,
        responded_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        client_ip TEXT,
        user_agent TEXT,
        device_fingerprint TEXT,
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )
    `);

    // Auto-migration for audit columns if database already exists
    try { await runSql('ALTER TABLE feedbacks ADD COLUMN client_ip TEXT'); } catch (e) {}
    try { await runSql('ALTER TABLE feedbacks ADD COLUMN user_agent TEXT'); } catch (e) {}
    try { await runSql('ALTER TABLE feedbacks ADD COLUMN device_fingerprint TEXT'); } catch (e) {}

    // 5. Table system_settings
    await runSql(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        description TEXT
      )
    `);

    // Seed default departments if empty
    const deptCount = await getSql<{ count: number }>('SELECT COUNT(*) as count FROM departments');
    if (deptCount && deptCount.count === 0) {
      const defaultDepts = [
        { name: 'Ban Giám Đốc', code: 'BGD' },
        { name: 'Khoa Khám Bệnh', code: 'KKB' },
        { name: 'Khoa Cấp Cứu', code: 'KCC' },
        { name: 'Khoa Dược', code: 'KD' },
        { name: 'Khoa Xét Nghiệm', code: 'KXN' },
        { name: 'Khoa Chẩn Đoán Hình Ảnh', code: 'KCDHA' },
        { name: 'Khoa Phẫu Thuật - Gây Mê Hồi Sức', code: 'KPT' },
        { name: 'Khoa Nội Tổng Hợp', code: 'KNT' },
        { name: 'Khoa Ngoại Tổng Hợp', code: 'KNG' },
        { name: 'Khoa Phụ Sản', code: 'KPS' },
        { name: 'Khoa Nhi', code: 'KNH' },
        { name: 'Phòng Kế Hoạch Tổng Hợp', code: 'PKHTH' },
        { name: 'Phòng Tổ Chức Cán Bộ', code: 'PTCCB' },
        { name: 'Phòng Hành Chính Quản Trị', code: 'PHCQT' },
        { name: 'Phòng Tài Chính Kế Toán', code: 'PTCKT' },
        { name: 'Phòng Điều Dưỡng', code: 'PDD' },
        { name: 'Phòng Quản Lý Chất Lượng', code: 'PQLCL' }
      ];
      for (const d of defaultDepts) {
        await runSql('INSERT INTO departments (name, code) VALUES (?, ?)', [d.name, d.code]);
      }
      console.log('✅ Đã khởi tạo 17 Khoa/Phòng ban mặc định.');
    }

    // Seed default categories if empty
    const catCount = await getSql<{ count: number }>('SELECT COUNT(*) as count FROM categories');
    if (catCount && catCount.count === 0) {
      const defaultCats = [
        { name: '💡 Đề xuất / Sáng kiến cải tiến', code: 'PROPOSAL', icon: 'lightbulb', description: 'Đề xuất cải tiến quy trình, công nghệ, trải nghiệm bệnh nhân & nhân viên' },
        { name: '⚠️ Phản ánh sự cố / Cơ sở vật chất', code: 'INCIDENT', icon: 'exclamation-triangle', description: 'Báo cáo sự cố máy móc, vật tư y tế, cơ sở vật chất hỏng hóc' },
        { name: '🤝 Góp ý quy trình / Thái độ công việc', code: 'FEEDBACK', icon: 'comments', description: 'Góp ý quy trình phối hợp giữa các khoa phòng, thái độ ứng xử' },
        { name: '🔐 Báo cáo an toàn / Vi phạm / Khác', code: 'VIOLATION', icon: 'shield-alt', description: 'Phản ánh vi phạm quy định, an toàn lao động, sự cố bảo mật' }
      ];
      for (const c of defaultCats) {
        await runSql('INSERT INTO categories (name, code, icon, description) VALUES (?, ?, ?, ?)', [c.name, c.code, c.icon, c.description]);
      }
      console.log('✅ Đã khởi tạo 4 Loại phân mục báo cáo mặc định.');
    }

    // Seed default users if empty
    const userCount = await getSql<{ count: number }>('SELECT COUNT(*) as count FROM users');
    if (userCount && userCount.count === 0) {
      const adminPass = await bcrypt.hash('admin123', 10);
      await runSql(
        'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
        ['admin', adminPass, 'Quản Trị Hệ Thống', 'admin']
      );
      await runSql(
        'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
        ['ban-giam-doc', adminPass, 'Ban Giám Đốc Bệnh Viện', 'leader']
      );
      console.log('✅ Đã tạo tài khoản mặc định: admin / admin123 & ban-giam-doc / admin123');
    }

    // Seed default settings if empty
    const settingsCount = await getSql<{ count: number }>('SELECT COUNT(*) as count FROM system_settings');
    if (settingsCount && settingsCount.count === 0) {
      await runSql('INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)', [
        'telegram_bot_token', process.env.TELEGRAM_BOT_TOKEN || '', 'Token của Telegram Bot'
      ]);
      await runSql('INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)', [
        'telegram_chat_id', process.env.TELEGRAM_CHAT_ID || '', 'Chat ID nhận thông báo Telegram'
      ]);
      await runSql('INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)', [
        'hospital_name', 'Bệnh viện An Phú', 'Tên cơ sở y tế'
      ]);
      await runSql('INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)', [
        'portal_title', 'info.benhvienanphu.vn - Trang Ý Kiến & Báo Cáo', 'Tiêu đề Cổng thông tin'
      ]);
    }
  });
}
