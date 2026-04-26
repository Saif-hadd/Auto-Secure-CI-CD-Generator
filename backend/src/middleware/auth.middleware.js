import { SessionService } from '../services/session.service.js';
import { clearCsrfCookie, clearSessionCookie, getRequestCookies } from '../utils/cookies.js';
import { env } from '../utils/env.js';
import { logger } from '../utils/logger.js';

export const authenticateUser = async (req, res, next) => {
  try {
    const cookies = getRequestCookies(req);
    const sessionToken = cookies[env.SESSION_COOKIE_NAME];

    if (!sessionToken) {
      clearSessionCookie(res);
      clearCsrfCookie(res);
      return res.status(401).json({ error: 'Authentication required' });
    }

    const authenticatedSession = await SessionService.authenticateSession(sessionToken);

    if (!authenticatedSession) {
      clearSessionCookie(res);
      clearCsrfCookie(res);
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.session = authenticatedSession.session;
    req.user = authenticatedSession.user;
    next();
  } catch (error) {
    logger.error({ context: { path: req.originalUrl }, err: error }, 'Authentication middleware error');
    res.status(401).json({ error: 'Authentication failed' });
  }
};
