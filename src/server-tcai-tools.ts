/**
 * ASTRA — the_consciousness_ai (TCAI/ACM) MCP Tools
 * ══════════════════════════════════════════════════
 * Registers 17 tools + 2 resources + 2 prompts into the ASTRA MCP server,
 * exposing the TypeScript port of tlcdv/the_consciousness_ai:
 *
 *   tcai_cycle             — full GNW cycle fed from live SNN layer rates
 *   tcai_workspace_state   — workspace state + unity metrics
 *   tcai_emotion_appraise  — PAD appraisal of raw signals
 *   tcai_memory_store      — attention-gated emotional memory storage
 *   tcai_memory_retrieve   — blended similarity/congruence/salience recall
 *   tcai_self_model        — self-representation + attention schema state
 *   tcai_metrics           — GNW · EI · Φ̃-RIIU composite report
 *   tcai_reset             — reset the consciousness system
 *
 *   ── Second-order (self-evidencing) loop — NEW in v2.9 ──
 *   tcai_second_order      — full second-order loop snapshot
 *   tcai_meta_learning     — learning velocity from RPE variance
 *   tcai_capability_model  — action → expected-valence capability map
 *   tcai_curiosity         — RND intrinsic reward (epistemic value proxy)
 *   tcai_metaconsciousness — meta-representation composite score
 *   tcai_development        — longitudinal developmental-stage tracking
 *   tcai_convergence       — satisfaction / halting criterion (free-energy + task quality)
 *   tcai_active_inference  — real variational/expected free energy + model learning
 *   tcai_calibrate         — calibrate halting threshold on measured ΔF scale
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 * Upstream Python: © tlcdv/the_consciousness_ai (vendored in /python)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { tcaiSystem, type CycleInput } from './engine/tcai/acm-bridge.js';
import { PROXY_DISCLAIMER } from './engine/tcai/types.js';

const MODULES = ['vision', 'audio', 'memory', 'body', 'semantic'] as const;

const emotionSchema = {
  valence: z.number().min(-1).max(1).optional().describe('Pleasure ∈ [−1,1]'),
  arousal: z.number().min(0).max(1).optional().describe('Arousal ∈ [0,1]'),
  dominance: z.number().min(0).max(1).optional().describe('Dominance ∈ [0,1]'),
};

/** Derive per-specialist signal vectors from live ASTRA SNN layer metrics. */
function deriveSignals(getState: () => any, dim: number): CycleInput['signals'] {
  const st = getState();
  const layerMetrics: Array<{ firingRate: number }> = st?.snn?.layerMetrics ?? [];
  const tick: number = st?.snn?.timestep ?? 0;
  const signals: CycleInput['signals'] = {};
  MODULES.forEach((name, i) => {
    const rate = (layerMetrics[i % Math.max(1, layerMetrics.length)]?.firingRate ?? 20) / 100;
    const vec = new Array<number>(dim);
    for (let j = 0; j < dim; j++) {
      vec[j] = rate * Math.sin(0.13 * (j + 1) * (i + 1) + 0.01 * tick) +
               0.1 * rate * Math.cos(0.07 * j + i);
    }
    signals[name] = vec;
  });
  return signals;
}

const json = (o: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(o, null, 2) }] });

export function registerTCAICapabilities(server: McpServer, getState: () => any): void {

  // ── Tool 1: full consciousness cycle ─────────────────────────────
  server.tool('tcai_cycle',
    'Run one or more ACM cycles (the_consciousness_ai port): SNN signals → AKOrN binding → GNW ignition → qualia → emotion → reward shaping → emotional memory → self-model → second-order loop. Set stopWhenSatisfied to halt early once the recursive loop reaches a sustained satisfactory (converged, low-curiosity, stable) regime.',
    {
      cycles: z.number().int().min(1).max(50).optional().describe('Number of cycles (default 1; upper bound if stopWhenSatisfied)'),
      rewardSignal: z.number().min(-1).max(1).optional().describe('Task feedback ∈ [−1,1]'),
      novelty: z.number().min(0).max(1).optional().describe('Surprise/curiosity ∈ [0,1]'),
      threat: z.number().min(0).max(1).optional(),
      controllability: z.number().min(0).max(1).optional(),
      predictionError: z.number().min(0).optional().describe('World-model surprise (raw)'),
      predictionConfidence: z.number().min(0).max(1).optional(),
      narrative: z.string().max(500).optional().describe('Annotation for the memory record'),
      stopWhenSatisfied: z.boolean().optional().describe('Halt early when the second-order loop reports sustained satisfaction'),
      epsFreeEnergy: z.number().min(0).max(5).optional().describe('Halt threshold: absolute |ΔF| ≤ (nats, default 0.02)'),
      relFreeEnergy: z.number().min(0).max(1).optional().describe('Halt threshold: |ΔF| ≤ rel·F, scale-free (default 0.03)'),
      minTaskQuality: z.number().min(0).max(1).optional().describe('Halt threshold: realized task quality ≥ (default 0.6)'),
      maxEpistemic: z.number().min(0).max(5).optional().describe('Halt threshold: expected info gain ≤ (default 0.1)'),
      satisfactionPatience: z.number().int().min(1).max(20).optional().describe('Consecutive satisfied cycles required to halt (default 3)'),
      closedLoop: z.boolean().optional().describe('Enable closed-loop actuation (AIF action drives the substrate); default on'),
      setpoint: z.number().min(0).max(1).optional().describe('Continuous controller substrate setpoint to regulate toward (v2.9, default 0.3)'),
      productionLoop: z.boolean().optional().describe('Close the loop through the shared production SNN (read+write); default off (v2.9)'),
    },
    async (args) => {
      if (args.closedLoop !== undefined) tcaiSystem.secondOrder.setActuation(args.closedLoop);
      if (args.setpoint !== undefined) tcaiSystem.secondOrder.actuationController.configure({ setpoint: args.setpoint });
      if (args.productionLoop !== undefined) tcaiSystem.setProductionLoop(args.productionLoop);
      // Optionally reconfigure the halting criterion for this run.
      const overrides: Record<string, number> = {};
      if (args.epsFreeEnergy !== undefined) overrides.epsFreeEnergy = args.epsFreeEnergy;
      if (args.relFreeEnergy !== undefined) overrides.relFreeEnergy = args.relFreeEnergy;
      if (args.minTaskQuality !== undefined) overrides.minTaskQuality = args.minTaskQuality;
      if (args.maxEpistemic !== undefined) overrides.maxEpistemic = args.maxEpistemic;
      if (args.satisfactionPatience !== undefined) overrides.patience = args.satisfactionPatience;
      if (Object.keys(overrides).length > 0) tcaiSystem.secondOrder.convergence.configure(overrides);

      const n = args.cycles ?? 1;
      let last = null as ReturnType<typeof tcaiSystem.runCycle> | null;
      let stoppedEarly = false;
      let stoppedAtCycle: number | null = null;
      for (let i = 0; i < n; i++) {
        last = tcaiSystem.runCycle({
          signals: deriveSignals(getState, tcaiSystem.workspace.config.workspaceDim),
          rewardSignal: args.rewardSignal,
          novelty: args.novelty,
          threat: args.threat,
          controllability: args.controllability,
          predictionError: args.predictionError,
          predictionConfidence: args.predictionConfidence,
          narrative: args.narrative,
        });
        if (args.stopWhenSatisfied && last.secondOrder.convergence.satisfied) {
          stoppedEarly = true;
          stoppedAtCycle = i + 1;
          break;
        }
      }
      return json({
        cyclesRun: stoppedAtCycle ?? n, requestedCycles: n,
        stoppedEarly, stoppedAtCycle, totalCycles: tcaiSystem.getCycles(),
        ignition: last?.competition.ignition, ignited: last?.competition.ignited,
        winners: last?.competition.winners, syncR: last?.competition.syncR,
        qualia: last?.competition.qualia, phiProxy: last?.competition.phiProxy,
        emotion: last?.emotion, reward: last?.reward,
        memoryStored: last?.memoryStored, selfContinuity: last?.selfContinuity,
        phiRIIU: last?.phiRIIU,
        secondOrder: last?.secondOrder ? {
          learningVelocity: last.secondOrder.metaLearning.learningVelocity,
          noveltySpike: last.secondOrder.metaLearning.noveltySpike,
          intrinsicReward: last.secondOrder.curiosity.intrinsicReward,
          metaconsciousness: last.secondOrder.metacognition.overall,
          developmentStage: last.secondOrder.development.stage,
          freeEnergy: last.secondOrder.activeInference.freeEnergy,
          deltaFreeEnergy: last.secondOrder.activeInference.deltaFreeEnergy,
          pragmatic: last.secondOrder.activeInference.pragmatic,
          taskQuality: last.secondOrder.activeInference.taskQuality,
          substrateObs: last.secondOrder.activeInference.substrateObs,
          substrateDrive: last.secondOrder.activeInference.substrateDrive,
          actuation: last.secondOrder.actuation,
          convergence: last.secondOrder.convergence,
        } : undefined,
        disclaimer: PROXY_DISCLAIMER,
      });
    });

  // ── Tool 2: workspace state ──────────────────────────────────────
  server.tool('tcai_workspace_state',
    'Global Neuronal Workspace state: ignition, focus, qualia, sync R, unity metrics, access history',
    {},
    async () => json({
      state: { ...tcaiSystem.workspace.state, broadcastPayload: undefined,
        activeContent: Object.keys(tcaiSystem.workspace.state.activeContent) },
      unity: tcaiSystem.workspace.getUnityMetrics(),
      config: tcaiSystem.workspace.config,
    }));

  // ── Tool 3: emotion appraisal ────────────────────────────────────
  server.tool('tcai_emotion_appraise',
    'Appraise raw signals into PAD emotional space (Mehrabian) with inertia',
    {
      rewardSignal: z.number().min(-1).max(1).optional(),
      novelty: z.number().min(0).max(1).optional(),
      threat: z.number().min(0).max(1).optional(),
      controllability: z.number().min(0).max(1).optional(),
    },
    async (args) => {
      const emotion = tcaiSystem.emotionProcessor.appraise(args);
      return json({ emotion, stability: tcaiSystem.emotionProcessor.stability() });
    });

  // ── Tool 4: memory store ─────────────────────────────────────────
  server.tool('tcai_memory_store',
    'Store an experience in emotional memory (attention-gated, salience-indexed)',
    {
      narrative: z.string().max(1000).describe('Description of the experience'),
      embedding: z.array(z.number()).min(2).max(256).optional().describe('Feature vector (defaults to current broadcast)'),
      attentionLevel: z.number().min(0).max(1).optional(),
      ...emotionSchema,
    },
    async (args) => {
      const embedding = args.embedding ??
        tcaiSystem.workspace.state.broadcastPayload ??
        new Array(tcaiSystem.workspace.config.workspaceDim).fill(0);
      const res = tcaiSystem.memory.store({
        narrative: args.narrative,
        embedding,
        emotionalContext: { valence: args.valence, arousal: args.arousal, dominance: args.dominance },
        attentionLevel: args.attentionLevel,
      });
      return json({ ...res, stats: tcaiSystem.memory.stats() });
    });

  // ── Tool 5: memory retrieve ──────────────────────────────────────
  server.tool('tcai_memory_retrieve',
    'Retrieve memories by blended cosine similarity, PAD congruence and salience',
    {
      topK: z.number().int().min(1).max(25).optional(),
      embedding: z.array(z.number()).min(2).max(256).optional().describe('Query vector (defaults to current broadcast)'),
      ...emotionSchema,
    },
    async (args) => {
      const hits = tcaiSystem.memory.retrieve({
        embedding: args.embedding ?? tcaiSystem.workspace.state.broadcastPayload ?? undefined,
        emotion: (args.valence !== undefined || args.arousal !== undefined || args.dominance !== undefined)
          ? { valence: args.valence, arousal: args.arousal, dominance: args.dominance } : undefined,
        topK: args.topK,
      });
      return json({
        hits: hits.map((h) => ({
          id: h.record.id, narrative: h.record.narrative,
          emotion: h.record.emotionalContext, salience: h.record.salience,
          similarity: h.similarity, congruence: h.emotionalCongruence, score: h.score,
        })),
        stats: tcaiSystem.memory.stats(),
      });
    });

  // ── Tool 6: self model ───────────────────────────────────────────
  server.tool('tcai_self_model',
    'Self-representation state: interoception, epistemic model, temporal continuity, attention schema',
    {},
    async () => json({
      self: tcaiSystem.selfModel.getCurrentState(),
      attention: tcaiSystem.selfModel.attentionSchema.getCurrentFocus(),
    }));

  // ── Tool 7: metrics report ───────────────────────────────────────
  server.tool('tcai_metrics',
    'Consciousness proxy report: GNW metrics, Effective Information, Φ̃-RIIU, composite score',
    {},
    async () => json(tcaiSystem.report()));

  // ── Tool 8: reset ────────────────────────────────────────────────
  server.tool('tcai_reset',
    'Reset the TCAI consciousness system (workspace, memory, emotion, metrics)',
    {},
    async () => {
      tcaiSystem.reset();
      return json({ reset: true, cycles: tcaiSystem.getCycles() });
    });

  // ════════════════════════════════════════════════════════════════
  //  SECOND-ORDER (SELF-EVIDENCING) LOOP — NEW IN v2.9
  // ════════════════════════════════════════════════════════════════

  // ── Tool 9: full second-order snapshot ───────────────────────────
  server.tool('tcai_second_order',
    'Second-order (self-evidencing) loop snapshot: meta-learning velocity, RND curiosity (epistemic value), capability model, meta-consciousness score, developmental stage. The system observing and correcting its own predictive capacity (Legros 2026 §3.2).',
    {},
    async () => {
      const st = tcaiSystem.secondOrder.getState();
      if (!st) return json({ available: false, hint: 'Run tcai_cycle first to populate the second-order loop.', disclaimer: PROXY_DISCLAIMER });
      return json({ available: true, ...st });
    });

  // ── Tool 10: meta-learning ───────────────────────────────────────
  server.tool('tcai_meta_learning',
    'Meta-learning state (MetaLearningModule port): learning velocity from RPE-variance dynamics. velocity>0 ⇒ converging; noveltySpike ⇒ novel/confusing regime. Optionally inject an RPE sample.',
    {
      rpe: z.number().min(-1).max(1).optional().describe('Inject a reward-prediction-error sample ∈ [−1,1]'),
    },
    async (args) => {
      if (args.rpe !== undefined) {
        const meta = tcaiSystem.secondOrder.metaLearning.update(args.rpe);
        return json({ injected: args.rpe, ...meta, disclaimer: PROXY_DISCLAIMER });
      }
      const st = tcaiSystem.secondOrder.getState();
      return json({ ...(st?.metaLearning ?? { learningVelocity: 0, noveltySpike: false, samples: 0 }), disclaimer: PROXY_DISCLAIMER });
    });

  // ── Tool 11: capability model ────────────────────────────────────
  server.tool('tcai_capability_model',
    'Agency capability model (DirectExperienceLearner port): action → expected-valence map (EMA). Query expected outcome of an action, or list the learned capability table.',
    {
      action: z.string().max(64).optional().describe('Action label to query expected valence for'),
    },
    async (args) => {
      if (args.action) {
        return json({ action: args.action, expectedValence: tcaiSystem.secondOrder.capability.expect(args.action) });
      }
      return json({ capabilities: tcaiSystem.secondOrder.capability.snapshot(), disclaimer: PROXY_DISCLAIMER });
    });

  // ── Tool 12: curiosity ───────────────────────────────────────────
  server.tool('tcai_curiosity',
    'Intrinsic-reward / curiosity (RNDCuriosity port): prediction error between a frozen random target and an online predictor on a representation vector. High error = novelty = exploration drive (EFE epistemic value proxy, Legros 2026 §4.1). Defaults to the current GNW broadcast.',
    {
      embedding: z.array(z.number()).min(2).max(256).optional().describe('Representation vector (defaults to current broadcast)'),
    },
    async (args) => {
      const vec = args.embedding ?? tcaiSystem.workspace.state.broadcastPayload ??
        new Array(tcaiSystem.workspace.config.workspaceDim).fill(0);
      const c = tcaiSystem.secondOrder.curiosity.observe(vec);
      return json({ ...c, disclaimer: PROXY_DISCLAIMER });
    });

  // ── Tool 13: meta-consciousness ──────────────────────────────────
  server.tool('tcai_metaconsciousness',
    'Meta-consciousness composite (MetaconsciousnessEvaluator port): weighted score over confidence calibration, learning awareness, self-continuity and error monitoring. PROXY of meta-representation capacity, not a measurement.',
    {},
    async () => {
      const st = tcaiSystem.secondOrder.getState();
      if (!st) return json({ available: false, hint: 'Run tcai_cycle first.', disclaimer: PROXY_DISCLAIMER });
      return json({ available: true, ...st.metacognition });
    });

  // ── Tool 14: development tracking ────────────────────────────────
  server.tool('tcai_development',
    'Longitudinal developmental tracking (DevelopmentTracker port): coarse stage (nascent→reactive→integrative→reflective) from the running composite-proxy level, stability and meta-representation score. Second-order self-monitoring over time.',
    {},
    async () => {
      const st = tcaiSystem.secondOrder.getState();
      if (!st) return json({ available: false, hint: 'Run tcai_cycle first.', disclaimer: PROXY_DISCLAIMER });
      return json({ available: true, ...st.development, disclaimer: PROXY_DISCLAIMER });
    });

  // ── Tool 15: convergence / satisfaction criterion ────────────────
  server.tool('tcai_convergence',
    'Inspect or configure the recursive double-loop halting criterion (v2.9). With no arguments, returns the current satisfaction state and active thresholds. With arguments, updates them. The loop halts only when variational free energy has settled (|ΔF| ≤ epsFreeEnergy) AND realized task quality is high (≥ minTaskQuality) AND epistemic value is low, sustained over `patience` cycles — stationarity alone is insufficient (Legros 2026 §2.2/§4.3).',
    {
      epsFreeEnergy: z.number().min(0).max(5).optional().describe('Halt threshold: absolute |ΔF| ≤ (nats, default 0.02)'),
      relFreeEnergy: z.number().min(0).max(1).optional().describe('Halt threshold: |ΔF| ≤ rel·F, scale-free (default 0.03)'),
      minTaskQuality: z.number().min(0).max(1).optional().describe('Halt threshold: realized task quality ≥ (default 0.6)'),
      maxEpistemic: z.number().min(0).max(5).optional().describe('Halt threshold: expected info gain ≤ (default 0.1)'),
      patience: z.number().int().min(1).max(20).optional().describe('Consecutive satisfied cycles required to halt (default 3)'),
    },
    async (args) => {
      const overrides: Record<string, number> = {};
      if (args.epsFreeEnergy !== undefined) overrides.epsFreeEnergy = args.epsFreeEnergy;
      if (args.relFreeEnergy !== undefined) overrides.relFreeEnergy = args.relFreeEnergy;
      if (args.minTaskQuality !== undefined) overrides.minTaskQuality = args.minTaskQuality;
      if (args.maxEpistemic !== undefined) overrides.maxEpistemic = args.maxEpistemic;
      if (args.patience !== undefined) overrides.patience = args.patience;
      const configured = Object.keys(overrides).length > 0;
      const criterion = configured
        ? tcaiSystem.secondOrder.convergence.configure(overrides)
        : tcaiSystem.secondOrder.convergence.getConfig();
      const st = tcaiSystem.secondOrder.getState();
      return json({
        configured,
        criterion,
        satisfied: tcaiSystem.secondOrder.isSatisfied(),
        state: st?.convergence ?? null,
        disclaimer: PROXY_DISCLAIMER,
      });
    });

  // ── Tool 16: active-inference core (real F and EFE) ──────────────
  server.tool('tcai_active_inference',
    'Active-inference core telemetry (v2.9): the REAL variational free energy F (surprise), expected free energy G(π) decomposed into pragmatic + epistemic value, the realized task quality, the model entropy, and the Dirichlet-learned action. This is the principled quantity the halting criterion thresholds on — not a heuristic correlate (Da Costa et al. 2020; Legros 2026 §4.3).',
    {},
    async () => {
      const st = tcaiSystem.secondOrder.getState();
      if (!st) return json({ available: false, hint: 'Run tcai_cycle first.', disclaimer: PROXY_DISCLAIMER });
      return json({ available: true, ...st.activeInference, disclaimer: PROXY_DISCLAIMER });
    });

  // ── Tool 17: threshold calibration on measured ΔF scale (v2.9) ───
  server.tool('tcai_calibrate',
    'Calibrate the halting threshold on the measured ΔF scale instead of a guessed constant. Runs `cycles` warm-up cycles at the given reward, records the free-energy increments |ΔF|, and sets epsFreeEnergy to `factor`× their median. Returns the measured ΔF scale and the applied threshold. Addresses the v2.9 critique that the default 0.02 nats was uncalibrated.',
    {
      cycles: z.number().int().min(5).max(200).optional().describe('Warm-up cycles to measure ΔF (default 25)'),
      reward: z.number().min(-1).max(1).optional().describe('Reward signal during warm-up (default 0.8)'),
      factor: z.number().min(0.05).max(2).optional().describe('epsFreeEnergy = factor × median|ΔF| (default 0.5)'),
    },
    async (args) => {
      const cycles = args.cycles ?? 25;
      const reward = args.reward ?? 0.8;
      for (let i = 0; i < cycles; i++) {
        tcaiSystem.runCycle({
          signals: deriveSignals(getState, tcaiSystem.workspace.config.workspaceDim),
          rewardSignal: reward,
        });
      }
      const result = tcaiSystem.secondOrder.convergence.calibrate(args.factor ?? 0.5);
      return json({
        ...result,
        criterion: tcaiSystem.secondOrder.convergence.getConfig(),
        note: 'epsFreeEnergy set from measured ΔF; relFreeEnergy (scale-free) also applies.',
        disclaimer: PROXY_DISCLAIMER,
      });
    });

  // ── Resource ─────────────────────────────────────────────────────
  server.resource('tcai-state', 'astra://tcai/state',
    { description: 'the_consciousness_ai integrated system state', mimeType: 'application/json' },
    async () => ({ contents: [{ uri: 'astra://tcai/state', mimeType: 'application/json',
      text: JSON.stringify({
        report: tcaiSystem.report(),
        workspace: tcaiSystem.workspace.getUnityMetrics(),
        memory: tcaiSystem.memory.stats(),
        self: tcaiSystem.selfModel.getCurrentState(),
      }, null, 2) }] }));

  // ── Prompt ───────────────────────────────────────────────────────
  server.prompt('tcai-consciousness-cycle', 'Guided ACM consciousness cycle experiment', {},
    async () => ({
      messages: [{ role: 'user' as const, content: { type: 'text' as const,
        text: 'TCAI experiment: tcai_reset → snn_step 10 → tcai_cycle 10 (novelty 0.7) → tcai_workspace_state → tcai_emotion_appraise (rewardSignal 0.8) → tcai_cycle 10 (rewardSignal 0.8) → tcai_memory_retrieve → tcai_self_model → tcai_metrics. Compare ignition dynamics, emotional trajectory and Φ̃-RIIU before/after reward; flag proxy-metric caveats.' } }],
    }));

  // ── Resource: second-order loop state (v2.9) ─────────────────────
  server.resource('tcai-second-order', 'astra://tcai/second-order',
    { description: 'Second-order (self-evidencing) loop state: meta-learning, curiosity, capability, meta-consciousness, development', mimeType: 'application/json' },
    async () => ({ contents: [{ uri: 'astra://tcai/second-order', mimeType: 'application/json',
      text: JSON.stringify(tcaiSystem.secondOrder.getState() ?? { available: false }, null, 2) }] }));

  // ── Prompt: second-order loop experiment (v2.9) ──────────────────
  server.prompt('tcai-second-order-loop', 'Probe the second-order self-evidencing loop', {},
    async () => ({
      messages: [{ role: 'user' as const, content: { type: 'text' as const,
        text: 'Second-order loop probe: tcai_reset → tcai_cycle 15 (novelty 0.8) → tcai_meta_learning → tcai_curiosity → tcai_cycle 15 (rewardSignal 0.7, novelty 0.1) → tcai_meta_learning → tcai_metaconsciousness → tcai_capability_model → tcai_development. Show how learning velocity rises and curiosity/intrinsic reward falls as the regime becomes familiar; relate to EFE epistemic vs pragmatic value (Legros 2026 §4.3) and flag proxy caveats.' } }],
    }));
}
