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

export async function jwtGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.accessToken;

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
