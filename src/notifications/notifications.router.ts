import { Router, type Request, type Response } from 'express';
import { prisma } from '../db.js';
import { jwtGuard } from '../auth/middleware.js';
import { sendError } from '../http/responses.js';

export const notificationsRouter = Router();

notificationsRouter.get('/', jwtGuard, async (req: Request, res: Response) => {
  try {
    const reqData = req as unknown as { user?: { id: string }; userId?: string };
    const userId = reqData.user?.id || reqData.userId;

    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(notifications);
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Internal server error');
  }
});

notificationsRouter.get('/unread-count', jwtGuard, async (req: Request, res: Response) => {
  try {
    const reqData = req as unknown as { user?: { id: string }; userId?: string };
    const userId = reqData.user?.id || reqData.userId;

    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const count = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    res.status(200).json({ count });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Internal server error');
  }
});

notificationsRouter.patch('/:id/read', jwtGuard, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const reqData = req as unknown as { user?: { id: string }; userId?: string };
    const userId = reqData.user?.id || reqData.userId;

    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return sendError(res, 404, 'Notification not found');
    }

    if (notification.userId !== userId) {
      return sendError(res, 403, 'Forbidden');
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Internal server error');
  }
});
