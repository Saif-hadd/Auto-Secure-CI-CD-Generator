import express from 'express';
import {
  githubCallback,
  getCurrentUser,
  logout
} from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/github/callback', githubCallback);
router.get('/me', getCurrentUser);
router.post('/logout', logout);

export default router;
