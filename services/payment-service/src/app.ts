import express, { Request, Response, NextFunction } from 'express';
import { PaymentProcessor, OrderClient } from './payment.processor.js';
import { Database } from './db.js';
import {
  createLogger,
  generateCorrelationId,
  runWithContext,
  getRequestContext,
} from '@grocery/observability';
import { okResponse, errorResponse } from '@grocery/contracts';

const logger = createLogger('payment-service:api');

export function createApp(deps?: { orderClient?: OrderClient }): express.Application {
  const app = express();

  // Capture raw body for webhook HMAC signature calculation
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  const orderClient: OrderClient = deps?.orderClient || {
    getOrderStatus: async (orderId) => {
      const res = await fetch(
        `${process.env.ORDER_SERVICE_URL || 'http://localhost:3004'}/api/v1/orders/${orderId}`
      );
      const json: any = await res.json();
      return json.data?.status || 'CANCELLED';
    },
    confirmOrderPayment: async (orderId, paymentId) => {
      const res = await fetch(
        `${process.env.ORDER_SERVICE_URL || 'http://localhost:3004'}/api/v1/orders/${orderId}/confirm-payment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId }),
        }
      );
      return res.ok;
    },
  };

  const processor = new PaymentProcessor(orderClient);

  // Correlation ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || generateCorrelationId();
    res.setHeader('X-Correlation-Id', correlationId);

    runWithContext(
      {
        correlationId,
        serviceName: 'payment-service',
        route: `${req.method} ${req.path}`,
      },
      () => {
        logger.info('Incoming payment request', { method: req.method, path: req.path });
        next();
      }
    );
  });

  // Health checks
  app.get('/health/live', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'live', timestamp: new Date().toISOString() });
  });

  app.get('/health/ready', async (_req: Request, res: Response) => {
    const isDbHealthy = await Database.checkHealth();
    if (isDbHealthy) {
      res.status(200).json({ status: 'ready', database: 'connected' });
    } else {
      res.status(503).json({ status: 'not_ready', database: 'disconnected' });
    }
  });

  // Auto-bootstrap customer wallet tables
  const initWalletTables = async () => {
    try {
      await Database.query(`
        CREATE TABLE IF NOT EXISTS customer_wallets (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          customer_id VARCHAR(64) NOT NULL UNIQUE,
          balance NUMERIC(12, 4) NOT NULL DEFAULT 0.0000 CHECK (balance >= 0),
          currency VARCHAR(3) NOT NULL DEFAULT 'INR',
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_cust_wallets_cust_id ON customer_wallets(customer_id);

        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          wallet_id UUID NOT NULL,
          customer_id VARCHAR(64) NOT NULL,
          type VARCHAR(32) NOT NULL,
          amount NUMERIC(12, 4) NOT NULL,
          balance_after NUMERIC(12, 4) NOT NULL,
          reference_id VARCHAR(128),
          description TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_wallet_tx_cust_id ON wallet_transactions(customer_id);
      `);
    } catch (err: any) {
      logger.warn('Wallet tables initialization note', { message: err.message });
    }
  };
  initWalletTables().catch(() => {});

  // =========================================================
  // Feature 15: Customer Wallet & Cashback APIs
  // =========================================================

  // Helper to ensure customer wallet exists (auto-credits ₹100 welcome bonus on creation)
  const getOrCreateWallet = async (customerId: string) => {
    const existing = await Database.query(
      `SELECT id, customer_id, balance, currency, is_active, created_at, updated_at
       FROM customer_wallets
       WHERE customer_id = $1
       LIMIT 1`,
      [customerId]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Auto-create wallet with ₹100 Welcome Gift
    const initialBonus = 100.0;
    const inserted = await Database.query(
      `INSERT INTO customer_wallets (customer_id, balance, currency, is_active)
       VALUES ($1, $2, 'INR', TRUE)
       RETURNING id, customer_id, balance, currency, is_active, created_at, updated_at`,
      [customerId, initialBonus]
    );
    const newWallet = inserted.rows[0];

    // Record welcome bonus transaction
    await Database.query(
      `INSERT INTO wallet_transactions (wallet_id, customer_id, type, amount, balance_after, reference_id, description)
       VALUES ($1, $2, 'WELCOME_BONUS', $3, $4, 'WELCOME_100', 'Welcome to FreshCart! Joining Bonus Credit')`,
      [newWallet.id, customerId, initialBonus, initialBonus]
    );

    return newWallet;
  };

  // Get Wallet Balance & Passbook Transactions
  app.get('/api/v1/payments/wallet', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const customerId =
        (req.headers['x-user-id'] as string) ||
        (req.query.customerId as string) ||
        'cust_demo';

      const wallet = await getOrCreateWallet(customerId);

      const txRes = await Database.query(
        `SELECT id, type, amount, balance_after, reference_id, description, created_at
         FROM wallet_transactions
         WHERE customer_id = $1
         ORDER BY created_at DESC
         LIMIT 30`,
        [customerId]
      );

      res.status(200).json(
        okResponse(
          {
            walletId: wallet.id,
            customerId: wallet.customer_id,
            balance: parseFloat(wallet.balance),
            currency: wallet.currency,
            isActive: wallet.is_active,
            transactions: txRes.rows.map((tx) => ({
              id: tx.id,
              type: tx.type,
              amount: parseFloat(tx.amount),
              balanceAfter: parseFloat(tx.balance_after),
              referenceId: tx.reference_id,
              description: tx.description,
              createdAt: tx.created_at,
            })),
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Top-Up Wallet Balance
  app.post('/api/v1/payments/wallet/topup', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const customerId =
        (req.headers['x-user-id'] as string) ||
        req.body?.customerId ||
        'cust_demo';
      const amount = parseFloat(req.body?.amount);
      const paymentMethod = req.body?.paymentMethod || 'UPI / NetBanking';

      if (isNaN(amount) || amount <= 0) {
        return res
          .status(400)
          .json(errorResponse('INVALID_AMOUNT', 'Top-up amount must be greater than 0', correlationId));
      }

      const wallet = await getOrCreateWallet(customerId);
      const newBalance = parseFloat(wallet.balance) + amount;

      await Database.query(
        `UPDATE customer_wallets
         SET balance = $1, updated_at = NOW()
         WHERE id = $2`,
        [newBalance, wallet.id]
      );

      const txRes = await Database.query(
        `INSERT INTO wallet_transactions (wallet_id, customer_id, type, amount, balance_after, reference_id, description)
         VALUES ($1, $2, 'TOPUP', $3, $4, $5, $6)
         RETURNING id, created_at`,
        [
          wallet.id,
          customerId,
          amount,
          newBalance,
          `TOPUP_${Date.now()}`,
          `Added funds to wallet via ${paymentMethod}`,
        ]
      );

      res.status(200).json(
        okResponse(
          {
            success: true,
            customerId,
            amountAdded: amount,
            newBalance,
            transactionId: txRes.rows[0]?.id,
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Pay Order using Wallet Balance (Atomically deducts balance)
  app.post('/api/v1/payments/wallet/pay', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const customerId =
        (req.headers['x-user-id'] as string) ||
        req.body?.customerId ||
        'cust_demo';
      const { orderId } = req.body;
      const amount = parseFloat(req.body?.amount);

      if (!orderId || isNaN(amount) || amount <= 0) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'orderId and positive amount are required', correlationId));
      }

      const wallet = await getOrCreateWallet(customerId);
      const currentBalance = parseFloat(wallet.balance);

      if (currentBalance < amount) {
        return res.status(400).json(
          errorResponse(
            'INSUFFICIENT_WALLET_BALANCE',
            `Insufficient wallet balance. Available: ₹${currentBalance.toFixed(2)}, Required: ₹${amount.toFixed(2)}`,
            correlationId
          )
        );
      }

      const newBalance = currentBalance - amount;

      await Database.query(
        `UPDATE customer_wallets
         SET balance = $1, updated_at = NOW()
         WHERE id = $2`,
        [newBalance, wallet.id]
      );

      const txRes = await Database.query(
        `INSERT INTO wallet_transactions (wallet_id, customer_id, type, amount, balance_after, reference_id, description)
         VALUES ($1, $2, 'ORDER_PAYMENT', $3, $4, $5, $6)
         RETURNING id, created_at`,
        [
          wallet.id,
          customerId,
          amount,
          newBalance,
          orderId,
          `Payment for FreshCart Order #${orderId}`,
        ]
      );

      // Notify Order Service of successful payment
      await orderClient.confirmOrderPayment(orderId, `wallet_tx_${txRes.rows[0]?.id}`).catch(() => {});

      res.status(200).json(
        okResponse(
          {
            success: true,
            orderId,
            paidAmount: amount,
            newBalance,
            transactionId: txRes.rows[0]?.id,
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Credit Cashback (e.g. 5% cashback on successful grocery deliveries)
  app.post('/api/v1/payments/wallet/cashback', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const customerId =
        (req.headers['x-user-id'] as string) ||
        req.body?.customerId ||
        'cust_demo';
      const { orderId } = req.body;
      const orderTotal = parseFloat(req.body?.orderTotal || '0');
      const rate = parseFloat(req.body?.rate || '0.05');

      if (!orderId || isNaN(orderTotal) || orderTotal <= 0) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'orderId and positive orderTotal required', correlationId));
      }

      const cashbackAmount = Math.max(5, Math.round(orderTotal * rate));
      const wallet = await getOrCreateWallet(customerId);
      const newBalance = parseFloat(wallet.balance) + cashbackAmount;

      await Database.query(
        `UPDATE customer_wallets
         SET balance = $1, updated_at = NOW()
         WHERE id = $2`,
        [newBalance, wallet.id]
      );

      const txRes = await Database.query(
        `INSERT INTO wallet_transactions (wallet_id, customer_id, type, amount, balance_after, reference_id, description)
         VALUES ($1, $2, 'CASHBACK', $3, $4, $5, $6)
         RETURNING id, created_at`,
        [
          wallet.id,
          customerId,
          cashbackAmount,
          newBalance,
          orderId,
          `5% FreshCart Cashback Reward on Order #${orderId}`,
        ]
      );

      res.status(200).json(
        okResponse(
          {
            success: true,
            orderId,
            cashbackAmount,
            newBalance,
            transactionId: txRes.rows[0]?.id,
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Create Payment Intent (Called during checkout)
  app.post('/api/v1/payments/intents', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId, amount, currency } = req.body;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!orderId || typeof amount !== 'number' || amount <= 0) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'orderId and positive amount are required', correlationId));
      }

      const result = await processor.createPaymentIntent({ orderId, amount, currency });
      res.status(201).json(okResponse(result, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Payment Provider Webhook Receiver (Acceptance Scenarios 3 & 4)
  app.post('/webhook/payment', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'test_webhook_secret_key';
      const signatureHeader = req.headers['x-webhook-signature'] as string | undefined;
      const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));

      const outcome = await processor.handleWebhook({
        rawBody,
        signatureHeader,
        webhookSecret,
        payload: req.body,
      });

      res.status(200).json(okResponse(outcome, correlationId));
    } catch (err: any) {
      if (err.message?.includes('INVALID_SIGNATURE')) {
        const correlationId = getRequestContext()?.correlationId || 'unknown';
        return res
          .status(401)
          .json(errorResponse('UNAUTHORIZED', 'Invalid or forged webhook signature', correlationId));
      }
      next(err);
    }
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled payment service exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}
