/**
 * ASTRA — Tests d'intégration de la couche transport
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 *
 * Motivation : les 229 tests historiques exerçaient les moteurs (SNN, JEPA,
 * TCAI, active inference…) mais jamais les transports HTTP. Le bug du corps
 * de requête non transmis (express.json() consomme le flux ; le SDK MCP doit
 * recevoir le corps parsé via handleRequest/handlePostMessage, faute de quoi
 * chaque POST reste suspendu jusqu'au timeout) a ainsi survécu à une suite
 * intégralement verte. Cette suite ferme cet angle mort.
 *
 * Couverture :
 *   Streamable HTTP (spec MCP)
 *     T1  /health — statut, version unifiée, transport
 *     T2  Préflight CORS (OPTIONS → 204 + en-têtes)
 *     T3  Cycle de vie complet : initialize → session, serverInfo.version,
 *         notifications/initialized (202), tools/list (70 outils), DELETE (200)
 *     T4  Régression corps-parsé : initialize répond sous délai strict
 *     T5  Garde anti-session-orpheline : POST non-initialize sans session → 400 JSON-RPC
 *     T6  GET /mcp sans session → 404
 *     T7  Session supprimée → POST ultérieur rejeté ; Map des sessions élaguée
 *   SSE (transport historique)
 *     T8  /health — statut, version unifiée, transport
 *     T9  Cycle de vie : événement `endpoint`, POST initialize (202),
 *         réponse initialize reçue SUR le flux SSE (régression corps-parsé)
 *     T10 POST /messages avec session inconnue → 404
 *     T11 Déconnexion client → transport élagué de la Map
 *
 * Chaque requête porte un AbortSignal.timeout : une régression du corps parsé
 * se manifesterait par un échec net (TimeoutError), non par une suite gelée.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';

import { createHttpApp } from '../src/http-server.js';
import { createSseApp } from '../src/sse-server.js';
import { ASTRA_VERSION } from '../src/version.js';

// ── Constantes de contrat ─────────────────────────────────────────
// Doit rester alignée sur le gate CI (« 70 tools · 15 resources · 10 prompts »).
const EXPECTED_TOOL_COUNT = 70;
const REQUEST_TIMEOUT_MS = 8000;
const PROTOCOL_VERSION = '2025-03-26';

// ── Aides ─────────────────────────────────────────────────────────

function listen(app: express.Express): Promise<{ server: Server; base: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    // Node ≥ 18.2 : force la fermeture des connexions persistantes (flux SSE ouverts).
    server.closeAllConnections?.();
    server.close(() => resolve());
  });
}

/** Le transport Streamable HTTP répond en text/event-stream ; extraire le premier objet JSON. */
function parseSseBody(text: string): unknown {
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) return JSON.parse(line.slice(6));
  }
  // Réponse JSON simple (mode non-streaming)
  return JSON.parse(text);
}

function mcpHeaders(sessionId?: string): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (sessionId) h['mcp-session-id'] = sessionId;
  return h;
}

const initializeBody = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'astra-transport-tests', version: '1.0' },
  },
});

async function initializeSession(base: string): Promise<string> {
  const res = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: mcpHeaders(),
    body: initializeBody,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  assert.equal(res.status, 200, 'initialize doit répondre 200');
  const sid = res.headers.get('mcp-session-id');
  assert.ok(sid, 'l’en-tête Mcp-Session-Id doit être présent');
  // Consommer le corps pour libérer la connexion.
  await res.text();
  return sid;
}

// ═══ Streamable HTTP ══════════════════════════════════════════════

test('Transport Streamable HTTP', async (t) => {
  const { app, sessions } = createHttpApp();
  const { server, base } = await listen(app);
  t.after(() => closeServer(server));

  await t.test('T1 — /health expose statut, version unifiée et transport', async () => {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    assert.equal(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.status, 'ok');
    assert.equal(body.version, ASTRA_VERSION, 'la version /health doit égaler ASTRA_VERSION');
    assert.equal(body.transport, 'streamable-http');
    assert.equal(typeof body.activeSessions, 'number');
  });

  await t.test('T2 — préflight CORS OPTIONS → 204 avec en-têtes', async () => {
    const res = await fetch(`${base}/mcp`, {
      method: 'OPTIONS',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    assert.equal(res.status, 204);
    assert.ok(res.headers.get('access-control-allow-origin'));
    assert.match(res.headers.get('access-control-allow-methods') ?? '', /DELETE/);
    assert.match(res.headers.get('access-control-expose-headers') ?? '', /Mcp-Session-Id/i);
  });

  await t.test('T3 — cycle de vie complet initialize → tools/list → DELETE', async () => {
    // initialize
    const initRes = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: mcpHeaders(),
      body: initializeBody,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    assert.equal(initRes.status, 200);
    const sid = initRes.headers.get('mcp-session-id');
    assert.ok(sid);
    const initMsg = parseSseBody(await initRes.text()) as {
      result: { protocolVersion: string; serverInfo: { name: string; version: string } };
    };
    assert.equal(initMsg.result.serverInfo.name, 'astra');
    assert.equal(
      initMsg.result.serverInfo.version,
      ASTRA_VERSION,
      'le serveur MCP doit annoncer la version unifiée aux clients',
    );
    assert.equal(sessions.size, 1, 'une session doit être enregistrée après initialize');

    // notifications/initialized
    const notifRes = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: mcpHeaders(sid!),
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    assert.equal(notifRes.status, 202, 'une notification doit être acquittée 202');
    await notifRes.text();

    // tools/list — c'est ici que le bug historique gelait la requête
    const toolsRes = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: mcpHeaders(sid!),
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    assert.equal(toolsRes.status, 200);
    const toolsMsg = parseSseBody(await toolsRes.text()) as { result: { tools: Array<{ name: string }> } };
    assert.equal(
      toolsMsg.result.tools.length,
      EXPECTED_TOOL_COUNT,
      `v3.0 doit exposer exactement ${EXPECTED_TOOL_COUNT} outils (gate CI)`,
    );
    const names = new Set(toolsMsg.result.tools.map((tl) => tl.name));
    assert.equal(names.size, EXPECTED_TOOL_COUNT, 'les noms d’outils doivent être uniques');

    // DELETE — terminaison de session
    const delRes = await fetch(`${base}/mcp`, {
      method: 'DELETE',
      headers: mcpHeaders(sid!),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    assert.equal(delRes.status, 200);
    await delRes.text();
    assert.equal(sessions.size, 0, 'la Map des sessions doit être élaguée après DELETE');
  });

  await t.test('T4 — régression corps-parsé : initialize répond sous délai strict', async () => {
    // Avant correction, express.json() consommait le flux et handleRequest
    // relisait un flux vide : la requête restait suspendue. Un timeout court
    // suffit donc à détecter toute réintroduction du défaut.
    const t0 = Date.now();
    const sid = await initializeSession(base);
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < REQUEST_TIMEOUT_MS, `initialize a répondu en ${elapsed} ms`);
    await fetch(`${base}/mcp`, {
      method: 'DELETE',
      headers: mcpHeaders(sid),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).then((r) => r.text());
  });

  await t.test('T5 — POST non-initialize sans session → 400 JSON-RPC (garde anti-fuite)', async () => {
    const before = sessions.size;
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: mcpHeaders(),
      body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list' }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    assert.equal(res.status, 400);
    const body = await res.json() as { jsonrpc: string; error: { code: number } };
    assert.equal(body.jsonrpc, '2.0');
    assert.equal(body.error.code, -32000);
    assert.equal(sessions.size, before, 'aucune instance serveur orpheline ne doit être créée');
  });

  await t.test('T6 — GET /mcp sans session → 404', async () => {
    const res = await fetch(`${base}/mcp`, {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    assert.equal(res.status, 404);
    await res.text();
  });

  await t.test('T7 — session supprimée : POST ultérieur rejeté', async () => {
    const sid = await initializeSession(base);
    await fetch(`${base}/mcp`, {
      method: 'DELETE',
      headers: mcpHeaders(sid),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).then((r) => r.text());
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: mcpHeaders(sid),
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list' }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    // La session n'existe plus et le corps n'est pas un initialize → garde 400.
    assert.equal(res.status, 400);
    await res.text();
  });
});

// ═══ SSE (transport historique) ═══════════════════════════════════

test('Transport SSE', async (t) => {
  const { app, transports } = createSseApp();
  const { server, base } = await listen(app);
  t.after(() => closeServer(server));

  await t.test('T8 — /health expose statut, version unifiée et transport', async () => {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    assert.equal(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assert.equal(body.status, 'ok');
    assert.equal(body.version, ASTRA_VERSION);
    assert.equal(body.transport, 'sse');
  });

  await t.test('T9 — cycle de vie : endpoint, initialize (202), réponse sur le flux', async () => {
    const ctrl = new AbortController();
    try {
      const streamRes = await fetch(`${base}/sse`, {
        headers: { Accept: 'text/event-stream' },
        signal: ctrl.signal,
      });
      assert.equal(streamRes.status, 200);
      assert.match(streamRes.headers.get('content-type') ?? '', /text\/event-stream/);

      const reader = streamRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let endpoint: string | null = null;
      let initReceived = false;
      const deadline = Date.now() + REQUEST_TIMEOUT_MS;

      while (Date.now() < deadline && !initReceived) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        if (!endpoint) {
          const m = buffer.match(/event: endpoint\ndata: (.*)\n/);
          if (m) {
            endpoint = m[1];
            assert.match(endpoint, /^\/messages\?sessionId=/, 'l’événement endpoint doit router vers /messages');
            assert.equal(transports.size, 1, 'le transport doit être enregistré');

            // Régression corps-parsé : avant correction, ce POST restait suspendu.
            const postRes = await fetch(`${base}${endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: initializeBody,
              signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
            assert.equal(postRes.status, 202, 'le POST initialize doit être acquitté 202');
            await postRes.text();
          }
        }

        if (buffer.includes('"serverInfo"')) {
          const m = buffer.match(/data: (\{.*"serverInfo".*\})\n/);
          assert.ok(m, 'la réponse initialize doit arriver sur le flux SSE');
          const msg = JSON.parse(m![1]) as { result: { serverInfo: { version: string } } };
          assert.equal(msg.result.serverInfo.version, ASTRA_VERSION);
          initReceived = true;
        }
      }
      assert.ok(initReceived, 'réponse initialize reçue sur le flux SSE avant échéance');
    } finally {
      ctrl.abort();
    }
    // La déconnexion du client doit élaguer la Map (T11, vérifié après un tour d'événements).
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(transports.size, 0, 'le transport doit être élagué à la déconnexion du client');
  });

  await t.test('T10 — POST /messages avec session inconnue → 404', async () => {
    const res = await fetch(`${base}/messages?sessionId=inexistante`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: initializeBody,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    assert.equal(res.status, 404);
    const body = await res.json() as { error: string };
    assert.equal(body.error, 'Session not found');
  });
});
