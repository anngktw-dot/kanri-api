import { Router, type Request, type Response } from 'express';
import { prisma } from '../db.js';
import { sendError } from '../http/responses.js';
import { jwtGuard } from '../auth/middleware.js';

export const tasksRouter = Router();

tasksRouter.post('/', jwtGuard, async (req: Request, res: Response) => {
  try {
    const { title, description, workspaceId } = req.body;

    const todoStatus = await prisma.status.findUnique({
      where: { name: 'To Do' },
    });

    if (!todoStatus) {
      return sendError(res, 500, 'System error: status "To Do" not found in DB');
    }

    const newTask = await prisma.task.create({
      data: {
        title,
        description,
        workspaceId,
        statusId: todoStatus.id,
      },
    });

    res.status(201).json(newTask);
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'System error: error occurred while creating task');
  }
});

tasksRouter.patch('/:id/status', jwtGuard, async (req: Request, res: Response) => {
  try {
    const taskId = req.params.id as string;
    const { statusId } = req.body;

    const reqData = req as unknown as { user?: { id: string }; userId?: string };
    const userId = reqData.user?.id || reqData.userId;

    const [currentTask, user] = await Promise.all([
      prisma.task.findUnique({ where: { id: taskId }, include: { status: true } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!currentTask) return sendError(res, 404, 'Task not found');
    if (!user) return sendError(res, 401, 'User not found or unauthorized');

    const targetStatus = await prisma.status.findUnique({ where: { id: statusId } });
    if (!targetStatus) return sendError(res, 400, 'Invalid status');

    if (targetStatus.name === 'Done') {
      const userData = user as unknown as { role?: string };
      if (userData.role !== 'ADMIN' && userData.role !== 'admin') {
        return sendError(res, 403, 'only ADMIN can move task to Done');
      }

      if (currentTask.status.name !== 'Review') {
        return sendError(
          res,
          400,
          'task cannot be moved to Done without going through the Review stage',
        );
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { statusId: targetStatus.id },
    });

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'System error: error occurred while updating task status');
  }
});
