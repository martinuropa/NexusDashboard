import 'dotenv/config';

import express from 'express';

import { createIncidentsRouter } from './routes/incidents.routes';
import { IncidentEventBus } from './services/event-bus';
import { IncidentRunner } from './services/incident-runner';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const eventBus = new IncidentEventBus();
const incidentRunner = new IncidentRunner(eventBus);

app.use(express.json());
app.get('/health', (_request, response) => response.json({ status: 'ok' }));
app.use('/api/incidents', createIncidentsRouter(eventBus, incidentRunner));

app.listen(port, () => {
  console.log(`NexusCX backend listening on http://localhost:${port}`);
});
