export type OrderStatus =
  | 'PENDING_CONFIRMATION'
  | 'AWAITING_PAYMENT'
  | 'CONFIRMED'
  | 'PICKING'
  | 'PACKED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED';

export type OrderChannel = 'WEB' | 'WHATSAPP';

export interface OrderItemSnapshot {
  sku: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  netAmount: number;
  taxAmount: number;
}

export interface DeliveryAddress {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  instructions?: string;
  slot?: string;
  slotId?: string;
  scheduledFor?: string;
  deliveryWindowStart?: string;
  deliveryWindowEnd?: string;
  timeZone?: string;
  subscriptionNumber?: string;
}

export interface CreateOrderRequest {
  idempotencyKey: string;
  channel: OrderChannel;
  customerId: string;
  deliveryAddress: DeliveryAddress;
  items: Array<{
    sku: string;
    quantity: number;
  }>;
  promoCode?: string;
  paymentMethod?: 'COD';
  reservationId?: string;
}

export interface OrderResponse {
  orderId: string;
  orderNumber: string;
  idempotencyKey: string;
  channel: OrderChannel;
  status: OrderStatus;
  customerId: string;
  subtotal: number;
  deliveryFee: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  currency: string;
  reservationId: string;
  paymentCheckoutUrl?: string;
  deliveryAddress: DeliveryAddress;
  items: OrderItemSnapshot[];
  createdAt: string;
  updatedAt: string;
}

export * from './subscriptions.js';
