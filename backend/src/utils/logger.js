// FIXES APPLIED: 3.1
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info' // FIX: centralize structured logging configuration
});
