import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/auth.service.js';
import { Database } from '../src/db.js';

describe('IdentityService - Auth & JWT', () => {
  const authService = new AuthService('test-secret-salt-key-12345');

  it('correctly hashes passwords with unique salts and verifies correctly', () => {
    const rawPass = 'SecretGroceryPass123!';
    const hash1 = authService.hashPassword(rawPass);
    const hash2 = authService.hashPassword(rawPass);

    // Each hash should have unique salt
    assert.notEqual(hash1, hash2);

    // Both should verify successfully
    assert.equal(authService.verifyPassword(rawPass, hash1), true);
    assert.equal(authService.verifyPassword(rawPass, hash2), true);

    // Wrong password should fail
    assert.equal(authService.verifyPassword('WrongPassword', hash1), false);
  });

  it('signs and verifies JWT tokens with valid claims and expiration', () => {
    const claims = {
      userId: 'user-uuid-1',
      role: 'CUSTOMER' as const,
      fullName: 'Rahul Sharma',
      email: 'rahul@example.com',
    };

    const token = authService.signToken(claims, 3600);
    assert.ok(token);

    const verified = authService.verifyToken(token);
    assert.ok(verified);
    assert.equal(verified.userId, 'user-uuid-1');
    assert.equal(verified.role, 'CUSTOMER');
    assert.equal(verified.fullName, 'Rahul Sharma');
    assert.equal(verified.email, 'rahul@example.com');
    assert.ok(verified.exp > verified.iat);
  });

  it('rejects tampered or malformed JWT tokens', () => {
    const token = authService.signToken(
      {
        userId: 'user-uuid-2',
        role: 'CUSTOMER' as const,
        fullName: 'Test User',
      },
      3600
    );

    // Tamper with payload
    const parts = token.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ userId: 'user-uuid-2', role: 'STORE_ADMIN', exp: 9999999999 })
    ).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    assert.equal(authService.verifyToken(tamperedToken), null);
    assert.equal(authService.verifyToken('malformed.token'), null);
  });

  it('rejects expired JWT tokens immediately', () => {
    // Generate token expired 10 seconds ago
    const expiredToken = authService.signToken(
      {
        userId: 'user-uuid-3',
        role: 'CUSTOMER' as const,
        fullName: 'Expired User',
      },
      -10
    );

    assert.equal(authService.verifyToken(expiredToken), null);
  });

  it('registers and logs in user against database', async () => {
    let insertedUser: any = null;

    // Mock Database.query
    Database.query = async (text: string, params?: any[]): Promise<any> => {
      if (text.includes('INSERT INTO users')) {
        insertedUser = {
          id: params?.[0],
          full_name: params?.[1],
          email: params?.[2],
          phone: params?.[3],
          password_hash: params?.[4],
          role: params?.[5],
          is_active: true,
        };
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('SELECT id, full_name')) {
        if (insertedUser && (params?.[0] === insertedUser.email || params?.[0] === insertedUser.phone)) {
          return { rowCount: 1, rows: [insertedUser] };
        }
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    // 1. Register
    const regResult = await authService.register({
      fullName: 'Anita Roy',
      email: 'anita@example.com',
      password: 'MyStrongPassword99!',
      role: 'CUSTOMER',
    });

    assert.ok(regResult.token);
    assert.equal(regResult.user.fullName, 'Anita Roy');
    assert.equal(regResult.user.role, 'CUSTOMER');

    // 2. Successful Login
    const loginResult = await authService.login('anita@example.com', 'MyStrongPassword99!');
    assert.ok(loginResult);
    assert.equal(loginResult.user.fullName, 'Anita Roy');

    // 3. Failed Login with wrong password
    const failedLogin = await authService.login('anita@example.com', 'WrongPassword!');
    assert.equal(failedLogin, null);
  });
});
