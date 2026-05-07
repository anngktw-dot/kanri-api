import { Router, type Request, type Response } from 'express';
import { jwtGuard, type AuthenticatedRequest } from '../auth/middleware.js';
import { prisma } from '../db.js';
import { publicUser } from '../http/responses.js';

export const usersRouter = Router();

usersRouter.get('/me', jwtGuard, async (req: Request, res: Response) => {
  const { payload } = (req as AuthenticatedRequest).auth;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.status(200).json({ user: publicUser(user) });
});
