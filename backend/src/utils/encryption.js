import crypto from 'crypto';
import { env } from './env.js';

const ENCRYPTION_VERSION = 'enc:v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function deriveKey(secret) {
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(`${ENCRYPTION_VERSION}:`);
}

export function encrypt(value, secret = env.TOKEN_ENCRYPTION_KEY) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Cannot encrypt an empty value');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url')
  ].join(':');
}

export function decrypt(value, secret = env.TOKEN_ENCRYPTION_KEY) {
  if (!isEncrypted(value)) {
    throw new Error('Value is not encrypted with the expected format');
  }

  const parts = value.split(':');

  if (parts.length !== 5) {
    throw new Error('Encrypted value format is invalid');
  }

  const [, version, ivPart, authTagPart, encryptedPart] = parts;

  if (`${parts[0]}:${version}` !== ENCRYPTION_VERSION) {
    throw new Error('Encrypted value version is not supported');
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    deriveKey(secret),
    Buffer.from(ivPart, 'base64url')
  );

  decipher.setAuthTag(Buffer.from(authTagPart, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

export function decryptIfNeeded(value, secret = env.TOKEN_ENCRYPTION_KEY) {
  if (value == null) {
    return value;
  }

  return isEncrypted(value) ? decrypt(value, secret) : value;
}
