import { SessionService } from '../services/session.service.js';
import { getRequestCookies } from '../utils/cookies.js';
import { env } from '../utils/env.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const requireCsrfProtection = async (req, res, next) => {
  try {
    if (SAFE_METHODS.has(req.method)) {
      return next();
    }

    if (!req.session?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const csrfHeader = req.get('x-csrf-token');
    const cookies = getRequestCookies(req);
    const csrfCookie = cookies[env.CSRF_COOKIE_NAME];

    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }

    const isValid = await SessionService.validateCsrfToken(req.session.id, csrfHeader);

    if (!isValid) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }

    next();
  } catch (error) {
    next(error);
  }
};
