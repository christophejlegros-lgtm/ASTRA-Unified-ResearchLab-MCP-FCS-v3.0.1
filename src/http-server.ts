#!/usr/bin/env node
/**
 * ASTRA MCP Server — Streamable HTTP Transport
 * © 2026 Christophe Jean Legros — Geneva
 *
 * Modern stateless HTTP transport per MCP spec 2025-11-25.
 * Supports both streaming (SSE) and non-streaming responses.
 *
 * Architecture note: Each HTTP session creates a separate MCP server
 * instance sharing the same singleton state. This is by design — the
 * MCP spec models each client as an independent session. The SNN
 * simulation loop runs once (guarded by isRunning check) and its
 * state is shared across all sessions via the singleton stores.
 *
 * Usage:
 *   ASTRA_HTTP_PORT=9003 node dist/http-server.js
 */

import express from 'express';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createAstraServer } from './server.js';
import { logger } from './utils/logger.js';
import { ASTRA_VERSION } from './version.js';

const PORT = Number.parseInt(process.env.ASTRA_HTTP_PORT || '9003', 10) || 9003;
const HOST = process.env.ASTRA_HTTP_HOST || '127.0.0.1';

type HttpSession = { server: ReturnType<typeof createAstraServer>; transport: StreamableHTTPServerTransport };

/**
 * Fabrique l'application Express du transport Streamable HTTP.
 * Exportée pour les tests d'intégration (tests/transports.test.ts),
 * qui l'attachent à un port éphémère sans lancer le processus serveur.
 */
export function createHttpApp(): { app: express.Express; sessions: Map<string, HttpSession> } {
  const app = express();

  app.use((_req, res, next) => {
    const allowedOrigin = process.env.ASTRA_CORS_ORIGIN || '*';
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
    res.header('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  app.use(express.json());

  // Session management
  const sessions = new Map<string, HttpSession>();

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      server: 'astra-mcp-server',
      version: ASTRA_VERSION,
      transport: 'streamable-http',
      activeSessions: sessions.size,
      uptime: process.uptime(),
    });
  });

  // MCP endpoint — handles all JSON-RPC traffic
  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    // Existing session?
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      // express.json() a déjà consommé le flux : transmettre le corps parsé
      // est obligatoire (cf. doc du SDK), sinon la requête reste suspendue.
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    // Ne créer une session que pour une requête initialize valide —
    // évite la fuite d'instances serveur orphelines sur des POST parasites.
    if (!isInitializeRequest(req.body)) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: no valid session. Send an initialize request first.' },
        id: null,
      });
      return;
    }

    // New session — each client gets its own server instance but shares singleton state
    const server = createAstraServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (newSessionId) => {
        logger.info({ sessionId: newSessionId }, 'New Streamable HTTP session');
        sessions.set(newSessionId, { server, transport });
      },
    });

    // Clean up on close
    transport.onclose = () => {
      const sid = [...sessions.entries()].find(([_, v]) => v.transport === transport)?.[0];
      if (sid) {
        sessions.delete(sid);
        logger.info({ sessionId: sid, activeSessions: sessions.size }, 'Session closed');
      }
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // GET for SSE streaming from server → client
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(404).json({ error: 'Session not found. Send POST /mcp first.' });
      return;
    }
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res);
  });

  // DELETE for session termination
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res);
    // transport.onclose élague déjà la Map ; ce delete n'est qu'un filet de sécurité.
    if (sessions.delete(sessionId)) {
      logger.info({ sessionId, activeSessions: sessions.size }, 'Session deleted via DELETE');
    }
  });

  return { app, sessions };
}

async function main(): Promise<void> {
  const { app } = createHttpApp();
  app.listen(PORT, HOST, () => {
    logger.info({ host: HOST, port: PORT }, `ASTRA MCP Server (Streamable HTTP) listening`);
    logger.info(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
  });
}

// Ne démarrer l'écoute que si le module est le point d'entrée (node dist/http-server.js
// ou bin astra-mcp-http) — jamais lors d'un import par la suite de tests.
const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    logger.fatal({ error }, 'Fatal error starting ASTRA HTTP server');
    process.exit(1);
  });
}
