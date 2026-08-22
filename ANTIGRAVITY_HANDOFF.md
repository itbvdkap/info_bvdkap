# Handoff cho Antigravity Code - info_bvdkap

## 1. Mục tiêu dự án

Public app `info_bvdkap` lên domain:

```text
info.benhvienanphu.vn
```

App hiện là hệ thống thông tin/phản ánh/báo cáo nội bộ cho Bệnh viện Đa khoa An Phú.

Mục tiêu kỹ thuật là đưa app lên mô hình giống `APP_BENHAN`:

- Source quản lý bằng GitHub.
- Frontend/API deploy bằng Vercel.
- Database chuyển từ SQLite local sang Supabase Postgres.
- Domain `info.benhvienanphu.vn` trỏ về Vercel.

Repo GitHub:

```text
https://github.com/itbvdkap/info_bvdkap
```

Thư mục local hiện tại:

```text
E:\HIS\api ksk\info_benhvienanphu_app
```

## 2. Trạng thái hiện tại

Repo local đã được khởi tạo Git và push lên GitHub.

Branch:

```text
main
```

Commit đã push:

```text
e359b1b Merge remote-tracking branch 'origin/main'
```

Đã thêm:

- `.gitignore`
- `README.md`
- `backend/.env.example`

Đã cố ý KHÔNG commit:

- `backend/.env`
- `backend/info_benhvienanphu.sqlite`
- `backend/node_modules/`
- `backend/dist/`
- `backend/uploads/`

Lý do: đây là file runtime, dữ liệu thật, secret hoặc output build.

## 3. Cấu trúc hiện tại

```text
info_benhvienanphu_app/
  backend/
    src/
      database/
      routes/
      services/
      server.ts
    package.json
    package-lock.json
    tsconfig.json
    test_verification.js
    .env.example
    .env                    # ignored
    info_benhvienanphu.sqlite # ignored
    dist/                   # ignored
    node_modules/           # ignored
    uploads/                # ignored
  frontend/
    public/
      index.html
      app.js
  README.md
  .gitignore
```

Backend hiện tại là Express, chạy bằng:

```powershell
cd backend
npm install
npm run build
npm start
```

Mặc định port:

```text
5000
```

Frontend hiện gọi API theo same-origin:

```text
/api/departments
/api/categories
/api/settings
/api/feedbacks
/api/auth/login
...
```

Điểm thuận lợi: khi chuyển sang Vercel, nếu giữ API cùng domain `/api/...` thì frontend gần như không cần sửa nhiều.

## 4. Kiến trúc đích mong muốn

Chuyển repo về dạng:

```text
info-benhvienanphu/
  api/
    auth/
    feedbacks/
    departments/
    categories/
    settings/
    export/
  public/
    index.html
    app.js
  supabase/
    migrations/
  package.json
  vercel.json
```

Trong đó:

```text
frontend/public/index.html -> public/index.html
frontend/public/app.js     -> public/app.js
```

Các route trong `backend/src/routes` sẽ được chuyển dần sang Vercel Serverless Functions trong thư mục `api/`.

Database SQLite sẽ được chuyển sang Supabase Postgres.

## 5. Các bảng cần migrate từ SQLite sang Supabase

Tạo schema riêng:

```sql
create schema if not exists info;
```

Các bảng cần kiểm tra trong SQLite và migrate:

```text
info.users
info.departments
info.categories
info.feedbacks
info.feedback_attachments
info.settings
```

Nếu app có upload file, chuyển file upload sang Supabase Storage:

```text
bucket: info-feedback-uploads
```

Không đưa file SQLite thật lên GitHub.

## 6. Thứ tự chuyển API

Làm theo thứ tự dễ kiểm thử:

1. `GET /api/departments`
2. `GET /api/categories`
3. `GET /api/settings`
4. `POST /api/feedbacks`
5. `GET /api/feedbacks/track/:code`
6. `POST /api/auth/login`
7. `GET /api/feedbacks/admin`
8. `PUT /api/feedbacks/:id/respond`
9. `GET /api/feedbacks/stats`
10. `GET /api/export/excel`

Không nên chuyển tất cả một lần. Sau mỗi nhóm API cần chạy thử frontend.

## 7. Vercel config gợi ý

Tạo `vercel.json`:

```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/((?!api/).*)",
      "destination": "/index.html"
    }
  ]
}
```

Tạo root `package.json` nếu chuyển API sang Vercel:

```json
{
  "name": "info-bvdkap",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vercel dev",
    "build": "echo \"static build\""
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.0.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@types/node": "^20.0.0"
  }
}
```

Phiên bản package có thể chỉnh theo lockfile thực tế.

## 8. Biến môi trường cần có trên Vercel

Không commit các biến này.

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

Nếu dùng Supabase public client ở frontend thì chỉ dùng publishable/anon key dạng public, không dùng service role.

## 9. Domain

Sau khi deploy Vercel, thêm domain:

```text
info.benhvienanphu.vn
```

DNS thông thường:

```text
CNAME info cname.vercel-dns.com
```

Nếu dùng Cloudflare, ban đầu nên để DNS Only trong lúc verify domain. Sau khi chạy ổn có thể bật proxy.

## 10. Quy tắc an toàn

- Không commit `.env`.
- Không commit SQLite database thật.
- Không commit `node_modules`.
- Không commit `dist`.
- Không commit `uploads`.
- Không hardcode Supabase service role key vào frontend.
- Không để admin API public nếu chưa có auth.
- Với Supabase, bật RLS nếu expose table qua Data API.
- Ưu tiên server-side API dùng service role, frontend chỉ gọi `/api/...`.

## 11. Việc cần làm ngay cho Antigravity

### M0 - Kiểm tra baseline

- Pull repo `https://github.com/itbvdkap/info_bvdkap`.
- Chạy:

```powershell
cd backend
npm install
npm run build
npm start
```

- Mở:

```text
http://localhost:5000
```

- Test:

```text
GET /api/health
GET /api/departments
GET /api/categories
GET /api/settings
```

### M1 - Chuẩn hóa cấu trúc deploy

- Tạo `public/`.
- Copy `frontend/public/index.html` vào `public/index.html`.
- Copy `frontend/public/app.js` vào `public/app.js`.
- Tạo `api/`.
- Tạo `supabase/migrations/`.
- Tạo root `package.json`.
- Tạo `vercel.json`.

### M2 - Supabase migration

- Đọc schema SQLite hiện tại.
- Tạo migration SQL trong `supabase/migrations/`.
- Tạo schema `info`.
- Tạo các bảng tương ứng.
- Chuẩn bị script import dữ liệu từ SQLite sang Supabase.

### M3 - Chuyển API public trước

Chuyển:

```text
GET /api/departments
GET /api/categories
GET /api/settings
```

Sau đó chạy `vercel dev` và kiểm tra frontend load dropdown/cấu hình.

### M4 - Chuyển form phản ánh

Chuyển:

```text
POST /api/feedbacks
GET /api/feedbacks/track/:code
```

Kiểm tra gửi phản ánh và tra cứu mã phản ánh.

### M5 - Chuyển admin

Chuyển:

```text
POST /api/auth/login
GET /api/feedbacks/admin
PUT /api/feedbacks/:id/respond
GET /api/feedbacks/stats
GET /api/export/excel
```

### M6 - Deploy Vercel + domain

- Deploy preview.
- Test full flow.
- Deploy production.
- Gắn domain `info.benhvienanphu.vn`.

## 12. Câu lệnh Git thường dùng

```powershell
git status
git pull
git add -- <file>
git commit -m "..."
git push
```

Không dùng `git add .` nếu chưa kiểm tra kỹ file nhạy cảm.

## 13. Kỳ vọng khi hoàn thành

- `info.benhvienanphu.vn` chạy trên Vercel.
- Frontend nằm trong `public/`.
- API nằm trong `api/`.
- Dữ liệu nằm trong Supabase Postgres.
- SQLite chỉ còn là nguồn migrate/tham khảo, không còn dùng runtime production.
- Repo GitHub không chứa secret hoặc dữ liệu runtime thật.
