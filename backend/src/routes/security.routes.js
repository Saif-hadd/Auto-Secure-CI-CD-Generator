import express from 'express';
import {
  runSecurityScan,
  getScanHistory,
  compareScanResults,
  getLatestScan
} from '../controllers/security.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateUser);

router.post('/:pipelineId/scan', runSecurityScan);
router.get('/:pipelineId/history', getScanHistory);
router.get('/:pipelineId/compare', compareScanResults);
router.get('/:pipelineId/latest', getLatestScan);

export default router;
