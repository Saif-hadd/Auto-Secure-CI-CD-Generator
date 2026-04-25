import pg from 'pg';
import { env } from '../utils/env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

pool.on('error', (err) => {
  logger.error({ context: {}, err }, 'Unexpected error on idle client'); // FIX: replace console logging with structured logger
  process.exit(-1);
});

export const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.info({ context: { duration, rows: result.rowCount } }, 'Executed query'); // FIX: replace console logging with structured logger
    return result;
  } catch (error) {
    logger.error({ context: {}, err: error }, 'Database query error'); // FIX: replace console logging with structured logger
    throw error;
  }
};

export const getClient = async () => {
  const client = await pool.connect();
  const clientQuery = client.query.bind(client);
  const release = client.release.bind(client);

  const timeout = setTimeout(() => {
    logger.error({ context: {} }, 'A client has been checked out for more than 5 seconds'); // FIX: replace console logging with structured logger
  }, 5000);

  client.query = (...args) => clientQuery(...args);

  client.release = () => {
    clearTimeout(timeout);
    client.query = clientQuery;
    client.release = release;
    return release();
  };

  return client;
};
