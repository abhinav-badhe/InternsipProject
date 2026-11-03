import express, { Request, Response, NextFunction } from 'express';
import { PricingRepository } from './pricing.repository.js';
import { PricingCalculator } from './pricing.calculator.js';
import { Database } from './db.js';
import {
  createLogger,
  generateCorrelationId,
  runWithContext,
  getRequestContext,
} from '@grocery/observability';
import { okResponse, errorResponse, QuoteRequest } from '@grocery/contracts';

const logger = createLogger('pricing-service:api');
const pricingRepo = new PricingRepository();

export function createApp(): express.Application {
  const app = express();
  app.use(express.json());

  // Correlation ID and context middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || generateCorrelationId();
    res.setHeader('X-Correlation-Id', correlationId);

    runWithContext(
      {
        correlationId,
        serviceName: 'pricing-service',
        route: `${req.method} ${req.path}`,
      },
      () => {
        logger.info('Incoming pricing request', { method: req.method, path: req.path });
        next();
      }
    );
  });

  // Liveness check
  app.get('/health/live', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'live', timestamp: new Date().toISOString() });
  });

  // Readiness check
  app.get('/health/ready', async (_req: Request, res: Response) => {
    const isDbHealthy = await Database.checkHealth();
    if (isDbHealthy) {
      res.status(200).json({ status: 'ready', database: 'connected' });
    } else {
      res.status(503).json({ status: 'not_ready', database: 'disconnected' });
    }
  });

  // Auto-bootstrap coupons and referrals
  const initCouponsAndReferrals = async () => {
    try {
      await Database.query(`
        CREATE TABLE IF NOT EXISTS promotions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          code VARCHAR(32) NOT NULL UNIQUE,
          description TEXT,
          discount_type VARCHAR(32) NOT NULL,
          discount_value NUMERIC(10, 2) NOT NULL,
          min_order_amount NUMERIC(12, 4) DEFAULT 0,
          max_discount_amount NUMERIC(12, 4),
          starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ends_at TIMESTAMPTZ,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);

        INSERT INTO promotions (code, description, discount_type, discount_value, min_order_amount, max_discount_amount, is_active)
        VALUES 
          ('WELCOME50', 'Flat ₹50 OFF on your first grocery basket (Min order ₹199)', 'FIXED_AMOUNT', 50.00, 199.00, 50.00, TRUE),
          ('SAVE10', '10% OFF on all fresh fruits, veggies & staples (Min order ₹300)', 'PERCENTAGE', 10.00, 300.00, 100.00, TRUE),
          ('FREESHIP', 'Free Express Home Delivery on orders above ₹149', 'FREE_SHIPPING', 40.00, 149.00, 40.00, TRUE),
          ('FLAT100', 'Flat ₹100 instant discount on mega restock (Min order ₹699)', 'FIXED_AMOUNT', 100.00, 699.00, 100.00, TRUE),
          ('FRESH20', '20% Mega Savings for Weekend Super Savers (Min order ₹499)', 'PERCENTAGE', 20.00, 499.00, 150.00, TRUE)
        ON CONFLICT (code) DO NOTHING;

        CREATE TABLE IF NOT EXISTS customer_referrals (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          referrer_customer_id VARCHAR(64) NOT NULL,
          referral_code VARCHAR(32) NOT NULL UNIQUE,
          referee_customer_id VARCHAR(64),
          status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
          reward_amount NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          redeemed_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON customer_referrals(referrer_customer_id);
        CREATE INDEX IF NOT EXISTS idx_referrals_code ON customer_referrals(referral_code);

        CREATE TABLE IF NOT EXISTS surge_rules (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          code VARCHAR(64) NOT NULL UNIQUE,
          name VARCHAR(128) NOT NULL,
          surge_type VARCHAR(32) NOT NULL,
          fee_amount NUMERIC(10, 2) NOT NULL DEFAULT 20.00,
          multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
          description TEXT,
          is_active BOOLEAN NOT NULL DEFAULT FALSE,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_surge_rules_active ON surge_rules(is_active);

        INSERT INTO surge_rules (code, name, surge_type, fee_amount, multiplier, description, is_active)
        VALUES
          ('RAIN_SURGE', 'Monsoon / Heavy Rain Surcharge', 'WEATHER', 25.00, 1.00, 'Rain fee passed 100% to delivery riders braving adverse weather.', FALSE),
          ('PEAK_DEMAND', 'Peak Evening Order Rush', 'HIGH_DEMAND', 20.00, 1.15, 'High fulfillment demand surge to balance dark store picking capacity.', FALSE),
          ('LATE_NIGHT', 'Midnight Delivery Surcharge', 'LATE_NIGHT', 30.00, 1.00, 'Late night rider safety and operational shift surcharge.', FALSE)
        ON CONFLICT (code) DO NOTHING;
      `);
    } catch (err: any) {
      logger.warn('Coupons and referrals bootstrap notice', { message: err.message });
    }
  };
  initCouponsAndReferrals().catch(() => {});

  // =========================================================
  // Feature 17: Referral System and Coupon Engine APIs
  // =========================================================

  // List all currently available public coupons
  app.get('/api/v1/pricing/coupons', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const query = `
        SELECT code, description, discount_type, discount_value, min_order_amount, max_discount_amount
        FROM promotions
        WHERE is_active = TRUE
          AND starts_at <= NOW()
          AND (ends_at IS NULL OR ends_at > NOW())
        ORDER BY min_order_amount ASC;
      `;
      const result = await Database.query(query);

      res.status(200).json(
        okResponse(
          result.rows.map((r) => ({
            code: r.code,
            description: r.description,
            discountType: r.discount_type,
            discountValue: parseFloat(r.discount_value),
            minOrderAmount: parseFloat(r.min_order_amount || '0'),
            maxDiscountAmount: r.max_discount_amount ? parseFloat(r.max_discount_amount) : undefined,
          })),
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Validate a specific coupon code against basket subtotal
  app.post('/api/v1/pricing/coupons/validate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const { code, subtotal } = req.body;

      if (!code || typeof code !== 'string') {
        return res.status(400).json(errorResponse('INVALID_PARAM', 'code is required', correlationId));
      }

      const basketTotal = parseFloat(subtotal || '0');
      const promo = await pricingRepo.getPromotionByCode(code.trim());

      if (!promo) {
        return res.status(404).json(
          errorResponse('COUPON_NOT_FOUND', `Coupon code "${code}" is invalid or expired`, correlationId)
        );
      }

      if (basketTotal < promo.minOrderAmount) {
        return res.status(400).json(
          errorResponse(
            'MIN_ORDER_NOT_MET',
            `Coupon "${promo.code}" requires a minimum order of ₹${promo.minOrderAmount.toFixed(2)}. Add ₹${(promo.minOrderAmount - basketTotal).toFixed(2)} more items to apply.`,
            correlationId
          )
        );
      }

      // Calculate discount amount
      let discountAmount = 0;
      if (promo.discountType === 'FIXED_AMOUNT') {
        discountAmount = promo.discountValue;
      } else if (promo.discountType === 'PERCENTAGE') {
        discountAmount = (basketTotal * promo.discountValue) / 100;
        if (promo.maxDiscountAmount && discountAmount > promo.maxDiscountAmount) {
          discountAmount = promo.maxDiscountAmount;
        }
      } else if (promo.discountType === 'FREE_SHIPPING') {
        discountAmount = promo.discountValue || 40.0;
      }

      discountAmount = Math.min(basketTotal, Number(discountAmount.toFixed(2)));

      res.status(200).json(
        okResponse(
          {
            valid: true,
            code: promo.code,
            discountType: promo.discountType,
            discountAmount,
            description: promo.description,
            savingsMessage: `You save ₹${discountAmount.toFixed(2)} with ${promo.code}!`,
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Get or Generate Customer's Unique Referral Code & Stats
  app.get('/api/v1/pricing/referrals/my-code', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const customerId =
        (req.headers['x-user-id'] as string) ||
        (req.query.customerId as string) ||
        'cust_demo';

      // Check if code already exists for this referrer
      let refRes = await Database.query(
        `SELECT referral_code, reward_amount, created_at
         FROM customer_referrals
         WHERE referrer_customer_id = $1 AND referee_customer_id IS NULL
         LIMIT 1`,
        [customerId]
      );

      let referralCode = refRes.rows[0]?.referral_code;

      if (!referralCode) {
        // Generate memorable referral code
        const cleanId = customerId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
        referralCode = `FC${cleanId || 'GIFT'}${Math.floor(100 + Math.random() * 900)}`;

        await Database.query(
          `INSERT INTO customer_referrals (referrer_customer_id, referral_code, reward_amount)
           VALUES ($1, $2, 100.00)`,
          [customerId, referralCode]
        );
      }

      // Count successful redeemed referrals
      const statsRes = await Database.query(
        `SELECT COUNT(*) as friends_invited
         FROM customer_referrals
         WHERE referrer_customer_id = $1 AND referee_customer_id IS NOT NULL`,
        [customerId]
      );

      const friendsInvited = parseInt(statsRes.rows[0]?.friends_invited || '0', 10);
      const rewardPerFriend = 100.0;
      const totalEarned = friendsInvited * rewardPerFriend;

      res.status(200).json(
        okResponse(
          {
            customerId,
            referralCode,
            shareUrl: `http://localhost:5173/?ref=${referralCode}`,
            rewardPerFriend,
            friendsInvited,
            totalEarned,
            shareMessage: `Get ₹100 instant bonus on FreshCart groceries! Use my referral code ${referralCode} at http://localhost:5173/?ref=${referralCode}`,
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Claim a Friend's Referral Code on Sign-Up or Checkout
  app.post('/api/v1/pricing/referrals/claim', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const refereeId =
        (req.headers['x-user-id'] as string) ||
        req.body?.customerId ||
        'cust_new';
      const { referralCode } = req.body;

      if (!referralCode) {
        return res.status(400).json(errorResponse('INVALID_PARAM', 'referralCode is required', correlationId));
      }

      const codeClean = referralCode.trim().toUpperCase();

      const refCheck = await Database.query(
        `SELECT id, referrer_customer_id, reward_amount
         FROM customer_referrals
         WHERE UPPER(referral_code) = $1
         LIMIT 1`,
        [codeClean]
      );

      if (refCheck.rows.length === 0) {
        return res
          .status(404)
          .json(errorResponse('INVALID_REFERRAL', `Referral code "${referralCode}" not found`, correlationId));
      }

      const referrer = refCheck.rows[0];
      if (referrer.referrer_customer_id === refereeId) {
        return res
          .status(400)
          .json(errorResponse('SELF_REFERRAL', 'You cannot use your own referral code', correlationId));
      }

      // Check if already claimed by this referee
      const existingClaim = await Database.query(
        `SELECT id FROM customer_referrals WHERE referee_customer_id = $1 LIMIT 1`,
        [refereeId]
      );

      if (existingClaim.rows.length > 0) {
        return res.status(400).json(
          errorResponse('ALREADY_CLAIMED', 'You have already redeemed a referral welcome gift', correlationId)
        );
      }

      // Record successful referral redemption
      await Database.query(
        `INSERT INTO customer_referrals (referrer_customer_id, referral_code, referee_customer_id, status, reward_amount, redeemed_at)
         VALUES ($1, $2, $3, 'REDEEMED', 100.00, NOW())`,
        [referrer.referrer_customer_id, codeClean, refereeId]
      );

      res.status(200).json(
        okResponse(
          {
            success: true,
            referralCode: codeClean,
            rewardAmount: 100.0,
            message: '🎉 Referral code applied! ₹100 welcome reward unlocked for your account.',
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // =========================================================
  // Feature 18: Dynamic / Surge Pricing Engine APIs
  // =========================================================

  // Live Surge Status (Weather, Peak Demand, Late Night)
  app.get('/api/v1/pricing/surge/status', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const activeRes = await Database.query(
        `SELECT code, name, surge_type, fee_amount, multiplier, description, is_active
         FROM surge_rules
         ORDER BY fee_amount DESC`
      );

      const allRules = activeRes.rows.map((r) => ({
        code: r.code,
        name: r.name,
        surgeType: r.surge_type,
        feeAmount: parseFloat(r.fee_amount),
        multiplier: parseFloat(r.multiplier),
        description: r.description,
        isActive: Boolean(r.is_active),
      }));

      const activeRules = allRules.filter((r) => r.isActive);
      const isSurgeActive = activeRules.length > 0;
      const totalSurgeFee = activeRules.reduce((sum, r) => sum + r.feeAmount, 0);
      const maxMultiplier = activeRules.reduce((max, r) => Math.max(max, r.multiplier), 1.0);
      const reasons = activeRules.map((r) => r.name);

      res.status(200).json(
        okResponse(
          {
            isSurgeActive,
            totalSurgeFee,
            multiplier: maxMultiplier,
            reasons,
            activeRules,
            allRules,
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Toggle or Override Surge Rule (Staff / Operations / Weather Simulation)
  app.post('/api/v1/pricing/surge/toggle', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const { code, isActive } = req.body;

      if (!code || typeof isActive !== 'boolean') {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'code and boolean isActive are required', correlationId));
      }

      await Database.query(
        `UPDATE surge_rules
         SET is_active = $1, updated_at = NOW()
         WHERE UPPER(code) = UPPER($2)`,
        [isActive, code]
      );

      logger.info('Surge rule updated', { code, isActive });

      res.status(200).json(
        okResponse(
          {
            success: true,
            code,
            isActive,
            message: `Surge rule ${code} is now ${isActive ? 'ACTIVE' : 'INACTIVE'}`,
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Price Quote Endpoint (Recalculates cart/checkout prices with taxes & discounts)
  app.post('/api/v1/pricing/quote', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as QuoteRequest;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'At least one item is required for quote', correlationId));
      }

      for (const item of body.items) {
        if (!item.sku || typeof item.quantity !== 'number' || item.quantity <= 0) {
          return res
            .status(400)
            .json(errorResponse('INVALID_ITEM', `Invalid SKU or quantity for item: ${item.sku}`, correlationId));
        }
      }

      const skus = body.items.map((i) => i.sku);
      const priceMap = await pricingRepo.getPricesBySkus(skus);

      // Check if all requested items have active prices
      const missingSkus = skus.filter((sku) => !priceMap.has(sku));
      if (missingSkus.length > 0) {
        return res
          .status(404)
          .json(
            errorResponse(
              'PRICE_NOT_FOUND',
              `Active price not found for SKUs: ${missingSkus.join(', ')}`,
              correlationId,
              { missingSkus }
            )
          );
      }

      // Check promotion if promoCode was supplied
      let promotion;
      if (body.promoCode) {
        promotion = await pricingRepo.getPromotionByCode(body.promoCode);
      }

      const quote = PricingCalculator.calculateQuote({
        items: body.items,
        priceMap,
        promotion: promotion || undefined,
      });

      res.json(okResponse(quote, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // All active base prices
  app.get('/api/v1/pricing/prices', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const priceMap = await pricingRepo.getAllActivePrices();
      const prices = Array.from(priceMap.values());
      res.json(okResponse(prices, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Single SKU price inquiry
  app.get('/api/v1/pricing/prices/:sku', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sku = req.params.sku as string;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const priceMap = await pricingRepo.getPricesBySkus([sku]);
      const price = priceMap.get(sku);

      if (!price) {
        return res
          .status(404)
          .json(errorResponse('NOT_FOUND', `Active price not found for SKU: ${sku}`, correlationId));
      }

      res.json(okResponse(price, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled pricing service exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}
