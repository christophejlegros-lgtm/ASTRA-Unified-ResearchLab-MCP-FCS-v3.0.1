/**
 * ASTRA Logger
 * Structured logging via pino. Writes to stderr so stdout
 * stays clean for MCP stdio transport.
 */

import pino from 'pino';

const level = process.env.ASTRA_LOG_LEVEL || 'info';

export const logger = pino({
  name: 'astra-mcp',
  level,
  transport: process.stderr.isTTY
    ? { target: 'pino-pretty', options: { destination: 2 } }
    : undefined,
}, process.stderr);
