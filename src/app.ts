import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';

import { prisma } from './db.js';
import { requestId, securityHeaders } from './http/middleware.js';
import { sendError } from './http/responses.js';
import { openApiDocument } from './openapi.js';

import { authRouter } from './auth/auth.router.js';
import { usersRouter } from './users/users.router.js';
import { tasksRouter } from './tasks/tasks.router.js';
import { statusesRouter } from './statuses/statuses.router.js';
import { notificationsRouter } from './notifications/notifications.router.js';
import { commentsRouter } from './comments/comments.router.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(requestId);
app.use(securityHeaders);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/tasks', tasksRouter);
app.use('/statuses', statusesRouter);
app.use('/notifications', notificationsRouter);
app.use('/comments', commentsRouter);

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'Kanri API',
    status: 'running',
    health: '/health',
    docs: '/docs',
    openapi: '/openapi.json',
  });
});

app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: 'ok',
      database: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: 'error',
      database: 'unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/openapi.json', (_req: Request, res: Response) => {
  res.status(200).json(openApiDocument);
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.use((_req: Request, res: Response) => {
  sendError(res, 404, 'Route not found');
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  void _next;
  console.error(error);
  sendError(res, 500, 'Internal server error');
});
