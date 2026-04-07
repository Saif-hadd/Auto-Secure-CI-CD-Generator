import express from 'express';
import {
  getUserRepositories,
  getRepositoryById,
  detectStack,
  syncRepositories
} from '../controllers/repo.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateUser);

router.get('/', getUserRepositories);
router.get('/:repoId', getRepositoryById);
router.post('/sync', syncRepositories);
router.post('/:repoId/detect-stack', detectStack);

export default router;
