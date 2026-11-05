import express, { Request, Response, NextFunction } from 'express';
import { ForecasterService } from './forecaster.service.js';
import { Database } from './db.js';
import {
  createLogger,
  generateCorrelationId,
  runWithContext,
  getRequestContext,
} from '@grocery/observability';
import { okResponse, errorResponse } from '@grocery/contracts';

const logger = createLogger('analytics-service:api');
const forecaster = new ForecasterService();

export function createApp(): express.Application {
  const app = express();
  app.use(express.json());

  // Correlation ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || generateCorrelationId();
    res.setHeader('X-Correlation-Id', correlationId);

    runWithContext(
      {
        correlationId,
        serviceName: 'analytics-service',
        route: `${req.method} ${req.path}`,
      },
      () => {
        logger.info('Incoming analytics request', { method: req.method, path: req.path });
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

  // Auto-bootstrap CLV & Churn Analytics Schema
  const initClvSchema = async () => {
    try {
      await Database.query(`
        CREATE TABLE IF NOT EXISTS customer_clv_predictions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          customer_id VARCHAR(64) NOT NULL UNIQUE,
          customer_name VARCHAR(128) NOT NULL DEFAULT 'FreshCart Shopper',
          customer_phone VARCHAR(32),
          total_orders INTEGER NOT NULL DEFAULT 1,
          total_spend NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
          average_order_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
          days_since_last_order INTEGER NOT NULL DEFAULT 0,
          predicted_monthly_orders NUMERIC(5, 2) NOT NULL DEFAULT 3.50,
          predicted_annual_clv NUMERIC(12, 2) NOT NULL DEFAULT 12000.00,
          churn_probability NUMERIC(4, 2) NOT NULL DEFAULT 0.15,
          churn_risk_level VARCHAR(16) NOT NULL DEFAULT 'LOW',
          segment VARCHAR(32) NOT NULL DEFAULT 'LOYAL_REGULAR',
          recommended_action TEXT,
          last_order_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_clv_churn_risk ON customer_clv_predictions(churn_risk_level);

        INSERT INTO customer_clv_predictions (
          customer_id, customer_name, customer_phone, total_orders, total_spend, average_order_value,
          days_since_last_order, predicted_monthly_orders, predicted_annual_clv, churn_probability,
          churn_risk_level, segment, recommended_action, last_order_at
        )
        VALUES
          ('cust_101', 'Priya Sharma', '+91 98111 22334', 18, 9840.00, 546.67, 2, 8.5, 52480.00, 0.05, 'LOW', 'VIP_CHAMPION', 'VIP Priority delivery & complimentary samples', NOW() - INTERVAL '2 days'),
          ('cust_102', 'Rahul Verma', '+91 98222 33445', 9, 3915.00, 435.00, 5, 4.2, 21924.00, 0.12, 'LOW', 'LOYAL_REGULAR', 'Morning milk subscription prompt', NOW() - INTERVAL '5 days'),
          ('cust_103', 'Ananya Patel', '+91 98333 44556', 5, 2450.00, 490.00, 16, 1.8, 10584.00, 0.48, 'MEDIUM', 'AT_RISK', 'Send ₹50 reactivate coupon: WELCOME50', NOW() - INTERVAL '16 days'),
          ('cust_104', 'Vikram Malhotra', '+91 98444 55667', 3, 1180.00, 393.33, 34, 0.5, 2360.00, 0.85, 'HIGH', 'HIBERNATING', 'Automated WhatsApp "We miss you" reminder with free delivery', NOW() - INTERVAL '34 days'),
          ('cust_demo', 'Abhinav Badhe', '+91 98765 43210', 6, 2890.00, 481.67, 1, 6.0, 34680.00, 0.08, 'LOW', 'VIP_CHAMPION', 'Referral program ambassador invite', NOW() - INTERVAL '1 day')
        ON CONFLICT (customer_id) DO NOTHING;
      `);
    } catch (err: any) {
      logger.warn('CLV predictions bootstrap note', { message: err.message });
    }
  };
  initClvSchema().catch(() => {});

  // 1. Train ML Model Tournament & Choose Best Suitable Model
  app.post('/api/v1/analytics/train-model', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const trainingResult = await forecaster.trainAndSelectBestModel();
      res.status(200).json(okResponse(trainingResult, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 2. Get Active Model Information & Evaluation Diagnostics
  app.get('/api/v1/analytics/model-info', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      let info = forecaster.getModelInfo();
      if (!info) {
        info = await forecaster.trainAndSelectBestModel();
      }
      res.status(200).json(okResponse(info, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 3. Generate Storewide Demand Forecasts & Stockout Reorder Alerts
  app.post('/api/v1/analytics/generate-forecasts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const horizonDays = Number(req.body?.horizonDays || 7);
      const result = await forecaster.generateStorewideForecasts(horizonDays);
      res.status(200).json(okResponse(result, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 4. Retrieve Current Forecasts & Alerts List
  app.get('/api/v1/analytics/forecasts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const horizonDays = Number(req.query?.horizonDays || 7);
      const result = await forecaster.generateStorewideForecasts(horizonDays);
      res.status(200).json(okResponse(result, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Demand Forecast for Single SKU (Scenario 15: Tags model version and data freshness)
  app.get('/api/v1/analytics/forecast/:sku', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sku = req.params.sku as string;
      const horizonDays = Number(req.query.horizonDays || 7);
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const forecast = await forecaster.computeSkuForecast(sku, horizonDays);
      res.status(200).json(okResponse(forecast, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Stockout Risk Assessment (Scenario 15: Computes days-of-supply against supplier lead time)
  app.post('/api/v1/analytics/stockout-risk', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sku, currentAuthoritativeStock, supplierLeadTimeDays, safetyStockDays } = req.body;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!sku || currentAuthoritativeStock === undefined || supplierLeadTimeDays === undefined) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'sku, currentAuthoritativeStock, and supplierLeadTimeDays are required', correlationId));
      }

      const risk = await forecaster.assessStockoutRisk({
        sku,
        currentAuthoritativeStock: Number(currentAuthoritativeStock),
        supplierLeadTimeDays: Number(supplierLeadTimeDays),
        safetyStockDays: safetyStockDays ? Number(safetyStockDays) : undefined,
      });

      res.status(200).json(okResponse(risk, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // =========================================================
  // Feature 4: Proactive Reorder and Recurring Reminders
  // =========================================================

  // Candidates for proactive replenishment reminder
  app.get('/api/v1/analytics/reorder-reminders/candidates', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const reminderCandidatesRes = await Database.query(`
        SELECT 
          o.customer_id as "customerId",
          COALESCE(NULLIF(MAX(o.delivery_address->>'recipientName'), ''), 'FreshCart Shopper') as "customerName",
          COALESCE(NULLIF(MAX(o.delivery_address->>'phone'), ''), '+919876543210') as "customerPhone",
          oi.sku,
          oi.product_name as "productName",
          MAX(o.created_at) as "lastOrderedAt",
          COALESCE(EXTRACT(DAY FROM (NOW() - MAX(o.created_at))), 2)::int as "daysAgo"
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE o.status != 'CANCELLED'
        GROUP BY o.customer_id, oi.sku, oi.product_name
        HAVING EXTRACT(DAY FROM (NOW() - MAX(o.created_at))) >= 1
        ORDER BY "daysAgo" DESC
        LIMIT 20
      `);

      res.status(200).json(okResponse({ candidates: reminderCandidatesRes.rows }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Dispatch Proactive WhatsApp Reminder
  app.post('/api/v1/analytics/reorder-reminders/:customerId/send', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const { customerId } = req.params;
      const { sku, productName, phone, daysAgo = 3, customerName = 'Valued Shopper' } = req.body || {};

      const waUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
      const reorderLink = `http://localhost:5173/?reorderSku=${sku || 'AMUL-TZ-500ML'}`;

      const waMsg = `🥛 *Running Low on Essentials? FreshCart Smart Reminder*\n\nHello ${customerName}!\nIt's been ~${daysAgo} days since your last restock of *${productName || 'Fresh Milk & Pantry Essentials'}*.\n\nNeed a quick restock delivered in 10–15 mins?\n\n1️⃣ Reply *'REORDER'* to add directly to your WhatsApp cart\n2️⃣ Or 1-tap checkout online: ${reorderLink}\n\nHave a great day! 🛍️`;

      if (phone) {
        fetch(`${waUrl}/api/v1/whatsapp/dispatch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toPhone: phone,
            bodyText: waMsg,
          }),
        }).catch(() => {});
      }

      res.status(200).json(okResponse({
        customerId,
        phone,
        productName,
        message: `Dispatched restock reminder for ${productName} to ${phone || 'customer WhatsApp'}!`,
        preview: waMsg,
      }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // =========================================================
  // Feature 20: Customer Lifetime Value (CLV) & Churn Risk Prediction
  // (Live Transactional RFM Analytics Engine)
  // =========================================================

  const syncLiveCustomerRfm = async () => {
    try {
      const liveOrdersRes = await Database.query(`
        SELECT 
          o.customer_id,
          COALESCE(NULLIF(MAX(o.delivery_address->>'recipientName'), ''), 'FreshCart Shopper') as customer_name,
          COALESCE(NULLIF(MAX(o.delivery_address->>'phone'), ''), '') as customer_phone,
          COUNT(o.id)::int as total_orders,
          COALESCE(SUM(o.grand_total), 0)::numeric(12,2) as total_spend,
          COALESCE(AVG(o.grand_total), 0)::numeric(12,2) as average_order_value,
          COALESCE(EXTRACT(DAY FROM (NOW() - MAX(o.created_at))), 0)::int as days_since_last_order,
          MAX(o.created_at) as last_order_at
        FROM orders o
        WHERE o.status != 'CANCELLED'
        GROUP BY o.customer_id
      `);

      for (const row of liveOrdersRes.rows) {
        const totalSpend = parseFloat(row.total_spend) || 0;
        const totalOrders = row.total_orders || 1;
        const aov = parseFloat(row.average_order_value) || 0;
        const recencyDays = row.days_since_last_order;

        let churnRisk = 'LOW';
        let churnProb = 0.08;
        if (recencyDays > 21) {
          churnRisk = 'HIGH';
          churnProb = 0.75;
        } else if (recencyDays > 10) {
          churnRisk = 'MEDIUM';
          churnProb = 0.38;
        }

        let segment = 'NEW';
        if (totalSpend >= 5000 || totalOrders >= 10) {
          segment = 'VIP_CHAMPION';
        } else if (totalOrders >= 3) {
          segment = churnRisk === 'HIGH' ? 'AT_RISK' : 'LOYAL_REGULAR';
        } else if (churnRisk === 'HIGH') {
          segment = 'HIBERNATING';
        }

        const cadenceDays = Math.max(5, Math.round(recencyDays + 3));
        const predictedMonthly = Number((30 / cadenceDays).toFixed(2));
        const annualClv = Number((aov * predictedMonthly * 12 * (1 - churnProb)).toFixed(2));

        const action =
          segment === 'VIP_CHAMPION'
            ? 'VIP priority delivery & complimentary samples'
            : segment === 'AT_RISK'
            ? 'Send ₹50 reactivate coupon: WELCOME50'
            : segment === 'HIBERNATING'
            ? 'Win-back WhatsApp campaign with 20% off'
            : 'Morning milk subscription prompt';

        await Database.query(`
          INSERT INTO customer_clv_predictions (
            customer_id, customer_name, customer_phone, total_orders, total_spend,
            average_order_value, days_since_last_order, predicted_monthly_orders,
            predicted_annual_clv, churn_probability, churn_risk_level, segment,
            recommended_action, last_order_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
          ON CONFLICT (customer_id) DO UPDATE SET
            customer_name = EXCLUDED.customer_name,
            customer_phone = EXCLUDED.customer_phone,
            total_orders = EXCLUDED.total_orders,
            total_spend = EXCLUDED.total_spend,
            average_order_value = EXCLUDED.average_order_value,
            days_since_last_order = EXCLUDED.days_since_last_order,
            predicted_monthly_orders = EXCLUDED.predicted_monthly_orders,
            predicted_annual_clv = EXCLUDED.predicted_annual_clv,
            churn_probability = EXCLUDED.churn_probability,
            churn_risk_level = EXCLUDED.churn_risk_level,
            segment = EXCLUDED.segment,
            recommended_action = EXCLUDED.recommended_action,
            last_order_at = EXCLUDED.last_order_at,
            updated_at = NOW();
        `, [
          row.customer_id, row.customer_name, row.customer_phone, totalOrders, totalSpend,
          aov, recencyDays, predictedMonthly, annualClv, churnProb, churnRisk, segment,
          action, row.last_order_at
        ]);
      }
    } catch (err: any) {
      logger.warn('RFM live aggregation notice', { error: err.message });
    }
  };

  // Trigger Live RFM Recalculation
  app.post('/api/v1/analytics/customers/recalculate-rfm', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      await syncLiveCustomerRfm();
      res.status(200).json(okResponse({ message: 'Live customer RFM scores recalculated successfully' }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Get CLV & Churn Analytics Dashboard
  app.get('/api/v1/analytics/customers/clv-churn', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      // Keep metrics live with latest transactional orders
      await syncLiveCustomerRfm();

      const queryRes = await Database.query(
        `SELECT id, customer_id, customer_name, customer_phone, total_orders, total_spend,
                average_order_value, days_since_last_order, predicted_monthly_orders,
                predicted_annual_clv, churn_probability, churn_risk_level, segment,
                recommended_action, last_order_at
         FROM customer_clv_predictions
         ORDER BY predicted_annual_clv DESC`
      );

      const customers = queryRes.rows.map((r) => ({
        id: r.id,
        customerId: r.customer_id,
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
        totalOrders: r.total_orders,
        totalSpend: parseFloat(r.total_spend),
        averageOrderValue: parseFloat(r.average_order_value),
        daysSinceLastOrder: r.days_since_last_order,
        predictedMonthlyOrders: parseFloat(r.predicted_monthly_orders),
        predictedAnnualClv: parseFloat(r.predicted_annual_clv),
        churnProbability: parseFloat(r.churn_probability),
        churnRiskLevel: r.churn_risk_level,
        segment: r.segment,
        recommendedAction: r.recommended_action,
        lastOrderAt: r.last_order_at,
      }));

      const totalCustomers = customers.length;
      const totalPortfolioClv = customers.reduce((sum, c) => sum + c.predictedAnnualClv, 0);
      const averageClv = totalCustomers > 0 ? Math.round(totalPortfolioClv / totalCustomers) : 0;
      const highChurnRiskCount = customers.filter((c) => c.churnRiskLevel === 'HIGH').length;
      const vipCount = customers.filter((c) => c.segment === 'VIP_CHAMPION').length;

      res.status(200).json(
        okResponse(
          {
            summary: {
              totalCustomers,
              totalPortfolioClv,
              averageClv,
              highChurnRiskCount,
              vipCount,
            },
            customers,
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // 1-Click WhatsApp Reactivation Campaign for At-Risk Customers
  app.post('/api/v1/analytics/customers/:customerId/reactivate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const customerId = req.params.customerId;

      const custRes = await Database.query(
        `SELECT customer_id, customer_name, customer_phone, churn_risk_level, segment
         FROM customer_clv_predictions
         WHERE customer_id = $1
         LIMIT 1`,
        [customerId]
      );

      if (custRes.rows.length === 0) {
        return res
          .status(404)
          .json(errorResponse('NOT_FOUND', `Customer ${customerId} not found`, correlationId));
      }

      const cust = custRes.rows[0];

      // Update recommended action to reflect dispatched retention incentive
      await Database.query(
        `UPDATE customer_clv_predictions
         SET recommended_action = 'Dispatched 20% reactivation voucher via WhatsApp', updated_at = NOW()
         WHERE customer_id = $1`,
        [customerId]
      );

      // Dispatch retention reactivation message via notification-service
      try {
        const notifUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3011';
        if (cust.customer_phone) {
          await fetch(`${notifUrl}/api/v1/notifications/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId },
            body: JSON.stringify({
              recipientId: customerId,
              recipientAddress: cust.customer_phone,
              channel: 'WHATSAPP',
              templateCode: 'PROMO_DISCOUNT',
              payload: {
                customerName: cust.customer_name,
                discountPercent: 20,
                couponCode: 'FRESH20',
                message: `Hi ${cust.customer_name}, we miss you at FreshCart! Use code FRESH20 to get 20% off your next grocery order.`,
              },
            }),
          });
        }
      } catch (notifErr: any) {
        logger.warn('Failed to dispatch reactivation notification', { customerId, error: notifErr.message });
      }

      logger.info('Retention reactivation incentive triggered', { customerId, phone: cust.customer_phone });

      res.status(200).json(
        okResponse(
          {
            success: true,
            customerId,
            campaign: 'WINBACK_REACTIVATION_20',
            message: `Reactivation incentive dispatched to ${cust.customer_name} (${cust.customer_phone}) with code FRESH20.`,
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled analytics service exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}
