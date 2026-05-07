import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { prisma } from '../db.js';

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createRefreshToken(userId: string): Promise<{
  refreshToken: string;
  expiresIn: number;
}> {
  const refreshToken = randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + config.refreshTokenTtlSeconds * 1000);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(refreshToken),
      userId,
      expiresAt,
    },
  });

  return {
    refreshToken,
    expiresIn: config.refreshTokenTtlSeconds,
  };
}

export async function rotateRefreshToken(refreshToken: string): Promise<{
  user: { id: string; email: string; name: string | null; createdAt: Date; updatedAt: Date };
  refreshToken: string;
  refreshExpiresIn: number;
} | null> {
  const tokenHash = hashRefreshToken(refreshToken);
  const session = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    return null;
  }

  const nextRefreshToken = randomBytes(48).toString('base64url');
  const nextExpiresAt = new Date(Date.now() + config.refreshTokenTtlSeconds * 1000);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        tokenHash: hashRefreshToken(nextRefreshToken),
        userId: session.userId,
        expiresAt: nextExpiresAt,
      },
    }),
  ]);

  return {
    user: session.user,
    refreshToken: nextRefreshToken,
    refreshExpiresIn: config.refreshTokenTtlSeconds,
  };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: {
      tokenHash: hashRefreshToken(refreshToken),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}
