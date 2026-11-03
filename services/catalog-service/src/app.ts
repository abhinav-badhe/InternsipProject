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

      for (const sku of inputSkus) {
        const pair = AFFINITY_PAIRS[sku];
        if (pair) {
          for (const cSku of pair.complementarySkus) {
            if (!seenSkus.has(cSku)) {
              seenSkus.add(cSku);
              matchedAffinitySkus.push({ sku: cSku, reason: pair.reason, score: 0.95 });
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
          const activeVariant = prod.variants.find((v) => !seenSkus.has(v.sku.toUpperCase()) && v.price > 0);
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

  // Global Error Handler (Fails closed, never leaks stack traces)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled server exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}
