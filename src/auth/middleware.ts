import type { NextFunction, Request, Response } from 'express';
import { sendError } from '../http/responses.js';
import { verifyAccessToken } from './jwt.js';
import { isTokenRevoked } from './token-blacklist.js';

export interface AuthenticatedRequest extends Request {
  auth: {
    payload: {
      jti: string;
      sub: string;
      exp: number;
      email: string;
      [key: string]: unknown;
    };
  };
}

function getCookie(req: Request, name: string): string | null {
  const cookie = req.header('cookie');

  if (!cookie) {
    return null;
  }

  const pairs = cookie.split(';');

  for (const pair of pairs) {
    const [rawKey, ...rawValue] = pair.trim().split('=');

    if (rawKey === name) {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return null;
}

function getBearerToken(req: Request): string | null {
  const authorization = req.header('authorization');

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');

  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

export async function jwtGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = getBearerToken(req) ?? getCookie(req, 'accessToken');

    if (!token) {
      sendError(res, 401, 'Unauthorized: No token provided');
      return;
    }

    const payload = verifyAccessToken(token);

    const revoked = await isTokenRevoked(payload.jti);
    if (revoked) {
      res.clearCookie('accessToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
      sendError(res, 401, 'Unauthorized: Token has been revoked');
      return;
    }

    (req as AuthenticatedRequest).auth = { payload };

    next();
  } catch {
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    sendError(res, 401, 'Unauthorized: Invalid or expired token');
  }
}
