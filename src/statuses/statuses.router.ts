import { Router, type Request, type Response } from 'express';
import { prisma } from '../db.js';
import { sendError } from '../http/responses.js';
import { jwtGuard } from '../auth/middleware.js';

export const statusesRouter = Router();

statusesRouter.get('/', jwtGuard, async (req: Request, res: Response) => {
  try {
    const statuses = await prisma.status.findMany({
      orderBy: {
        position: 'asc',
      },
      select: {
        id: true,
        name: true,
        position: true,
      },
    });

    res.status(200).json(statuses);
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Внутрішня помилка сервера при отриманні статусів');
  }
});
