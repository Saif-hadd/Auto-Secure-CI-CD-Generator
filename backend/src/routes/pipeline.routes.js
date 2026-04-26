import express from 'express';
import {
  generatePipeline,
  getPipelinesByRepo,
  pushPipelineToGitHub,
  getSecurityDashboard
} from '../controllers/pipeline.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';
import { requireCsrfProtection } from '../middleware/csrf.middleware.js';

const router = express.Router();

router.use(authenticateUser);
router.use(requireCsrfProtection);

router.post('/generate', generatePipeline);
router.get('/repo/:repoId', getPipelinesByRepo);
router.post('/:pipelineId/push', pushPipelineToGitHub);
router.get('/:pipelineId/security', getSecurityDashboard);

export default router;
