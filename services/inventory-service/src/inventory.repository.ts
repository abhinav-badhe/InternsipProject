import { Database } from './db.js';
import {
  ReserveStockRequest,
  ReserveStockResponse,
  StockBalance,
} from '@grocery/contracts';
import { createLogger } from '@grocery/observability';

const logger = createLogger('inventory-service:repo');

export class InventoryRepository {
  /**
   * Concurrency-safe stock reservation using row locking (SELECT ... FOR UPDATE).
   * Prevents overselling when two customers compete for the last unit (Acceptance Scenario 1).
   */
  public async reserveStock(req: ReserveStockRequest): Promise<ReserveStockResponse> {
    const client = await Database.getClient();
    const ttlSeconds = req.ttlSeconds ?? 300; // default 5 minutes
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    try {
      await client.query('BEGIN');

      // Check default store location
      const locRes = await client.query('SELECT id FROM stock_locations WHERE is_active = TRUE LIMIT 1');
      if (locRes.rows.length === 0) {
        throw new Error('No active stock location configured');
      }
      const locationId = locRes.rows[0].id;

      // Lock balance rows and check availability
      const unavailableItems: Array<{ sku: string; requestedQuantity: number; availableQuantity: number }> = [];
      const balanceMap = new Map<string, { balanceId: string; onHand: number; reserved: number; sellable: number }>();

      for (const item of req.items) {
        const lockQuery = `
          SELECT id, on_hand_qty, reserved_qty, (on_hand_qty - reserved_qty) as sellable_qty
          FROM stock_balances
          WHERE sku = $1 AND location_id = $2
          FOR UPDATE;
        `;
        const lockRes = await client.query(lockQuery, [item.sku, locationId]);

        if (lockRes.rows.length === 0) {
          unavailableItems.push({
            sku: item.sku,
            requestedQuantity: item.quantity,
            availableQuantity: 0,
          });
          continue;
        }

        const row = lockRes.rows[0];
        const onHand = parseFloat(row.on_hand_qty);
        const reserved = parseFloat(row.reserved_qty);
        const sellable = parseFloat(row.sellable_qty);

        if (sellable < item.quantity) {
          unavailableItems.push({
            sku: item.sku,
            requestedQuantity: item.quantity,
            availableQuantity: Math.max(0, sellable),
          });
        } else {
          balanceMap.set(item.sku, {
            balanceId: row.id,
            onHand,
            reserved,
            sellable,
          });
        }
      }

      // If any item is unavailable, abort and rollback transaction (All-or-nothing guarantee)
      if (unavailableItems.length > 0) {
        await client.query('ROLLBACK');
        logger.info('Reservation rejected due to insufficient sellable stock', {
          reservationId: req.reservationId,
          unavailableItems,
        });
        return {
          reservationId: req.reservationId,
          status: 'INSUFFICIENT_STOCK',
          expiresAtUtc: expiresAt.toISOString(),
          reservedItems: [],
          unavailableItems,
        };
      }

      // Increment reserved quantity for all items
      for (const item of req.items) {
        const b = balanceMap.get(item.sku)!;
        const newReserved = b.reserved + item.quantity;
        await client.query(
          `UPDATE stock_balances 
           SET reserved_qty = $1, updated_at = NOW() 
           WHERE id = $2`,
          [newReserved, b.balanceId]
        );
      }

      // Record reservation master record
      await client.query(
        `INSERT INTO stock_reservations (id, order_id, status, expires_at)
         VALUES ($1, $2, 'ACTIVE', $3)`,
        [req.reservationId, req.orderId || null, expiresAt]
      );

      // Record reservation line items
      for (const item of req.items) {
        await client.query(
          `INSERT INTO stock_reservation_items (reservation_id, location_id, sku, quantity)
           VALUES ($1, $2, $3, $4)`,
          [req.reservationId, locationId, item.sku, item.quantity]
        );
      }

      await client.query('COMMIT');
      logger.info('Stock successfully reserved', { reservationId: req.reservationId });

      return {
        reservationId: req.reservationId,
        status: 'RESERVED',
        expiresAtUtc: expiresAt.toISOString(),
        reservedItems: req.items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Stock reservation failed with error', { error: (err as any).message });
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Safe release of reservation when payment fails or customer cancels
   */
  public async releaseReservation(reservationId: string, reason: string): Promise<boolean> {
    const client = await Database.getClient();
    try {
      await client.query('BEGIN');

      const resvRes = await client.query(
        `SELECT id, status FROM stock_reservations WHERE id = $1 FOR UPDATE`,
        [reservationId]
      );

      if (resvRes.rows.length === 0 || resvRes.rows[0].status !== 'ACTIVE') {
        await client.query('ROLLBACK');
        return false; // Idempotent: already released or expired
      }

      // Fetch items
      const itemsRes = await client.query(
        `SELECT sku, location_id, quantity FROM stock_reservation_items WHERE reservation_id = $1`,
        [reservationId]
      );

      for (const item of itemsRes.rows) {
        const qty = parseFloat(item.quantity);
        await client.query(
          `UPDATE stock_balances 
           SET reserved_qty = GREATEST(0, reserved_qty - $1), updated_at = NOW()
           WHERE sku = $2 AND location_id = $3`,
          [qty, item.sku, item.location_id]
        );
      }

      await client.query(
        `UPDATE stock_reservations SET status = 'RELEASED', updated_at = NOW() WHERE id = $1`,
        [reservationId]
      );

      await client.query('COMMIT');
      logger.info('Reservation released', { reservationId, reason });
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Failed to release reservation', { reservationId, error: (err as any).message });
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Consume reservation on payment confirmation:
   * Decrements on_hand_qty, decrements reserved_qty, and logs to movement ledger in ONE transaction.
   */
  public async consumeReservation(reservationId: string, orderId: string): Promise<boolean> {
    const client = await Database.getClient();
    try {
      await client.query('BEGIN');

      const resvRes = await client.query(
        `SELECT id, status FROM stock_reservations WHERE id = $1 FOR UPDATE`,
        [reservationId]
      );

      if (resvRes.rows.length === 0 || resvRes.rows[0].status !== 'ACTIVE') {
        await client.query('ROLLBACK');
        return false;
      }

      const itemsRes = await client.query(
        `SELECT sku, location_id, quantity FROM stock_reservation_items WHERE reservation_id = $1`,
        [reservationId]
      );

      for (const item of itemsRes.rows) {
        const qty = parseFloat(item.quantity);

        // Update balance: deduct physical on_hand and release reservation hold
        const updRes = await client.query(
          `UPDATE stock_balances 
           SET on_hand_qty = on_hand_qty - $1, 
               reserved_qty = GREATEST(0, reserved_qty - $1),
               updated_at = NOW()
           WHERE sku = $2 AND location_id = $3
           RETURNING on_hand_qty`,
          [qty, item.sku, item.location_id]
        );

        const newBalance = parseFloat(updRes.rows[0].on_hand_qty);

        // Record in append-only stock movement ledger
        await client.query(
          `INSERT INTO stock_movement_ledger 
           (location_id, sku, quantity_delta, balance_after, reason, reference_id, actor)
           VALUES ($1, $2, $3, $4, 'SALE', $5, 'order_checkout')`,
          [item.location_id, item.sku, -qty, newBalance, orderId]
        );
      }

      await client.query(
        `UPDATE stock_reservations 
         SET status = 'CONSUMED', order_id = $1, updated_at = NOW() 
         WHERE id = $2`,
        [orderId, reservationId]
      );

      await client.query('COMMIT');
      logger.info('Reservation consumed and ledger recorded', { reservationId, orderId });
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Failed to consume reservation', { reservationId, error: (err as any).message });
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Release expired reservations (Acceptance Scenario 6)
   */
  public async releaseExpiredReservations(): Promise<number> {
    const expiredRes = await Database.query(
      `SELECT id FROM stock_reservations WHERE status = 'ACTIVE' AND expires_at < NOW() LIMIT 100`
    );

    let releasedCount = 0;
    for (const row of expiredRes.rows) {
      const success = await this.releaseReservation(row.id, 'TTL_EXPIRED');
      if (success) {
        await Database.query(`UPDATE stock_reservations SET status = 'EXPIRED' WHERE id = $1`, [row.id]);
        releasedCount++;
      }
    }

    if (releasedCount > 0) {
      logger.info('Expired reservations cleaned up', { count: releasedCount });
    }
    return releasedCount;
  }

  /**
   * Get balance for a specific SKU
   */
  public async getBalanceBySku(sku: string): Promise<StockBalance | null> {
    const res = await Database.query(
      `SELECT sku, location_id, on_hand_qty, reserved_qty, (on_hand_qty - reserved_qty) as sellable_qty, updated_at
       FROM stock_balances
       WHERE sku = $1
       LIMIT 1`,
      [sku]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      sku: row.sku,
      locationId: row.location_id,
      onHandQuantity: parseFloat(row.on_hand_qty),
      reservedQuantity: parseFloat(row.reserved_qty),
      sellableQuantity: parseFloat(row.sellable_qty),
      updatedAt: row.updated_at,
    };
  }
}
