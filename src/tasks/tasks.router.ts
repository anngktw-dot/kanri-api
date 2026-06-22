import { Prisma } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import { jwtGuard, type AuthenticatedRequest } from '../auth/middleware.js';
import { prisma } from '../db.js';
import { sendError } from '../http/responses.js';

export const tasksRouter = Router();
export const commentsRouter = Router();
export const statusesRouter = Router();

const DEFAULT_WORKSPACE_NAME = 'Default Workspace';
const STATUS_TO_DO = 'to do';
const STATUS_REVIEW = 'review';
const STATUS_DONE = 'done';
const ACTIVE_TASK_LIMIT = 3;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TaskBody = {
  title?: unknown;
  description?: unknown;
  status?: unknown;
  assignee?: unknown;
  assigneeId?: unknown;
  deadline?: unknown;
  dueDate?: unknown;
  priority?: unknown;
};

type CommentBody = {
  body?: unknown;
  comment?: unknown;
  content?: unknown;
};

type StatusBody = {
  name?: unknown;
};

type TaskRecord = Prisma.TaskGetPayload<{
  include: {
    status: true;
    assignee: { select: { id: true; email: true; name: true } };
    reporter: { select: { id: true; email: true; name: true } };
  };
}>;

type CommentRecord = Prisma.CommentGetPayload<{
  include: {
    author: { select: { id: true; email: true; name: true } };
  };
}>;

function normalizeRequiredString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeStatus(value: unknown): string | null | undefined {
  const normalized = normalizeOptionalString(value);

  if (normalized === undefined || normalized === null) {
    return normalized;
  }

  return normalized.toLowerCase();
}

function normalizeDate(value: unknown): Date | null | undefined {
  const normalized = normalizeOptionalString(value);

  if (normalized === undefined || normalized === null) {
    return normalized;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function displayStatus(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function publicStatus(status: { id: string; name: string; position: number }) {
  return {
    id: status.id,
    name: displayStatus(status.name),
    position: status.position,
  };
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function publicTask(task: TaskRecord) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: displayStatus(task.status.name),
    assignee: task.assignee,
    reporter: task.reporter,
    deadline: task.dueDate?.toISOString() ?? null,
    priority: task.priority,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function publicComment(comment: CommentRecord) {
  return {
    id: comment.id,
    taskId: comment.taskId,
    body: comment.body,
    author: comment.author,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

async function getOrCreateDefaultWorkspace(userId: string): Promise<string> {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true },
    orderBy: { createdAt: 'asc' },
  });

  if (membership) {
    return membership.workspaceId;
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: DEFAULT_WORKSPACE_NAME,
      members: {
        create: {
          userId,
          role: 'admin',
        },
      },
    },
    select: { id: true },
  });

  return workspace.id;
}

async function findStatus(name: string): Promise<{ id: string; name: string } | null> {
  return prisma.status.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
}

async function findAssignee(value: string): Promise<{ id: string } | null> {
  if (isUuid(value)) {
    return prisma.user.findUnique({
      where: { id: value },
      select: { id: true },
    });
  }

  return prisma.user.findFirst({
    where: { email: { equals: value, mode: 'insensitive' } },
    select: { id: true },
  });
}

async function countActiveTasks(assigneeId: string, excludeTaskId?: string): Promise<number> {
  return prisma.task.count({
    where: {
      assigneeId,
      ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
      status: {
        name: { not: STATUS_DONE, mode: 'insensitive' },
      },
    },
  });
}

async function userCanDeleteTask(
  userId: string,
  task: { reporterId: string | null; workspaceId: string },
) {
  if (task.reporterId === userId) {
    return true;
  }

  const adminMembership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspaceId: task.workspaceId,
      role: { equals: 'admin', mode: 'insensitive' },
    },
    select: { id: true },
  });

  return Boolean(adminMembership);
}

async function userIsWorkspaceAdmin(userId: string, workspaceId: string): Promise<boolean> {
  const adminMembership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspaceId,
      role: { equals: 'admin', mode: 'insensitive' },
    },
    select: { id: true },
  });

  return Boolean(adminMembership);
}

async function userCanDeleteComment(
  userId: string,
  comment: { authorId: string; task: { workspaceId: string } },
) {
  if (comment.authorId === userId) {
    return true;
  }

  return userIsWorkspaceAdmin(userId, comment.task.workspaceId);
}

tasksRouter.post('/', jwtGuard, async (req: Request<object, object, TaskBody>, res: Response) => {
  const { payload } = (req as AuthenticatedRequest).auth;
  const title = normalizeRequiredString(req.body.title);
  const assigneeValue = normalizeRequiredString(req.body.assigneeId ?? req.body.assignee);
  const requestedStatus = normalizeStatus(req.body.status);

  if (!title || !assigneeValue) {
    sendError(res, 400, 'Title and assignee are required');
    return;
  }

  if (requestedStatus === STATUS_DONE) {
    sendError(res, 400, 'Task cannot be created with Done status');
    return;
  }

  const assignee = await findAssignee(assigneeValue);

  if (!assignee) {
    sendError(res, 404, 'Assignee not found');
    return;
  }

  if ((await countActiveTasks(assignee.id)) >= ACTIVE_TASK_LIMIT) {
    sendError(res, 400, 'Assignee already has 3 active tasks');
    return;
  }

  const toDoStatus = await findStatus(STATUS_TO_DO);

  if (!toDoStatus) {
    sendError(res, 500, 'Default To Do status is not configured');
    return;
  }

  const deadline = normalizeDate(req.body.deadline ?? req.body.dueDate);

  if (
    deadline === undefined &&
    (req.body.deadline !== undefined || req.body.dueDate !== undefined)
  ) {
    sendError(res, 400, 'Deadline must be a valid date');
    return;
  }

  const workspaceId = await getOrCreateDefaultWorkspace(payload.sub);
  const task = await prisma.task.create({
    data: {
      workspaceId,
      statusId: toDoStatus.id,
      reporterId: payload.sub,
      assigneeId: assignee.id,
      title,
      description: normalizeOptionalString(req.body.description),
      dueDate: deadline,
      priority: normalizeOptionalString(req.body.priority) ?? undefined,
    },
    include: {
      status: true,
      assignee: { select: { id: true, email: true, name: true } },
      reporter: { select: { id: true, email: true, name: true } },
    },
  });

  res.status(201).json({ task: publicTask(task) });
});

tasksRouter.get('/', jwtGuard, async (req: Request, res: Response) => {
  const status = normalizeStatus(req.query.status);
  const assignee = normalizeOptionalString(req.query.assignee);

  const tasks = await prisma.task.findMany({
    where: {
      ...(status ? { status: { name: { equals: status, mode: 'insensitive' } } } : {}),
      ...(assignee
        ? isUuid(assignee)
          ? { assigneeId: assignee }
          : { assignee: { email: { equals: assignee, mode: 'insensitive' } } }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      status: true,
      assignee: { select: { id: true, email: true, name: true } },
      reporter: { select: { id: true, email: true, name: true } },
    },
  });

  res.status(200).json({ tasks: tasks.map(publicTask) });
});

tasksRouter.post(
  '/:id/comments',
  jwtGuard,
  async (req: Request<{ id: string }, object, CommentBody>, res: Response) => {
    const { payload } = (req as unknown as AuthenticatedRequest).auth;

    if (!isUuid(req.params.id)) {
      sendError(res, 404, 'Task not found');
      return;
    }

    const body = normalizeRequiredString(req.body.body ?? req.body.comment ?? req.body.content);

    if (!body) {
      sendError(res, 400, 'Comment body is required');
      return;
    }

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });

    if (!task) {
      sendError(res, 404, 'Task not found');
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        taskId: task.id,
        authorId: payload.sub,
        body,
      },
      include: {
        author: { select: { id: true, email: true, name: true } },
      },
    });

    res.status(201).json({ comment: publicComment(comment) });
  },
);

tasksRouter.get('/:id/comments', jwtGuard, async (req: Request<{ id: string }>, res: Response) => {
  if (!isUuid(req.params.id)) {
    sendError(res, 404, 'Task not found');
    return;
  }

  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });

  if (!task) {
    sendError(res, 404, 'Task not found');
    return;
  }

  const comments = await prisma.comment.findMany({
    where: { taskId: task.id },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: {
      author: { select: { id: true, email: true, name: true } },
    },
  });

  res.status(200).json({ comments: comments.map(publicComment) });
});

tasksRouter.get('/:id', jwtGuard, async (req: Request<{ id: string }>, res: Response) => {
  if (!isUuid(req.params.id)) {
    sendError(res, 404, 'Task not found');
    return;
  }

  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: {
      status: true,
      assignee: { select: { id: true, email: true, name: true } },
      reporter: { select: { id: true, email: true, name: true } },
    },
  });

  if (!task) {
    sendError(res, 404, 'Task not found');
    return;
  }

  res.status(200).json({ task: publicTask(task) });
});

tasksRouter.patch(
  '/:id',
  jwtGuard,
  async (req: Request<{ id: string }, object, TaskBody>, res: Response) => {
    if (!isUuid(req.params.id)) {
      sendError(res, 404, 'Task not found');
      return;
    }

    const existingTask = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { status: true },
    });

    if (!existingTask) {
      sendError(res, 404, 'Task not found');
      return;
    }

    const data: Prisma.TaskUpdateInput = {};
    const title = normalizeOptionalString(req.body.title);
    const description = normalizeOptionalString(req.body.description);
    const priority = normalizeOptionalString(req.body.priority);
    const assigneeValue = normalizeOptionalString(req.body.assigneeId ?? req.body.assignee);
    const deadline = normalizeDate(req.body.deadline ?? req.body.dueDate);
    const status = normalizeStatus(req.body.status);
    let finalAssigneeId = existingTask.assigneeId;
    let finalStatusName = existingTask.status.name;

    if (req.body.title !== undefined) {
      if (!title) {
        sendError(res, 400, 'Title cannot be empty');
        return;
      }

      data.title = title;
    }

    if (description !== undefined) {
      data.description = description;
    }

    if (priority !== undefined) {
      data.priority = priority ?? 'medium';
    }

    if (
      deadline === undefined &&
      (req.body.deadline !== undefined || req.body.dueDate !== undefined)
    ) {
      sendError(res, 400, 'Deadline must be a valid date');
      return;
    }

    if (deadline !== undefined) {
      data.dueDate = deadline;
    }

    if (assigneeValue !== undefined) {
      if (!assigneeValue) {
        sendError(res, 400, 'Assignee cannot be empty');
        return;
      }

      const assignee = await findAssignee(assigneeValue);

      if (!assignee) {
        sendError(res, 404, 'Assignee not found');
        return;
      }

      finalAssigneeId = assignee.id;
      data.assignee = { connect: { id: assignee.id } };
    }

    if (status !== undefined) {
      if (!status) {
        sendError(res, 400, 'Status cannot be empty');
        return;
      }

      if (status === STATUS_DONE && existingTask.status.name.toLowerCase() !== STATUS_REVIEW) {
        sendError(res, 400, 'Task cannot move to Done without Review');
        return;
      }

      const nextStatus = await findStatus(status);

      if (!nextStatus) {
        sendError(res, 404, 'Status not found');
        return;
      }

      finalStatusName = nextStatus.name;
      data.status = { connect: { id: nextStatus.id } };
    }

    if (
      finalAssigneeId &&
      finalStatusName.toLowerCase() !== STATUS_DONE &&
      (await countActiveTasks(finalAssigneeId, existingTask.id)) >= ACTIVE_TASK_LIMIT
    ) {
      sendError(res, 400, 'Assignee already has 3 active tasks');
      return;
    }

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data,
      include: {
        status: true,
        assignee: { select: { id: true, email: true, name: true } },
        reporter: { select: { id: true, email: true, name: true } },
      },
    });

    res.status(200).json({ task: publicTask(task) });
  },
);

tasksRouter.delete('/:id', jwtGuard, async (req: Request<{ id: string }>, res: Response) => {
  const { payload } = (req as unknown as AuthenticatedRequest).auth;

  if (!isUuid(req.params.id)) {
    sendError(res, 404, 'Task not found');
    return;
  }

  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    select: { id: true, reporterId: true, workspaceId: true },
  });

  if (!task) {
    sendError(res, 404, 'Task not found');
    return;
  }

  if (!(await userCanDeleteTask(payload.sub, task))) {
    sendError(res, 403, 'Only an administrator or task author can delete this task');
    return;
  }

  await prisma.task.delete({
    where: { id: task.id },
  });

  res.status(200).json({ message: 'Task deleted successfully' });
});

commentsRouter.delete('/:id', jwtGuard, async (req: Request<{ id: string }>, res: Response) => {
  const { payload } = (req as unknown as AuthenticatedRequest).auth;

  if (!isUuid(req.params.id)) {
    sendError(res, 404, 'Comment not found');
    return;
  }

  const comment = await prisma.comment.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      authorId: true,
      task: { select: { workspaceId: true } },
    },
  });

  if (!comment) {
    sendError(res, 404, 'Comment not found');
    return;
  }

  if (!(await userCanDeleteComment(payload.sub, comment))) {
    sendError(res, 403, 'Only an administrator or comment author can delete this comment');
    return;
  }

  await prisma.comment.delete({
    where: { id: comment.id },
  });

  res.status(200).json({ message: 'Comment deleted successfully' });
});

statusesRouter.get('/', jwtGuard, async (_req: Request, res: Response) => {
  const statuses = await prisma.status.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      position: true,
    },
  });

  res.status(200).json({ statuses: statuses.map(publicStatus) });
});

statusesRouter.post(
  '/',
  jwtGuard,
  async (req: Request<object, object, StatusBody>, res: Response) => {
    const name = normalizeRequiredString(req.body.name);

    if (!name) {
      sendError(res, 400, 'Status name is required');
      return;
    }

    const existing = await findStatus(name);

    if (existing) {
      sendError(res, 409, 'Status already exists');
      return;
    }

    const aggregate = await prisma.status.aggregate({
      _max: { position: true },
    });

    const status = await prisma.status.create({
      data: {
        name: name.toLowerCase(),
        position: (aggregate._max.position ?? 0) + 1,
      },
      select: {
        id: true,
        name: true,
        position: true,
      },
    });

    res.status(201).json({ status: publicStatus(status) });
  },
);
