import { Agent, invokeFunctionTool, RunContext } from '@openai/agents';
import { z } from 'zod';

import { IncidentEventBus } from '../services/event-bus';
import { createInventoryTools } from '../tools/inventory.tool';
import { createViberOfferTool } from '../tools/viber.tool';

export const nexusDecisionSchema = z.object({
  problem: z.string(),
  verifiedContext: z.array(z.string()),
  recoveryStrategy: z.literal('ALTERNATIVE_FULFILLMENT'),
  rationale: z.string(),
  actions: z.array(z.string()).min(2),
});

export type NexusDecision = z.infer<typeof nexusDecisionSchema>;

function createNexusTools(eventBus: IncidentEventBus, incidentId: string) {
  const { checkInventory, reserveInventory } = createInventoryTools(eventBus, incidentId);
  const sendViberOffer = createViberOfferTool(eventBus, incidentId);
  return { checkInventory, reserveInventory, sendViberOffer };
}

export function createNexusAgent(eventBus: IncidentEventBus, incidentId: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required to run the Nexus agent. Add it to .env.');
  }

  const { checkInventory, reserveInventory, sendViberOffer } = createNexusTools(eventBus, incidentId);

  return new Agent({
    name: 'NEXUS_AGENT',
    instructions: `You orchestrate an out-of-stock recovery for one ecommerce incident.

You must call checkInventory first. If Taguig Hub has at least one unit, select ALTERNATIVE_FULFILLMENT, call reserveInventory for exactly one Taguig Hub unit, then call sendViberOffer. Never recommend a refund, GCash payment, CRM suppression, or any action outside these tools. Return only the structured decision after the tools succeed.`,
    tools: [checkInventory, reserveInventory, sendViberOffer],
    outputType: nexusDecisionSchema,
  });
}

/**
 * Executes the same validated tool chain without constructing or running an
 * OpenAI agent. This is intentionally useful only for predictable demos.
 */
export async function runDemoNexusAgent(eventBus: IncidentEventBus, incidentId: string): Promise<NexusDecision> {
  const { checkInventory, reserveInventory, sendViberOffer } = createNexusTools(eventBus, incidentId);
  const runContext = new RunContext();

  const inventory: unknown = await invokeFunctionTool({
    tool: checkInventory,
    runContext,
    input: JSON.stringify({ orderId: '1234', product: 'Skincare Set' }),
  });
  if (typeof inventory !== 'object' || inventory === null || !('taguigHubStock' in inventory)) {
    throw new Error('Alternative fulfillment is unavailable because Taguig Hub has no inventory.');
  }
  const taguigHubStock = inventory.taguigHubStock;
  if (typeof taguigHubStock !== 'number' || taguigHubStock < 1) {
    throw new Error('Alternative fulfillment is unavailable because Taguig Hub has no inventory.');
  }

  await invokeFunctionTool({
    tool: reserveInventory,
    runContext,
    input: JSON.stringify({
      orderId: '1234', product: 'Skincare Set', hub: 'Taguig Hub', quantity: 1,
    }),
  });
  await invokeFunctionTool({
    tool: sendViberOffer,
    runContext,
    input: JSON.stringify({
      customerId: '9812', orderId: '1234', recoveryStrategy: 'ALTERNATIVE_FULFILLMENT',
    }),
  });

  return nexusDecisionSchema.parse({
    problem: 'Seller inventory unavailable for Shopee order #1234.',
    verifiedContext: [
      'Seller stock: 0 units',
      `Taguig Hub stock: ${taguigHubStock} units`,
      'Makati Hub stock: 0 units',
      'Customer: Maria Santos (VIP)',
    ],
    recoveryStrategy: 'ALTERNATIVE_FULFILLMENT',
    rationale: 'The same product is available at Taguig Hub, allowing recovery without a refund.',
    actions: ['Reserve 1 unit at Taguig Hub', 'Send Viber recovery offer'],
  });
}
