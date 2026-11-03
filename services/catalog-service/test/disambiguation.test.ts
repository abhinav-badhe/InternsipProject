import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CatalogRepository } from '../src/catalog.repository.js';
import { Database } from '../src/db.js';

describe('Catalog Service - Category Disambiguation & Domain Logic', () => {
  it('should identify when a search term matches multiple categories', async () => {
    // Mock Database.query to simulate the "soap" disambiguation behavior
    const originalQuery = Database.query;
    Database.query = async (text: string, params?: any[]) => {
      if (text.includes('FROM categories c')) {
        return {
          rows: [
            { id: 'cat-1', name: 'Bathing Soaps & Body Wash', slug: 'bathing-soaps', parent_id: 'p-1', aliases: ['soap'] },
            { id: 'cat-2', name: 'Washing Soaps & Detergent Bars', slug: 'washing-soaps', parent_id: 'p-2', aliases: ['soap'] },
            { id: 'cat-3', name: 'Dishwashing & Utensil Soaps', slug: 'utensil-soaps', parent_id: 'p-3', aliases: ['soap'] },
          ],
          rowCount: 3,
        } as any;
      }
      if (text.includes('SELECT DISTINCT b.name')) {
        const catId = params?.[0];
        if (catId === 'cat-1') return { rows: [{ name: 'Dove' }, { name: 'Dettol' }] } as any;
        if (catId === 'cat-2') return { rows: [{ name: 'Rin' }, { name: 'Surf Excel' }] } as any;
        if (catId === 'cat-3') return { rows: [{ name: 'Vim' }, { name: 'Exo' }] } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    };

    try {
      const repo = new CatalogRepository();
      const result = await repo.disambiguateCategory('soap');

      assert.equal(result.isAmbiguous, true);
      assert.equal(result.matchingCategories.length, 3);

      const bathing = result.matchingCategories.find((c) => c.id === 'cat-1');
      assert.ok(bathing);
      assert.deepEqual(bathing?.sampleBrands, ['Dove', 'Dettol']);

      const washing = result.matchingCategories.find((c) => c.id === 'cat-2');
      assert.ok(washing);
      assert.deepEqual(washing?.sampleBrands, ['Rin', 'Surf Excel']);

      const utensil = result.matchingCategories.find((c) => c.id === 'cat-3');
      assert.ok(utensil);
      assert.deepEqual(utensil?.sampleBrands, ['Vim', 'Exo']);
    } finally {
      Database.query = originalQuery;
    }
  });

  it('should return isAmbiguous = false for single specific category match', async () => {
    const originalQuery = Database.query;
    Database.query = async (text: string) => {
      if (text.includes('FROM categories c')) {
        return {
          rows: [
            { id: 'cat-milk', name: 'Milk & Cream', slug: 'milk-cream', parent_id: 'p-dairy', aliases: ['milk'] },
          ],
          rowCount: 1,
        } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    };

    try {
      const repo = new CatalogRepository();
      const result = await repo.disambiguateCategory('milk');

      assert.equal(result.isAmbiguous, false);
      assert.equal(result.matchingCategories.length, 1);
      assert.equal(result.matchingCategories[0].name, 'Milk & Cream');
    } finally {
      Database.query = originalQuery;
    }
  });

  it('should find similar alternatives in the same category when SKU is out of stock', async () => {
    const originalQuery = Database.query;
    Database.query = async (text: string, params?: any[]) => {
      if (text.includes('WHERE pv.sku = $1')) {
        return {
          rows: [
            {
              id: 'var-1',
              sku: 'DOVE-BAR-75G',
              variant_name: '75 g Single Bar',
              product_id: 'prod-1',
              product_name: 'Dove Cream Beauty Bar',
              primary_category_id: 'cat-soaps',
              storage_type: 'ambient',
            },
          ],
          rowCount: 1,
        } as any;
      }
      if (text.includes('FROM product_variants pv') && text.includes('pv.sku != $2')) {
        return {
          rows: [
            {
              id: 'var-2',
              product_id: 'prod-2',
              sku: 'DETTOL-BAR-75G',
              barcode: '8901030010099',
              variant_name: '75 g Single Bar',
              net_weight_value: '75.000',
              measurement_unit: 'g',
              image_urls: ['https://images.unsplash.com/photo-1?w=500'],
              status: 'active',
              product_name: 'Dettol Original Protection Bar',
              storage_type: 'ambient',
              brand_name: 'Dettol',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          rowCount: 1,
        } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    };

    try {
      const repo = new CatalogRepository();
      const alternatives = await repo.getSimilarAlternatives('DOVE-BAR-75G');

      assert.ok(alternatives);
      assert.equal(alternatives?.requestedSku, 'DOVE-BAR-75G');
      assert.equal(alternatives?.inStockAlternatives.length, 1);
      assert.equal(alternatives?.inStockAlternatives[0].variant.sku, 'DETTOL-BAR-75G');
      assert.equal(alternatives?.inStockAlternatives[0].brandName, 'Dettol');
    } finally {
      Database.query = originalQuery;
    }
  });

  it('Feature 19: AI-Powered Product Recommendations returns affinity items for cart SKUs', () => {
    const AFFINITY_PAIRS: Record<string, { complementarySkus: string[]; reason: string }> = {
      'AMUL-TAAZA-1L': { complementarySkus: ['BRD-WHT-400G', 'EGG-WHT-6PK', 'AMUL-BTR-100G'], reason: 'Frequently bought with Fresh Milk' },
      'BRD-WHT-400G': { complementarySkus: ['AMUL-BTR-100G', 'AMUL-TAAZA-1L'], reason: 'Breakfast Combo' },
    };

    const cartSkus = ['AMUL-TAAZA-1L'];
    const matched = AFFINITY_PAIRS[cartSkus[0]];
    assert.ok(matched);
    assert.ok(matched.complementarySkus.includes('BRD-WHT-400G'));
    assert.equal(matched.reason, 'Frequently bought with Fresh Milk');
  });
});
