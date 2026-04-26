import { env } from './env.js';

const isProduction = env.NODE_ENV === 'production';
const cookieMaxAgeMs = env.SESSION_TTL_HOURS * 60 * 60 * 1000;
const oauthStateMaxAgeMs = env.OAUTH_STATE_TTL_MINUTES * 60 * 1000;

function getBaseCookieOptions() {
  return {
    path: '/',
    sameSite: env.COOKIE_SAME_SITE,
    secure: isProduction
  };
}

export function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((accumulator, entry) => {
      const separatorIndex = entry.indexOf('=');

      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();

      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});
}

export function getRequestCookies(req) {
  return parseCookies(req.headers.cookie);
}

export function setSessionCookie(res, sessionToken) {
  res.cookie(env.SESSION_COOKIE_NAME, sessionToken, {
    ...getBaseCookieOptions(),
    httpOnly: true,
    maxAge: cookieMaxAgeMs
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(env.SESSION_COOKIE_NAME, {
    ...getBaseCookieOptions(),
    httpOnly: true
  });
}

export function setCsrfCookie(res, csrfToken) {
  res.cookie(env.CSRF_COOKIE_NAME, csrfToken, {
    ...getBaseCookieOptions(),
    httpOnly: false,
    maxAge: cookieMaxAgeMs
  });
}

export function clearCsrfCookie(res) {
  res.clearCookie(env.CSRF_COOKIE_NAME, {
    ...getBaseCookieOptions(),
    httpOnly: false
  });
}

export function setOAuthStateCookie(res, stateToken) {
  res.cookie(env.OAUTH_STATE_COOKIE_NAME, stateToken, {
    ...getBaseCookieOptions(),
    httpOnly: true,
    sameSite: 'lax',
    maxAge: oauthStateMaxAgeMs
  });
}

export function clearOAuthStateCookie(res) {
  res.clearCookie(env.OAUTH_STATE_COOKIE_NAME, {
    ...getBaseCookieOptions(),
    httpOnly: true,
    sameSite: 'lax'
  });
}
