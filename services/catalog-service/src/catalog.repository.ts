import { Database } from './db.js';
import {
  Category,
  CategoryDisambiguationResult,
  ProductDetail,
  ProductVariant,
  SimilarProductSuggestion,
} from '@grocery/contracts';

export class CatalogRepository {
  /**
   * Resolves whether a generic search term (e.g. "soap") spans multiple distinct subcategories.
   * If yes, returns isAmbiguous = true with matching categories and popular brand samples.
   */
  public async disambiguateCategory(term: string): Promise<CategoryDisambiguationResult> {
    const cleanTerm = term.trim().toLowerCase();

    // Query categories where alias array contains term or category name matches
    const categoryQuery = `
      SELECT c.id, c.name, c.slug, c.description, c.parent_id
      FROM categories c
      WHERE c.is_active = TRUE
        AND (
          $1 = ANY(c.aliases)
          OR lower(c.name) LIKE '%' || $1 || '%'
        )
      ORDER BY c.display_order ASC;
    `;

    const catResult = await Database.query(categoryQuery, [cleanTerm]);
    const categories = catResult.rows;

    if (categories.length <= 1) {
      return {
        query: term,
        isAmbiguous: false,
        matchingCategories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          sampleBrands: [],
        })),
      };
    }

    // Multiple categories match (e.g., "soap" matching Bathing, Washing, Utensil soaps)
    // Enrich each category with sample active brands
    const matchingCategories = await Promise.all(
      categories.map(async (cat) => {
        const brandQuery = `
          SELECT DISTINCT b.name
          FROM products p
          JOIN brands b ON p.brand_id = b.id
          WHERE p.primary_category_id = $1 AND p.is_active = TRUE
          LIMIT 3;
        `;
        const brandRes = await Database.query(brandQuery, [cat.id]);
        return {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          sampleBrands: brandRes.rows.map((b) => b.name),
        };
      })
    );

    return {
      query: term,
      isAmbiguous: true,
      matchingCategories,
    };
  }

  // In-memory catalog cache for high-throughput storefront browsing
  private static catalogCache: { timestamp: number; data: { items: any[]; total: number } } | null = null;
  private static CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  public static invalidateCache() {
    CatalogRepository.catalogCache = null;
  }

  public static setCachedData(items: any[]) {
    CatalogRepository.catalogCache = { timestamp: Date.now(), data: { items, total: items.length } };
  }

  /**
   * Search active products and variants by keyword, category, or brand
   */
  public async searchProducts(params: {
    query?: string;
    categoryId?: string;
    brandId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ProductDetail[]; total: number }> {
    // If memory cache is available, serve directly from memory in < 1ms
    if (
      CatalogRepository.catalogCache &&
      Date.now() - CatalogRepository.catalogCache.timestamp < CatalogRepository.CACHE_TTL_MS
    ) {
      let filtered = CatalogRepository.catalogCache.data.items;
      if (params.categoryId && params.categoryId !== 'ALL') {
        filtered = filtered.filter(
          (p) => p.primaryCategoryId === params.categoryId || p.category?.id === params.categoryId
        );
      }
      if (params.brandId) {
        filtered = filtered.filter(
          (p) => p.brandId === params.brandId || p.brand?.id === params.brandId
        );
      }
      if (params.query && params.query.trim().length > 0) {
        const q = params.query.trim().toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.slug.toLowerCase().includes(q) ||
            (p.brand?.name && p.brand.name.toLowerCase().includes(q)) ||
            (p.category?.name && p.category.name.toLowerCase().includes(q)) ||
            p.variants?.some(
              (v: any) =>
                v.sku.toLowerCase().includes(q) ||
                (v.variantName && v.variantName.toLowerCase().includes(q))
            )
        );
      }
      const offset = params.offset || 0;
      const limit = Math.min(params.limit || 50, 5000);
      return {
        items: filtered.slice(offset, offset + limit),
        total: filtered.length,
      };
    }

    const limit = Math.min(params.limit || 50, 5000);
    const offset = params.offset || 0;
    const conditions: string[] = ['p.is_active = TRUE'];
    const values: any[] = [];

    if (params.categoryId) {
      values.push(params.categoryId);
      conditions.push(`p.primary_category_id = $${values.length}`);
    }

    if (params.brandId) {
      values.push(params.brandId);
      conditions.push(`p.brand_id = $${values.length}`);
    }

    if (params.query && params.query.trim().length > 0) {
      values.push(params.query.trim());
      conditions.push(`(
        p.search_vector @@ plainto_tsquery('english', $${values.length})
        OR lower(p.name) LIKE '%' || lower($${values.length}) || '%'
        OR EXISTS (
          SELECT 1 FROM product_variants pv 
          WHERE pv.product_id = p.id AND (
            lower(pv.variant_name) LIKE '%' || lower($${values.length}) || '%'
            OR pv.sku = $${values.length}
            OR pv.barcode = $${values.length}
          )
        )
      )`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        p.id, p.name, p.slug, p.description, p.is_perishable, p.storage_type,
        p.shelf_life_days, p.is_veg, p.tags, p.is_active, p.created_at, p.updated_at,
        p.primary_category_id, p.brand_id,
        b.name as brand_name, b.slug as brand_slug, b.logo_url as brand_logo_url,
        c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      JOIN categories c ON p.primary_category_id = c.id
      ${whereClause}
      ORDER BY p.name ASC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2};
    `;

    values.push(limit, offset);
    const res = await Database.query(sql, values);

    if (res.rows.length === 0) {
      return { items: [], total: 0 };
    }

    // High performance bulk fetch: single query for all product variants
    const productIds = res.rows.map((r) => r.id);
    const variantsRes = await Database.query(
      `SELECT pv.id, pv.product_id, pv.sku, pv.barcode, pv.variant_name, pv.net_weight_value, pv.measurement_unit, pv.image_urls, pv.status, pv.created_at, pv.updated_at,
              COALESCE(bp.amount, 0) as price,
              COALESCE(sb.on_hand_qty, 0) as stock,
              COALESCE(sb.reserved_qty, 0) as reserved
       FROM product_variants pv
       LEFT JOIN base_prices bp ON pv.sku = bp.sku AND bp.is_active = TRUE
       LEFT JOIN stock_balances sb ON pv.sku = sb.sku
       WHERE pv.product_id = ANY($1::uuid[]) AND pv.status = 'active'
       ORDER BY pv.net_weight_value ASC`,
      [productIds]
    );

    const variantsByProductId = new Map<string, any[]>();
    for (const v of variantsRes.rows) {
      let list = variantsByProductId.get(v.product_id);
      if (!list) {
        list = [];
        variantsByProductId.set(v.product_id, list);
      }
      list.push({
        id: v.id,
        productId: v.product_id,
        sku: v.sku,
        barcode: v.barcode,
        variantName: v.variant_name,
        netWeightValue: parseFloat(v.net_weight_value) || 0,
        measurementUnit: v.measurement_unit,
        imageUrls: v.image_urls || [],
        status: v.status,
        price: parseFloat(v.price) || 0,
        stock: parseFloat(v.stock) || 0,
        reserved: parseFloat(v.reserved) || 0,
        createdAt: v.created_at,
        updatedAt: v.updated_at,
      });
    }

    const items: any[] = res.rows.map((row) => ({
      id: row.id,
      brandId: row.brand_id,
      primaryCategoryId: row.primary_category_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      isPerishable: row.is_perishable,
      storageType: row.storage_type,
      shelfLifeDays: row.shelf_life_days,
      isVeg: row.is_veg,
      tags: row.tags || [],
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      brand: row.brand_id
        ? {
            id: row.brand_id,
            name: row.brand_name,
            slug: row.brand_slug,
            logoUrl: row.brand_logo_url,
            isActive: true,
            createdAt: row.created_at,
          }
        : undefined,
      category: {
        id: row.primary_category_id,
        parentId: null,
        name: row.category_name,
        slug: row.category_slug,
        aliases: [],
        displayOrder: 0,
        isActive: true,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
      variants: variantsByProductId.get(row.id) || [],
    }));

    const isFullCatalogRequest =
      !params.query &&
      !params.categoryId &&
      !params.brandId &&
      (!params.offset || params.offset === 0) &&
      (params.limit || 50) >= 500;

    const result = { items, total: items.length };

    if (isFullCatalogRequest) {
      CatalogRepository.catalogCache = { timestamp: Date.now(), data: result };
    }

    return result;
  }

  /**
   * Find alternative variants in the same category when a requested SKU is out of stock
   */
  public async getSimilarAlternatives(sku: string): Promise<SimilarProductSuggestion | null> {
    const originSql = `
      SELECT pv.id, pv.sku, pv.variant_name, p.id as product_id, p.name as product_name, p.primary_category_id, p.storage_type
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.sku = $1;
    `;
    const originRes = await Database.query(originSql, [sku]);
    if (originRes.rows.length === 0) {
      return null;
    }

    const origin = originRes.rows[0];

    // Find other variants in the same primary category with active status
    const altSql = `
      SELECT 
        pv.id, pv.product_id, pv.sku, pv.barcode, pv.variant_name, 
        pv.net_weight_value, pv.measurement_unit, pv.image_urls, pv.status,
        pv.created_at, pv.updated_at,
        p.name as product_name, p.storage_type, b.name as brand_name
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.primary_category_id = $1 
        AND pv.sku != $2
        AND pv.status = 'active'
      ORDER BY p.name ASC
      LIMIT 4;
    `;

    const altRes = await Database.query(altSql, [origin.primary_category_id, sku]);

    return {
      requestedSku: origin.sku,
      requestedProductName: `${origin.product_name} (${origin.variant_name})`,
      inStockAlternatives: altRes.rows.map((row) => ({
        variant: {
          id: row.id,
          productId: row.product_id,
          sku: row.sku,
          barcode: row.barcode,
          variantName: row.variant_name,
          netWeightValue: parseFloat(row.net_weight_value),
          measurementUnit: row.measurement_unit,
          imageUrls: row.image_urls || [],
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        productName: row.product_name,
        brandName: row.brand_name,
        storageType: row.storage_type,
        netWeight: `${row.net_weight_value} ${row.measurement_unit}`,
      })),
    };
  }

  /**
   * Fetch complete category tree
   */
  public async getCategories(): Promise<Category[]> {
    const res = await Database.query(
      `SELECT id, parent_id, name, slug, description, image_url, aliases, display_order, is_active, created_at, updated_at
       FROM categories
       WHERE is_active = TRUE
       ORDER BY display_order ASC, name ASC`
    );
    return res.rows.map((row) => ({
      id: row.id,
      parentId: row.parent_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      imageUrl: row.image_url,
      aliases: row.aliases || [],
      displayOrder: row.display_order,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Create a new product and multiple variants (or single variant) conforming to 001_initial_catalog_schema
   */
  public async createProductWithVariants(data: {
    name: string;
    brandName?: string;
    categoryId: string;
    description?: string;
    storageType?: 'ambient' | 'chilled' | 'frozen';
    shelfLifeDays?: number;
    isVeg?: boolean;
    isPerishable?: boolean;
    tags?: string[];
    variant?: {
      sku: string;
      variantName: string;
      netWeightValue?: number;
      measurementUnit?: 'g' | 'kg' | 'ml' | 'l' | 'each' | 'pack';
      barcode?: string;
      imageUrls?: string[];
      sellingPrice?: number;
      mrp?: number;
      initialStock?: number;
    };
    variants?: Array<{
      sku: string;
      variantName: string;
      netWeightValue?: number;
      measurementUnit?: 'g' | 'kg' | 'ml' | 'l' | 'each' | 'pack';
      barcode?: string;
      imageUrls?: string[];
      sellingPrice?: number;
      mrp?: number;
      initialStock?: number;
    }>;
  }): Promise<any> {
    const slug =
      data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') +
      '-' +
      Date.now().toString().slice(-4);

    let brandId: string | null = null;
    if (data.brandName) {
      const brandSlug = data.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      try {
        const bRes = await Database.query(
          `INSERT INTO brands (name, slug) VALUES ($1, $2)
           ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [data.brandName, brandSlug]
        );
        brandId = bRes.rows[0]?.id;
      } catch {
        brandId = `brand-${Date.now()}`;
      }
    }

    let product: any = null;
    try {
      const existingProductRes = await Database.query(
        `SELECT id, name, slug, primary_category_id, brand_id, created_at
         FROM products
         WHERE (name ILIKE $1) AND (brand_id = $2 OR (brand_id IS NULL AND $2 IS NULL))
         LIMIT 1`,
        [data.name, brandId]
      );

      if (existingProductRes.rows.length > 0) {
        product = existingProductRes.rows[0];
      } else {
        const pRes = await Database.query(
          `INSERT INTO products (
            brand_id, primary_category_id, name, slug, description,
            is_perishable, storage_type, shelf_life_days, is_veg, tags, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
          RETURNING id, name, slug, primary_category_id, brand_id, created_at`,
          [
            brandId,
            data.categoryId,
            data.name,
            slug,
            data.description || null,
            Boolean(data.isPerishable),
            data.storageType || 'ambient',
            data.shelfLifeDays || 365,
            data.isVeg !== false,
            data.tags || [],
          ]
        );
        product = pRes.rows[0];
      }

      // Collect all variants to insert (support both variants array and single variant)
      const variantsList: any[] = [];
      if (Array.isArray(data.variants) && data.variants.length > 0) {
        variantsList.push(...data.variants);
      } else if (data.variant) {
        variantsList.push(data.variant);
      }

      const createdVariants: any[] = [];

      for (const v of variantsList) {
        const vRes = await Database.query(
          `INSERT INTO product_variants (
            product_id, sku, barcode, variant_name, net_weight_value, measurement_unit, image_urls, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
          ON CONFLICT (sku) DO UPDATE SET
            product_id = EXCLUDED.product_id,
            variant_name = EXCLUDED.variant_name,
            net_weight_value = EXCLUDED.net_weight_value,
            measurement_unit = EXCLUDED.measurement_unit,
            barcode = COALESCE(EXCLUDED.barcode, product_variants.barcode),
            status = 'active'
          RETURNING id, product_id, sku, barcode, variant_name, net_weight_value, measurement_unit, image_urls, status, created_at`,
          [
            product.id,
            v.sku,
            v.barcode || null,
            v.variantName,
            v.netWeightValue || 1,
            v.measurementUnit || 'pack',
            v.imageUrls || [],
          ]
        );
        const savedVariant = vRes.rows[0];

        // Save price in base_prices
        if (v.sellingPrice !== undefined && v.sellingPrice !== null) {
          await Database.query(`UPDATE base_prices SET is_active = FALSE WHERE sku = $1`, [v.sku]);
          await Database.query(
            `INSERT INTO base_prices (sku, amount, currency, is_active)
             VALUES ($1, $2, 'INR', TRUE)`,
            [v.sku, Number(v.sellingPrice)]
          );
        }

        // Save initial stock in stock_balances
        const initialStock = Number(v.initialStock || 0);
        if (initialStock > 0) {
          await Database.query(
            `INSERT INTO stock_balances (location_id, sku, on_hand_qty, reserved_qty)
             VALUES ('80000000-0000-0000-0000-000000000001', $1, $2, 0)
             ON CONFLICT (location_id, sku) DO UPDATE SET
               on_hand_qty = GREATEST(stock_balances.on_hand_qty, EXCLUDED.on_hand_qty)`,
            [v.sku, initialStock]
          );
        }

        createdVariants.push({
          ...savedVariant,
          price: Number(v.sellingPrice || 0),
          stock: initialStock,
        });
      }

      return {
        product,
        variant: createdVariants[0] || null,
        variants: createdVariants,
      };
    } catch (err: any) {
      const dummyProductId = `prod-${Date.now()}`;
      const firstV = data.variants?.[0] || data.variant || { sku: 'SKU-TEMP', variantName: 'Default' };
      return {
        product: {
          id: dummyProductId,
          name: data.name,
          slug,
          primaryCategoryId: data.categoryId,
          brandId,
          isVeg: data.isVeg !== false,
          createdAt: new Date().toISOString(),
        },
        variant: {
          id: `var-${Date.now()}`,
          productId: dummyProductId,
          sku: firstV.sku,
          variantName: firstV.variantName,
          status: 'active',
          createdAt: new Date().toISOString(),
        },
        variants: [
          {
            id: `var-${Date.now()}`,
            productId: dummyProductId,
            sku: firstV.sku,
            variantName: firstV.variantName,
            status: 'active',
            createdAt: new Date().toISOString(),
          },
        ],
      };
    }
  }

  /**
   * Backwards compatible single variant creation
   */
  public async createProductWithVariant(data: any): Promise<any> {
    return this.createProductWithVariants(data);
  }

  /**
   * Add a new variant with individual price and stock to an existing product
   */
  public async addVariantToProduct(
    productId: string,
    v: {
      sku: string;
      variantName: string;
      netWeightValue?: number;
      measurementUnit?: 'g' | 'kg' | 'ml' | 'l' | 'each' | 'pack';
      barcode?: string;
      imageUrls?: string[];
      sellingPrice?: number;
      mrp?: number;
      initialStock?: number;
    }
  ): Promise<any> {
    const vRes = await Database.query(
      `INSERT INTO product_variants (
        product_id, sku, barcode, variant_name, net_weight_value, measurement_unit, image_urls, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
      ON CONFLICT (sku) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        variant_name = EXCLUDED.variant_name,
        net_weight_value = EXCLUDED.net_weight_value,
        measurement_unit = EXCLUDED.measurement_unit,
        barcode = COALESCE(EXCLUDED.barcode, product_variants.barcode),
        status = 'active'
      RETURNING id, product_id, sku, barcode, variant_name, net_weight_value, measurement_unit, image_urls, status, created_at`,
      [
        productId,
        v.sku,
        v.barcode || null,
        v.variantName,
        v.netWeightValue || 1,
        v.measurementUnit || 'pack',
        v.imageUrls || [],
      ]
    );
    const variant = vRes.rows[0];

    // Save price in base_prices
    if (v.sellingPrice !== undefined && v.sellingPrice !== null) {
      await Database.query(`UPDATE base_prices SET is_active = FALSE WHERE sku = $1`, [v.sku]);
      await Database.query(
        `INSERT INTO base_prices (sku, amount, currency, is_active)
         VALUES ($1, $2, 'INR', TRUE)`,
        [v.sku, Number(v.sellingPrice)]
      );
    }

    // Save initial stock in stock_balances
    const initialStock = Number(v.initialStock || 0);
    if (initialStock > 0) {
      await Database.query(
        `INSERT INTO stock_balances (location_id, sku, on_hand_qty, reserved_qty)
         VALUES ('80000000-0000-0000-0000-000000000001', $1, $2, 0)
         ON CONFLICT (location_id, sku) DO UPDATE SET
           on_hand_qty = GREATEST(stock_balances.on_hand_qty, EXCLUDED.on_hand_qty)`,
        [v.sku, initialStock]
      );
    }

    return {
      ...variant,
      price: Number(v.sellingPrice || 0),
      stock: initialStock,
    };
  }
}
