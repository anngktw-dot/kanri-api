import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createAccessToken, verifyAccessToken } from '../src/auth/jwt.js';
import { hashPassword } from '../src/auth/password.js';
import {
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../src/auth/refresh-token.js';
import { isTokenRevoked, revokeToken } from '../src/auth/token-blacklist.js';
import { prisma } from '../src/db.js';

const testUserEmail = 'test-auth@example.com';
let testUser: {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
};

void describe('auth database integration', () => {
  before(async () => {
    testUser = await prisma.user.upsert({
      where: { email: testUserEmail },
      update: {
        passwordHash: hashPassword('ChangeMe123'),
      },
      create: {
        email: testUserEmail,
        name: 'Test Auth',
        passwordHash: hashPassword('ChangeMe123'),
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  after(async () => {
    await prisma.$disconnect();
  });

  void it('persists access token revocation', async () => {
    const token = createAccessToken(testUser);
    const payload = verifyAccessToken(token.accessToken);

    assert.equal(await isTokenRevoked(payload.jti), false);

    await revokeToken(payload.jti, payload.sub, payload.exp);

    assert.equal(await isTokenRevoked(payload.jti), true);
  });

  void it('rotates refresh tokens and rejects reused sessions', async () => {
    const refresh = await createRefreshToken(testUser.id);
    const rotated = await rotateRefreshToken(refresh.refreshToken);

    assert.ok(rotated);
    assert.equal(rotated.user.id, testUser.id);
    assert.notEqual(rotated.refreshToken, refresh.refreshToken);

    const reused = await rotateRefreshToken(refresh.refreshToken);

    assert.equal(reused, null);

    await revokeRefreshToken(rotated.refreshToken);

    const afterRevoke = await rotateRefreshToken(rotated.refreshToken);

    assert.equal(afterRevoke, null);
  });
});
