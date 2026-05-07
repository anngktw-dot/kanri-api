import type { Response } from 'express';

export function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ message });
}

export function publicUser(user: {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt?: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt?.toISOString(),
  };
}
