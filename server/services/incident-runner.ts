import { randomUUID } from 'node:crypto';

import { run } from '@openai/agents';

import { createNexusAgent, nexusDecisionSchema, runDemoNexusAgent } from '../agents/nexus.agent';
import { getCustomerProfile } from '../tools/customer.tool';
import { hasInventoryReservation } from '../tools/inventory.tool';
import { hasViberOffer } from '../tools/viber.tool';
import { IncidentEventBus } from './event-bus';

export interface SimulatedIncident {
  incidentId: string;
  orderId: '1234';
  product: 'Skincare Set';
  orderValuePhp: 2500;
  customerId: '9812';
}

export class IncidentRunner {
  private readonly startedIncidents = new Set<string>();

  constructor(private readonly eventBus: IncidentEventBus) {}

  createSimulatedIncident(): SimulatedIncident {
    const incident: SimulatedIncident = {
      incidentId: randomUUID(), orderId: '1234', product: 'Skincare Set', orderValuePhp: 2500, customerId: '9812',
    };
    this.eventBus.emit({
      incidentId: incident.incidentId, agent: 'NEXUS_AGENT', type: 'INCIDENT_RECEIVED',
      message: 'Received seller out-of-stock incident for Shopee order #1234.',
    });
    return incident;
  }

  async start(incident: SimulatedIncident): Promise<void> {
    if (this.startedIncidents.has(incident.incidentId)) return;
    this.startedIncidents.add(incident.incidentId);

    const decision = process.env.DEMO_MODE === 'true'
      ? await runDemoNexusAgent(this.eventBus, incident.incidentId)
      : await this.runOpenAiWorkflow(incident);
    if (!hasInventoryReservation(incident.incidentId, incident.orderId)) {
      throw new Error('Agent completed without a validated inventory reservation.');
    }
    if (!hasViberOffer(incident.incidentId, incident.customerId, incident.orderId)) {
      throw new Error('Agent completed without a validated Viber recovery offer.');
    }
    this.eventBus.emit({
      incidentId: incident.incidentId, agent: 'NEXUS_AGENT', type: 'INCIDENT_RECOVERED',
      message: `Incident recovered with ${decision.recoveryStrategy}.`,
    });
  }

  private async runOpenAiWorkflow(incident: SimulatedIncident) {
    const customer = getCustomerProfile(incident.customerId);
    const agent = createNexusAgent(this.eventBus, incident.incidentId);
    const result = await run(
      agent,
      `Recover this out-of-stock incident:\nOrder: #${incident.orderId}\nProduct: ${incident.product}\nOrder value: PHP ${incident.orderValuePhp}\nCustomer: ${customer.name} (${customer.tier}; preferred channel: ${customer.preferredChannel}).`,
      { maxTurns: 6 },
    );
    return nexusDecisionSchema.parse(result.finalOutput);
  }
}
