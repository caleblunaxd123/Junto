import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './routes/auth.routes';
import gruposRoutes from './routes/grupos.routes';
import gastosRoutes from './routes/gastos.routes';
import pagosRoutes from './routes/pagos.routes';
import aiRoutes from './routes/ai.routes';
import cuentasRoutes from './routes/cuentas.routes';
import { authMiddleware } from './middleware/auth';
import { getActivity } from './services/activity.service';
import { errorHandler } from './middleware/errorHandler';
import { initFirebase } from './lib/firebase';
import { initRemindersJob } from './jobs/reminders.job';

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.FRONTEND_URL || '').split(',').map((value) => value.trim()).filter(Boolean);
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /super_secret|cambia_esto|local-qa|example/i.test(process.env.JWT_SECRET)) throw new Error('Configure a strong production JWT_SECRET before starting JUNTO.');
  if (!allowedOrigins.length || allowedOrigins.some((origin) => !origin.startsWith('https://') || origin.includes('*'))) throw new Error('Configure explicit HTTPS FRONTEND_URL origins for production.');
}

// Security & logging
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && !allowedOrigins.length)),
    // Authentication uses bearer tokens, not cross-site cookies.
    credentials: false,
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing — raw for Culqi webhook, json for everything else
app.use('/api/pagos/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/grupos', gruposRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/ia', aiRoutes);
app.use('/api/cuentas-rapidas', cuentasRoutes);
app.get('/api/actividad', authMiddleware, async (req, res, next) => {
  try { res.json(await getActivity(req.user!.userId, typeof req.query.grupoId === 'string' ? req.query.grupoId : undefined)); }
  catch (error) { next(error); }
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV, timestamp: new Date().toISOString() });
});

// Global error handler
app.use(errorHandler);

// Initialize services
initFirebase();
initRemindersJob();

app.listen(PORT, () => {
  console.info(`[Server] Junto API running on port ${PORT} — ${process.env.NODE_ENV}`);
});

export default app;
