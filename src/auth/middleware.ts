import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db.js';
import { isTokenRevoked } from './token-blacklist.js';
import { verifyAccessToken, type AccessTokenPayload } from './jwt.js';

export type AuthenticatedRequest = Request & {
  auth: {
    token: string;
    payload: AccessTokenPayload;
  };
};

function getBearerToken(req: Request): string | null {
  const authorization = req.header('authorization');

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

export async function jwtGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getBearerToken(req);

  if (!token) {
    res.status(401).json({ message: 'Missing bearer token' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    if (await isTokenRevoked(payload.jti)) {
      res.status(401).json({ message: 'Token is invalidated' });
      return;
    }

    const userExists = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true },
    });

    if (!userExists) {
      res.status(401).json({ message: 'Token user no longer exists' });
      return;
    }

    (req as AuthenticatedRequest).auth = {
      token,
      payload,
    };

    next();
  } catch {
    res.status(401).json({ message: 'Invalid bearer token' });
  }
}
