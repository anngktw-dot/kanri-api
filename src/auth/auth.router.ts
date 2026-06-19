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
  MIN_PASSWORD_LENGTH,
  type LoginBody,
  type RegisterBody,
} from './validation.js';
import { CaptchaService } from './captcha.service.js';

export const authRouter = Router();

const authRateLimiter = createRateLimiter({
  keyPrefix: 'auth',
  maxRequests: 10,
  windowMs: 60 * 1000,
});

function invalidCredentialsMessage(): string {
  return `Valid email and password with at least ${MIN_PASSWORD_LENGTH} characters are required`;
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};

async function sendTokenPair(
  res: Response,
  status: number,
  user: { id: string; email: string; name: string | null; createdAt: Date; updatedAt: Date },
  message: string,
): Promise<void> {
  const access = createAccessToken({ id: user.id, email: user.email });
  const refresh = await createRefreshToken(user.id);

  res.cookie('accessToken', access.accessToken, {
    ...cookieOptions,
    maxAge: access.expiresIn * 1000,
  });

  res.cookie('refreshToken', refresh.refreshToken, {
    ...cookieOptions,
    maxAge: refresh.expiresIn * 1000,
  });

  res.status(status).json({
    message,
    user: publicUser(user),
  });
}

authRouter.post(
  '/register',
  authRateLimiter,
  async (req: Request<object, object, RegisterBody & { captchaToken?: string }>, res: Response) => {
    const isValidCaptcha = await CaptchaService.verify(req.body.captchaToken || '');
    if (!isValidCaptcha) {
      sendError(res, 403, 'Invalid CAPTCHA');
      return;
    }

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

      await sendTokenPair(res, 201, user, 'Registered successfully');
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
  async (req: Request<object, object, LoginBody & { captchaToken?: string }>, res: Response) => {
    const isValidCaptcha = await CaptchaService.verify(req.body.captchaToken || '');
    if (!isValidCaptcha) {
      sendError(res, 403, 'Invalid CAPTCHA');
      return;
    }

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

    await sendTokenPair(res, 200, user, 'Logged in successfully');
  },
);

authRouter.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    sendError(res, 401, 'Refresh token is required');
    return;
  }

  const rotated = await rotateRefreshToken(refreshToken);

  if (!rotated) {
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    sendError(res, 401, 'Invalid refresh token');
    return;
  }

  const access = createAccessToken({ id: rotated.user.id, email: rotated.user.email });

  res.cookie('accessToken', access.accessToken, {
    ...cookieOptions,
    maxAge: access.expiresIn * 1000,
  });

  res.cookie('refreshToken', rotated.refreshToken, {
    ...cookieOptions,
    maxAge: rotated.refreshExpiresIn * 1000,
  });

  res.status(200).json({
    message: 'Tokens refreshed successfully',
    user: publicUser(rotated.user),
  });
});

authRouter.post('/logout', jwtGuard, async (req: Request, res: Response) => {
  const { payload } = (req as AuthenticatedRequest).auth;
  const refreshToken = req.cookies?.refreshToken;

  await revokeToken(payload.jti, payload.sub, payload.exp);

  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);

  res.status(204).send();
});
