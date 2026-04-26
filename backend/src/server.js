import { env } from './utils/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes.js';
import repoRoutes from './routes/repo.routes.js';
import pipelineRoutes from './routes/pipeline.routes.js';
import analyzerRoutes from './routes/analyzer.routes.js';
import securityRoutes from './routes/security.routes.js';
import remediationRoutes from './routes/remediation.routes.js';
import { bootstrapSecurity } from './config/bootstrap.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = env.PORT;

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token']
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      formAction: ["'self'"]
    }
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginResourcePolicy: false
}));

app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/repos', repoRoutes);
app.use('/api/pipelines', pipelineRoutes);
app.use('/api/analyzer', analyzerRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/remediation', remediationRoutes);

app.use((err, req, res, next) => {
  logger.error({ context: { method: req.method, path: req.originalUrl }, err }, 'Unhandled request error'); // FIX: replace console logging with structured logger
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

async function startServer() {
  await bootstrapSecurity();

  app.listen(PORT, () => {
    logger.info({ context: { port: PORT, nodeEnv: env.NODE_ENV } }, 'Backend server running');
  });
}

startServer().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start backend server');
  process.exit(1);
});
