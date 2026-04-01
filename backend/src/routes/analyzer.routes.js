import express from 'express';
import { analyzeYAML } from '../controllers/analyzer.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateUser);

router.post('/analyze', analyzeYAML);

export default router;
