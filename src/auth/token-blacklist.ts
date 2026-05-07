import { prisma } from '../db.js';

export async function revokeToken(jti: string, userId: string, expiresAt: number): Promise<void> {
  await prisma.revokedToken.upsert({
    where: { tokenJti: jti },
    update: {
      expiresAt: new Date(expiresAt * 1000),
    },
    create: {
      tokenJti: jti,
      userId,
      expiresAt: new Date(expiresAt * 1000),
    },
  });
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  const revokedToken = await prisma.revokedToken.findUnique({
    where: { tokenJti: jti },
    select: { expiresAt: true },
  });

  if (!revokedToken) {
    return false;
  }

  if (revokedToken.expiresAt <= new Date()) {
    await prisma.revokedToken.delete({
      where: { tokenJti: jti },
    });
    return false;
  }

  return true;
}

export async function pruneExpiredRevokedTokens(): Promise<void> {
  await prisma.revokedToken.deleteMany({
    where: {
      expiresAt: {
        lte: new Date(),
      },
    },
  });
}
