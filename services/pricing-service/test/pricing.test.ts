import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PricingCalculator, SkuPriceInfo, PromotionRule } from '../src/pricing.calculator.js';

describe('Pricing Service - Calculation Engine & Taxes', () => {
  const priceMap = new Map<string, SkuPriceInfo>([
    [
      'DOVE-BAR-75G',
      {
        sku: 'DOVE-BAR-75G',
        amount: 52.0,
        currency: 'INR',
        taxRatePercent: 18.0,
        productName: 'Dove Beauty Bar',
        variantName: '75 g',
      },
    ],
    [
      'AMUL-TZ-500ML',
      {
        sku: 'AMUL-TZ-500ML',
        amount: 27.0,
        currency: 'INR',
        taxRatePercent: 0.0,
        productName: 'Amul Taaza Milk',
        variantName: '500 ml',
      },
    ],
  ]);

  it('should accurately compute line items, taxes, and delivery fees below threshold', () => {
    // 2 x Dove (₹52 = ₹104) + 1 x Milk (₹27 = ₹27)
    // Subtotal: ₹131.00
    // Dove Tax: 104 * 18% = ₹18.72
    // Milk Tax: 0
    // Total Tax: ₹18.72
    // Delivery Fee: ₹30.00 (subtotal < ₹500)
    // Grand Total: 131 + 18.72 + 30 = ₹179.72

    const quote = PricingCalculator.calculateQuote({
      items: [
        { sku: 'DOVE-BAR-75G', quantity: 2 },
        { sku: 'AMUL-TZ-500ML', quantity: 1 },
      ],
      priceMap,
    });

    assert.equal(quote.subtotal, 131.0);
    assert.equal(quote.taxTotal, 18.72);
    assert.equal(quote.deliveryFee, 30.0);
    assert.equal(quote.discountTotal, 0.0);
    assert.equal(quote.grandTotal, 179.72);
    assert.equal(quote.items.length, 2);
  });

  it('should grant free delivery when subtotal reaches the threshold', () => {
    // 10 x Dove (₹52 = ₹520) -> Subtotal: ₹520.00 >= ₹500 -> Free delivery!
    const quote = PricingCalculator.calculateQuote({
      items: [{ sku: 'DOVE-BAR-75G', quantity: 10 }],
      priceMap,
    });

    assert.equal(quote.subtotal, 520.0);
    assert.equal(quote.deliveryFee, 0.0);
    assert.equal(quote.taxTotal, 93.6); // 520 * 18%
    assert.equal(quote.grandTotal, 613.6);
  });

  it('should apply percentage discount coupon when minimum order requirement is met', () => {
    const promo: PromotionRule = {
      code: 'SAVE10',
      description: '10% off on orders above ₹100',
      discountType: 'PERCENTAGE',
      discountValue: 10.0,
      minOrderAmount: 100.0,
    };

    // Subtotal: ₹104 (2 x Dove) >= ₹100 min order
    // Discount: 10% of 104 = ₹10.40
    const quote = PricingCalculator.calculateQuote({
      items: [{ sku: 'DOVE-BAR-75G', quantity: 2 }],
      priceMap,
      promotion: promo,
    });

    assert.equal(quote.subtotal, 104.0);
    assert.equal(quote.discountTotal, 10.4);
    assert.equal(quote.appliedPromotions.length, 1);
    assert.equal(quote.appliedPromotions[0].code, 'SAVE10');
  });

  it('should not apply coupon when minimum order requirement is NOT met', () => {
    const promo: PromotionRule = {
      code: 'BIGSAVER',
      description: '₹50 off on orders above ₹500',
      discountType: 'FIXED_AMOUNT',
      discountValue: 50.0,
      minOrderAmount: 500.0,
    };

    // Subtotal: ₹104 < ₹500 -> Not applied
    const quote = PricingCalculator.calculateQuote({
      items: [{ sku: 'DOVE-BAR-75G', quantity: 2 }],
      priceMap,
      promotion: promo,
    });

    assert.equal(quote.discountTotal, 0.0);
    assert.equal(quote.appliedPromotions.length, 0);
  });

  it('should throw an error if an item price is missing from priceMap', () => {
    assert.throws(
      () => {
        PricingCalculator.calculateQuote({
          items: [{ sku: 'UNKNOWN-SKU', quantity: 1 }],
          priceMap,
        });
      },
      {
        message: 'Price not found for SKU: UNKNOWN-SKU',
      }
    );
  });
});
