import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { NexusEvent, NexusEventType, SimulatedIncidentResponse } from './nexus.models';

const nexusEventTypes: NexusEventType[] = [
  'INCIDENT_RECEIVED',
  'INVENTORY_CHECK',
  'INVENTORY_FOUND',
  'DECISION_MADE',
  'INVENTORY_RESERVED',
  'VIBER_OFFER_SENT',
  'INCIDENT_RECOVERED',
];

@Injectable({ providedIn: 'root' })
export class NexusApiService {
  constructor(private readonly http: HttpClient) {}

  simulateIncident(): Observable<SimulatedIncidentResponse> {
    return this.http.post<SimulatedIncidentResponse>('/api/incidents/simulate', {});
  }

  connectToIncidentEvents(incidentId: string): Observable<NexusEvent> {
    return new Observable<NexusEvent>((observer) => {
      const eventSource = new EventSource(`/api/incidents/${encodeURIComponent(incidentId)}/events`);

      const handleEvent = (event: Event) => {
        try {
          observer.next(JSON.parse((event as MessageEvent<string>).data) as NexusEvent);
        } catch {
          observer.error(new Error('Received an invalid NexusCX event payload.'));
          eventSource.close();
        }
      };

      for (const eventType of nexusEventTypes) {
        eventSource.addEventListener(eventType, handleEvent);
      }

      eventSource.addEventListener('INCIDENT_RECOVERED', () => {
        eventSource.close();
        observer.complete();
      });

      eventSource.onerror = () => {
        if (eventSource.readyState !== EventSource.CLOSED) {
          return;
        }
        observer.error(new Error('NexusCX event stream disconnected unexpectedly.'));
      };

      return () => eventSource.close();
    });
  }
}
