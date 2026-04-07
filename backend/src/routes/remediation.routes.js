import express from 'express';
import {
  runRemediation,
  getRemediationHistory,
  getLatestRemediation
} from '../controllers/remediation.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateUser);

router.post('/:pipelineId/remediate', runRemediation);
router.get('/:pipelineId/history', getRemediationHistory);
router.get('/:pipelineId/latest', getLatestRemediation);

export default router;
