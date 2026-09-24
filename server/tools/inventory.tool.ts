import { tool } from '@openai/agents';
import { z } from 'zod';

import { IncidentEventBus } from '../services/event-bus';

const ORDER_ID = '1234';
const PRODUCT = 'Skincare Set';
const SELLER_STOCK = 0;
const MAKATI_HUB_STOCK = 0;
const TAGUIG_HUB_STOCK = 3;
const reservations = new Set<string>();
const inventoryChecks = new Set<string>();

function validateOrderAndProduct(orderId: string, product: string): void {
  if (orderId !== ORDER_ID || product !== PRODUCT) {
    throw new Error('This Phase 1 inventory tool only supports order #1234 for Skincare Set.');
  }
}

export function createInventoryTools(eventBus: IncidentEventBus, incidentId: string) {
  let taguigHubStock = TAGUIG_HUB_STOCK;
  const checkInventory = tool({
    name: 'checkInventory',
    description: 'Check seller and warehouse stock for the cancelled order before choosing a recovery path.',
    parameters: z.object({ orderId: z.string(), product: z.string() }),
    async execute({ orderId, product }) {
      validateOrderAndProduct(orderId, product);
      inventoryChecks.add(`${incidentId}:${orderId}`);
      eventBus.emit({
        incidentId, agent: 'NEXUS_AGENT', type: 'INVENTORY_CHECK',
        message: 'Checking seller, Taguig Hub, and Makati Hub inventory for Skincare Set.',
      });
      const result = { sellerStock: SELLER_STOCK, taguigHubStock, makatiHubStock: MAKATI_HUB_STOCK };
      eventBus.emit({
        incidentId, agent: 'NEXUS_AGENT', type: 'INVENTORY_FOUND',
        message: `Taguig Hub has ${taguigHubStock} units available; seller and Makati Hub are out of stock.`,
      });
      return result;
    },
  });

  const reserveInventory = tool({
    name: 'reserveInventory',
    description: 'Reserve one Taguig Hub unit only after inventory confirms availability for this incident.',
    parameters: z.object({
      orderId: z.string(), product: z.string(), hub: z.literal('Taguig Hub'), quantity: z.literal(1),
    }),
    async execute({ orderId, product, hub, quantity }) {
      validateOrderAndProduct(orderId, product);
      const reservationKey = `${incidentId}:${orderId}`;
      if (hub !== 'Taguig Hub' || quantity !== 1) throw new Error('Only one Taguig Hub unit may be reserved.');
      if (!inventoryChecks.has(reservationKey)) throw new Error('Inventory must be checked before it can be reserved.');
      if (reservations.has(reservationKey)) {
        return { reservationId: reservationKey, status: 'already_reserved', remainingTaguigStock: taguigHubStock };
      }
      if (taguigHubStock < quantity) throw new Error('Taguig Hub has insufficient inventory.');

      eventBus.emit({
        incidentId, agent: 'NEXUS_AGENT', type: 'DECISION_MADE',
        message: 'Alternative fulfillment selected because Taguig Hub inventory is available.',
        data: {
          problem: 'Seller inventory unavailable for Shopee order #1234.',
          verifiedContext: [
            'Seller stock: 0 units', `Taguig Hub stock: ${taguigHubStock} units`,
            'Makati Hub stock: 0 units', 'Customer: Maria Santos (VIP)',
          ],
          recoveryStrategy: 'ALTERNATIVE_FULFILLMENT',
          rationale: 'The same product is available at Taguig Hub, allowing recovery without a refund.',
          actions: ['Reserve 1 unit at Taguig Hub', 'Send Viber recovery offer'],
        },
      });
      taguigHubStock -= quantity;
      reservations.add(reservationKey);
      eventBus.emit({
        incidentId, agent: 'NEXUS_AGENT', type: 'INVENTORY_RESERVED',
        message: `Reserved 1 Skincare Set at Taguig Hub. ${taguigHubStock} units remain.`,
      });
      return { reservationId: reservationKey, status: 'reserved', remainingTaguigStock: taguigHubStock };
    },
  });
  return { checkInventory, reserveInventory };
}

export function hasInventoryReservation(incidentId: string, orderId: string): boolean {
  return reservations.has(`${incidentId}:${orderId}`);
}
