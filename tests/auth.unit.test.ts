import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAccessToken, verifyAccessToken } from '../src/auth/jwt.js';
import { hashPassword, verifyPassword } from '../src/auth/password.js';
import { getEmailPassword, getOptionalName } from '../src/auth/validation.js';

void describe('auth unit tests', () => {
  void it('hashes and verifies passwords', () => {
    const passwordHash = hashPassword('ChangeMe123');

    assert.ok(passwordHash.startsWith('scrypt$'));
    assert.equal(verifyPassword('ChangeMe123', passwordHash), true);
    assert.equal(verifyPassword('wrong-password', passwordHash), false);
  });

  void it('signs and verifies JWT access tokens', () => {
    const token = createAccessToken({
      id: '6d828275-5550-4edb-913d-82da0a295b20',
      email: 'user@example.com',
    });
    const payload = verifyAccessToken(token.accessToken);

    assert.equal(payload.sub, '6d828275-5550-4edb-913d-82da0a295b20');
    assert.equal(payload.email, 'user@example.com');
    assert.ok(payload.exp > payload.iat);
    assert.ok(payload.jti);
  });

  void it('normalizes and validates auth payloads', () => {
    assert.deepEqual(
      getEmailPassword({
        email: ' USER@EXAMPLE.COM ',
        password: 'ChangeMe123',
      }),
      {
        email: 'user@example.com',
        password: 'ChangeMe123',
      },
    );
    assert.equal(getEmailPassword({ email: 'bad-email', password: 'ChangeMe123' }), null);
    assert.equal(getEmailPassword({ email: 'user@example.com', password: 'short' }), null);
    assert.equal(getOptionalName(' User '), 'User');
    assert.equal(getOptionalName('   '), null);
  });
});
