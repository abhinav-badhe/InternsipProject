export interface QuoteItemRequest {
  sku: string;
  quantity: number;
}

export interface QuoteItemResponse {
  sku: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  taxAmount: number;
  taxRatePercent: number;
}

export interface QuoteRequest {
  customerId?: string;
  deliverySlotId?: string;
  deliveryAddressPostalCode?: string;
  items: QuoteItemRequest[];
  promoCode?: string;
}

export interface QuoteResponse {
  quoteId: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  deliveryFee: number;
  grandTotal: number;
  validUntilUtc: string;
  items: QuoteItemResponse[];
  appliedPromotions: Array<{
    code: string;
    description: string;
    discountAmount: number;
  }>;
}
