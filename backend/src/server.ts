import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { initDatabase } from './database/db';
import { authRouter } from './routes/auth.router';
import { departmentRouter } from './routes/department.router';
import { categoryRouter } from './routes/category.router';
import { feedbackRouter } from './routes/feedback.router';
import { settingsRouter } from './routes/settings.router';
import { exportRouter } from './routes/export.router';

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Parsing Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for Tailwind CDN & Chart.js in SPA
}));
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static uploads directory
const uploadsPath = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// Static frontend directory
const frontendPath = path.resolve(__dirname, '../../frontend/public');
app.use(express.static(frontendPath));

// REST API Routers
app.use('/api/auth', authRouter);
app.use('/api/departments', departmentRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/feedbacks', feedbackRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/export', exportRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    system: 'info.benhvienanphu.vn API Engine',
    timestamp: new Date().toISOString()
  });
});

// Fallback to index.html for Single Page Application (SPA)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API Endpoint không tồn tại!' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start Server & Init Database
app.listen(PORT, async () => {
  console.log(`🚀 [info.benhvienanphu.vn] Backend Server đang chạy tại: http://localhost:${PORT}`);
  try {
    await initDatabase();
    console.log('✨ Khởi tạo CSDL SQLite hoàn tất!');
  } catch (err) {
    console.error('❌ Lỗi khởi tạo CSDL:', err);
  }
});
