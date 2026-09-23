#!/usr/bin/env node
/**
 * ASTRA MCP Server — stdio Transport
 * © 2026 Christophe Jean Legros — Geneva
 *
 * Entry point for Claude Desktop, Cursor, and VS Code.
 * Communicates via stdin/stdout using JSON-RPC 2.0.
 *
 * Usage:
 *   node dist/index.js
 *   npx @astra/mcp-server
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createAstraServer } from './server.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  logger.info('ASTRA MCP Server starting (stdio transport)');

  const server = createAstraServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  logger.info('ASTRA MCP Server connected via stdio — ready for requests');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.fatal({ error }, 'Fatal error starting ASTRA MCP Server');
  process.exit(1);
});
