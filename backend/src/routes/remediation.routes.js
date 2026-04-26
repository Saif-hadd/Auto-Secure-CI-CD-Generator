import express from 'express';
import {
  runRemediation,
  getRemediationHistory,
  getLatestRemediation
} from '../controllers/remediation.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';
import { requireCsrfProtection } from '../middleware/csrf.middleware.js';

const router = express.Router();

router.use(authenticateUser);
router.use(requireCsrfProtection);

router.post('/:pipelineId/remediate', runRemediation);
router.get('/:pipelineId/history', getRemediationHistory);
router.get('/:pipelineId/latest', getLatestRemediation);

export default router;
