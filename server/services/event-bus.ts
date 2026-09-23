export type IncidentEventType =
  | 'INCIDENT_RECEIVED'
  | 'INVENTORY_CHECK'
  | 'INVENTORY_FOUND'
  | 'DECISION_MADE'
  | 'INVENTORY_RESERVED'
  | 'VIBER_OFFER_SENT'
  | 'INCIDENT_RECOVERED';

export interface AiDecisionData {
  problem: string;
  verifiedContext: string[];
  recoveryStrategy: 'ALTERNATIVE_FULFILLMENT';
  rationale: string;
  actions: string[];
}

export interface IncidentEvent {
  incidentId: string;
  timestamp: string;
  agent: 'NEXUS_AGENT';
  type: IncidentEventType;
  message: string;
  data?: AiDecisionData;
}

type Subscriber = (event: IncidentEvent) => void;

/** In-memory event history for the Phase 1 demo. */
export class IncidentEventBus {
  private readonly eventsByIncident = new Map<string, IncidentEvent[]>();
  private readonly subscribersByIncident = new Map<string, Set<Subscriber>>();

  emit(event: Omit<IncidentEvent, 'timestamp'> & { timestamp?: string }): IncidentEvent {
    const completeEvent: IncidentEvent = {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    };
    const history = this.eventsByIncident.get(completeEvent.incidentId) ?? [];
    history.push(completeEvent);
    this.eventsByIncident.set(completeEvent.incidentId, history);

    for (const subscriber of this.subscribersByIncident.get(completeEvent.incidentId) ?? []) {
      subscriber(completeEvent);
    }
    return completeEvent;
  }

  subscribe(incidentId: string, subscriber: Subscriber): () => void {
    for (const event of this.eventsByIncident.get(incidentId) ?? []) {
      subscriber(event);
    }
    const subscribers = this.subscribersByIncident.get(incidentId) ?? new Set<Subscriber>();
    subscribers.add(subscriber);
    this.subscribersByIncident.set(incidentId, subscribers);

    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) this.subscribersByIncident.delete(incidentId);
    };
  }

  hasIncident(incidentId: string): boolean {
    return this.eventsByIncident.has(incidentId);
  }
}
