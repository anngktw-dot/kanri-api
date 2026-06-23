import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import { authRouter } from './auth/auth.router.js';
import { prisma } from './db.js';
import { requestId, securityHeaders } from './http/middleware.js';
import { sendError } from './http/responses.js';
import { openApiDocument } from './openapi.js';
import { commentsRouter, statusesRouter, tasksRouter } from './tasks/tasks.router.js';
import { usersRouter } from './users/users.router.js';
import { notificationsRouter } from './notifications/notifications.router.js';

export const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'https://kanriboard.netlify.app',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(requestId);

app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/docs')) {
    return next();
  }
  securityHeaders(req, res, next);
});

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

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

app.get('/docs', (_req: Request, res: Response) => {
  res.status(200).type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kanri API Docs</title>
    <style>
      body { margin: 0; }
    </style>
  </head>
  <body>
    <script id="api-reference" data-url="/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`);
});

app.get('/register', (_req: Request, res: Response) => {
  res.sendFile('public/register.html', { root: process.cwd() });
});

app.get('/login', (_req: Request, res: Response) => {
  res.sendFile('public/login.html', { root: process.cwd() });
});

app.get('/board', (_req: Request, res: Response) => {
  res.sendFile('public/board.html', { root: process.cwd() });
});

app.use('/assets', express.static('public/assets'));

app.use('/auth', authRouter);
app.use('/tasks', tasksRouter);
app.use('/comments', commentsRouter);
app.use('/statuses', statusesRouter);
app.use('/notifications', notificationsRouter);
app.use('/users', usersRouter);

app.use((_req: Request, res: Response) => {
  sendError(res, 404, 'Route not found');
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  void _next;
  console.error(error);
  sendError(res, 500, 'Internal server error');
});
