/**
 * ASTRA — MCP tool surface for the OVOMIND affective bridge
 * ═════════════════════════════════════════════════════════
 * Six tools, following the naming and registration convention of
 * server-tcai-tools.ts / server-neuroplatform-tools.ts.
 *
 *   ovo_status          — bridge state, substrate descriptor, ethics gate
 *   ovo_read            — poll one affect frame, lifted to PAD with provenance
 *   ovo_cycle           — read + feed the TCAI cycle in one call
 *   ovo_set_policy      — configure the dominance policy and control loop
 *   ovo_arm_control     — arm/disarm closed-loop affective actuation
 *   ovo_isomorphism     — compare the three substrates on the PAD pipeline
 *
 * Every text payload passes through `lintClaim` before emission.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  OvomindBridge,
  OvomindSimAdapter,
  OvomindLiveAdapter,
  AffectiveController,
  type DominancePolicy,
} from './engine/ovomind.js';
import { SUBSTRATES, lintClaim } from './engine/tcai/phenomenal-guard.js';
import type { TCAIConsciousnessSystem } from './engine/tcai/acm-bridge.js';

const DOMINANCE_POLICIES = ['prior', 'endogenous', 'withhold'] as const;

/** Wrap a payload, refusing to emit any string the claim linter rejects. */
function emit(payload: unknown) {
  const text = JSON.stringify(payload, null, 2);
  const violations = lintClaim(text);
  if (violations.length > 0) {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          error: 'CLAIM_LINT_FAILED',
          patterns: violations,
          note: 'Output asserted something the architecture cannot support; emission blocked.',
        }, null, 2),
      }],
      isError: true,
    };
  }
  return { content: [{ type: 'text' as const, text }] };
}

export interface OvomindToolDeps {
  tcai: TCAIConsciousnessSystem;
  /** Set from env: OVOMIND_ENDPOINT / OVOMIND_API_KEY. Absent ⇒ sim mode. */
  liveEndpoint?: string;
  liveApiKey?: string;
}

export function registerOvomindTools(server: McpServer, deps: OvomindToolDeps): OvomindBridge {
  const controller = new AffectiveController();
  const adapter = deps.liveEndpoint && deps.liveApiKey
    ? new OvomindLiveAdapter({ endpoint: deps.liveEndpoint, apiKey: deps.liveApiKey })
    : new OvomindSimAdapter();
  let dominancePolicy: DominancePolicy = 'prior';
  const bridge = new OvomindBridge(adapter, controller, { dominancePolicy });

  server.tool(
    'ovo_status',
    'OVOMIND bridge status: adapter mode, substrate descriptor, frame counters, ' +
    'and the synthetic-phenomenology ethics assessment for the current configuration.',
    {},
    async () => emit(bridge.status()),
  );

  server.tool(
    'ovo_read',
    'Poll one OVOMIND affect frame and lift it into PAD. Every axis is returned ' +
    'with its epistemic tier, provenance and basis string. Dominance is never ' +
    'estimated from the human channel.',
    { controllability: z.number().min(0).max(1).optional() },
    async ({ controllability }) => {
      const frame = bridge.read(controllability);
      return emit(frame ?? { frame: null, note: 'Stream produced no frame.' });
    },
  );

  server.tool(
    'ovo_cycle',
    'Read one affect frame and run a TCAI cycle with the human channel entering ' +
    'as the `body` specialist. The human valence is NOT routed to rewardSignal.',
    {
      controllability: z.number().min(0).max(1).optional(),
      actuate: z.boolean().optional().describe('Also compute a control command (requires an armed controller).'),
    },
    async ({ controllability, actuate }) => {
      const frame = bridge.read(controllability);
      if (!frame) return emit({ error: 'NO_FRAME' });
      const fragment = bridge.toCycleFragment(frame);
      const result = deps.tcai.runCycle(fragment);
      return emit({
        frame,
        cycle: {
          ignition: result.competition.ignition,
          ignited: result.competition.ignited,
          winners: result.competition.winners,
          syncR: result.competition.syncR,
          phiRIIU: result.phiRIIU,
          emotionProxy: result.emotion,
          selfContinuity: result.selfContinuity,
        },
        control: actuate ? bridge.actuate(frame) : null,
        disclaimer:
          'emotionProxy is ASTRA\'s internal PAD proxy, computed analytically. ' +
          'frame is a measurement of a human subject. They are different quantities ' +
          'in the same units and must not be compared without a matched-stimulus protocol.',
      });
    },
  );

  server.tool(
    'ovo_set_policy',
    'Configure the Russell→PAD dominance policy and the closed-loop control policy.',
    {
      dominancePolicy: z.enum(DOMINANCE_POLICIES).optional(),
      controlEnabled: z.boolean().optional(),
      arousalSetpoint: z.number().min(0).max(1).optional(),
      maxStepPerCycle: z.number().min(0).max(0.25).optional(),
      protocolReference: z.string().nullable().optional()
        .describe('Consent / ethics protocol reference. Required to arm the control loop.'),
    },
    async (args) => {
      if (args.dominancePolicy) dominancePolicy = args.dominancePolicy;
      controller.setPolicy({
        ...(args.controlEnabled !== undefined ? { enabled: args.controlEnabled } : {}),
        ...(args.arousalSetpoint !== undefined ? { arousalSetpoint: args.arousalSetpoint } : {}),
        ...(args.maxStepPerCycle !== undefined ? { maxStepPerCycle: args.maxStepPerCycle } : {}),
        ...(args.protocolReference !== undefined ? { protocolReference: args.protocolReference } : {}),
      });
      return emit({
        dominancePolicy,
        controlPolicy: controller.getPolicy(),
        ethics: bridge.status().ethics,
      });
    },
  );

  server.tool(
    'ovo_arm_control',
    'Arm or disarm closed-loop affective actuation. Arming places a human subject ' +
    'inside the control loop and is refused without a protocol reference.',
    { arm: z.boolean() },
    async ({ arm }) => {
      if (!arm) { controller.disarm(); return emit({ armed: false, reason: 'Disarmed by request.' }); }
      const r = controller.arm();
      return emit({ ...r, ethics: bridge.status().ethics });
    },
  );

  server.tool(
    'ovo_isomorphism',
    'Side-by-side comparison of the three substrates feeding the same PAD pipeline ' +
    '(silicon SNN, organoid MEA, human wearable), with the axes each can constrain ' +
    'and the caveat that blocks a naive isomorphism claim.',
    {},
    async () => emit({
      substrates: Object.values(SUBSTRATES),
      readable:
        'Only the human channel constrains valence externally; only it and the SNN ' +
        'reach the arousal axis with comparable dynamics; no substrate constrains ' +
        'dominance from measurement. Any cross-substrate PAD comparison is therefore ' +
        'a comparison over two axes at most.',
      protocolNote:
        'A defensible isomorphism experiment requires matched stimuli, a pre-registered ' +
        'correlation target and an ablation arm. Correlating free-running trajectories ' +
        'will produce a coefficient with no interpretation.',
    }),
  );

  return bridge;
}
