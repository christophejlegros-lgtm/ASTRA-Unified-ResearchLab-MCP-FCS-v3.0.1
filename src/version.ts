/**
 * ASTRA — Version unique (source de vérité)
 * © 2026 Christophe Jean Legros — Geneva
 *
 * Doit rester synchronisée avec package.json "version".
 * Consommée par server.ts, sse-server.ts et http-server.ts afin
 * d'éliminer les chaînes de version divergentes (2.0.0 / 2.2.0 / 2.9.0).
 */
export const ASTRA_VERSION = '3.0.0';
