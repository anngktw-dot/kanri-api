import { Router, type Request, type Response } from 'express';
import { prisma } from '../db.js';
import { sendError } from '../http/responses.js';
import { jwtGuard } from '../auth/middleware.js';
import { TransitionService } from './transition.service.js';
import { NotificationService } from '../notifications/notification.service.js';

export const tasksRouter = Router();

tasksRouter.post('/', jwtGuard, async (req: Request, res: Response) => {
  try {
    const { title, description, workspaceId } = req.body;

    const todoStatus = await prisma.status.findUnique({
      where: { name: 'To Do' },
    });

    if (!todoStatus) {
      return sendError(res, 500, 'Status "To Do" not found');
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
    sendError(res, 500, 'Internal server error');
  }
});

tasksRouter.patch('/:id/status', jwtGuard, async (req: Request, res: Response) => {
  try {
    const taskId = req.params.id as string;
    const { statusId } = req.body;

    const reqData = req as unknown as { user?: { id: string }; userId?: string };
    const userId = reqData.user?.id || reqData.userId;

    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return sendError(res, 401, 'User not found');
    }

    const userData = user as unknown as { role?: string };

    const validationError = await TransitionService.validate(taskId, statusId, {
      id: user.id,
      role: userData.role,
    });

    if (validationError) {
      const statusCode =
        validationError.code === '404' ? 404 : validationError.code === 'ROLE_REQUIRED' ? 403 : 400;
      return res.status(statusCode).json({
        error: validationError.code,
        message: validationError.message,
      });
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { statusId },
    });

    if (updatedTask.assigneeId) {
      await NotificationService.create(
        updatedTask.assigneeId,
        'Task Status Updated',
        `The status of your task "${updatedTask.title}" has been changed`,
        updatedTask.id,
      );
    }
    tasksRouter.patch('/:id/assignee', jwtGuard, async (req: Request, res: Response) => {
      try {
        const taskId = req.params.id as string;
        const { assigneeId } = req.body;

        const reqData = req as unknown as { user?: { id: string }; userId?: string };
        const userId = reqData.user?.id || reqData.userId;

        if (!userId) {
          return sendError(res, 401, 'Unauthorized');
        }

        const updatedTask = await prisma.task.update({
          where: { id: taskId },
          data: { assigneeId },
        });

        if (assigneeId) {
          await NotificationService.create(
            assigneeId,
            'New Task Assigned',
            `You have been assigned to the task "${updatedTask.title}"`,
            taskId,
          );
        }

        res.status(200).json(updatedTask);
      } catch (error) {
        console.error(error);
        sendError(res, 500, 'Internal server error');
      }
    });

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Internal server error');
  }
});

tasksRouter.get('/:id/available-transitions', jwtGuard, async (req: Request, res: Response) => {
  try {
    const taskId = req.params.id as string;

    const reqData = req as unknown as { user?: { id: string }; userId?: string };
    const userId = reqData.user?.id || reqData.userId;

    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return sendError(res, 401, 'User not found');
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } });

    if (!task) {
      return sendError(res, 404, 'Task not found');
    }

    const rules = await prisma.transitionRule.findMany({
      where: { fromStatusId: task.statusId },
      include: { toStatus: true },
    });

    const userData = user as unknown as { role?: string };
    const availableTransitions = [];

    for (const rule of rules) {
      if (rule.allowedRole && userData.role?.toLowerCase() !== rule.allowedRole.toLowerCase()) {
        continue;
      }

      if (rule.toStatus.name === 'InProgress') {
        const inProgressCount = await prisma.task.count({
          where: {
            assigneeId: user.id,
            status: { name: 'InProgress' },
          },
        });

        if (inProgressCount >= 3) {
          continue;
        }
      }

      availableTransitions.push({
        id: rule.toStatus.id,
        name: rule.toStatus.name,
        position: rule.toStatus.position,
      });
    }

    res.status(200).json(availableTransitions);
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Internal server error');
  }
});
