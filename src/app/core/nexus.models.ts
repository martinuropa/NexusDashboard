export type NexusEventType =
  | 'INCIDENT_RECEIVED'
  | 'INVENTORY_CHECK'
  | 'INVENTORY_FOUND'
  | 'DECISION_MADE'
  | 'INVENTORY_RESERVED'
  | 'VIBER_OFFER_SENT'
  | 'INCIDENT_RECOVERED';

export interface NexusDecision {
  problem: string;
  verifiedContext: string[];
  recoveryStrategy: 'ALTERNATIVE_FULFILLMENT';
  rationale: string;
  actions: string[];
}

export interface NexusEvent {
  incidentId: string;
  timestamp: string;
  agent: 'NEXUS_AGENT';
  type: NexusEventType;
  message: string;
  data?: NexusDecision;
}

export interface SimulatedIncidentResponse {
  incidentId: string;
}
