/**
 * ASTRA × the_consciousness_ai — Second-Order (Self-Evidencing) Loop
 * ══════════════════════════════════════════════════════════════════
 * NEW IN v2.9 — primary contribution.
 *
 * The v2.2 cycle already produces the *signal* of the second-order loop
 * (world-model surprise ‖ẑₜ₊₁ − zₜ₊₁‖) but not its *update organ*: the layer
 * that observes the system's own predictive capacity and corrects it
 * (self-referential closure, von Foerster; self-evidencing, Friston).
 *
 * This module is a native TypeScript port of the second-order fragments of
 * tlcdv/the_consciousness_ai (verified against the upstream `main` branch):
 *
 *   models/self_model/self_representation_core.py
 *       → MetaLearningModule       (learning velocity from RPE variance)
 *       → DirectExperienceLearner  (action → valence capability model)
 *   models/core/rnd_curiosity.py
 *       → RNDCuriosity             (intrinsic reward = predictor/target error)
 *   models/evaluation/metaconsciousness_evaluation.py
 *       → MetaconsciousnessEvaluator
 *   models/evaluation/development_tracking.py
 *       → DevelopmentTracker       (longitudinal staged self-monitoring)
 *
 * Formal grounding (Legros 2026, §2.2 / §3.2 / §4.3): the EFE exploration /
 * parameter-information-gain term G(π) is here approximated by the RND
 * intrinsic reward; the model-update step is the RPE-variance-driven
 * learning-velocity estimate. A Friston-exact counterpart (pymdp Dirichlet
 * A/B updates) is provided as an optional Python bridge — see
 * python/second_order/active_inference_loop.py and SECOND-ORDER-LOOP-INTEGRATION.md.
 *
 * ⚠ All outputs are computational PROXIES of regularity-of-learning and
 * meta-representation, NOT measurements of meta-consciousness.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 * Upstream Python: © tlcdv/the_consciousness_ai (vendored in /python)
 */

import {
  type MetaLearningState,
  type CapabilityEntry,
  type CuriosityState,
  type MetaconsciousnessReport,
  type DevelopmentState,
  type ConvergenceConfig,
  type ConvergenceState,
  type ActiveInferenceState,
  type SubstrateActuation,
  type SecondOrderState,
  PROXY_DISCLAIMER,
} from './types.js';
import { ActiveInferenceCore } from './active-inference.js';

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const variance = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, v) => a + (v - m) * (v - m), 0) / xs.length;
};

// ── Meta-Learning (MetaLearningModule) ─────────────────────────────
//
// Tracks learning velocity. If RPE variance is dropping, the agent is
// successfully learning; if it spikes, the agent is in a novel situation.
// Direct port of MetaLearningModule.__call__ (self_representation_core.py).

export class MetaLearningModule {
  private rpeHistory: number[] = [];
  private learningVelocity = 0;

  constructor(private readonly windowSize = 50) {}

  update(rpe: number): MetaLearningState {
    this.rpeHistory.push(rpe);
    if (this.rpeHistory.length > this.windowSize) this.rpeHistory.shift();

    if (this.rpeHistory.length < 10) {
      return {
        learningVelocity: 0,
        rpeVarianceRatio: 1,
        noveltySpike: false,
        samples: this.rpeHistory.length,
      };
    }

    const recent = this.rpeHistory.slice(-10);
    const recentVar = variance(recent);
    const overallVar = variance(this.rpeHistory);
    const varianceRatio = recentVar / (overallVar + 1e-8);

    // recent variance ≪ overall ⇒ converging (learning);
    // recent variance ≫ overall ⇒ novel / confusing.
    const noveltySpike = varianceRatio > 2.0;
    this.learningVelocity = clamp(1 - varianceRatio, -1, 1);

    return {
      learningVelocity: this.learningVelocity,
      rpeVarianceRatio: varianceRatio,
      noveltySpike,
      samples: this.rpeHistory.length,
    };
  }

  getVelocity(): number { return this.learningVelocity; }
  reset(): void { this.rpeHistory = []; this.learningVelocity = 0; }
}

// ── Capability Model (DirectExperienceLearner) ─────────────────────
//
// Learns "what I can do": maps recent actions to emotional outcomes,
// building a capability model of the agent's agency. EMA update of the
// expected valence shift per discrete action bucket.

export class CapabilityModel {
  private readonly model = new Map<string, number>();

  constructor(private readonly lr = 0.1) {}

  /** action: the cycle's focus winner / motor sector; outcome: realized valence. */
  update(action: string | undefined, realizedValence: number): { actionType: string; expectedValenceShift: number } {
    const actionType = action && action.length ? action : 'idle';
    const prev = this.model.get(actionType) ?? 0;
    const next = prev + this.lr * (realizedValence - prev);
    this.model.set(actionType, next);
    return { actionType, expectedValenceShift: next };
  }

  /** Predicted valence outcome for an action (before acting). */
  expect(action: string): number { return this.model.get(action) ?? 0; }

  snapshot(): CapabilityEntry[] {
    return [...this.model.entries()]
      .map(([action, expectedValence]) => ({ action, expectedValence }))
      .sort((a, b) => b.expectedValence - a.expectedValence);
  }

  reset(): void { this.model.clear(); }
}

// ── Curiosity (RNDCuriosity, two-layer port) ───────────────────────
//
// Intrinsic reward via Random Network Distillation: a frozen random TWO-LAYER
// network (target) vs an online-learned two-layer predictor. The v2.9 single
// linear+tanh layer collapsed almost immediately for any low-dim input,
// making novelty trivial; a hidden nonlinear layer gives the target enough
// complexity that prediction error tracks genuine familiarity rather than
// degenerating in a few steps. Note (v2.9): curiosity is now TELEMETRY only —
// it no longer gates the halting criterion (which thresholds real free energy
// + task quality). It remains a useful exploration-pressure readout.

export class RNDCuriosity {
  private readonly tW1: number[][]; private readonly tW2: number[][]; // frozen target
  private readonly pW1: number[][]; private readonly pW2: number[][]; // learned predictor
  private runningError = 0;
  private steps = 0;

  constructor(
    private readonly inputDim = 64,
    private readonly hiddenDim = 32,
    private readonly featureDim = 16,
    private readonly lr = 0.01,
    seed = 1234,
  ) {
    let s = seed >>> 0;
    const rng = (): number => {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const mat = (rows: number, cols: number): number[][] =>
      Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => (rng() * 2 - 1) / Math.sqrt(cols)));
    this.tW1 = mat(hiddenDim, inputDim); this.tW2 = mat(featureDim, hiddenDim);
    this.pW1 = mat(hiddenDim, inputDim); this.pW2 = mat(featureDim, hiddenDim);
  }

  private fwd(W1: number[][], W2: number[][], x: number[]): { h: number[]; y: number[] } {
    const h = W1.map((row) => {
      let acc = 0;
      for (let i = 0; i < this.inputDim; i++) acc += row[i] * (x[i] ?? 0);
      return Math.tanh(acc);
    });
    const y = W2.map((row) => {
      let acc = 0;
      for (let j = 0; j < this.hiddenDim; j++) acc += row[j] * h[j];
      return Math.tanh(acc);
    });
    return { h, y };
  }

  observe(rawInput: number[]): CuriosityState {
    const x = new Array<number>(this.inputDim).fill(0);
    for (let i = 0; i < this.inputDim; i++) x[i] = rawInput[i] ?? 0;

    const tgt = this.fwd(this.tW1, this.tW2, x).y;
    const { h, y: pred } = this.fwd(this.pW1, this.pW2, x);

    let err = 0;
    const dY = new Array<number>(this.featureDim);
    for (let f = 0; f < this.featureDim; f++) {
      const e = pred[f] - tgt[f];
      err += e * e;
      dY[f] = e * (1 - pred[f] * pred[f]); // through output tanh
    }
    err /= this.featureDim;

    // Backprop one SGD step through the two predictor layers.
    const dH = new Array<number>(this.hiddenDim).fill(0);
    for (let f = 0; f < this.featureDim; f++) {
      for (let j = 0; j < this.hiddenDim; j++) {
        dH[j] += dY[f] * this.pW2[f][j];
        this.pW2[f][j] -= this.lr * dY[f] * h[j];
      }
    }
    for (let j = 0; j < this.hiddenDim; j++) {
      const g = dH[j] * (1 - h[j] * h[j]);
      for (let i = 0; i < this.inputDim; i++) this.pW1[j][i] -= this.lr * g * x[i];
    }

    this.steps++;
    this.runningError = 0.95 * this.runningError + 0.05 * err;
    const intrinsicReward = clamp(Math.tanh(err), 0, 1);
    return { intrinsicReward, rawError: err, runningError: this.runningError, steps: this.steps };
  }

  reset(): void { this.runningError = 0; this.steps = 0; }
}

// ── Metaconsciousness Evaluator ────────────────────────────────────
//
// Port of MetaconsciousnessEvaluator: scores the system's meta-representation
// capacity from (i) confidence calibration, (ii) learning-velocity awareness,
// (iii) temporal self-continuity, (iv) error-monitoring (RPE tracking quality).
// A weighted composite ∈ [0,1]. Proxy, not a measurement.

export class MetaconsciousnessEvaluator {
  evaluate(input: {
    confidenceCalibration: number;   // self-model
    learningVelocity: number;        // meta-learning (∈ [-1,1])
    temporalContinuity: number;      // self-model
    noveltyDetected: boolean;        // meta-learning novelty spike
  }): MetaconsciousnessReport {
    const calibration = clamp(input.confidenceCalibration, 0, 1);
    // Awareness of learning = positive learning progress only. (v2.9 fix: the
    // v2.9 |velocity| credited destabilisation as much as convergence, which
    // is incoherent — a system falling apart is not "more meta-aware".)
    const learningAwareness = clamp(input.learningVelocity, 0, 1);
    const selfContinuity = clamp(input.temporalContinuity, 0, 1);
    // Error monitoring credit: detecting novelty when variance spikes.
    const errorMonitoring = input.noveltyDetected ? 0.8 : 0.5;

    const components = {
      calibration,
      learningAwareness,
      selfContinuity,
      errorMonitoring,
    };
    const overall = clamp(
      0.30 * calibration + 0.25 * learningAwareness +
      0.25 * selfContinuity + 0.20 * errorMonitoring,
      0, 1,
    );
    return { overall, components, disclaimer: PROXY_DISCLAIMER };
  }
}

// ── Development Tracker ────────────────────────────────────────────
//
// Port of DevelopmentTracker: longitudinal self-monitoring. Tracks the
// trajectory of the composite proxy and assigns a coarse developmental
// stage from its running level and stability — the system monitoring its
// own consciousness-proxy trajectory over time (a second-order operation).

const STAGES = ['nascent', 'reactive', 'integrative', 'reflective'] as const;
export type DevelopmentStage = (typeof STAGES)[number];

export class DevelopmentTracker {
  private history: number[] = [];
  private peak = 0;

  update(compositeProxy: number, metaScore: number): DevelopmentState {
    const c = clamp(compositeProxy, 0, 1);
    this.history.push(c);
    if (this.history.length > 256) this.history.shift();
    this.peak = Math.max(this.peak, c);

    const level = mean(this.history.slice(-32));
    const stability = 1 - clamp(Math.sqrt(variance(this.history.slice(-32))), 0, 1);

    // Stage from blended level × meta-representation score.
    const blended = 0.6 * level + 0.4 * clamp(metaScore, 0, 1);
    let idx = 0;
    if (blended >= 0.65 && stability >= 0.6) idx = 3;
    else if (blended >= 0.45) idx = 2;
    else if (blended >= 0.25) idx = 1;
    const stage: DevelopmentStage = STAGES[idx];

    return {
      stage,
      stageIndex: idx,
      level,
      stability,
      peak: this.peak,
      samples: this.history.length,
    };
  }

  reset(): void { this.history = []; this.peak = 0; }
}

// ── Convergence Monitor (v2.9: free-energy + task-quality halting) ─
//
// The v2.9 criterion thresholded heuristic correlates (RPE-variance, RND
// curiosity, proxy stability) that all track *input stationarity*: feeding a
// constant input declared "satisfaction" regardless of result quality. v2.9
// fixes this by gating on TWO independent, meaningful quantities:
//
//   (1) free-energy convergence — |ΔF| ≤ epsFreeEnergy, where F is the REAL
//       variational free energy from the active-inference core (the model has
//       settled); and
//   (2) task quality — realized pragmatic value ≥ minTaskQuality, an
//       EXTERNALLY grounded signal (did the task actually go well), so a
//       mediocre fixed point (stable but low-reward) is NOT declared
//       satisfactory.
//
// Halting therefore requires the loop to be both *settled* AND *good*,
// sustained over a patience window. Thresholds are in meaningful units:
// epsFreeEnergy in nats; minTaskQuality as a fraction of maximal preference.

export const DEFAULT_CONVERGENCE: ConvergenceConfig = {
  epsFreeEnergy: 0.02,
  relFreeEnergy: 0.03,   // |ΔF| ≤ 3% of F — scale-free, calibrated on measured ΔF/F
  minTaskQuality: 0.6,
  maxEpistemic: 0.1,
  patience: 3,
};

export class ConvergenceMonitor {
  private cfg: ConvergenceConfig;
  private sustained = 0;
  private deltaHistory: number[] = [];

  constructor(cfg: Partial<ConvergenceConfig> = {}) {
    this.cfg = { ...DEFAULT_CONVERGENCE, ...cfg };
  }

  configure(partial: Partial<ConvergenceConfig>): ConvergenceConfig {
    this.cfg = { ...this.cfg, ...partial };
    this.sustained = 0;
    return { ...this.cfg };
  }

  getConfig(): ConvergenceConfig { return { ...this.cfg }; }

  /**
   * Calibrate epsFreeEnergy on a measured ΔF window: set the absolute floor to
   * a fraction of the median observed |ΔF| (data-driven, replacing a guessed
   * constant). Returns the recommended/applied value.
   */
  calibrate(factor = 0.5): { medianDelta: number; epsFreeEnergy: number; samples: number } {
    const xs = [...this.deltaHistory].sort((a, b) => a - b);
    const median = xs.length ? xs[Math.floor(xs.length / 2)] : this.cfg.epsFreeEnergy;
    const eps = Math.max(1e-4, median * factor);
    this.cfg = { ...this.cfg, epsFreeEnergy: eps };
    this.sustained = 0;
    return { medianDelta: median, epsFreeEnergy: eps, samples: xs.length };
  }

  update(input: {
    freeEnergy: number;
    deltaFreeEnergy: number;
    taskQuality: number;
    epistemic: number;
  }): ConvergenceState {
    this.deltaHistory.push(input.deltaFreeEnergy);
    if (this.deltaHistory.length > 200) this.deltaHistory.shift();

    // Settled if ΔF below the absolute floor OR below a fraction of F (scale-free).
    const relThreshold = this.cfg.relFreeEnergy * Math.abs(input.freeEnergy);
    const effThreshold = Math.max(this.cfg.epsFreeEnergy, relThreshold);
    const reasons = {
      freeEnergyConverged: input.deltaFreeEnergy <= effThreshold,
      taskQualityMet: input.taskQuality >= this.cfg.minTaskQuality,
      lowEpistemic: input.epistemic <= this.cfg.maxEpistemic,
    };
    const allMet = reasons.freeEnergyConverged && reasons.taskQualityMet && reasons.lowEpistemic;
    this.sustained = allMet ? this.sustained + 1 : 0;
    const satisfied = this.sustained >= this.cfg.patience;

    const settled = clamp(1 - input.deltaFreeEnergy / (effThreshold * 5 + 1e-9), 0, 1);
    const satisfactionScore = clamp(
      0.5 * clamp(input.taskQuality, 0, 1) +
      0.3 * settled +
      0.2 * clamp(1 - input.epistemic, 0, 1),
      0, 1,
    );

    return {
      satisfied, satisfactionScore, sustainedFor: this.sustained,
      freeEnergy: input.freeEnergy, deltaFreeEnergy: input.deltaFreeEnergy,
      taskQuality: input.taskQuality, reasons, criterion: { ...this.cfg },
    };
  }

  reset(): void { this.sustained = 0; this.deltaHistory = []; }
}

// ── Continuous Active-Inference Actuation Controller (v2.9) ────────
//
// v2.9 maximised a monotone preference over a monotone drive→feature map, so
// the optimum was always the boundary (drive→1): the EFE machinery only
// detected the slope sign — a degenerate "ramp to max". v2.9 makes the
// objective NON-DEGENERATE: the controller REGULATES the substrate to a
// configurable SETPOINT with a homeostatic drive cost, so the optimum is
// interior and the EFE terms genuinely balance:
//     G(d) = −pragmatic(d) − β·exp(−t/τ)·epistemic(d) + λ·d²,
//     pragmatic(d) = −((featurê(d) − setpoint)/width)²   (peaked at setpoint)
// where featurê(d) = clamp(w0 + w1·d) is the online-learned forward model.
// The controller drives the substrate TOWARD the target (interior drive),
// and tracks the setpoint when it changes — true regulation, not maximisation.

export interface ContinuousControllerConfig {
  setpoint: number;   // target substrate feature ∈[0,1]
  width: number;      // preference sharpness around the setpoint
  beta: number;       // epistemic (exploration) weight
  driveCost: number;  // λ: homeostatic cost on drive magnitude
  tau: number;        // exploration anneal time-constant
}

export const DEFAULT_CONTROLLER: ContinuousControllerConfig = {
  setpoint: 0.3, width: 0.25, beta: 0.3, driveCost: 0.05, tau: 40,
};

export class ContinuousActuationController {
  private w0 = 0;
  private w1 = 0.5;
  private n = 0;
  private sumD = 0;
  private lastDrive = 0.5;
  private tStep = 0;
  private lastError = 0;
  private cfg: ContinuousControllerConfig;

  constructor(
    cfg: Partial<ContinuousControllerConfig> = {},
    private readonly lr = 0.05,
    private readonly gridStep = 0.02,
  ) {
    this.cfg = { ...DEFAULT_CONTROLLER, ...cfg };
  }

  configure(partial: Partial<ContinuousControllerConfig>): ContinuousControllerConfig {
    this.cfg = { ...this.cfg, ...partial };
    return { ...this.cfg };
  }

  getConfig(): ContinuousControllerConfig { return { ...this.cfg }; }

  /** Observe the realised substrate feature; return the next continuous drive. */
  select(observedFeature: number): {
    drive: number; predictedFeature: number; pragmatic: number; epistemic: number; modelError: number;
  } {
    // 1 — update forward model from (lastDrive → observedFeature) via LMS.
    const pred = clamp(this.w0 + this.w1 * this.lastDrive, 0, 1);
    const err = observedFeature - pred;
    this.lastError = Math.abs(err);
    this.w0 += this.lr * err;
    this.w1 += this.lr * err * this.lastDrive;
    this.n++; this.sumD += this.lastDrive; this.tStep++;

    // 2 — select drive minimising EFE over a 1-D grid (interior optimum).
    const { setpoint, width, beta, driveCost, tau } = this.cfg;
    const meanD = this.n ? this.sumD / this.n : 0.5;
    const explore = Math.exp(-this.tStep / tau);
    let best = 0.5, bestG = Infinity, bestPF = 0, bestPrag = 0, bestEpi = 0;
    for (let d = 0; d <= 1.0001; d += this.gridStep) {
      const pf = clamp(this.w0 + this.w1 * d, 0, 1);
      const pragmatic = -Math.pow((pf - setpoint) / width, 2);  // peaked at setpoint
      const epistemic = Math.abs(d - meanD);
      const G = -pragmatic - beta * explore * epistemic + driveCost * d * d;
      if (G < bestG) { bestG = G; best = clamp(d, 0, 1); bestPF = pf; bestPrag = pragmatic; bestEpi = epistemic; }
    }
    this.lastDrive = best;
    return { drive: best, predictedFeature: bestPF, pragmatic: bestPrag, epistemic: bestEpi, modelError: this.lastError };
  }

  getDrive(): number { return this.lastDrive; }

  reset(): void {
    this.w0 = 0; this.w1 = 0.5; this.n = 0; this.sumD = 0;
    this.lastDrive = 0.5; this.tStep = 0; this.lastError = 0;
  }
}

// ── Second-Order Loop Orchestrator ─────────────────────────────────
//
// Combines the four sub-modules into a single self-evidencing pass driven
// each cycle by the first-order outputs (RPE, prediction error, broadcast,
// focus winner, self-model calibration/continuity, composite proxy).

export interface SecondOrderInput {
  rpe: number;                    // reward-prediction error ≈ reward.totalReward
  predictionError?: number;       // raw WM surprise
  broadcast: number[];            // GNW broadcast vector (curiosity input)
  focusWinner?: string;           // attention winner = discrete "action"
  realizedValence: number;        // emotion.valence (capability outcome)
  confidenceCalibration: number;  // self-model
  temporalContinuity: number;     // self-model
  compositeProxy: number;         // current TCAI composite report
  substrateScore: number;         // GROUNDED substrate feature ∈[0,1] (ignition·syncR·Φ̃)
  taskFeedback: number;           // external task signal ∈[-1,1], INDEPENDENT of substrate
}

// Active-inference over the SUBSTRATE (v2.9): the observation is a discretised
// substrate feature (not the reward), so F is the surprise of ASTRA's own
// dynamics. Preferences favour high-coherence substrate states, giving the
// agent a reason to act. taskQuality is a SEPARATE external channel.
const AIF_OBS = 5;
const AIF_CTRL = 3;                              // decrease / hold / increase drive
const AIF_PREFS = [0, 0.5, 1.0, 1.5, 2.0];       // prefer high-coherence substrate

export class SecondOrderLoop {
  readonly metaLearning = new MetaLearningModule();
  readonly capability = new CapabilityModel();
  readonly curiosity = new RNDCuriosity();
  readonly metaEvaluator = new MetaconsciousnessEvaluator();
  readonly development = new DevelopmentTracker();
  readonly activeInference = new ActiveInferenceCore(AIF_OBS, AIF_OBS, AIF_CTRL, 4.0, 1.0, 0, 7);
  readonly actuationController = new ContinuousActuationController();
  readonly convergence = new ConvergenceMonitor();
  private last: SecondOrderState | null = null;
  private substrateDrive = 0.5;          // closed-loop actuation state ∈[0,1]
  private taskQualityEma = 0;
  private actuationEnabled = true;

  /** Enable/disable closed-loop actuation (for ablation / open-loop control). */
  setActuation(enabled: boolean): void { this.actuationEnabled = enabled; }
  isActuationEnabled(): boolean { return this.actuationEnabled; }

  step(input: SecondOrderInput): SecondOrderState {
    const meta = this.metaLearning.update(input.rpe);
    const curiosity = this.curiosity.observe(input.broadcast);
    const capability = this.capability.update(input.focusWinner, input.realizedValence);
    const metacognition = this.metaEvaluator.evaluate({
      confidenceCalibration: input.confidenceCalibration,
      learningVelocity: meta.learningVelocity,
      temporalContinuity: input.temporalContinuity,
      noveltyDetected: meta.noveltySpike || curiosity.intrinsicReward > 0.6,
    });
    const development = this.development.update(input.compositeProxy, metacognition.overall);

    // ── SUBSTRATE-GROUNDED active inference (discrete core ⇒ F / halting) ──
    // Observation = discretised substrate feature (already shifted by the
    // PREVIOUS drive in acm-bridge via the real SNN). The discrete core
    // supplies the variational free energy F used by the halting criterion.
    const obsBucket = clamp(Math.floor(input.substrateScore * AIF_OBS), 0, AIF_OBS - 1);
    const aif = this.activeInference.step(obsBucket, AIF_PREFS);

    // ── CLOSE THE LOOP with the CONTINUOUS SETPOINT regulator (v2.9) ──────
    // The controller learns the drive→feature map and selects the drive that
    // minimises expected free energy w.r.t. a SETPOINT (interior optimum), not
    // a maximum. (Division of labour: the discrete ActiveInferenceCore above is
    // PERCEPTION — it supplies F for halting; this controller is CONTROL — it
    // supplies the actuation. Both observe the same substrate feature.)
    let ctl = { drive: 0.5, predictedFeature: 0, pragmatic: 0, epistemic: 0, modelError: 0 };
    if (this.actuationEnabled) {
      ctl = this.actuationController.select(input.substrateScore);
      this.substrateDrive = ctl.drive;
    }
    const current = [-1, -0.33, 0.33, 1].map(() => (this.substrateDrive - 0.5) * 2);
    const actuation: SubstrateActuation = { drive: this.substrateDrive, current, action: aif.action };

    // ── Task quality: EXTERNAL reward EMA, INDEPENDENT of the AIF observation ─
    const extQuality = clamp((clamp(input.taskFeedback, -1, 1) + 1) / 2, 0, 1);
    this.taskQualityEma = 0.7 * this.taskQualityEma + 0.3 * extQuality;
    const taskQuality = this.taskQualityEma;

    const activeInference: ActiveInferenceState = {
      freeEnergy: aif.freeEnergy,
      deltaFreeEnergy: aif.deltaFreeEnergy,
      expectedFreeEnergy: aif.expectedFreeEnergy,
      pragmatic: ctl.pragmatic,
      epistemic: ctl.epistemic,
      realizedPreference: aif.realizedPreference,
      taskQuality,
      substrateObs: obsBucket,
      substrateDrive: this.substrateDrive,
      controllerSetpoint: this.actuationController.getConfig().setpoint,
      predictedFeature: ctl.predictedFeature,
      controllerModelError: ctl.modelError,
      action: aif.action,
      modelEntropy: aif.modelEntropy,
    };

    const convergence = this.convergence.update({
      freeEnergy: aif.freeEnergy,
      deltaFreeEnergy: aif.deltaFreeEnergy,
      taskQuality,
      epistemic: ctl.epistemic,
    });

    this.last = {
      metaLearning: meta, curiosity, capability, metacognition, development,
      activeInference, actuation, convergence, disclaimer: PROXY_DISCLAIMER,
    };
    return this.last;
  }

  getActuation(): SubstrateActuation | null {
    return this.last ? this.last.actuation : null;
  }

  isSatisfied(): boolean { return this.last?.convergence.satisfied ?? false; }

  getState(): SecondOrderState | null { return this.last; }

  reset(): void {
    this.metaLearning.reset();
    this.capability.reset();
    this.curiosity.reset();
    this.development.reset();
    this.activeInference.reset();
    this.actuationController.reset();
    this.convergence.reset();
    this.substrateDrive = 0.5;
    this.taskQualityEma = 0;
    this.last = null;
  }
}
