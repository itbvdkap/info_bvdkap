# info_bvdkap

Ung dung thong tin/phan anh noi bo cho Benh vien Da khoa An Phu.

## Cau truc hien tai

- `frontend/public`: giao dien tinh.
- `backend/src`: Express API source.
- `backend/dist`: output build, khong commit.
- `backend/info_benhvienanphu.sqlite`: database local hien tai, khong commit.

## Chay local

```powershell
cd backend
npm install
npm run build
npm start
```

Mac dinh backend chay port `5000` neu khong set `PORT`.

## Huong deploy tiep theo

- GitHub luu source.
- Vercel host frontend/API sau khi chuyen API sang serverless hoac Next.js API routes.
- Supabase thay the SQLite bang Postgres.
