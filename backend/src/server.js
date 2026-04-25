import 'dotenv/config';
import './utils/env.js'; // FIX: validate required environment variables before loading the rest of the server
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import repoRoutes from './routes/repo.routes.js';
import pipelineRoutes from './routes/pipeline.routes.js';
import analyzerRoutes from './routes/analyzer.routes.js';
import securityRoutes from './routes/security.routes.js';
import remediationRoutes from './routes/remediation.routes.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

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

app.listen(PORT, () => {
  logger.info({ context: { port: PORT } }, 'Backend server running'); // FIX: replace console logging with structured logger
});
