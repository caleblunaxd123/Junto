import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './routes/auth.routes';
import gruposRoutes from './routes/grupos.routes';
import gastosRoutes from './routes/gastos.routes';
import pagosRoutes from './routes/pagos.routes';
import { errorHandler } from './middleware/errorHandler';
import { initFirebase } from './lib/firebase';
import { initRemindersJob } from './jobs/reminders.job';

const app = express();
const PORT = process.env.PORT || 3000;

// Security & logging
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
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
