import { prisma } from '../db.js';

export class NotificationService {
  static async create(userId: string, title: string, message: string, taskId?: string) {
    return prisma.notification.create({
      data: {
        userId,
        title,
        message,
        taskId,
      },
    });
  }
}
