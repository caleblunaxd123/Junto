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
import { emailProvider } from './lib/email';
import { authMiddleware } from './middleware/auth';
import { getActivity } from './services/activity.service';
import { errorHandler } from './middleware/errorHandler';
import { initPushReceiptsJob } from './jobs/pushReceipts.job';
import { initRemindersJob } from './jobs/reminders.job';

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.FRONTEND_URL || '').split(',').map((value) => value.trim()).filter(Boolean);
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /super_secret|cambia_esto|local-qa|example/i.test(process.env.JWT_SECRET)) throw new Error('Configure a strong production JWT_SECRET before starting JUNTO.');
  if (!allowedOrigins.length || allowedOrigins.some((origin) => !origin.startsWith('https://') || origin.includes('*'))) throw new Error('Configure explicit HTTPS FRONTEND_URL origins for production.');
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
app.get('/api/actividad', authMiddleware, async (req, res, next) => {
  try { res.json(await getActivity(req.user!.userId, typeof req.query.grupoId === 'string' ? req.query.grupoId : undefined)); }
  catch (error) { next(error); }
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV, email: emailProvider() ?? 'sin configurar', timestamp: new Date().toISOString() });
});

// Public web: invitation landing, App Links, privacy and account deletion.
app.use(publicRoutes);

// Global error handler
app.use(errorHandler);

// Initialize services
initPushReceiptsJob();
initRemindersJob();

app.listen(PORT, () => {
  console.info(`[Server] Junto API running on port ${PORT} — ${process.env.NODE_ENV}`);
});

export default app;
