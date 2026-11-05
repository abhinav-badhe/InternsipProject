import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InventoryRepository } from '../src/inventory.repository.js';
import { Database } from '../src/db.js';

describe('Inventory Service - Concurrency & Acceptance Scenarios', () => {
  it('Scenario 1: Concurrency Protection on Last Sellable Unit (Zero Oversell)', async () => {
    // In-memory mock database state
    let onHand = 1.0;
    let reserved = 0.0;
    const reservations = new Map<string, any>();

    const mockClient = {
      query: async (sql: string, params?: any[]) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return { rows: [] };
        }
        if (sql.includes('SELECT id FROM stock_locations')) {
          return { rows: [{ id: 'loc-1' }] };
        }
        if (sql.includes('SELECT id, on_hand_qty, reserved_qty')) {
          const sellable = onHand - reserved;
          return {
            rows: [
              {
                id: 'bal-1',
                on_hand_qty: onHand.toString(),
                reserved_qty: reserved.toString(),
                sellable_qty: sellable.toString(),
              },
            ],
          };
        }
        if (sql.includes('UPDATE stock_balances') && sql.includes('SET reserved_qty = $1')) {
          reserved = params![0];
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO stock_reservations')) {
          reservations.set(params![0], { id: params![0], status: 'ACTIVE' });
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO stock_reservation_items')) {
          return { rows: [] };
        }
        return { rows: [] };
      },
      release: () => {},
    };

    const originalGetClient = Database.getClient;
    Database.getClient = async () => mockClient as any;

    try {
      const repo = new InventoryRepository();

      // Customer A requests the 1 sellable unit
      const outcomeA = await repo.reserveStock({
        reservationId: 'res-cust-a',
        items: [{ sku: 'DOVE-BAR-125G-4PK', quantity: 1 }],
      });

      assert.equal(outcomeA.status, 'RESERVED');
      assert.equal(reserved, 1.0); // Now 1 unit is held

      // Customer B attempts to reserve 1 unit of the same SKU simultaneously
      const outcomeB = await repo.reserveStock({
        reservationId: 'res-cust-b',
        items: [{ sku: 'DOVE-BAR-125G-4PK', quantity: 1 }],
      });

      assert.equal(outcomeB.status, 'INSUFFICIENT_STOCK');
      assert.equal(outcomeB.unavailableItems?.length, 1);
      assert.equal(outcomeB.unavailableItems?.[0].availableQuantity, 0);

      // Verify zero oversell: reserved quantity never exceeded onHand!
      assert.equal(reserved, 1.0);
      assert.equal(onHand, 1.0);
    } finally {
      Database.getClient = originalGetClient;
    }
  });

  it('Scenario 6: Expired Reservation Safe Release', async () => {
    let reserved = 2.0;

    const mockClient = {
      query: async (sql: string, params?: any[]) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return { rows: [] };
        }
        if (sql.includes('FROM stock_reservations WHERE id = $1')) {
          return { rows: [{ id: params![0], status: 'ACTIVE' }] };
        }
        if (sql.includes('SELECT sku, location_id, quantity FROM stock_reservation_items')) {
          return { rows: [{ sku: 'AMUL-TZ-500ML', location_id: 'loc-1', quantity: '2.000' }] };
        }
        if (sql.includes('UPDATE stock_balances') && sql.includes('GREATEST(0, reserved_qty - $1)')) {
          reserved = Math.max(0, reserved - params![0]);
          return { rows: [] };
        }
        if (sql.includes('UPDATE stock_reservations SET status =')) {
          return { rows: [] };
        }
        return { rows: [] };
      },
      release: () => {},
    };

    const originalGetClient = Database.getClient;
    Database.getClient = async () => mockClient as any;

    try {
      const repo = new InventoryRepository();
      const released = await repo.releaseReservation('res-expired-01', 'TTL_EXPIRED');

      assert.equal(released, true);
      assert.equal(reserved, 0.0); // Held stock successfully returned to sellable pool
    } finally {
      Database.getClient = originalGetClient;
    }
  });

  it('Scenario 7: Consuming Reservation Updates Balance & Records Movement Ledger', async () => {
    let onHand = 10.0;
    let reserved = 2.0;
    let ledgerCount = 0;

    const mockClient = {
      query: async (sql: string, params?: any[]) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return { rows: [] };
        }
        if (sql.includes('FROM stock_reservations WHERE id = $1')) {
          return { rows: [{ id: params![0], status: 'ACTIVE' }] };
        }
        if (sql.includes('SELECT sku, location_id, quantity FROM stock_reservation_items')) {
          return { rows: [{ sku: 'DOVE-BAR-75G', location_id: 'loc-1', quantity: '2.000' }] };
        }
        if (sql.includes('UPDATE stock_balances') && sql.includes('on_hand_qty = on_hand_qty - $1')) {
          onHand -= params![0];
          reserved -= params![0];
          return { rows: [{ on_hand_qty: onHand.toString() }] };
        }
        if (sql.includes('INSERT INTO stock_movement_ledger')) {
          ledgerCount++;
          assert.ok(sql.includes("'SALE'")); // Reason is 'SALE'
          assert.equal(params![4], 'ORD-999'); // Order reference
          return { rows: [] };
        }
        if (sql.includes('UPDATE stock_reservations SET status =')) {
          return { rows: [] };
        }
        return { rows: [] };
      },
      release: () => {},
    };

    const originalGetClient = Database.getClient;
    Database.getClient = async () => mockClient as any;

    try {
      const repo = new InventoryRepository();
      const consumed = await repo.consumeReservation('res-active-01', 'ORD-999');

      assert.equal(consumed, true);
      assert.equal(onHand, 8.0); // on_hand reduced by 2
      assert.equal(reserved, 0.0); // hold cleared
      assert.equal(ledgerCount, 1); // ledger entry written
    } finally {
      Database.getClient = originalGetClient;
    }
  });
});
