import { prisma } from '../db.js';

interface UserContext {
  id: string;
  role?: string;
}

export class TransitionService {
  static async validate(
    taskId: string,
    toStatusId: string,
    user: UserContext,
  ): Promise<{ code: string; message: string } | null> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { status: true },
    });

    if (!task) {
      return { code: '404', message: 'Task not found' };
    }

    const fromStatusId = task.statusId;

    if (fromStatusId === toStatusId) return null;

    const rule = await prisma.transitionRule.findFirst({
      where: {
        fromStatusId: fromStatusId,
        toStatusId: toStatusId,
      },
    });

    if (!rule) {
      return {
        code: 'TRANSITION_NOT_ALLOWED',
        message: 'Transition not allowed by business rules',
      };
    }

    if (rule.allowedRole && user.role?.toLowerCase() !== rule.allowedRole.toLowerCase()) {
      return { code: 'ROLE_REQUIRED', message: `Role required: ${rule.allowedRole}` };
    }

    const targetStatus = await prisma.status.findUnique({ where: { id: toStatusId } });

    if (targetStatus?.name === 'InProgress') {
      const inProgressCount = await prisma.task.count({
        where: {
          assigneeId: user.id,
          status: { name: 'InProgress' },
        },
      });

      if (inProgressCount >= 3) {
        return {
          code: 'LIMIT_EXCEEDED',
          message: 'Limit exceeded: maximum 3 active tasks allowed',
        };
      }
    }

    return null;
  }
}
