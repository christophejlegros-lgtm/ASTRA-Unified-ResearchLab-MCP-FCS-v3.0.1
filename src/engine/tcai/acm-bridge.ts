/**
 * ASTRA × the_consciousness_ai — Consciousness System Orchestrator
 * ═════════════════════════════════════════════════════════════════
 * TypeScript port of the upstream ACM perception–emotion–memory–workspace
 * loop (models/core/consciousness_core.py orchestration, simplified to the
 * analytically computable path):
 *
 *   specialists → bids → AKOrN binding → GNW competition → ignition
 *        → broadcast → qualia → emotion appraisal → reward shaping
 *        → emotional memory (attention-gated) → self-model update
 *        → metrics (GNW · EI · Φ̃-RIIU) → composite report
 *
 * The system is fed from live ASTRA state (SNN layer firing rates, sensor
 * latents, world-model surprise), making the vendored ACM architecture an
 * operational layer of the ASTRA MCP server.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 * Upstream Python: © tlcdv/the_consciousness_ai (vendored in /python)
 */

import {
  type WorkspaceMessage, type CompetitionResult, type ConsciousnessReport,
  type EmotionalState, type SecondOrderState, PROXY_DISCLAIMER,
} from './types.js';
import { GlobalWorkspace, type GWConfig } from './global-workspace.js';
import { EmotionalMemoryCore } from './emotional-memory.js';
import { EmotionalProcessor, EmotionalRewardShaper, type RewardMetrics } from './emotion.js';
import { SelfRepresentationCore } from './self-model.js';
import { GNWMetrics, RIIUPhi, computeEffectiveInformation, discretizeContinuous } from './metrics.js';
import { SecondOrderLoop } from './second-order.js';
import { SNNEngine } from '../snn.js';

// Closed-loop SNN actuation constants (v2.9), calibrated on measured response.
const SNN_INJECT_AMP_MAX = 24;   // drive=1 ⇒ max sustained injection amplitude
const SNN_INJECT_COUNT = 24;     // neurons stimulated in the input layer
const SNN_INNER_STEPS = 6;       // sustained-injection inner steps per cycle

export interface CycleInput {
  /** Per-specialist signal vectors (e.g. SNN layer rates, sensor latents). */
  signals: Partial<Record<'vision' | 'audio' | 'memory' | 'body' | 'semantic', number[]>>;
  /** Optional explicit bids; otherwise derived from signal energy. */
  bids?: Partial<Record<'vision' | 'audio' | 'memory' | 'body' | 'semantic', number>>;
  rewardSignal?: number;        // task feedback ∈ [−1, 1]
  novelty?: number;             // e.g. world-model surprise (normalized)
  threat?: number;
  controllability?: number;
  predictionError?: number;     // raw WM surprise
  predictionConfidence?: number;
  narrative?: string;           // textual annotation for the memory record
  goalVector?: number[];
}

export interface CycleResult {
  competition: CompetitionResult;
  emotion: EmotionalState;
  reward: RewardMetrics;
  memoryStored: boolean;
  selfContinuity: number;
  phiRIIU: number;
  secondOrder: SecondOrderState;
}

export class TCAIConsciousnessSystem {
  readonly workspace: GlobalWorkspace;
  readonly memory: EmotionalMemoryCore;
  readonly emotionProcessor: EmotionalProcessor;
  readonly rewardShaper: EmotionalRewardShaper;
  readonly selfModel: SelfRepresentationCore;
  readonly gnwMetrics: GNWMetrics;
  readonly riiu: RIIUPhi;
  readonly secondOrder: SecondOrderLoop;
  /** Real LIF spiking substrate the closed-loop actuation drives (v2.9). */
  readonly substrateSnn = new SNNEngine();
  private frLo = Infinity;   // adaptive firing-rate range (handles SNN drift)
  private frHi = -Infinity;
  /** Optional shared PRODUCTION SNN the actuation also drives (v2.9). */
  private productionSnn: SNNEngine | null = null;
  /** v2.9: route the closed loop THROUGH the production SNN (read+write). Off by
   *  default so the cycle never contends with the server's own snn_step. */
  private productionLoop = false;

  /** Wire the closed-loop actuation onto the shared production SNN (server). */
  connectProductionSnn(snn: SNNEngine): void { this.productionSnn = snn; }
  /** Enable/disable closing the loop through the production SNN (read+write). */
  setProductionLoop(enabled: boolean): void { this.productionLoop = enabled; }
  isProductionLoop(): boolean { return this.productionLoop && this.productionSnn !== null; }
  private ignitionTrajectory: number[] = [];
  private cycles = 0;

  constructor(gwConfig?: Partial<GWConfig>) {
    this.workspace = new GlobalWorkspace(gwConfig);
    this.memory = new EmotionalMemoryCore();
    this.emotionProcessor = new EmotionalProcessor();
    this.rewardShaper = new EmotionalRewardShaper();
    this.selfModel = new SelfRepresentationCore();
    this.gnwMetrics = new GNWMetrics();
    this.riiu = new RIIUPhi();
    this.secondOrder = new SecondOrderLoop();
  }

  /** One full perception → workspace → emotion → memory → self cycle. */
  runCycle(input: CycleInput): CycleResult {
    this.cycles++;
    const now = Date.now();

    // 1 — Build specialist messages (bid = signal RMS unless explicit)
    const messages: WorkspaceMessage[] = [];
    for (const [source, vec] of Object.entries(input.signals)) {
      if (!vec || vec.length === 0) continue;
      const rms = Math.sqrt(vec.reduce((a, v) => a + v * v, 0) / vec.length);
      const bid = input.bids?.[source as keyof CycleInput['bids']] ?? Math.tanh(rms);
      messages.push({ source, content: vec, priority: Math.max(0, Math.min(1, bid)), timestamp: now });
    }

    // 2 — Affective modulation feeds forward into the competition
    this.workspace.affectiveState = this.emotionProcessor.getState();
    const competition = this.workspace.runCompetition(messages, input.goalVector);

    // 3 — Emotion appraisal (novelty defaults to WM surprise if provided)
    const novelty = input.novelty ?? (input.predictionError !== undefined
      ? Math.tanh(input.predictionError) : 0);
    const emotion = this.emotionProcessor.appraise({
      rewardSignal: input.rewardSignal,
      novelty,
      threat: input.threat,
      controllability: input.controllability,
    });

    // 4 — Reward shaping with memory influence
    const reward = this.rewardShaper.computeReward({
      baseReward: input.rewardSignal ?? 0,
      emotion,
      stability: this.emotionProcessor.stability(),
      memory: this.memory,
      contextEmbedding: competition.broadcast,
    });

    // 5 — Attention-gated emotional memory storage (gate = ignition)
    const stored = this.memory.store({
      narrative: input.narrative ?? `cycle ${this.cycles} · focus ${competition.winners[0] ?? 'idle'}`,
      embedding: competition.broadcast,
      emotionalContext: emotion,
      attentionLevel: competition.ignition,
      timestamp: now,
    });

    // 6 — Self-model update
    const self = this.selfModel.update({
      emotionalState: emotion,
      effort: competition.ignition * 0.6 + 0.2,
      predictionError: input.predictionError,
      predictionConfidence: input.predictionConfidence,
      reward: reward.totalReward,
      attentionTarget: competition.winners[0] ?? 'idle',
      attentionIntensity: competition.ignition,
    });

    // 7 — Metrics accumulation
    this.gnwMetrics.update(competition.ignition, competition.ignited);
    if (competition.ignited && stored.stored) this.gnwMetrics.logReuse();
    this.riiu.push(competition.broadcast);
    this.ignitionTrajectory.push(competition.ignition);
    if (this.ignitionTrajectory.length > 512) this.ignitionTrajectory.shift();

    // 8 — Second-order (self-evidencing) loop. CLOSED ON A REAL LIF SNN (v2.9):
    //     the previous cycle's AIF actuation injects sustained current into the
    //     spiking substrate; its firing rate (which responds monotonically to
    //     injection: ~59→102 Hz) becomes the grounded observation. So the AIF
    //     action causally shapes its own next observation through real spike
    //     dynamics — the contingency the v2.9 flat toy lacked.
    const prevAct = this.secondOrder.getActuation();
    const drive = prevAct?.drive ?? 0.5;
    const actuationOn = this.secondOrder.isActuationEnabled();
    const amp = actuationOn ? drive * SNN_INJECT_AMP_MAX : SNN_INJECT_AMP_MAX * 0.5;
    // v2.9: when the production loop is enabled, the closed loop runs THROUGH the
    // shared production SNN (inject = write AND firing rate = read), genuinely
    // closing the loop on the deployed network. Otherwise it uses the private
    // substrate SNN and never touches the production network (no contention with
    // the server's snn_step — the v2.9 write-only injection is removed).
    const loopSnn = (this.productionLoop && this.productionSnn) ? this.productionSnn : this.substrateSnn;
    for (let k = 0; k < SNN_INNER_STEPS; k++) {
      loopSnn.injectSpikes('input', SNN_INJECT_COUNT, amp);
      loopSnn.step();
    }
    const fr = loopSnn.stats().firingRateStats.mean;
    // Adaptive normalisation: track the running operating range of the firing
    // rate so the grounded observation stays meaningful despite SNN drift /
    // non-stationarity (a fixed Hz window collapses as rates drift). (v2.9)
    this.frLo = Math.min(this.frLo, fr);
    this.frHi = Math.max(this.frHi, fr);
    const span = Math.max(8, this.frHi - this.frLo);
    const snnFeature = Math.max(0, Math.min(1, (fr - this.frLo) / span));

    const compositeNow = Math.max(0, Math.min(1,
      0.35 * this.gnwMetrics.report().meanIgnition + 0.25 * this.riiu.computeValue() +
      0.2 * this.workspace.getUnityMetrics().unity + 0.2 * competition.ignition));
    // Substrate feature dominated by the real SNN firing rate (actuation-driven),
    // blended with the GNW coherence proxies.
    const substrateScore = Math.max(0, Math.min(1,
      0.7 * snnFeature +
      0.3 * (0.4 * competition.ignition + 0.3 * competition.syncR + 0.3 * competition.phiProxy)));
    const secondOrder = this.secondOrder.step({
      rpe: reward.totalReward,
      predictionError: input.predictionError,
      broadcast: competition.broadcast,
      focusWinner: competition.winners[0] ?? 'idle',
      realizedValence: emotion.valence,
      confidenceCalibration: self.confidenceCalibration,
      temporalContinuity: self.temporalContinuity,
      compositeProxy: compositeNow,
      substrateScore,
      taskFeedback: input.rewardSignal ?? 0,
    });

    return {
      competition,
      emotion,
      reward,
      memoryStored: stored.stored,
      selfContinuity: self.temporalContinuity,
      phiRIIU: this.riiu.computeValue(),
      secondOrder,
    };
  }

  /** Composite consciousness proxy report (consciousness_metrics.py spirit). */
  report(): ConsciousnessReport {
    const gnw = this.gnwMetrics.report();
    const phi = this.riiu.computeValue();
    const ei = computeEffectiveInformation(discretizeContinuous(this.ignitionTrajectory, 8), 8);
    const eiNorm = Math.min(1, ei / 3); // log2(8) = 3 bits max
    const unity = this.workspace.getUnityMetrics();
    const composite = Math.max(0, Math.min(1,
      0.35 * gnw.meanIgnition + 0.25 * phi + 0.2 * eiNorm + 0.2 * unity.unity));
    return {
      gnw,
      phiRIIUProxy: phi,
      effectiveInformation: ei,
      workspace: {
        ignition: this.workspace.state.broadcastStrength,
        syncR: this.workspace.state.syncR,
        focus: this.workspace.state.focusTopic,
      },
      composite,
      disclaimer: PROXY_DISCLAIMER,
    };
  }

  getCycles(): number { return this.cycles; }

  reset(): void {
    this.workspace.reset();
    this.memory.clear();
    this.emotionProcessor.reset();
    this.gnwMetrics.reset();
    this.riiu.reset();
    this.secondOrder.reset();
    this.substrateSnn.reset();
    this.frLo = Infinity; this.frHi = -Infinity;
    this.ignitionTrajectory = [];
    this.cycles = 0;
  }
}

/** Singleton instance shared by the MCP server (mirrors acmModule pattern). */
export const tcaiSystem = new TCAIConsciousnessSystem();
