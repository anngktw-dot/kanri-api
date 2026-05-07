import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
} as const;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('base64url');
  const key = scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS).toString('base64url');

  return `scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt}$${key}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const parts = passwordHash.split('$');

  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const [, n, r, p, salt, storedKey] = parts;
  const expectedKey = Buffer.from(storedKey, 'base64url');
  const actualKey = scryptSync(password, salt, expectedKey.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });

  if (actualKey.length !== expectedKey.length) {
    return false;
  }

  return timingSafeEqual(actualKey, expectedKey);
}
