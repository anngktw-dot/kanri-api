import { Router, type Request, type Response } from 'express';
import { prisma } from '../db.js';
import { jwtGuard } from '../auth/middleware.js';
import { sendError } from '../http/responses.js';

export const commentsRouter = Router();

commentsRouter.delete('/:id', jwtGuard, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const reqData = req as unknown as { user?: { id: string; role?: string }; userId?: string };
    const userId = reqData.user?.id || reqData.userId;
    const userRole = reqData.user?.role;

    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const comment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      return sendError(res, 404, 'Comment not found');
    }

    if (comment.authorId !== userId && userRole?.toLowerCase() !== 'admin') {
      return sendError(res, 403, 'Forbidden');
    }

    await prisma.comment.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Internal server error');
  }
});
