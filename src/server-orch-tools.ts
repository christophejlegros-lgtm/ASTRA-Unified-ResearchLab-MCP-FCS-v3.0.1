/**
 * ASTRA — MCP tool surface for the Orch OR criterion layer
 * ════════════════════════════════════════════════════════
 *   orch_report        — consolidated theory status, criterion, substrates
 *   orch_criterion     — Penrose τ = ℏ/E_G with a sensitivity sweep
 *   orch_decoherence   — Tegmark vs Hagan et al. budget
 *   orch_substrate     — per-substrate verdict, including the OVOMIND channel
 *   orch_gate_config   — configure/enable the classical surrogate gate
 *   orch_cycle         — OVOMIND frame → TCAI cycle → epoch-quantised commit
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  OrchestratedGate,
  penroseCriterion,
  decoherenceBudget,
  assessSubstrate,
  orchReport,
  ORCH_EPOCH_S,
} from './engine/tcai/orch-or.js';
import { lintClaim } from './engine/tcai/phenomenal-guard.js';
import type { OvomindBridge } from './engine/ovomind.js';
import type { TCAIConsciousnessSystem } from './engine/tcai/acm-bridge.js';

const SUBSTRATES = ['silicon-snn', 'organoid-mea', 'human-wearable'] as const;

function emit(payload: unknown) {
  const text = JSON.stringify(payload, null, 2);
  const violations = lintClaim(text);
  if (violations.length > 0) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: 'CLAIM_LINT_FAILED', patterns: violations }, null, 2) }],
      isError: true,
    };
  }
  return { content: [{ type: 'text' as const, text }] };
}

export interface OrchToolDeps {
  tcai: TCAIConsciousnessSystem;
  ovomind: OvomindBridge;
  /** Seeded RNG for reproducible tie-breaks in experiments. */
  rng?: () => number;
}

export function registerOrchTools(server: McpServer, deps: OrchToolDeps): OrchestratedGate {
  const gate = new OrchestratedGate(undefined, deps.rng);
  let gateEnabled = false;

  server.tool(
    'orch_report',
    'Consolidated Orch OR status: theory epistemic standing, Penrose criterion at the ' +
    'canonical 2×10¹⁰ tubulins, decoherence budget, and the verdict for each of the ' +
    'three ASTRA substrates.',
    {},
    async () => emit(orchReport(gateEnabled ? gate : undefined)),
  );

  server.tool(
    'orch_criterion',
    'Penrose objective-reduction criterion τ = ℏ/E_G, with the mass-displacement scale ' +
    'exposed as a free parameter and a sensitivity sweep across four orders of magnitude.',
    {
      tubulinCount: z.number().positive().describe('Tubulin dimers in coherent superposition.'),
      separationM: z.number().positive().optional()
        .describe('Effective mass displacement, m. Default 1.056e-11 (back-calibrated to 2×10¹⁰ @ 25 ms).'),
      massKg: z.number().positive().optional().describe('Superposed unit mass. Default: tubulin dimer.'),
    },
    async (args) => emit(penroseCriterion(args)),
  );

  server.tool(
    'orch_decoherence',
    'Decoherence time budget for a target coherence window: Tegmark (2000) vs the ' +
    'Hagan/Hameroff/Tuszyński (2002) correction, and the residual gap.',
    { requiredCoherenceS: z.number().positive().optional() },
    async ({ requiredCoherenceS }) => emit(decoherenceBudget(requiredCoherenceS ?? ORCH_EPOCH_S)),
  );

  server.tool(
    'orch_substrate',
    'Orch OR verdict for one substrate: tubulin budget, epochs elapsed per observation ' +
    'through ASTRA\'s channel, and the reasoning behind the verdict.',
    {
      substrate: z.enum(SUBSTRATES),
      neuronCount: z.number().positive().optional(),
      channelLatencyMs: z.number().positive().optional(),
    },
    async ({ substrate, neuronCount, channelLatencyMs }) =>
      emit(assessSubstrate(substrate, { neuronCount, channelLatencyMs })),
  );

  server.tool(
    'orch_gate_config',
    'Enable or configure the classical surrogate gate (epoch-quantised ignition with ' +
    'stochastic tie-break). The gate reproduces the Orch OR temporal signature only; ' +
    'it does not instantiate objective reduction.',
    {
      enabled: z.boolean().optional(),
      epochMs: z.number().min(1).max(1000).optional(),
      tieBandFraction: z.number().min(0).max(0.5).optional(),
      ignitionFloor: z.number().min(0).max(1).optional(),
    },
    async ({ enabled, ...cfg }) => {
      if (enabled !== undefined) { gateEnabled = enabled; if (!enabled) gate.reset(); }
      gate.setConfig(cfg);
      return emit({
        enabled: gateEnabled,
        config: gate.getConfig(),
        disclaimer:
          'Surrogate timing layer. Penrose OR is claimed to be non-computable; a ' +
          'pseudo-random tie-break is computable by definition.',
      });
    },
  );

  server.tool(
    'orch_cycle',
    'Read one OVOMIND affect frame, run a TCAI cycle, and pass the workspace competition ' +
    'through the epoch-quantised surrogate gate. Reports how many Orch OR epochs the ' +
    'affect frame integrated over.',
    { controllability: z.number().min(0).max(1).optional() },
    async ({ controllability }) => {
      const frame = deps.ovomind.read(controllability);
      if (!frame) return emit({ error: 'NO_FRAME' });
      const result = deps.tcai.runCycle(deps.ovomind.toCycleFragment(frame));
      const gated = gateEnabled
        ? gate.submit(result.competition.boundBids, result.competition.ignition)
        : null;
      return emit({
        frame: { valence: frame.valence, arousal: frame.arousal, ageMs: frame.ageMs, stale: frame.stale },
        continuousIgnition: result.competition.ignition,
        continuousWinners: result.competition.winners,
        gated,
        orchEpochsIntegratedOver: frame.ageMs / (ORCH_EPOCH_S * 1000),
        interpretation:
          'The affect frame integrates over the epochs shown above. Under Orch OR that ' +
          'is the timescale on which conscious moments are individuated, so the human ' +
          'channel cannot resolve them — a sampling limit, not an accuracy limit.',
      });
    },
  );

  return gate;
}
