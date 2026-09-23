import { Router } from 'express';
import type { Request, Response } from 'express';

import { IncidentEvent, IncidentEventBus } from '../services/event-bus';
import { IncidentRunner, SimulatedIncident } from '../services/incident-runner';

export function createIncidentsRouter(eventBus: IncidentEventBus, incidentRunner: IncidentRunner): Router {
  const router = Router();
  const incidents = new Map<string, SimulatedIncident>();

  router.post('/simulate', (_request: Request, response: Response) => {
    const incident = incidentRunner.createSimulatedIncident();
    incidents.set(incident.incidentId, incident);
    response.status(202).json({ incidentId: incident.incidentId });
  });

  router.get('/:incidentId/events', (request: Request, response: Response) => {
    const routeIncidentId = request.params['incidentId'];
    const incidentId = Array.isArray(routeIncidentId) ? routeIncidentId[0] : routeIncidentId;
    const incident = incidentId ? incidents.get(incidentId) : undefined;
    if (!incident || !eventBus.hasIncident(incident.incidentId)) {
      response.status(404).json({ error: 'Incident not found' });
      return;
    }

    response.status(200).set({
      'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive',
      'Content-Type': 'text/event-stream', 'X-Accel-Buffering': 'no',
    });
    response.flushHeaders();

    const writeEvent = (event: IncidentEvent) => {
      response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      if (event.type === 'INCIDENT_RECOVERED') response.end();
    };
    const unsubscribe = eventBus.subscribe(incident.incidentId, writeEvent);
    void incidentRunner.start(incident).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown incident workflow failure.';
      response.write(`event: error\ndata: ${JSON.stringify({ incidentId: incident.incidentId, message })}\n\n`);
      response.end();
    });
    request.on('close', unsubscribe);
  });
  return router;
}
