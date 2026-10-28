import { Database } from './db.js';
import crypto from 'node:crypto';
import { createLogger } from '@grocery/observability';

const logger = createLogger('fulfillment-service:picker');

export interface PickItemInput {
  sku: string;
  productName: string;
  quantityRequested: number;
  batchNumber?: string;
  expiryDate?: string; // YYYY-MM-DD
}

export interface PickList {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  status: 'GENERATED' | 'ASSIGNED' | 'PICKING' | 'COMPLETED' | 'CANCELLED';
  zone: string;
  items: Array<{
    id: string;
    sku: string;
    productName: string;
    quantityRequested: number;
    quantityPicked: number;
    batchNumber?: string;
    expiryDate?: string;
    status: 'PENDING' | 'PICKED' | 'SUBSTITUTION_PROPOSED' | 'SUBSTITUTED' | 'OUT_OF_STOCK';
  }>;
}

export class FulfillmentService {
  /**
   * Generates a pick list applying FEFO (First-Expired, First-Out) sorting
   * so pickers prioritize batches expiring earliest.
   */
  public async generatePickList(params: {
    orderId: string;
    orderNumber: string;
    customerId: string;
    zone?: string;
    items: PickItemInput[];
  }): Promise<PickList> {
    const pickListId = crypto.randomUUID();
    const zone = params.zone || 'MAIN_STORE';

    // 1. Sort items by FEFO (earliest expiry first, items without expiry at end)
    const sortedItems = [...params.items].sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });

    // 2. Insert pick list master record
    await Database.query(
      `INSERT INTO pick_lists (id, order_id, order_number, customer_id, zone, status)
       VALUES ($1, $2, $3, $4, $5, 'GENERATED')`,
      [pickListId, params.orderId, params.orderNumber, params.customerId, zone]
    );

    // 3. Insert items
    const createdItems: PickList['items'] = [];
    for (const item of sortedItems) {
      const itemId = crypto.randomUUID();
      await Database.query(
        `INSERT INTO pick_items (id, pick_list_id, sku, product_name, quantity_requested, batch_number, expiry_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')`,
        [
          itemId,
          pickListId,
          item.sku,
          item.productName,
          item.quantityRequested,
          item.batchNumber || null,
          item.expiryDate || null,
        ]
      );

      createdItems.push({
        id: itemId,
        sku: item.sku,
        productName: item.productName,
        quantityRequested: item.quantityRequested,
        quantityPicked: 0,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        status: 'PENDING',
      });
    }

    logger.info('Pick list generated with FEFO sorting', {
      pickListId,
      orderNumber: params.orderNumber,
      itemCount: createdItems.length,
    });

    return {
      id: pickListId,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      customerId: params.customerId,
      status: 'GENERATED',
      zone,
      items: createdItems,
    };
  }

  /**
   * Proposes a substitution when requested SKU is out of stock / damaged.
   * Emits proposal requiring explicit customer approval.
   */
  public async proposeSubstitution(params: {
    pickListId: string;
    pickItemId: string;
    originalSku: string;
    proposedSku: string;
    proposedProductName: string;
    priceDelta: number;
  }): Promise<{ proposalId: string; status: 'PENDING_APPROVAL' }> {
    const proposalId = crypto.randomUUID();

    // Update item status to SUBSTITUTION_PROPOSED
    await Database.query(
      `UPDATE pick_items SET status = 'SUBSTITUTION_PROPOSED' WHERE id = $1`,
      [params.pickItemId]
    );

    // Insert proposal record
    await Database.query(
      `INSERT INTO substitution_proposals (id, pick_item_id, pick_list_id, original_sku, proposed_sku, proposed_product_name, price_delta, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING_APPROVAL')`,
      [
        proposalId,
        params.pickItemId,
        params.pickListId,
        params.originalSku,
        params.proposedSku,
        params.proposedProductName,
        params.priceDelta,
      ]
    );

    logger.info('Substitution proposed for order item', {
      proposalId,
      pickItemId: params.pickItemId,
      originalSku: params.originalSku,
      proposedSku: params.proposedSku,
    });

    return { proposalId, status: 'PENDING_APPROVAL' };
  }

  /**
   * Records customer's explicit substitution decision
   */
  public async recordSubstitutionDecision(params: {
    proposalId: string;
    approved: boolean;
    decisionNotes?: string;
  }): Promise<{ status: 'APPROVED' | 'REJECTED' }> {
    const proposalRes = await Database.query(
      `SELECT id, pick_item_id, proposed_sku, proposed_product_name
       FROM substitution_proposals
       WHERE id = $1`,
      [params.proposalId]
    );

    if (proposalRes.rows.length === 0) {
      throw new Error(`Substitution proposal ${params.proposalId} not found`);
    }

    const proposal = proposalRes.rows[0];
    const decisionStatus = params.approved ? 'APPROVED' : 'REJECTED';

    await Database.query(
      `UPDATE substitution_proposals
       SET status = $1, customer_decision_notes = $2, decided_at = NOW()
       WHERE id = $3`,
      [decisionStatus, params.decisionNotes || null, params.proposalId]
    );

    // Update pick_item status accordingly
    if (params.approved) {
      await Database.query(
        `UPDATE pick_items
         SET status = 'SUBSTITUTED',
             sku = $1,
             product_name = $2,
             quantity_picked = quantity_requested
         WHERE id = $3`,
        [proposal.proposed_sku, proposal.proposed_product_name, proposal.pick_item_id]
      );
      logger.info('Customer approved substitution proposal', { proposalId: params.proposalId });
    } else {
      await Database.query(
        `UPDATE pick_items
         SET status = 'OUT_OF_STOCK',
             quantity_picked = 0
         WHERE id = $1`,
        [proposal.pick_item_id]
      );
      logger.info('Customer rejected substitution proposal', { proposalId: params.proposalId });
    }

    return { status: decisionStatus };
  }
}
