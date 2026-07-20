import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import authRoutes from './routes/auth';
import eventRoutes from './routes/events';
import photoRoutes from './routes/photos';
import searchRoutes from './routes/search';

dotenv.config();

// ─── Security: Refuse to start without a proper JWT secret ───────────
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret === 'fallback-secret') {
  console.error('\n╔══════════════════════════════════════════════════════╗');
  console.error('║  FATAL: JWT_SECRET is missing or insecure.           ║');
  console.error('║  Set a strong JWT_SECRET in your .env file.          ║');
  console.error('╚══════════════════════════════════════════════════════╝\n');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security headers ───────────────────────────────────────────────
app.disable('x-powered-by'); // Hide "Express" from response headers

const uploadsDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176','https://qr-photo-scan.vercel.app'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/search', searchRoutes);

app.get('/api/health', (_req, res) => {
  // Simple health check endpoint
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
