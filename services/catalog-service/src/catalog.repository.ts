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
    const limit = Math.min(params.limit || 20, 50);
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

    // Fetch variants for each product
    const items: ProductDetail[] = await Promise.all(
      res.rows.map(async (row) => {
        const variantsRes = await Database.query(
          `SELECT id, product_id, sku, barcode, variant_name, net_weight_value, measurement_unit, image_urls, status, created_at, updated_at
           FROM product_variants
           WHERE product_id = $1 AND status = 'active'
           ORDER BY net_weight_value ASC`,
          [row.id]
        );

        return {
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
          variants: variantsRes.rows.map((v) => ({
            id: v.id,
            productId: v.product_id,
            sku: v.sku,
            barcode: v.barcode,
            variantName: v.variant_name,
            netWeightValue: parseFloat(v.net_weight_value),
            measurementUnit: v.measurement_unit,
            imageUrls: v.image_urls || [],
            status: v.status,
            createdAt: v.created_at,
            updatedAt: v.updated_at,
          })),
        };
      })
    );

    return { items, total: items.length };
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
}
