import express, { type NextFunction, type Request, type Response } from 'express';
import { authRouter } from './auth/auth.router.js';
import { prisma } from './db.js';
import { cors, requestId, securityHeaders } from './http/middleware.js';
import { sendError } from './http/responses.js';
import { openApiDocument } from './openapi.js';
import { usersRouter } from './users/users.router.js';
import swaggerUi from 'swagger-ui-express';
import { tasksRouter } from './tasks/tasks.router.js';
import { statusesRouter } from './statuses/statuses.router.js';
import { notificationsRouter } from './notifications/notifications.router.js';
import { commentsRouter } from './comments/comments.router.js';

export const app = express();

app.use('/tasks', tasksRouter);
app.use('/statuses', statusesRouter);
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(requestId);
app.use(securityHeaders);
app.use(cors);
app.use(express.json({ limit: '1mb' }));
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

// app.get('/docs', (_req: Request, res: Response) => {
//   res.status(200).type('html').send(`<!doctype html>
// <html lang="en">
//   <head>
//     <meta charset="utf-8" />
//     <meta name="viewport" content="width=device-width, initial-scale=1" />
//     <title>Kanri API Docs</title>
//     <style>
//       body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: #111827; background: #f9fafb; }
//       main { max-width: 920px; margin: 0 auto; padding: 48px 24px; }
//       h1 { margin: 0 0 8px; font-size: 36px; }
//       p { color: #4b5563; line-height: 1.6; }
//       code, pre { background: #111827; color: #f9fafb; border-radius: 8px; }
//       code { padding: 2px 6px; }
//       pre { padding: 18px; overflow-x: auto; }
//       a { color: #2563eb; }
//     </style>
//   </head>
//   <body>
//     <main>
//       <h1>Kanri API</h1>
//       <p>OpenAPI documentation is available as JSON at <a href="/openapi.json">/openapi.json</a>.</p>
//       <p>Import it into Swagger UI, Postman, Insomnia, or any OpenAPI-compatible client.</p>
//       <pre><code>curl http://localhost:3000/openapi.json</code></pre>
//     </main>
//   </body>
// </html>`);
// });

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/statuses', statusesRouter);

app.use((_req: Request, res: Response) => {
  sendError(res, 404, 'Route not found');
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  void _next;
  console.error(error);
  sendError(res, 500, 'Internal server error');
});
