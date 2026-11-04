import express, { Request, Response, NextFunction } from 'express';
import { CatalogRepository } from './catalog.repository.js';
import { Database } from './db.js';
import {
  createLogger,
  generateCorrelationId,
  runWithContext,
  getRequestContext,
} from '@grocery/observability';
import { okResponse, errorResponse } from '@grocery/contracts';

const logger = createLogger('catalog-service:api');
const catalogRepo = new CatalogRepository();

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
        serviceName: 'catalog-service',
        route: `${req.method} ${req.path}`,
      },
      () => {
        logger.info('Incoming request', { method: req.method, path: req.path });
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

  // Auto-bootstrap reviews and recipes tables
  const initReviewsAndRecipes = async () => {
    try {
      await Database.query(`
        CREATE TABLE IF NOT EXISTS product_reviews (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          product_id UUID NOT NULL,
          customer_id VARCHAR(64) NOT NULL,
          customer_name VARCHAR(128) NOT NULL,
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
          review_text TEXT,
          is_verified_buyer BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id);

        CREATE TABLE IF NOT EXISTS recipe_bundles (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(128) NOT NULL,
          slug VARCHAR(128) NOT NULL UNIQUE,
          cuisine VARCHAR(64) NOT NULL,
          description TEXT NOT NULL,
          prep_time_minutes INTEGER NOT NULL DEFAULT 20,
          servings INTEGER NOT NULL DEFAULT 4,
          image_url TEXT,
          bundle_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS recipe_bundle_items (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          recipe_id UUID NOT NULL REFERENCES recipe_bundles(id) ON DELETE CASCADE,
          sku VARCHAR(64) NOT NULL,
          product_name VARCHAR(128) NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          unit VARCHAR(32) NOT NULL DEFAULT 'pack'
        );
        CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe ON recipe_bundle_items(recipe_id);

        INSERT INTO recipe_bundles (id, name, slug, cuisine, description, prep_time_minutes, servings, image_url, bundle_discount_percent, is_active)
        VALUES
          ('b1111111-1111-1111-1111-111111111111', 'Homestyle Dal Tadka & Jeera Rice', 'dal-tadka-jeera-rice', 'North Indian', 'Comforting yellow toor dal tempered with cumin, garlic, and fresh tomatoes, served with aromatic basmati rice.', 25, 4, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80', 12.00, TRUE),
          ('b2222222-2222-2222-2222-222222222222', 'Creamy Italian Penne Pasta', 'creamy-italian-penne-pasta', 'Italian', 'Classic al dente penne pasta tossed in rich herb tomato sauce, garnished with mozzarella and oregano.', 20, 2, 'https://images.unsplash.com/photo-1621996346565-e3d5d6281691?w=600&auto=format&fit=crop&q=80', 10.00, TRUE),
          ('b3333333-3333-3333-3333-333333333333', 'Classic Mumbai Pav Bhaji', 'mumbai-pav-bhaji', 'Street Food', 'Mouth-watering spiced mashed vegetable curry served with golden butter-toasted ladi pav and lemon wedges.', 30, 4, 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=600&auto=format&fit=crop&q=80', 15.00, TRUE),
          ('b4444444-4444-4444-4444-444444444444', 'Royal Kadai Paneer', 'royal-kadai-paneer', 'North Indian', 'Succulent fresh paneer cubes cooked in a fragrant freshly ground coriander and red chili masala gravy.', 25, 4, 'https://images.unsplash.com/photo-1567184109191-3783b856947d?w=600&auto=format&fit=crop&q=80', 10.00, TRUE)
        ON CONFLICT (slug) DO NOTHING;

        INSERT INTO recipe_bundle_items (recipe_id, sku, product_name, quantity, unit)
        VALUES
          ('b1111111-1111-1111-1111-111111111111', 'TOMATO-HYB-1KG', 'Fresh Hybrid Tomatoes', 1, '1 kg'),
          ('b1111111-1111-1111-1111-111111111111', 'ONION-RED-1KG', 'Fresh Red Onions', 1, '1 kg'),
          ('b1111111-1111-1111-1111-111111111111', 'AMUL-BTR-100G', 'Amul Pasteurized Butter', 1, '100 g'),
          ('b2222222-2222-2222-2222-222222222222', 'MAGGI-NOODLE-4PK', 'Maggi 2-Minute Noodles / Pasta', 2, 'pack'),
          ('b2222222-2222-2222-2222-222222222222', 'AMUL-CHZ-200G', 'Amul Processed Cheese Block', 1, '200 g'),
          ('b2222222-2222-2222-2222-222222222222', 'TOMATO-HYB-1KG', 'Fresh Hybrid Tomatoes', 1, '1 kg'),
          ('b3333333-3333-3333-3333-333333333333', 'POTATO-1KG', 'Fresh Baby Potatoes', 1, '1 kg'),
          ('b3333333-3333-3333-3333-333333333333', 'TOMATO-HYB-1KG', 'Fresh Hybrid Tomatoes', 1, '1 kg'),
          ('b3333333-3333-3333-3333-333333333333', 'ONION-RED-1KG', 'Fresh Red Onions', 1, '1 kg'),
          ('b3333333-3333-3333-3333-333333333333', 'AMUL-BTR-100G', 'Amul Pasteurized Butter', 2, '100 g'),
          ('b3333333-3333-3333-3333-333333333333', 'BRD-WHT-400G', 'Fresh Whole Wheat Bread / Pav', 1, '400 g'),
          ('b4444444-4444-4444-4444-444444444444', 'AMUL-TAAZA-1L', 'Amul Taaza Fresh Toned Milk', 1, '1 L'),
          ('b4444444-4444-4444-4444-444444444444', 'TOMATO-HYB-1KG', 'Fresh Hybrid Tomatoes', 1, '1 kg'),
          ('b4444444-4444-4444-4444-444444444444', 'ONION-RED-1KG', 'Fresh Red Onions', 1, '1 kg')
        ON CONFLICT DO NOTHING;
      `);
    } catch (err: any) {
      logger.warn('Reviews and recipe bundles bootstrap notice', { message: err.message });
    }
  };
  initReviewsAndRecipes().catch(() => {});

  // Categories list
  app.get('/api/v1/catalog/categories', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await catalogRepo.getCategories();
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      res.json(okResponse(categories, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Get All Active Categories
  app.get('/api/v1/catalog/categories', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const categories = await catalogRepo.getCategories();
      res.json(okResponse(categories, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Category Disambiguation (Used by WhatsApp Adapter to resolve terms like "soap")
  app.get('/api/v1/catalog/disambiguate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const term = (req.query.term as string) || '';
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!term.trim()) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'Search term query parameter is required', correlationId));
      }

      const result = await catalogRepo.disambiguateCategory(term);
      res.json(okResponse(result, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Product Search
  app.get('/api/v1/catalog/products', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query, categoryId, brandId, limit, offset } = req.query;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const result = await catalogRepo.searchProducts({
        query: query as string,
        categoryId: categoryId as string,
        brandId: brandId as string,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      res.json(okResponse(result, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Similar Product Alternatives (Used when SKU is out of stock)
  app.get('/api/v1/catalog/variants/:sku/alternatives', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sku = req.params.sku as string;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const result = await catalogRepo.getSimilarAlternatives(sku);
      if (!result) {
        return res
          .status(404)
          .json(errorResponse('NOT_FOUND', `Product variant with SKU ${sku} was not found`, correlationId));
      }

      res.json(okResponse(result, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // =========================================================
  // Feature 19: AI-Powered Product Recommendations
  // ("Frequently Bought Together" & Collaborative Affinity)
  // =========================================================
  app.get('/api/v1/catalog/recommendations', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const cartSkusParam = (req.query.cartSkus as string) || '';
      const inputSkus = cartSkusParam
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      const AFFINITY_PAIRS: Record<string, { complementarySkus: string[]; reason: string }> = {
        'AMUL-TAAZA-1L': { complementarySkus: ['BRD-WHT-400G', 'EGG-WHT-6PK', 'AMUL-BTR-100G'], reason: 'Frequently bought with Fresh Milk' },
        'BRD-WHT-400G': { complementarySkus: ['AMUL-BTR-100G', 'AMUL-TAAZA-1L', 'EGG-WHT-6PK'], reason: 'Breakfast Morning Combo' },
        'EGG-WHT-6PK': { complementarySkus: ['BRD-WHT-400G', 'AMUL-BTR-100G'], reason: 'High Protein Essentials' },
        'TATA-TEA-500G': { complementarySkus: ['SUG-M-1KG', 'AMUL-TAAZA-1L'], reason: 'Chai Time Pairing' },
        'MAGGI-NOODLE-4PK': { complementarySkus: ['AMUL-CHZ-200G', 'EGG-WHT-6PK'], reason: 'Quick Bites Pair' },
        'ONION-RED-1KG': { complementarySkus: ['TOMATO-HYB-1KG', 'POTATO-1KG'], reason: 'Daily Fresh Sabzi' },
        'TOMATO-HYB-1KG': { complementarySkus: ['ONION-RED-1KG', 'POTATO-1KG'], reason: 'Cooking Staples' },
      };

      const matchedAffinitySkus: Array<{ sku: string; reason: string; score: number }> = [];
      const seenSkus = new Set<string>(inputSkus);

      // 1. Live Transactional Market Basket Analysis (Co-occurrence Query from real historical orders)
      if (inputSkus.length > 0) {
        try {
          const coRes = await Database.query(
            `SELECT UPPER(oi2.sku) as sku, count(*)::int as frequency
             FROM order_items oi1
             JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND UPPER(oi1.sku) != UPPER(oi2.sku)
             WHERE UPPER(oi1.sku) = ANY($1)
             GROUP BY UPPER(oi2.sku)
             ORDER BY frequency DESC
             LIMIT 6`,
            [inputSkus]
          );
          for (const row of coRes.rows) {
            if (!seenSkus.has(row.sku)) {
              seenSkus.add(row.sku);
              matchedAffinitySkus.push({
                sku: row.sku,
                reason: `Frequently bought together (${row.frequency} verified co-purchases)`,
                score: Math.min(0.99, 0.85 + row.frequency * 0.02),
              });
            }
          }
        } catch {}
      }

      // 2. Fallback / Complement with Rule-Based Affinity Matrix
      for (const sku of inputSkus) {
        const pair = AFFINITY_PAIRS[sku];
        if (pair) {
          for (const cSku of pair.complementarySkus) {
            if (!seenSkus.has(cSku)) {
              seenSkus.add(cSku);
              matchedAffinitySkus.push({ sku: cSku, reason: pair.reason, score: 0.92 });
            }
          }
        }
      }

      // Fetch active catalog products to enrich recommendations
      const catalogResult = await catalogRepo.searchProducts({ limit: 50 });
      const enrichedRecommendations: any[] = [];

      // 1. Add matched affinity items
      for (const rec of matchedAffinitySkus) {
        for (const prod of catalogResult.items) {
          const matchedVariant = prod.variants.find((v) => v.sku.toUpperCase() === rec.sku);
          if (matchedVariant) {
            enrichedRecommendations.push({
              product: prod,
              recommendedVariant: matchedVariant,
              affinityReason: rec.reason,
              affinityScore: rec.score,
            });
            break;
          }
        }
      }

      // 2. If fewer than 4 recommendations, top up with popular staples
      if (enrichedRecommendations.length < 4) {
        for (const prod of catalogResult.items) {
          if (enrichedRecommendations.length >= 6) break;
          const activeVariant = prod.variants.find(
            (v) => !seenSkus.has(v.sku.toUpperCase()) && ((v as any).price > 0 || (v as any).sellingPrice > 0)
          );
          if (activeVariant) {
            seenSkus.add(activeVariant.sku.toUpperCase());
            enrichedRecommendations.push({
              product: prod,
              recommendedVariant: activeVariant,
              affinityReason: 'Popular staple in your area',
              affinityScore: 0.85,
            });
          }
        }
      }

      res.json(okResponse({ recommendations: enrichedRecommendations }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Create Product with Multiple Variants (Supports Store Admin Console)
  app.post('/api/v1/catalog/products', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const name = req.body.name || req.body.productName;
      const categoryId = req.body.categoryId || req.body.primaryCategoryId;
      const brandName = req.body.brandName;

      // Extract variants array if provided, otherwise fallback to single variant or flat fields
      let variantsList: any[] = [];
      if (Array.isArray(req.body.variants) && req.body.variants.length > 0) {
        variantsList = req.body.variants.map((v: any) => ({
          sku: v.sku?.toUpperCase()?.trim(),
          variantName: v.variantName || v.packSize,
          barcode: v.barcode || null,
          sellingPrice: v.sellingPrice ?? v.price,
          mrp: v.mrp ?? (v.sellingPrice ? Math.round(v.sellingPrice * 1.15) : undefined),
          initialStock: v.initialStock ?? v.stock ?? 50,
          imageUrls: v.imageUrl ? [v.imageUrl] : v.imageUrls || [],
          netWeightValue: v.netWeightValue || 1,
          measurementUnit: v.measurementUnit || 'pack',
        }));
      } else {
        const singleV = req.body.variant || {
          sku: req.body.sku,
          variantName: req.body.variantName || req.body.packSize,
          barcode: req.body.barcode,
          sellingPrice: req.body.sellingPrice ?? req.body.price,
          mrp: req.body.mrp,
          initialStock: req.body.initialStock ?? req.body.stock ?? 50,
          imageUrls: req.body.imageUrl ? [req.body.imageUrl] : req.body.imageUrls || [],
          netWeightValue: req.body.netWeightValue || 1,
          measurementUnit: req.body.measurementUnit || 'pack',
        };
        if (singleV.sku && singleV.variantName) {
          variantsList.push(singleV);
        }
      }

      if (!name || !categoryId || variantsList.length === 0) {
        return res
          .status(400)
          .json(
            errorResponse(
              'INVALID_PARAM',
              'name, categoryId, and at least one variant with sku and variantName are required',
              correlationId
            )
          );
      }

      const result = await catalogRepo.createProductWithVariants({
        name,
        categoryId,
        brandName,
        description: req.body.description,
        storageType: req.body.storageType,
        shelfLifeDays: req.body.shelfLifeDays,
        isVeg: req.body.isVeg,
        isPerishable: req.body.isPerishable,
        tags: req.body.tags,
        variants: variantsList,
      });

      // Instantly invalidate in-memory catalog cache so new product is immediately visible
      CatalogRepository.invalidateCache();

      res.status(201).json(okResponse(result, correlationId));
    } catch (err: any) {
      if (err.code === '23505') {
        const correlationId = getRequestContext()?.correlationId || 'unknown';
        return res
          .status(409)
          .json(
            errorResponse(
              'DUPLICATE_KEY',
              `Product or variant with this SKU/slug already exists: ${err.detail || err.message}`,
              correlationId
            )
          );
      }
      next(err);
    }
  });

  // Add Variant to Existing Product
  app.post('/api/v1/catalog/products/:productId/variants', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const productId = req.params.productId as string;

      const sku = req.body.sku?.toUpperCase()?.trim();
      const variantName = req.body.variantName || req.body.packSize;
      if (!sku || !variantName) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'sku and variantName are required', correlationId));
      }

      const variant = await catalogRepo.addVariantToProduct(productId, {
        sku,
        variantName,
        barcode: req.body.barcode,
        sellingPrice: req.body.sellingPrice ?? req.body.price,
        mrp: req.body.mrp,
        initialStock: req.body.initialStock ?? req.body.stock ?? 50,
        imageUrls: req.body.imageUrl ? [req.body.imageUrl] : req.body.imageUrls || [],
        netWeightValue: req.body.netWeightValue || 1,
        measurementUnit: req.body.measurementUnit || 'pack',
      });

      // Instantly invalidate in-memory catalog cache so new variant is immediately visible
      CatalogRepository.invalidateCache();

      res.status(201).json(okResponse(variant, correlationId));
    } catch (err: any) {
      if (err.code === '23505') {
        const correlationId = getRequestContext()?.correlationId || 'unknown';
        return res
          .status(409)
          .json(errorResponse('DUPLICATE_KEY', `Variant with this SKU already exists: ${err.detail || err.message}`, correlationId));
      }
      next(err);
    }
  });

  // =========================================================
  // Feature 14: Product Reviews, Star Ratings & Recipe Bundles
  // =========================================================

  // Get Reviews for a Product
  app.get('/api/v1/catalog/products/:productId/reviews', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const productId = req.params.productId;

      const reviewsRes = await Database.query(
        `SELECT id, product_id, customer_id, customer_name, rating, review_text, is_verified_buyer, created_at
         FROM product_reviews
         WHERE product_id = $1
         ORDER BY created_at DESC`,
        [productId]
      );

      const reviews = reviewsRes.rows;
      const totalReviews = reviews.length;
      const averageRating =
        totalReviews > 0
          ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
          : 4.8; // Default fresh market baseline

      res.status(200).json(
        okResponse(
          {
            productId,
            averageRating,
            totalReviews,
            reviews,
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Submit a Review for a Product
  app.post('/api/v1/catalog/products/:productId/reviews', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const productId = req.params.productId;
      const customerId = (req.headers['x-user-id'] as string) || req.body?.customerId || 'cust_demo';
      const customerName = req.body?.customerName || 'Verified Shopper';
      const rating = Number(req.body?.rating);
      const reviewText = req.body?.reviewText || '';

      if (!rating || rating < 1 || rating > 5) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'Rating must be an integer between 1 and 5', correlationId));
      }

      const insertRes = await Database.query(
        `INSERT INTO product_reviews (product_id, customer_id, customer_name, rating, review_text, is_verified_buyer)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         RETURNING id, product_id, customer_id, customer_name, rating, review_text, is_verified_buyer, created_at`,
        [productId, customerId, customerName, rating, reviewText]
      );

      res.status(201).json(okResponse(insertRes.rows[0], correlationId));
    } catch (err) {
      next(err);
    }
  });

  // List "Shop by Recipe" Bundles with Ingredients & Discounted Pricing
  app.get('/api/v1/catalog/recipes', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const bundlesRes = await Database.query(
        `SELECT id, name, slug, cuisine, description, prep_time_minutes, servings, image_url, bundle_discount_percent, is_active
         FROM recipe_bundles
         WHERE is_active = TRUE
         ORDER BY prep_time_minutes ASC`
      );

      const itemsRes = await Database.query(
        `SELECT rbi.id, rbi.recipe_id, rbi.sku, rbi.product_name, rbi.quantity, rbi.unit,
                COALESCE(bp.amount, 45.00) as unit_price,
                pv.image_urls
         FROM recipe_bundle_items rbi
         LEFT JOIN product_variants pv ON rbi.sku = pv.sku
         LEFT JOIN base_prices bp ON rbi.sku = bp.sku AND bp.is_active = TRUE`
      );

      const itemsByRecipe = new Map<string, any[]>();
      for (const item of itemsRes.rows) {
        let list = itemsByRecipe.get(item.recipe_id);
        if (!list) {
          list = [];
          itemsByRecipe.set(item.recipe_id, list);
        }
        const unitPrice = parseFloat(item.unit_price) || 45.0;
        list.push({
          id: item.id,
          sku: item.sku,
          productName: item.product_name,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice,
          totalItemPrice: unitPrice * item.quantity,
          imageUrl: item.image_urls?.[0] || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300',
        });
      }

      const bundles = bundlesRes.rows.map((b) => {
        const ingredients = itemsByRecipe.get(b.id) || [];
        const originalPrice = ingredients.reduce((sum, ing) => sum + ing.totalItemPrice, 0);
        const discountPct = parseFloat(b.bundle_discount_percent) || 10.0;
        const savings = Math.round((originalPrice * discountPct) / 100);
        const bundlePrice = Math.max(0, originalPrice - savings);

        return {
          id: b.id,
          name: b.name,
          slug: b.slug,
          cuisine: b.cuisine,
          description: b.description,
          prepTimeMinutes: b.prep_time_minutes,
          servings: b.servings,
          imageUrl: b.image_url,
          bundleDiscountPercent: discountPct,
          originalPrice,
          savings,
          bundlePrice,
          ingredients,
        };
      });

      res.status(200).json(okResponse(bundles, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Global Error Handler (Fails closed, never leaks stack traces)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled server exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}
