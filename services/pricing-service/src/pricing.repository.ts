import { Database } from './db.js';
import { PromotionRule, SkuPriceInfo } from './pricing.calculator.js';

export class PricingRepository {
  /**
   * Fetch currently active base prices and linked tax rates for a list of SKUs
   */
  public async getPricesBySkus(skus: string[]): Promise<Map<string, SkuPriceInfo>> {
    if (skus.length === 0) {
      return new Map();
    }

    const query = `
      SELECT 
        bp.sku,
        bp.amount,
        bp.currency,
        COALESCE(tr.rate_percent, 0.00) as tax_rate_percent,
        p.name as product_name,
        v.variant_name
      FROM base_prices bp
      LEFT JOIN tax_rates tr ON bp.tax_rate_id = tr.id
      LEFT JOIN product_variants v ON bp.sku = v.sku
      LEFT JOIN products p ON v.product_id = p.id
      WHERE bp.sku = ANY($1)
        AND bp.is_active = TRUE
        AND bp.effective_from <= NOW()
        AND (bp.effective_to IS NULL OR bp.effective_to > NOW())
      ORDER BY bp.effective_from DESC;
    `;

    const res = await Database.query(query, [skus]);
    const priceMap = new Map<string, SkuPriceInfo>();

    for (const row of res.rows) {
      // If multiple effective prices match, the newest takes precedence (due to ORDER BY effective_from DESC)
      if (!priceMap.has(row.sku)) {
        priceMap.set(row.sku, {
          sku: row.sku,
          amount: parseFloat(row.amount),
          currency: row.currency,
          taxRatePercent: parseFloat(row.tax_rate_percent),
          productName: row.product_name || undefined,
          variantName: row.variant_name || undefined,
        });
      }
    }

    return priceMap;
  }

  /**
   * Fetch all currently active base prices across all SKUs
   */
  public async getAllActivePrices(): Promise<Map<string, SkuPriceInfo>> {
    const query = `
      SELECT 
        bp.sku,
        bp.amount,
        bp.currency,
        COALESCE(tr.rate_percent, 0.00) as tax_rate_percent,
        p.name as product_name,
        v.variant_name
      FROM base_prices bp
      LEFT JOIN tax_rates tr ON bp.tax_rate_id = tr.id
      LEFT JOIN product_variants v ON bp.sku = v.sku
      LEFT JOIN products p ON v.product_id = p.id
      WHERE bp.is_active = TRUE
        AND bp.effective_from <= NOW()
        AND (bp.effective_to IS NULL OR bp.effective_to > NOW())
      ORDER BY bp.effective_from DESC;
    `;

    const res = await Database.query(query);
    const priceMap = new Map<string, SkuPriceInfo>();

    for (const row of res.rows) {
      if (!priceMap.has(row.sku)) {
        priceMap.set(row.sku, {
          sku: row.sku,
          amount: parseFloat(row.amount),
          currency: row.currency,
          taxRatePercent: parseFloat(row.tax_rate_percent),
          productName: row.product_name || undefined,
          variantName: row.variant_name || undefined,
        });
      }
    }

    return priceMap;
  }

  /**
   * Fetch active promotion by code
   */
  public async getPromotionByCode(code: string): Promise<PromotionRule | null> {
    const query = `
      SELECT code, description, discount_type, discount_value, min_order_amount, max_discount_amount
      FROM promotions
      WHERE upper(code) = upper($1)
        AND is_active = TRUE
        AND starts_at <= NOW()
        AND (ends_at IS NULL OR ends_at > NOW())
      LIMIT 1;
    `;

    const res = await Database.query(query, [code.trim()]);
    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      code: row.code,
      description: row.description,
      discountType: row.discount_type,
      discountValue: parseFloat(row.discount_value),
      minOrderAmount: parseFloat(row.min_order_amount),
      maxDiscountAmount: row.max_discount_amount ? parseFloat(row.max_discount_amount) : undefined,
    };
  }
}
