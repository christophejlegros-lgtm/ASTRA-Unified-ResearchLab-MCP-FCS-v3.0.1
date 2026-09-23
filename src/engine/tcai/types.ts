/**
 * ASTRA × the_consciousness_ai — Shared Types
 * ════════════════════════════════════════════
 * TypeScript port of core dataclasses from tlcdv/the_consciousness_ai:
 *   models/core/global_workspace.py   → WorkspaceMessage, WorkspaceState
 *   models/core/qualia_mapper.py      → PhenomenologicalState
 *   models/self_model/self_representation_core.py → SelfState
 *   models/memory/emotional_memory_core.py → MemoryRecord
 *
 * ⚠ DISCLAIMER — These structures support computational PROXIES of
 * consciousness-related constructs (GNW, IIT, PAD). They are research
 * heuristics, not measurements of consciousness.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 * Upstream Python: © tlcdv/the_consciousness_ai (vendored in /python)
 */

// ── Emotional space (PAD — Mehrabian) ─────────────────────────────

export interface EmotionalState {
  valence: number;    // Pleasure  ∈ [-1, 1]
  arousal: number;    // Arousal   ∈ [0, 1]
  dominance: number;  // Dominance ∈ [0, 1]
}

export function clampEmotion(e: Partial<EmotionalState>): EmotionalState {
  const c = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
  return {
    valence: c(e.valence ?? 0, -1, 1),
    arousal: c(e.arousal ?? 0.5, 0, 1),
    dominance: c(e.dominance ?? 0.5, 0, 1),
  };
}

// ── Global Workspace (GNW — Dehaene/Baars) ────────────────────────

/** A message broadcast into the global workspace by a specialist module. */
export interface WorkspaceMessage {
  source: string;
  content: number[];          // payload vector (workspace_dim)
  priority: number;           // bid ∈ [0, 1]
  timestamp: number;
}

/** Phenomenological proxy vector — [Intensity, Valence, Complexity]. */
export interface PhenomenologicalState {
  intensity: number;
  valence: number;
  complexity: number;
}

export interface WorkspaceState {
  activeContent: Record<string, number[]>;
  accessHistory: Array<{ step: number; winners: string[]; ignition: number }>;
  broadcastStrength: number;          // activation level ∈ [0, 1]
  competitionResults: Record<string, number>;
  phiValue: number;                   // Φ̃ proxy on broadcast vector
  isConscious: boolean;               // ignition ≥ threshold (proxy label)
  focusTopic: string;
  qualiaVector: PhenomenologicalState;
  broadcastPayload: number[] | null;  // fused broadcast vector
  syncR: number;                      // Kuramoto order parameter R ∈ [0, 1]
}

export interface CompetitionResult {
  winners: string[];
  ignition: number;            // sigmoid ignition value ∈ [0, 1]
  ignited: boolean;
  boundBids: Record<string, number>;
  syncR: number;
  broadcast: number[];
  qualia: PhenomenologicalState;
  phiProxy: number;
  step: number;
}

// ── Emotional Memory ──────────────────────────────────────────────

export interface MemoryRecord {
  id: number;
  timestamp: number;
  narrative: string;
  embedding: number[];                // feature vector of the experience
  emotionalContext: EmotionalState;
  attentionLevel: number;             // gate at storage time ∈ [0, 1]
  salience: number;                   // |valence|·arousal·attention composite
  accessCount: number;
}

export interface RetrievalHit {
  record: MemoryRecord;
  similarity: number;                 // cosine on embeddings
  emotionalCongruence: number;        // 1 − normalized PAD distance
  score: number;                      // blended retrieval score
}

// ── Self Model ────────────────────────────────────────────────────

export interface SelfState {
  interoceptive: { energy: number; stress: number; effort: number };
  epistemic: { uncertainty: number; learningProgress: number };
  temporalContinuity: number;         // similarity to previous self-snapshot
  confidenceCalibration: number;
  emotional: EmotionalState;
  performanceEMA: number;
  updates: number;
  lastTimestamp: number;
}

export interface AttentionFocus {
  target: string;
  intensity: number;
  stability: number;
}

// ── Metrics ───────────────────────────────────────────────────────

export interface GNWMetricsReport {
  ignitionEvents: number;
  ignitionRate: number;
  meanIgnition: number;
  broadcastAvailability: number;      // fraction of steps with active broadcast
  reuseEvents: number;
  steps: number;
}

export interface ConsciousnessReport {
  gnw: GNWMetricsReport;
  phiRIIUProxy: number;
  effectiveInformation: number;
  workspace: { ignition: number; syncR: number; focus: string };
  composite: number;                  // blended TCAI proxy score ∈ [0, 1]
  disclaimer: string;
}

// ── Second-Order Loop (NEW in v2.9) ───────────────────────────────
// Self-evidencing layer: the system observes and corrects its own
// predictive capacity. Ports of MetaLearningModule, DirectExperienceLearner,
// RNDCuriosity, MetaconsciousnessEvaluator, DevelopmentTracker.

/** MetaLearningModule output — learning velocity from RPE variance. */
export interface MetaLearningState {
  learningVelocity: number;     // 1 − var_ratio ∈ [-1, 1]; >0 ⇒ converging
  rpeVarianceRatio: number;     // recent/overall RPE variance
  noveltySpike: boolean;        // var_ratio > 2 ⇒ novel/confusing regime
  samples: number;
}

/** A single action → expected-valence capability entry. */
export interface CapabilityEntry {
  action: string;
  expectedValence: number;      // EMA of realized valence for this action
}

/** RNDCuriosity output — intrinsic reward = predictor/target error. */
export interface CuriosityState {
  intrinsicReward: number;      // tanh(error) ∈ [0, 1] (epistemic value proxy)
  rawError: number;             // raw MSE in feature space
  runningError: number;         // EMA of error (familiarity baseline)
  steps: number;
}

/** MetaconsciousnessEvaluator composite. */
export interface MetaconsciousnessReport {
  overall: number;              // weighted composite ∈ [0, 1]
  components: {
    calibration: number;
    learningAwareness: number;
    selfContinuity: number;
    errorMonitoring: number;
  };
  disclaimer: string;
}

/** DevelopmentTracker longitudinal self-monitoring state. */
export interface DevelopmentState {
  stage: 'nascent' | 'reactive' | 'integrative' | 'reflective';
  stageIndex: number;
  level: number;                // running composite-proxy level
  stability: number;            // 1 − std of recent composite proxy
  peak: number;
  samples: number;
}

/** Thresholds defining a "satisfactory" converged regime (early-stop, v2.9). */
export interface ConvergenceConfig {
  epsFreeEnergy: number;        // absolute |ΔF| ≤ ⇒ free energy settled (nats)
  relFreeEnergy: number;        // OR |ΔF| ≤ relFreeEnergy·F ⇒ settled (scale-free)
  minTaskQuality: number;       // realized pragmatic value ≥ ⇒ result is actually good
  maxEpistemic: number;         // expected info gain ≤ ⇒ exploration exhausted
  patience: number;             // consecutive satisfied cycles required to halt
}

/** ConvergenceMonitor output — the satisfaction / halting signal (v2.9). */
export interface ConvergenceState {
  satisfied: boolean;
  satisfactionScore: number;
  sustainedFor: number;
  freeEnergy: number;
  deltaFreeEnergy: number;
  taskQuality: number;
  reasons: {
    freeEnergyConverged: boolean;  // |ΔF| ≤ max(eps, rel·F): absolute OR scale-free
    taskQualityMet: boolean;       // external task quality ≥ minTaskQuality
    lowEpistemic: boolean;
  };
  criterion: ConvergenceConfig;
}

/** Closed-loop actuation: AIF action → substrate drive / spike-injection bias. */
export interface SubstrateActuation {
  drive: number;                // ∈ [0,1] internal substrate drive
  current: number[];            // per-layer injection current for the real SNN
  action: number;               // AIF action that produced this actuation
}

/** Active-inference telemetry surfaced in the second-order state (v2.9). */
export interface ActiveInferenceState {
  freeEnergy: number;
  deltaFreeEnergy: number;
  expectedFreeEnergy: number[];
  pragmatic: number;
  epistemic: number;
  realizedPreference: number;
  taskQuality: number;          // external reward EMA (independent of observation)
  substrateObs: number;         // grounded observation bucket (substrate feature)
  substrateDrive: number;       // closed-loop actuation drive
  controllerSetpoint: number;   // continuous controller target feature (v2.9)
  predictedFeature: number;     // forward-model predicted feature at chosen drive
  controllerModelError: number; // |observed − predicted| forward-model surprise
  action: number;
  modelEntropy: number;
}

/** Full second-order loop snapshot. */
export interface SecondOrderState {
  metaLearning: MetaLearningState;
  curiosity: CuriosityState;
  capability: { actionType: string; expectedValenceShift: number };
  metacognition: MetaconsciousnessReport;
  development: DevelopmentState;
  activeInference: ActiveInferenceState;
  actuation: SubstrateActuation;
  convergence: ConvergenceState;
  disclaimer: string;
}

export const PROXY_DISCLAIMER =
  'Computational proxies inspired by GNW/IIT/PAD frameworks — research heuristics, not measurements of consciousness.';
