import express from 'express';
import {
  getGitHubAuthUrl,
  githubCallback,
  getCurrentUser,
  logout
} from '../controllers/auth.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';
import { requireCsrfProtection } from '../middleware/csrf.middleware.js';

const router = express.Router();

router.get('/github/url', getGitHubAuthUrl);
router.post('/github/callback', githubCallback);
router.get('/me', authenticateUser, getCurrentUser);
router.post('/logout', authenticateUser, requireCsrfProtection, logout);

export default router;
