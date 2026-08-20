import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from './config.js';
import { attachSockets } from './sockets.js';
import { authRouter } from './routes/auth.js';
import { itemsRouter } from './routes/items.js';
import { jobsRouter } from './routes/jobs.js';
import { centersRouter } from './routes/centers.js';
import { rewardsRouter } from './routes/rewards.js';
import { dashboardRouter } from './routes/dashboard.js';

const app = express();
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

app.use('/auth', authRouter);
app.use('/items', itemsRouter);
app.use('/jobs', jobsRouter);
app.use('/centers', centersRouter);
app.use('/rewards', rewardsRouter);
app.use('/dashboard', dashboardRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

// Catches errors thrown (or passed to next()) by any route above -- without
// this, Express falls back to its default HTML handler, which leaks stack
// traces to the client outside of NODE_ENV=production.
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  const message = status < 500 || !config.isProduction ? err.message : 'internal server error';
  res.status(status).json({ error: message });
});

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: config.corsOrigins } });
attachSockets(io);

httpServer.listen(config.port, () => {
  console.log(`ScrapSwap server listening on http://localhost:${config.port}`);
});
