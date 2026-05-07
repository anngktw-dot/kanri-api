import { Prisma } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import { createRateLimiter } from '../http/rate-limit.js';
import { publicUser, sendError } from '../http/responses.js';
import { prisma } from '../db.js';
import { createAccessToken } from './jwt.js';
import { jwtGuard, type AuthenticatedRequest } from './middleware.js';
import { hashPassword, verifyPassword } from './password.js';
import { createRefreshToken, revokeRefreshToken, rotateRefreshToken } from './refresh-token.js';
import { revokeToken } from './token-blacklist.js';
import {
  getEmailPassword,
  getOptionalName,
  getRefreshToken,
  MIN_PASSWORD_LENGTH,
  type LoginBody,
  type RefreshBody,
  type RegisterBody,
} from './validation.js';

export const authRouter = Router();

const authRateLimiter = createRateLimiter({
  keyPrefix: 'auth',
  maxRequests: 10,
  windowMs: 60 * 1000,
});

function invalidCredentialsMessage(): string {
  return `Valid email and password with at least ${MIN_PASSWORD_LENGTH} characters are required`;
}

async function sendTokenPair(
  res: Response,
  status: number,
  user: { id: string; email: string; name: string | null; createdAt: Date; updatedAt: Date },
): Promise<void> {
  const access = createAccessToken({ id: user.id, email: user.email });
  const refresh = await createRefreshToken(user.id);

  res.status(status).json({
    accessToken: access.accessToken,
    tokenType: 'Bearer',
    expiresIn: access.expiresIn,
    refreshToken: refresh.refreshToken,
    refreshExpiresIn: refresh.expiresIn,
    user: publicUser(user),
  });
}

authRouter.post(
  '/register',
  authRateLimiter,
  async (req: Request<object, object, RegisterBody>, res: Response) => {
    const credentials = getEmailPassword(req.body);

    if (!credentials) {
      sendError(res, 400, invalidCredentialsMessage());
      return;
    }

    try {
      const user = await prisma.user.create({
        data: {
          email: credentials.email,
          passwordHash: hashPassword(credentials.password),
          name: getOptionalName(req.body.name),
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await sendTokenPair(res, 201, user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        sendError(res, 409, 'User with this email already exists');
        return;
      }

      throw error;
    }
  },
);

authRouter.post(
  '/login',
  authRateLimiter,
  async (req: Request<object, object, LoginBody>, res: Response) => {
    const credentials = getEmailPassword(req.body);

    if (!credentials) {
      sendError(res, 400, invalidCredentialsMessage());
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: credentials.email,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user || !verifyPassword(credentials.password, user.passwordHash)) {
      sendError(res, 401, 'Invalid email or password');
      return;
    }

    await sendTokenPair(res, 200, user);
  },
);

authRouter.post('/refresh', async (req: Request<object, object, RefreshBody>, res: Response) => {
  const refreshToken = getRefreshToken(req.body);

  if (!refreshToken) {
    sendError(res, 400, 'Refresh token is required');
    return;
  }

  const rotated = await rotateRefreshToken(refreshToken);

  if (!rotated) {
    sendError(res, 401, 'Invalid refresh token');
    return;
  }

  const access = createAccessToken({ id: rotated.user.id, email: rotated.user.email });

  res.status(200).json({
    accessToken: access.accessToken,
    tokenType: 'Bearer',
    expiresIn: access.expiresIn,
    refreshToken: rotated.refreshToken,
    refreshExpiresIn: rotated.refreshExpiresIn,
    user: publicUser(rotated.user),
  });
});

authRouter.post('/logout', jwtGuard, async (req: Request<object, object, RefreshBody>, res) => {
  const { payload } = (req as AuthenticatedRequest).auth;
  const refreshToken = getRefreshToken(req.body);

  await revokeToken(payload.jti, payload.sub, payload.exp);

  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  res.status(204).send();
});
