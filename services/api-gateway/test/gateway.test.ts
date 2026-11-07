import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { AuthMiddleware } from '../src/auth.middleware.js';

describe('ApiGateway & Scenario 05 (Customer Cross-Tenant Data Isolation)', () => {
  const jwtSecret = 'test_gateway_jwt_secret_999';

  // Generate test tokens
  const tokenCustomerA = signTestToken(
    {
      userId: 'cust-A-uuid',
      role: 'CUSTOMER',
      fullName: 'Customer Alpha',
      email: 'alpha@example.com',
    },
    jwtSecret
  );

  const tokenCustomerB = signTestToken(
    {
      userId: 'cust-B-uuid',
      role: 'CUSTOMER',
      fullName: 'Customer Beta',
      email: 'beta@example.com',
    },
    jwtSecret
  );

  const tokenStoreAdmin = signTestToken(
    {
      userId: 'admin-uuid-1',
      role: 'STORE_ADMIN',
      fullName: 'Admin User',
      email: 'admin@grocerystore.com',
    },
    jwtSecret
  );

  // Mock downstream database of orders
  const mockOrdersDb: Record<string, { customerId: string; total: number; orderNumber: string }> = {
    'ORD-AAA-01': { customerId: 'cust-A-uuid', total: 450.0, orderNumber: 'ORD-AAA-01' },
    'ORD-BBB-02': { customerId: 'cust-B-uuid', total: 1200.0, orderNumber: 'ORD-BBB-02' },
  };

  // Mock downstream dispatcher simulating microservices
  const mockDispatcher = async (
    targetBaseUrl: string,
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: any
  ): Promise<{ status: number; body: any }> => {
    // 1. Order Service mock
    if (targetBaseUrl.includes('3004') || path.startsWith('/api/v1/orders')) {
      const match = path.match(/\/api\/v1\/orders\/([^/?]+)/);
      if (match) {
        const orderId = match[1];
        const order = mockOrdersDb[orderId];
        if (!order) {
          return { status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } } };
        }

        const requestingUserId = headers['x-user-id'];
        const requestingUserRole = headers['x-user-role'];

        // Strict cross-tenant check as implemented in order-service
        if (requestingUserRole !== 'STORE_ADMIN' && requestingUserId && requestingUserId !== order.customerId) {
          return {
            status: 403,
            body: {
              success: false,
              error: {
                code: 'CROSS_TENANT_ACCESS_DENIED',
                message: 'Access forbidden: You cannot view orders belonging to another customer',
              },
            },
          };
        }

        return {
          status: 200,
          body: { success: true, data: order },
        };
      }

      return { status: 200, body: { success: true, data: [] } };
    }

    // 2. Inventory Service mock
    if (targetBaseUrl.includes('3003') || path.startsWith('/api/v1/inventory')) {
      return { status: 200, body: { success: true, data: { adjusted: true } } };
    }

    return { status: 200, body: { success: true, data: {} } };
  };

  const app = createApp({
    jwtSecret,
    dispatcher: mockDispatcher,
    rateLimitMaxRequests: 100, // standard threshold for general tests
    rateLimitWindowMs: 60000,
  });

  // Acceptance Scenario 05: Customer A CANNOT access Customer B's order
  it('Scenario 05: Blocks cross-tenant order access when Customer A requests Customer B order', async () => {
    // Customer A attempts to fetch Customer B's order ORD-BBB-02
    const res = await simulateRequest(app, {
      method: 'GET',
      path: '/api/v1/orders/ORD-BBB-02',
      headers: {
        authorization: `Bearer ${tokenCustomerA}`,
      },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'CROSS_TENANT_ACCESS_DENIED');
  });

  it('Scenario 05: Allows Customer A to access their own order', async () => {
    const res = await simulateRequest(app, {
      method: 'GET',
      path: '/api/v1/orders/ORD-AAA-01',
      headers: {
        authorization: `Bearer ${tokenCustomerA}`,
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.orderNumber, 'ORD-AAA-01');
  });

  it('Scenario 05: Allows Store Admin to view any customer order', async () => {
    const res = await simulateRequest(app, {
      method: 'GET',
      path: '/api/v1/orders/ORD-BBB-02',
      headers: {
        authorization: `Bearer ${tokenStoreAdmin}`,
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.orderNumber, 'ORD-BBB-02');
  });

  it('Rejects unauthenticated requests to protected order endpoints', async () => {
    const res = await simulateRequest(app, {
      method: 'GET',
      path: '/api/v1/orders/ORD-AAA-01',
      headers: {},
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  it('Rejects tampered session tokens', async () => {
    const tampered = tokenCustomerA.substring(0, tokenCustomerA.length - 6) + 'abcdef';
    const res = await simulateRequest(app, {
      method: 'GET',
      path: '/api/v1/orders/ORD-AAA-01',
      headers: {
        authorization: `Bearer ${tampered}`,
      },
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_TOKEN');
  });

  it('Enforces RBAC: prevents customer from accessing staff-only inventory endpoint', async () => {
    const res = await simulateRequest(app, {
      method: 'POST',
      path: '/api/v1/inventory/adjust',
      headers: {
        authorization: `Bearer ${tokenCustomerA}`,
      },
      body: { sku: 'SOAP-MED-01', delta: 10 },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  it('Enforces RBAC: allows STORE_ADMIN to access staff-only inventory endpoint', async () => {
    const res = await simulateRequest(app, {
      method: 'POST',
      path: '/api/v1/inventory/adjust',
      headers: {
        authorization: `Bearer ${tokenStoreAdmin}`,
      },
      body: { sku: 'SOAP-MED-01', delta: 10 },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.adjusted, true);
  });

  it('Enforces rate limiting when request limit is exceeded', async () => {
    const limitedApp = createApp({
      jwtSecret,
      dispatcher: mockDispatcher,
      rateLimitMaxRequests: 3,
      rateLimitWindowMs: 10000,
    });

    // Send 3 allowed requests
    for (let i = 0; i < 3; i++) {
      const res = await simulateRequest(limitedApp, {
        method: 'GET',
        path: '/health/live',
        headers: {},
      });
      assert.equal(res.status, 200);
    }

    // 4th request must be rejected with 429
    const limitedRes = await simulateRequest(limitedApp, {
      method: 'GET',
      path: '/health/live',
      headers: {},
    });

    assert.equal(limitedRes.status, 429);
    assert.equal(limitedRes.body.error.code, 'RATE_LIMIT_EXCEEDED');
    assert.ok(limitedRes.headers['x-ratelimit-reset']);
  });

  it('Feature: DistributedRateLimiter enforces limits using Redis cluster/client', async () => {
    // Mock Redis client
    let counter = 0;
    const mockRedis = {
      multi() {
        return {
          incr(key: string) {
            counter++;
            return this;
          },
          ttl(key: string) {
            return this;
          },
          async exec() {
            return [
              [null, counter],
              [null, 55],
            ];
          },
        };
      },
      async expire() {},
    };

    const redisApp = createApp({
      jwtSecret,
      rateLimitMaxRequests: 2,
      redisClient: mockRedis,
    });

    const r1 = await simulateRequest(redisApp, { method: 'GET', path: '/health/live', headers: {} });
    assert.equal(r1.status, 200);

    const r2 = await simulateRequest(redisApp, { method: 'GET', path: '/health/live', headers: {} });
    assert.equal(r2.status, 200);

    const r3 = await simulateRequest(redisApp, { method: 'GET', path: '/health/live', headers: {} });
    assert.equal(r3.status, 429);
    assert.equal(r3.body.error.code, 'RATE_LIMIT_EXCEEDED');
  });

  it('ARC-01 Fix: Exposes IN_MEMORY mode in health check for single-instance free-tier transparency', async () => {
    const memoryApp = createApp({ jwtSecret });
    const resHealth = await simulateRequest(memoryApp, { method: 'GET', path: '/health' });
    assert.equal(resHealth.status, 200);
    assert.equal(resHealth.body.stateStorage.mode, 'IN_MEMORY');
    assert.equal(resHealth.body.stateStorage.multiInstanceSafe, false);

    const resReady = await simulateRequest(memoryApp, { method: 'GET', path: '/health/ready' });
    assert.equal(resReady.status, 200);
    assert.equal(resReady.body.stateStorage.distributed, false);
  });

  it('ARC-01 Fix: Exposes DISTRIBUTED_REDIS mode when Redis client is attached', async () => {
    const mockRedis: any = {
      multi() {
        return {
          incr() { return this; },
          ttl() { return this; },
          async exec() { return [[null, 1], [null, 60]]; },
        };
      },
      async expire() {},
      async get() { return null; },
      async set() {},
      async del() {},
    };

    const redisApp = createApp({ jwtSecret, redisClient: mockRedis });
    const resReady = await simulateRequest(redisApp, { method: 'GET', path: '/health/ready' });
    assert.equal(resReady.status, 200);
    assert.equal(resReady.body.stateStorage.distributed, true);
    assert.equal(resReady.body.stateStorage.multiInstanceSafe, true);
  });

  it('ARC-01 Fix: Fails closed when REQUIRE_DISTRIBUTED_CACHE=true and Redis is missing', async () => {
    process.env.REQUIRE_DISTRIBUTED_CACHE = 'true';
    try {
      const memoryApp = createApp({ jwtSecret });
      const resReady = await simulateRequest(memoryApp, { method: 'GET', path: '/health/ready' });
      assert.equal(resReady.status, 503);
      assert.equal(resReady.body.status, 'not_ready');

      // Mutating POST request with idempotency key must fail closed instead of risking split-brain duplicate execution
      const resPost = await simulateRequest(memoryApp, {
        method: 'POST',
        path: '/api/v1/orders/checkout',
        headers: { 'idempotency-key': 'test-idem-key-1' },
      });
      assert.equal(resPost.status, 503);
      assert.ok(
        ['DISTRIBUTED_CACHE_UNAVAILABLE', 'DISTRIBUTED_IDEMPOTENCY_UNAVAILABLE'].includes(resPost.body.error.code)
      );
    } finally {
      delete process.env.REQUIRE_DISTRIBUTED_CACHE;
    }
  });
});

// Helpers
function signTestToken(claims: any, secret: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    ...claims,
    iat: now,
    exp: now + 3600,
  };
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = require('node:crypto')
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

async function simulateRequest(
  app: any,
  opts: { method: string; path: string; headers?: Record<string, string>; body?: any }
): Promise<{ status: number; headers: Record<string, any>; body: any }> {
  return new Promise((resolve) => {
    const req: any = {
      method: opts.method,
      url: opts.path,
      originalUrl: opts.path,
      path: opts.path.split('?')[0],
      headers: opts.headers || {},
      body: opts.body || {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };

    let statusCode = 200;
    const resHeaders: Record<string, any> = {};

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      setHeader: (key: string, value: any) => {
        resHeaders[key.toLowerCase()] = value;
      },
      json: (data: any) => {
        resolve({
          status: statusCode,
          headers: resHeaders,
          body: data,
        });
      },
      send: (data: any) => {
        resolve({
          status: statusCode,
          headers: resHeaders,
          body: data,
        });
      },
    };

    app(req, res, (err: any) => {
      if (err) {
        resolve({
          status: 500,
          headers: resHeaders,
          body: { error: err.message },
        });
      }
    });
  });
}
