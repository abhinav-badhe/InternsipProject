export type StockMovementReason =
  | 'RECEIPT'
  | 'SALE'
  | 'ADJUSTMENT'
  | 'DAMAGE'
  | 'EXPIRED'
  | 'RETURN';

export type ReservationStatus = 'ACTIVE' | 'CONSUMED' | 'RELEASED' | 'EXPIRED';

export interface ReserveStockItem {
  sku: string;
  quantity: number;
}

export interface ReserveStockRequest {
  reservationId: string;
  orderId?: string;
  items: ReserveStockItem[];
  ttlSeconds?: number; // Defaults to 300 (5 minutes)
}

export interface ReserveStockResponse {
  reservationId: string;
  status: 'RESERVED' | 'INSUFFICIENT_STOCK';
  expiresAtUtc: string;
  reservedItems: Array<{
    sku: string;
    quantity: number;
  }>;
  unavailableItems?: Array<{
    sku: string;
    requestedQuantity: number;
    availableQuantity: number;
  }>;
}

export interface ReleaseReservationRequest {
  reservationId: string;
  reason: string;
}

export interface ConsumeReservationRequest {
  reservationId: string;
  orderId: string;
}

export interface StockBalance {
  sku: string;
  onHandQuantity: number;
  reservedQuantity: number;
  sellableQuantity: number;
  locationId: string;
  updatedAt: string;
}
