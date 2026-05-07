import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type AccessTokenPayload = {
  sub: string;
  email: string;
  iat: number;
  exp: number;
  jti: string;
};

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPart(value: string): string {
  return createHmac('sha256', config.jwtSecret).update(value).digest('base64url');
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function parseJsonObject(value: string): Record<string, JsonValue> {
  const parsed: unknown = JSON.parse(value);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JWT payload must be an object');
  }

  return parsed as Record<string, JsonValue>;
}

export function createAccessToken(user: { id: string; email: string }): {
  accessToken: string;
  expiresIn: number;
} {
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    iat: now,
    exp: now + config.accessTokenTtlSeconds,
    jti: randomUUID(),
  };

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = signPart(signingInput);

  return {
    accessToken: `${signingInput}.${signature}`,
    expiresIn: config.accessTokenTtlSeconds,
  };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const [encodedHeader, encodedPayload, signature, extra] = token.split('.');

  if (!encodedHeader || !encodedPayload || !signature || extra) {
    throw new Error('Invalid JWT format');
  }

  const expectedSignature = signPart(`${encodedHeader}.${encodedPayload}`);

  if (!constantTimeEqual(signature, expectedSignature)) {
    throw new Error('Invalid JWT signature');
  }

  const header = parseJsonObject(base64UrlDecode(encodedHeader));
  const payload = parseJsonObject(base64UrlDecode(encodedPayload));

  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new Error('Unsupported JWT header');
  }

  if (
    typeof payload.sub !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    typeof payload.jti !== 'string'
  ) {
    throw new Error('Invalid JWT payload');
  }

  const now = Math.floor(Date.now() / 1000);

  if (payload.exp <= now) {
    throw new Error('JWT has expired');
  }

  return payload as AccessTokenPayload;
}
