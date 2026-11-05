import { QuoteItemResponse, QuoteResponse } from '@grocery/contracts';
import crypto from 'node:crypto';

export interface SkuPriceInfo {
  sku: string;
  amount: number;
  currency: string;
  taxRatePercent: number;
  productName?: string;
  variantName?: string;
}

export interface PromotionRule {
  code: string;
  description: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
}

export class PricingCalculator {
  /** Round a number strictly to two decimal places */
  public static round2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  public static calculateQuote(params: {
    items: Array<{ sku: string; quantity: number }>;
    priceMap: Map<string, SkuPriceInfo>;
    promotion?: PromotionRule;
    freeDeliveryThreshold?: number;
    standardDeliveryFee?: number;
  }): QuoteResponse {
    const freeDeliveryThreshold = params.freeDeliveryThreshold ?? 500;
    const standardDeliveryFee = params.standardDeliveryFee ?? 30;

    let subtotal = 0;
    let taxTotal = 0;
    const itemResponses: QuoteItemResponse[] = [];

    for (const reqItem of params.items) {
      const priceInfo = params.priceMap.get(reqItem.sku);
      if (!priceInfo) {
        throw new Error(`Price not found for SKU: ${reqItem.sku}`);
      }

      const unitPrice = this.round2(priceInfo.amount);
      const grossAmount = this.round2(unitPrice * reqItem.quantity);
      const taxRate = priceInfo.taxRatePercent || 0;
      const taxAmount = this.round2((grossAmount * taxRate) / 100);

      subtotal = this.round2(subtotal + grossAmount);
      taxTotal = this.round2(taxTotal + taxAmount);

      itemResponses.push({
        sku: reqItem.sku,
        productName: priceInfo.productName || reqItem.sku,
        variantName: priceInfo.variantName || 'Standard',
        quantity: reqItem.quantity,
        unitPrice,
        grossAmount,
        discountAmount: 0,
        netAmount: grossAmount,
        taxAmount,
        taxRatePercent: taxRate,
      });
    }

    // Apply promotions if eligible
    let discountTotal = 0;
    let deliveryFee = subtotal >= freeDeliveryThreshold ? 0 : standardDeliveryFee;
    const appliedPromotions: Array<{ code: string; description: string; discountAmount: number }> = [];

    if (params.promotion && subtotal >= params.promotion.minOrderAmount) {
      const promo = params.promotion;
      if (promo.discountType === 'PERCENTAGE') {
        let calcDiscount = this.round2((subtotal * promo.discountValue) / 100);
        if (promo.maxDiscountAmount && calcDiscount > promo.maxDiscountAmount) {
          calcDiscount = promo.maxDiscountAmount;
        }
        discountTotal = calcDiscount;
        appliedPromotions.push({
          code: promo.code,
          description: promo.description,
          discountAmount: discountTotal,
        });
      } else if (promo.discountType === 'FIXED_AMOUNT') {
        discountTotal = Math.min(promo.discountValue, subtotal);
        appliedPromotions.push({
          code: promo.code,
          description: promo.description,
          discountAmount: discountTotal,
        });
      } else if (promo.discountType === 'FREE_SHIPPING') {
        const savedFee = deliveryFee;
        deliveryFee = 0;
        // Free shipping waives the delivery fee; discountTotal applies to goods and must not double-subtract shipping
        appliedPromotions.push({
          code: promo.code,
          description: promo.description,
          discountAmount: savedFee,
        });
      }
    }

    // Prorate merchandise discount across line items
    if (discountTotal > 0 && subtotal > 0 && itemResponses.length > 0) {
      let allocatedDiscount = 0;
      for (let i = 0; i < itemResponses.length; i++) {
        const item = itemResponses[i];
        let itemDiscount = 0;
        if (i === itemResponses.length - 1) {
          itemDiscount = this.round2(discountTotal - allocatedDiscount);
        } else {
          itemDiscount = this.round2((item.grossAmount / subtotal) * discountTotal);
          allocatedDiscount = this.round2(allocatedDiscount + itemDiscount);
        }
        item.discountAmount = itemDiscount;
        item.netAmount = this.round2(Math.max(0, item.grossAmount - itemDiscount));
      }
    }

    const grandTotal = this.round2(Math.max(0, subtotal - discountTotal + taxTotal + deliveryFee));

    // Quote valid for 15 minutes
    const validUntilUtc = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return {
      quoteId: crypto.randomUUID(),
      currency: 'INR',
      subtotal,
      discountTotal,
      taxTotal,
      deliveryFee,
      grandTotal,
      validUntilUtc,
      items: itemResponses,
      appliedPromotions,
    };
  }
}
