import 'dotenv/config';
import { initMonitoring } from './lib/monitoring';
initMonitoring();
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
import publicRoutes from './routes/public.routes';
import compartirRoutes from './routes/compartir.routes';
import comentariosRoutes from './routes/comentarios.routes';
import invitacionesRoutes from './routes/invitaciones.routes';
import notificacionesRoutes from './routes/notificaciones.routes';
import { emailProvider } from './lib/email';
import { authMiddleware } from './middleware/auth';
import { getActivity } from './services/activity.service';
import { getProfilePhoto } from './services/profilePhoto.service';
import { z } from 'zod';
import { errorHandler } from './middleware/errorHandler';
import { initPushReceiptsJob } from './jobs/pushReceipts.job';
import { initRemindersJob } from './jobs/reminders.job';
import { prisma } from './lib/prisma';
import { serverConfig } from './domain/serverConfig';
import cron from 'node-cron';
import { setTimeout as nodeTimeout } from 'node:timers';

const app = express();
const PORT = process.env.PORT || 3000;
const { allowedOrigins } = serverConfig(process.env);
if (process.env.NODE_ENV === 'production') {
  // Without e-mail nobody can verify an account; keep serving existing users but make it loud.
  if (!emailProvider()) console.error('[Email] Sin proveedor de correo: el registro y la recuperación de contraseña no funcionarán. Configura RESEND_API_KEY o SMTP_*.');
}

// Security & logging
// Render/railway terminate TLS in a proxy; without this every client shares one rate-limit bucket.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && !allowedOrigins.length)),
    // Authentication uses bearer tokens, not cross-site cookies.
    credentials: false,
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing. Only the two image readers take large bodies (a 3–4 MB photo in base64); every
// other route, including sign-in, stays small so nobody can make the API parse megabytes for free.
app.use(['/api/pagos/comprobantes', '/api/cuentas-rapidas/leer-boleta'], express.json({ limit: '6mb' }));
app.use('/api/auth/me/foto', express.json({ limit: '1600kb' }));
app.use(express.json({ limit: '256kb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/grupos', gruposRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/ia', aiRoutes);
app.use('/api/cuentas-rapidas', cuentasRoutes);
app.use('/api/compartir', compartirRoutes);
app.use('/api/comentarios', comentariosRoutes);
app.use('/api/invitaciones', invitacionesRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.get('/api/actividad', authMiddleware, async (req, res, next) => {
  try { res.json(await getActivity(req.user!.userId, typeof req.query.grupoId === 'string' ? req.query.grupoId : undefined)); }
  catch (error) { next(error); }
});

// Profile photos are public by random id (like a Google photo URL) and never change: a new upload is a new id.
app.get('/api/fotos/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().safeParse(req.params.id);
    const photo = id.success ? await getProfilePhoto(id.data) : null;
    if (!photo || !photo.usuario.activo) { res.status(404).end(); return; }
    res.set({ 'Content-Type': photo.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'Cross-Origin-Resource-Policy': 'cross-origin', 'X-Content-Type-Options': 'nosniff' });
    res.send(Buffer.from(photo.datos));
  } catch (error) { next(error); }
});

// Health check
app.get('/health', (_req, res) => {
  // Local harnesses must never mistake another running API for their own test instance.
  if (process.env.NODE_ENV === 'test' && process.env.JUNTO_QA_INSTANCE) res.setHeader('X-Junto-QA-Instance', process.env.JUNTO_QA_INSTANCE);
  res.json({ status: 'ok', env: process.env.NODE_ENV, email: emailProvider() ?? 'sin configurar', timestamp: new Date().toISOString() });
});

// Liveness must not claim the API is ready when PostgreSQL is unreachable.
// Return no connection details or secrets on this public probe.
app.get('/ready', async (_req, res) => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Database probe timeout')), 3000); }),
    ]);
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not_ready' });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
});

// Public web: invitation landing, App Links, privacy and account deletion.
app.use(publicRoutes);

// Global error handler
app.use(errorHandler);

// Initialize services
initPushReceiptsJob();
initRemindersJob();

const server = app.listen(PORT, () => {
  console.info(`[Server] Junto API running on port ${PORT} — ${process.env.NODE_ENV}`);
});

// Let in-flight requests finish during a container replacement; bound the wait so rollout can finish.
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  for (const task of cron.getTasks().values()) void task.stop();
  const deadline = nodeTimeout(() => process.exit(1), 10_000);
  deadline.unref();
  server.close(() => {
    void prisma.$disconnect().then(() => process.exit(0), () => process.exit(1));
  });
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

export default app;
