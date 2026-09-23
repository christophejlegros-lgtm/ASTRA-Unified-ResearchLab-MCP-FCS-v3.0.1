#!/usr/bin/env node
/**
 * ASTRA MCP Server — SSE Transport
 * © 2026 Christophe Jean Legros — Geneva
 *
 * HTTP + Server-Sent Events transport for web-based MCP clients.
 * Listens on configurable port (default 9002).
 *
 * Architecture note: Each SSE client connection creates a separate
 * MCP server instance sharing the same singleton state. This is by
 * design — the MCP spec models each client as an independent session.
 * The SNN simulation loop runs once (guarded by isRunning check) and
 * its state is shared across all sessions via the singleton stores.
 *
 * Usage:
 *   ASTRA_SSE_PORT=9002 node dist/sse-server.js
 */

import express from 'express';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createAstraServer } from './server.js';
import { logger } from './utils/logger.js';
import { ASTRA_VERSION } from './version.js';

const PORT = Number.parseInt(process.env.ASTRA_SSE_PORT || '9002', 10) || 9002;
const HOST = process.env.ASTRA_SSE_HOST || '127.0.0.1';

/**
 * Fabrique l'application Express du transport SSE.
 * Exportée pour les tests d'intégration (tests/transports.test.ts),
 * qui l'attachent à un port éphémère sans lancer le processus serveur.
 */
export function createSseApp(): { app: express.Express; transports: Map<string, SSEServerTransport> } {
  const app = express();

  // CORS for browser-based MCP clients
  app.use((_req, res, next) => {
    const allowedOrigin = process.env.ASTRA_CORS_ORIGIN || '*';
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  app.use(express.json());

  // SSE endpoint — one transport per client connection
  const transports = new Map<string, SSEServerTransport>();

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      server: 'astra-mcp-server',
      version: ASTRA_VERSION,
      transport: 'sse',
      activeSessions: transports.size,
      uptime: process.uptime(),
    });
  });

  app.get('/sse', async (req, res) => {
    logger.info({ ip: req.ip }, 'New SSE client connection');

    // Each client gets its own server instance but shares singleton state
    const server = createAstraServer();
    const transport = new SSEServerTransport('/messages', res);

    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    res.on('close', () => {
      logger.info({ sessionId }, 'SSE client disconnected');
      transports.delete(sessionId);
      void transport.close().catch((err) =>
        logger.warn({ sessionId, err }, 'Error closing SSE transport'));
    });

    await server.connect(transport);
    logger.info({ sessionId, activeSessions: transports.size }, 'SSE transport connected');
  });

  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);

    if (!transport) {
      res.status(404).json({ error: 'Session not found', sessionId });
      return;
    }

    // express.json() a déjà consommé le flux : le corps parsé DOIT être transmis,
    // sinon le SDK tente de relire un flux vide et la requête reste suspendue.
    await transport.handlePostMessage(req, res, req.body);
  });

  return { app, transports };
}

async function main(): Promise<void> {
  const { app } = createSseApp();
  app.listen(PORT, HOST, () => {
    logger.info({ host: HOST, port: PORT }, `ASTRA MCP Server (SSE) listening`);
    logger.info(`SSE endpoint: http://${HOST}:${PORT}/sse`);
    logger.info(`Messages endpoint: http://${HOST}:${PORT}/messages`);
  });
}

// Ne démarrer l'écoute que si le module est le point d'entrée (node dist/sse-server.js
// ou bin astra-mcp-sse) — jamais lors d'un import par la suite de tests.
const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    logger.fatal({ error }, 'Fatal error starting ASTRA SSE server');
    process.exit(1);
  });
}
