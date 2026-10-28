import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FulfillmentService } from '../src/fulfillment.service.js';
import { Database } from '../src/db.js';

describe('FulfillmentService - FEFO Picking & Substitution Workflow', () => {
  const service = new FulfillmentService();

  it('generates pick list with strict FEFO (First-Expired, First-Out) order', async () => {
    const insertedItems: any[] = [];

    Database.query = async (text: string, params?: any[]): Promise<any> => {
      if (text.includes('INSERT INTO pick_items')) {
        insertedItems.push({
          sku: params?.[2],
          productName: params?.[3],
          expiryDate: params?.[6],
        });
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    };

    const result = await service.generatePickList({
      orderId: 'ord-fefo-1',
      orderNumber: 'ORD-FEFO-001',
      customerId: 'cust-1',
      items: [
        {
          sku: 'BREAD-WHOLE-WHEAT',
          productName: 'Whole Wheat Bread',
          quantityRequested: 1,
          expiryDate: '2026-11-05',
        },
        {
          sku: 'MILK-TONED-1L',
          productName: 'Fresh Toned Milk 1L',
          quantityRequested: 2,
          expiryDate: '2026-10-30', // Earliest!
        },
        {
          sku: 'CURD-POUCH-500G',
          productName: 'Fresh Curd 500g',
          quantityRequested: 1,
          expiryDate: '2026-11-02', // Middle
        },
        {
          sku: 'RICE-BASMATI-5KG',
          productName: 'Basmati Rice 5kg',
          quantityRequested: 1,
          // No expiry date
        },
      ],
    });

    assert.equal(result.items.length, 4);

    // Verify FEFO sequence: Milk (Oct 30) -> Curd (Nov 02) -> Bread (Nov 05) -> Rice (No Expiry)
    assert.equal(result.items[0].sku, 'MILK-TONED-1L');
    assert.equal(result.items[1].sku, 'CURD-POUCH-500G');
    assert.equal(result.items[2].sku, 'BREAD-WHOLE-WHEAT');
    assert.equal(result.items[3].sku, 'RICE-BASMATI-5KG');

    assert.equal(insertedItems[0].sku, 'MILK-TONED-1L');
    assert.equal(insertedItems[1].sku, 'CURD-POUCH-500G');
  });

  it('manages substitution proposal and records customer approval', async () => {
    let proposalRecord: any = null;
    let itemStatus = 'PENDING';
    let itemSku = 'DETTOL-ORIG-75G';

    Database.query = async (text: string, params?: any[]): Promise<any> => {
      if (text.includes('UPDATE pick_items SET status = \'SUBSTITUTION_PROPOSED\'')) {
        itemStatus = 'SUBSTITUTION_PROPOSED';
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('INSERT INTO substitution_proposals')) {
        proposalRecord = {
          id: params?.[0],
          pick_item_id: params?.[1],
          proposed_sku: params?.[4],
          proposed_product_name: params?.[5],
          status: 'PENDING_APPROVAL',
        };
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('SELECT id, pick_item_id, proposed_sku')) {
        return { rowCount: 1, rows: [proposalRecord] };
      }
      if (text.includes('UPDATE substitution_proposals')) {
        proposalRecord.status = params?.[0];
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('UPDATE pick_items') && text.includes('SET status = \'SUBSTITUTED\'')) {
        itemStatus = 'SUBSTITUTED';
        itemSku = params?.[0];
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    };

    // 1. Propose substitution
    const proposal = await service.proposeSubstitution({
      pickListId: 'pl-1',
      pickItemId: 'pi-1',
      originalSku: 'DETTOL-ORIG-75G',
      proposedSku: 'LIFEBUOY-RED-100G',
      proposedProductName: 'Lifebuoy Total Soap 100g',
      priceDelta: -5.0,
    });

    assert.equal(proposal.status, 'PENDING_APPROVAL');
    assert.equal(itemStatus, 'SUBSTITUTION_PROPOSED');

    // 2. Customer explicitly approves
    const decision = await service.recordSubstitutionDecision({
      proposalId: proposal.proposalId,
      approved: true,
      decisionNotes: 'Customer approved alternative soap via WhatsApp',
    });

    assert.equal(decision.status, 'APPROVED');
    assert.equal(itemStatus, 'SUBSTITUTED');
    assert.equal(itemSku, 'LIFEBUOY-RED-100G');
  });

  it('manages substitution proposal and records customer rejection', async () => {
    let itemStatus = 'PENDING';
    const proposalRecord = {
      id: 'prop-rej-1',
      pick_item_id: 'pi-2',
      proposed_sku: 'PEARS-PURE-75G',
      proposed_product_name: 'Pears Pure & Gentle',
      status: 'PENDING_APPROVAL',
    };

    Database.query = async (text: string, params?: any[]): Promise<any> => {
      if (text.includes('SELECT id, pick_item_id')) {
        return { rowCount: 1, rows: [proposalRecord] };
      }
      if (text.includes('UPDATE substitution_proposals')) {
        proposalRecord.status = params?.[0];
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('UPDATE pick_items') && text.includes('status = \'OUT_OF_STOCK\'')) {
        itemStatus = 'OUT_OF_STOCK';
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    };

    const decision = await service.recordSubstitutionDecision({
      proposalId: 'prop-rej-1',
      approved: false,
      decisionNotes: 'Customer declined substitution',
    });

    assert.equal(decision.status, 'REJECTED');
    assert.equal(itemStatus, 'OUT_OF_STOCK');
  });
});
