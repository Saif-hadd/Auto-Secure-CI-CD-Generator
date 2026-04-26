import crypto from 'crypto';
import { AuthService } from '../services/auth.service.js';
import { SessionService } from '../services/session.service.js';
import {
  clearCsrfCookie,
  clearOAuthStateCookie,
  clearSessionCookie,
  getRequestCookies,
  setCsrfCookie,
  setOAuthStateCookie,
  setSessionCookie
} from '../utils/cookies.js';
import { env } from '../utils/env.js';
import { logger } from '../utils/logger.js';

function getRequestIpAddress(req) {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.socket?.remoteAddress || null;
}

function stateMatches(expectedState, receivedState) {
  if (!expectedState || !receivedState) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedState, 'utf8');
  const receivedBuffer = Buffer.from(receivedState, 'utf8');

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export const getGitHubAuthUrl = async (req, res) => {
  try {
    const state = crypto.randomBytes(32).toString('base64url');
    const query = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: env.FRONTEND_URL,
      scope: 'repo,user,workflow',
      state
    });

    setOAuthStateCookie(res, state);

    res.json({
      url: `https://github.com/login/oauth/authorize?${query.toString()}`
    });
  } catch (error) {
    logger.error({ err: error }, 'Get GitHub auth URL error');
    res.status(500).json({ error: 'Failed to initialize GitHub authentication' });
  }
};

export const githubCallback = async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    const cookies = getRequestCookies(req);
    const expectedState = cookies[env.OAUTH_STATE_COOKIE_NAME];

    if (!stateMatches(expectedState, state)) {
      clearOAuthStateCookie(res);
      return res.status(400).json({ error: 'Invalid OAuth state' });
    }

    const result = await AuthService.handleGitHubCallback(code);
    const session = await SessionService.createSession({
      userId: result.user.id,
      userAgent: req.get('user-agent'),
      ipAddress: getRequestIpAddress(req)
    });

    clearOAuthStateCookie(res);
    setSessionCookie(res, session.sessionToken);
    setCsrfCookie(res, session.csrfToken);

    res.json(result);
  } catch (error) {
    clearOAuthStateCookie(res);
    logger.error({ err: error }, 'GitHub callback error');
    res.status(500).json({ error: error.message });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    if (!req.user?.id || !req.session?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await AuthService.getUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const csrfToken = await SessionService.rotateCsrfToken(req.session.id);
    setCsrfCookie(res, csrfToken);

    res.json({ user });
  } catch (error) {
    logger.error({ err: error }, 'Get current user error');
    res.status(500).json({ error: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    if (req.session?.id) {
      await SessionService.invalidateSessionById(req.session.id);
    }

    clearSessionCookie(res);
    clearCsrfCookie(res);
    clearOAuthStateCookie(res);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error({ err: error }, 'Logout error');
    res.status(500).json({ error: error.message });
  }
};
