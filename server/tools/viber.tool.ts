import { tool } from '@openai/agents';
import { z } from 'zod';

import { IncidentEventBus } from '../services/event-bus';
import { getCustomerProfile } from './customer.tool';
import { hasInventoryReservation } from './inventory.tool';

const deliveredOffers = new Set<string>();

export function createViberOfferTool(eventBus: IncidentEventBus, incidentId: string) {
  return tool({
    name: 'sendViberOffer',
    description: 'Send the approved alternative-fulfillment recovery offer to the customer through Viber.',
    parameters: z.object({
      customerId: z.literal('9812'), orderId: z.literal('1234'), recoveryStrategy: z.literal('ALTERNATIVE_FULFILLMENT'),
    }),
    async execute({ customerId, orderId, recoveryStrategy }) {
      const customer = getCustomerProfile(customerId);
      const offerKey = `${incidentId}:${customerId}:${orderId}`;
      if (recoveryStrategy !== 'ALTERNATIVE_FULFILLMENT') throw new Error('Only the validated recovery offer may be sent.');
      if (!hasInventoryReservation(incidentId, orderId)) {
        throw new Error('A Taguig Hub inventory reservation is required before sending an offer.');
      }
      if (deliveredOffers.has(offerKey)) return { status: 'already_sent', channel: customer.preferredChannel };
      deliveredOffers.add(offerKey);
      eventBus.emit({
        incidentId, agent: 'NEXUS_AGENT', type: 'VIBER_OFFER_SENT',
        message: `Viber recovery offer sent to ${customer.name} for Taguig Hub alternative fulfillment.`,
      });
      return { status: 'sent', channel: customer.preferredChannel, customer: customer.name };
    },
  });
}

export function hasViberOffer(incidentId: string, customerId: string, orderId: string): boolean {
  return deliveredOffers.has(`${incidentId}:${customerId}:${orderId}`);
}
