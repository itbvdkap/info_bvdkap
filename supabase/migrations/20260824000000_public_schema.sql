-- Supabase Postgres Migration Script for Default Schema 'public'
-- 1. Table: public.users
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'leader',
  department_id INT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table: public.departments
CREATE TABLE IF NOT EXISTS public.departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  active INT DEFAULT 1
);

-- 3. Table: public.categories
CREATE TABLE IF NOT EXISTS public.categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  icon VARCHAR(100),
  description TEXT
);

-- 4. Table: public.feedbacks
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id SERIAL PRIMARY KEY,
  tracking_code VARCHAR(100) UNIQUE NOT NULL,
  is_anonymous INT DEFAULT 1,
  sender_name VARCHAR(255),
  sender_phone VARCHAR(50),
  sender_email VARCHAR(255),
  department_id INT NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  category_id INT NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  priority VARCHAR(20) DEFAULT 'normal',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  attachment_url TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  response_content TEXT,
  responded_by INT REFERENCES public.users(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  client_ip VARCHAR(100),
  user_agent TEXT,
  device_fingerprint TEXT
);

-- 5. Table: public.system_settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  description TEXT
);

-- Seed Default Departments
INSERT INTO public.departments (name, code) VALUES
  ('Ban Giám Đốc', 'BGD'),
  ('Khoa Khám Bệnh', 'KKB'),
  ('Khoa Cấp Cứu', 'KCC'),
  ('Khoa Dược', 'KD'),
  ('Khoa Xét Nghiệm', 'KXN'),
  ('Khoa Chẩn Đoán Hình Ảnh', 'KCDHA'),
  ('Khoa Phẫu Thuật - Gây Mê Hồi Sức', 'KPT'),
  ('Khoa Nội Tổng Hợp', 'KNT'),
  ('Khoa Ngoại Tổng Hợp', 'KNG'),
  ('Khoa Phụ Sản', 'KPS'),
  ('Khoa Nhi', 'KNH'),
  ('Phòng Kế Hoạch Tổng Hợp', 'PKHTH'),
  ('Phòng Tổ Chức Cán Bộ', 'PTCCB'),
  ('Phòng Hành Chính Quản Trị', 'PHCQT'),
  ('Phòng Tài Chính Kế Toán', 'PTCKT'),
  ('Phòng Điều Dưỡng', 'PDD'),
  ('Phòng Quản Lý Chất Lượng', 'PQLCL')
ON CONFLICT (code) DO NOTHING;

-- Seed Default Categories
INSERT INTO public.categories (name, code, icon, description) VALUES
  ('💡 Đề xuất / Sáng kiến cải tiến', 'PROPOSAL', 'lightbulb', 'Đề xuất cải tiến quy trình, công nghệ, trải nghiệm bệnh nhân & nhân viên'),
  ('⚠️ Phản ánh sự cố / Cơ sở vật chất', 'INCIDENT', 'exclamation-triangle', 'Báo cáo sự cố máy móc, vật tư y tế, cơ sở vật chất hỏng hóc'),
  ('🤝 Góp ý quy trình / Thái độ công việc', 'FEEDBACK', 'comments', 'Góp ý quy trình phối hợp giữa các khoa phòng, thái độ ứng xử'),
  ('🔐 Báo cáo an toàn / Vi phạm / Khác', 'VIOLATION', 'shield-alt', 'Phản ánh vi phạm quy định, an toàn lao động, sự cố bảo mật')
ON CONFLICT (code) DO NOTHING;

-- Seed Default Users (Password: admin123 -> bcrypt hash $2a$10$7793d...)
INSERT INTO public.users (username, password_hash, full_name, role) VALUES
  ('admin', '$2a$10$k1wP2Z0QfG8vP4Q7u7.2i.Lz4j3E8zQ5W.L5h2e.H8s5Z8j7Q5W.L', 'Quản Trị Viên Hệ Thống', 'admin'),
  ('ban-giam-doc', '$2a$10$k1wP2Z0QfG8vP4Q7u7.2i.Lz4j3E8zQ5W.L5h2e.H8s5Z8j7Q5W.L', 'Ban Giám Đốc Bệnh Viện', 'leader')
ON CONFLICT (username) DO NOTHING;

-- Seed Default Settings
INSERT INTO public.system_settings (key, value, description) VALUES
  ('telegram_bot_token', '', 'Token của Telegram Bot'),
  ('telegram_chat_id', '', 'Chat ID nhận thông báo Telegram'),
  ('email_enabled', 'false', 'Bật gửi email thông báo'),
  ('zalo_enabled', 'false', 'Bật gửi Zalo webhook notification'),
  ('hospital_name', 'Bệnh viện An Phú', 'Tên cơ sở y tế')
ON CONFLICT (key) DO NOTHING;
