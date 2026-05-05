import express, { type Request, type Response } from 'express';
import { prisma } from './db.js';

export const app = express();

app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'Kanri API',
    status: 'running',
    health: '/health',
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
