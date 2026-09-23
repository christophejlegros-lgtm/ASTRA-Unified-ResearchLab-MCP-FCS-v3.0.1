/**
 * ASTRA World Model — JEPA-Inspired Latent Dynamics Engine
 * =========================================================
 *
 * Adapts the LeWorldModel (Maes, Le Lidec, Scieur, LeCun, Balestriero 2026)
 * Joint-Embedding Predictive Architecture to ASTRA's neuromorphic SNN context.
 *
 * Architecture:
 *   Encoder:    z_t     = enc(s_t)           — SNN state → latent embedding
 *   Predictor:  ẑ_{t+1} = pred(z_t, a_t)    — latent dynamics model
 *   Loss:       L = L_pred + λ·SIGReg(Z)    — prediction + Gaussian regularizer
 *   Planning:   CEM in latent space          — optimal spike injection strategy
 *
 * Key components:
 *   - SNNStateEncoder: Projects SNN state vectors to latent space
 *   - LatentPredictor:  MLP conditioned on actions via additive modulation
 *   - SIGReg:           Sketch Isotropic Gaussian Regularizer (anti-collapse)
 *   - CEMPlanner:       Cross-Entropy Method for goal-directed planning
 *   - SurpriseDetector: Violation-of-expectation via prediction error
 *
 * Methodological disclaimer:
 *   This is a lightweight TypeScript implementation for simulation & MCP exposition.
 *   It faithfully transposes LeWM's architectural principles but uses simple linear
 *   projections rather than ViT encoders (ASTRA operates on structured SNN state
 *   vectors, not raw pixels). The SIGReg regularizer uses the Epps-Pulley
 *   characteristic-function test as described in the original paper.
 *
 * © 2026 Christophe Jean Legros — Geneva
 * Reference: Maes et al. (2026) "LeWorldModel: Stable End-to-End JEPA from Pixels"
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Raw SNN observation: membrane potentials + firing rates + weight statistics */
export interface SNNObservation {
  /** Membrane potentials per layer [mV], flattened */
  membranePotentials: Float64Array;
  /** Instantaneous firing rates per layer [Hz] */
  firingRates: Float64Array;
  /** Synaptic weight statistics: [mean, std, sparsity] per layer */
  weightStats: Float64Array;
  /** Bio-platform coupling factors (if connected) */
  bioCoupling: Float64Array;
  /** Timestep index */
  timestep: number;
}

/** Action space: spike injection parameters */
export interface SpikeAction {
  /** Target neuron indices */
  targetNeurons: number[];
  /** Injection strengths [mV] */
  strengths: number[];
  /** Duration in timesteps */
  duration: number;
}

/** Compact latent embedding */
export interface LatentEmbedding {
  /** Latent vector (Float64Array of size latentDim) */
  z: Float64Array;
  /** Timestamp of encoding */
  timestep: number;
  /** Encoding confidence (reconstruction proxy) */
  confidence: number;
}

/** World Model prediction result */
export interface Prediction {
  /** Predicted next-state latent embedding */
  zHat: Float64Array;
  /** Prediction loss (MSE in latent space) */
  predictionLoss: number;
  /** Surprise score (normalized prediction error) */
  surprise: number;
  /** Action that was conditioned on */
  action: SpikeAction;
  /** Source timestep */
  fromTimestep: number;
}

/** CEM planning result */
export interface PlanResult {
  /** Optimal action sequence */
  actions: SpikeAction[];
  /** Expected trajectory in latent space */
  trajectory: Float64Array[];
  /** Final distance to goal in latent space */
  goalDistance: number;
  /** Number of CEM iterations performed */
  iterations: number;
  /** Convergence achieved */
  converged: boolean;
}

/** World Model configuration */
export interface WorldModelConfig {
  /** Dimensionality of SNN observation vector */
  observationDim: number;
  /** Latent embedding dimensionality (LeWM default: 192) */
  latentDim: number;
  /** Hidden layer width for encoder/predictor MLPs */
  hiddenDim: number;
  /** Action embedding dimensionality */
  actionDim: number;
  /** SIGReg regularization strength (λ) */
  sigregLambda: number;
  /** SIGReg number of random projections */
  sigregProjections: number;
  /** SIGReg characteristic function knots */
  sigregKnots: number;
  /** CEM population size */
  cemPopulation: number;
  /** CEM elite fraction */
  cemEliteFraction: number;
  /** CEM max iterations */
  cemMaxIter: number;
  /** CEM convergence threshold */
  cemThreshold: number;
  /** Planning horizon (number of steps to plan ahead) */
  planningHorizon: number;
  /** Learning rate for online adaptation */
  learningRate: number;
  /** History buffer size for SIGReg batch computation */
  historySize: number;
  /** Number of SNN layers (for structured encoding) */
  numSNNLayers: number;
}

/** World Model metrics */
export interface WorldModelMetrics {
  /** Cumulative training steps */
  trainingSteps: number;
  /** Running average prediction loss */
  avgPredictionLoss: number;
  /** Running average SIGReg value */
  avgSigregLoss: number;
  /** Running average total loss */
  avgTotalLoss: number;
  /** Mean surprise score */
  avgSurprise: number;
  /** Latent space variance (collapse indicator: should be ~1.0) */
  latentVariance: number;
  /** Mean cosine similarity between consecutive embeddings */
  latentDrift: number;
  /** Planning success rate (goal reached within threshold) */
  planningSuccessRate: number;
  /** Number of plans executed */
  plansExecuted: number;
  /** Timestamp of last update */
  lastUpdated: number;
}

// ─── Default Configuration ──────────────────────────────────────────────────

export const DEFAULT_WM_CONFIG: WorldModelConfig = {
  observationDim: 128 + 4 * 3 + 4,       // 128 neurons + 4 layers × 3 weight stats + 4 bio
  latentDim: 64,                          // Compact (LeWM uses 192 for pixels; SNN states are lower-dim)
  hiddenDim: 128,                         // MLP hidden width
  actionDim: 16,                          // Action embedding size
  sigregLambda: 0.1,                      // λ for SIGReg (single hyperparameter)
  sigregProjections: 256,                 // Random projections (reduced from 1024 for efficiency)
  sigregKnots: 17,                        // CF evaluation points (as in LeWM)
  cemPopulation: 64,                      // CEM candidates per iteration
  cemEliteFraction: 0.2,                  // Top 20% elites
  cemMaxIter: 10,                         // CEM iterations
  cemThreshold: 0.05,                     // Goal-distance convergence
  planningHorizon: 8,                     // Steps ahead
  learningRate: 0.001,                    // SGD-like online learning rate
  historySize: 128,                       // Embedding history for SIGReg batch
  numSNNLayers: 4,                        // Default ASTRA layers: input, hidden1, hidden2, output
};

// ─── Linear Algebra Utilities ───────────────────────────────────────────────

/** Dense matrix stored row-major */
class DenseMatrix {
  constructor(
    public readonly rows: number,
    public readonly cols: number,
    public data: Float64Array,
  ) {
    if (data.length !== rows * cols) throw new Error(`Matrix size mismatch: ${rows}×${cols} ≠ ${data.length}`);
  }

  static zeros(rows: number, cols: number): DenseMatrix {
    return new DenseMatrix(rows, cols, new Float64Array(rows * cols));
  }

  /** Xavier/Glorot initialization */
  static xavier(rows: number, cols: number): DenseMatrix {
    const scale = Math.sqrt(2.0 / (rows + cols));
    const data = new Float64Array(rows * cols);
    for (let i = 0; i < data.length; i++) {
      data[i] = gaussianRandom() * scale;
    }
    return new DenseMatrix(rows, cols, data);
  }

  /** Matrix-vector multiply: y = Ax */
  mulVec(x: Float64Array): Float64Array {
    if (x.length !== this.cols) throw new Error(`Dimension mismatch: ${this.cols} ≠ ${x.length}`);
    const y = new Float64Array(this.rows);
    for (let i = 0; i < this.rows; i++) {
      let sum = 0;
      const offset = i * this.cols;
      for (let j = 0; j < this.cols; j++) {
        sum += this.data[offset + j] * x[j];
      }
      y[i] = sum;
    }
    return y;
  }

  /** Outer product rank-1 update: M += lr * (a ⊗ b) */
  addOuterProduct(a: Float64Array, b: Float64Array, lr: number): void {
    for (let i = 0; i < this.rows; i++) {
      const offset = i * this.cols;
      const ai = a[i] * lr;
      for (let j = 0; j < this.cols; j++) {
        this.data[offset + j] += ai * b[j];
      }
    }
  }
}

function gaussianRandom(): number {
  // Box-Muller transform
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function vecAdd(a: Float64Array, b: Float64Array): Float64Array {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i];
  return out;
}

function vecSub(a: Float64Array, b: Float64Array): Float64Array {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] - b[i];
  return out;
}

function vecScale(a: Float64Array, s: number): Float64Array {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * s;
  return out;
}

function vecDot(a: Float64Array, b: Float64Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function vecNorm(a: Float64Array): number {
  return Math.sqrt(vecDot(a, a));
}

function vecMSE(a: Float64Array, b: Float64Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return s / a.length;
}

function gelu(x: number): number {
  // Approximate GELU: x · Φ(x) ≈ 0.5x(1 + tanh(√(2/π)(x + 0.044715x³)))
  return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)));
}

function applyGELU(v: Float64Array): Float64Array {
  const out = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = gelu(v[i]);
  return out;
}

function layerNorm(v: Float64Array, eps = 1e-5): Float64Array {
  const n = v.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += v[i];
  mean /= n;
  let variance = 0;
  for (let i = 0; i < n; i++) variance += (v[i] - mean) ** 2;
  variance /= n;
  const std = Math.sqrt(variance + eps);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = (v[i] - mean) / std;
  return out;
}

// ─── SNN State Encoder ──────────────────────────────────────────────────────

/**
 * Encoder: s_t → z_t
 *
 * Two-layer MLP with LayerNorm and GELU activation.
 * Maps structured SNN state observations to compact latent embeddings.
 *
 * Unlike LeWM's ViT encoder for pixels, we use an MLP because SNN states
 * are already structured low-dimensional vectors (not spatial grids).
 */
export class SNNStateEncoder {
  private W1: DenseMatrix;
  private b1: Float64Array;
  private W2: DenseMatrix;
  private b2: Float64Array;

  constructor(
    public readonly inputDim: number,
    public readonly hiddenDim: number,
    public readonly outputDim: number,
  ) {
    this.W1 = DenseMatrix.xavier(hiddenDim, inputDim);
    this.b1 = new Float64Array(hiddenDim);
    this.W2 = DenseMatrix.xavier(outputDim, hiddenDim);
    this.b2 = new Float64Array(outputDim);
  }

  /** Forward pass: encode SNN observation → latent z */
  encode(obs: Float64Array): Float64Array {
    // Layer 1: LayerNorm → Linear → GELU
    const normed = layerNorm(obs);
    const h1 = vecAdd(this.W1.mulVec(normed), this.b1);
    const h1Act = applyGELU(h1);

    // Layer 2: LayerNorm → Linear (projection)
    const h1Norm = layerNorm(h1Act);
    return vecAdd(this.W2.mulVec(h1Norm), this.b2);
  }

  /** Online weight update via gradient approximation (for prediction loss backprop) */
  updateWeights(obsInput: Float64Array, gradOutput: Float64Array, lr: number): void {
    // Simplified single-step gradient: update W2 using h1 activations
    const normed = layerNorm(obsInput);
    const h1 = vecAdd(this.W1.mulVec(normed), this.b1);
    const h1Act = applyGELU(h1);
    const h1Norm = layerNorm(h1Act);

    // ∂L/∂W2 ≈ gradOutput ⊗ h1Norm (only if dims match)
    if (gradOutput.length === this.outputDim) {
      this.W2.addOuterProduct(gradOutput, h1Norm, -lr);
      for (let i = 0; i < this.b2.length; i++) this.b2[i] -= lr * gradOutput[i];
    }
  }
}

// ─── Latent Dynamics Predictor ──────────────────────────────────────────────

/**
 * Predictor: (z_t, a_t) → ẑ_{t+1}
 *
 * Two-layer MLP with action conditioning via additive modulation
 * (inspired by LeWM's AdaLN-zero modulation in the Transformer predictor).
 *
 * Architecture:
 *   h = GELU(W1 · [z_t] + b1 + W_a · embed(a_t))   — action-modulated hidden
 *   ẑ_{t+1} = W2 · LayerNorm(h) + b2                — projected prediction
 */
export class LatentPredictor {
  private W1: DenseMatrix;
  private b1: Float64Array;
  private Wa: DenseMatrix;       // Action modulation weights
  private ba: Float64Array;
  private W2: DenseMatrix;
  private b2: Float64Array;

  constructor(
    public readonly latentDim: number,
    public readonly hiddenDim: number,
    public readonly actionDim: number,
  ) {
    this.W1 = DenseMatrix.xavier(hiddenDim, latentDim);
    this.b1 = new Float64Array(hiddenDim);
    this.Wa = DenseMatrix.xavier(hiddenDim, actionDim);
    this.ba = new Float64Array(hiddenDim);
    this.W2 = DenseMatrix.xavier(latentDim, hiddenDim);
    this.b2 = new Float64Array(latentDim);
  }

  /** Encode a SpikeAction into a fixed-size vector */
  encodeAction(action: SpikeAction, maxNeurons: number): Float64Array {
    const embed = new Float64Array(this.actionDim);
    // Encode: normalized target distribution + strength stats + duration
    const nTargets = action.targetNeurons.length;
    if (nTargets > 0) {
      embed[0] = nTargets / maxNeurons;               // target density
      let meanIdx = 0, meanStr = 0;
      for (let i = 0; i < nTargets; i++) {
        meanIdx += action.targetNeurons[i];
        meanStr += action.strengths[i] ?? 0;
      }
      embed[1] = (meanIdx / nTargets) / maxNeurons;   // mean target position
      embed[2] = meanStr / nTargets;                   // mean strength
      embed[3] = action.duration / 100;                // normalized duration

      // Spread: variance of target positions
      let varIdx = 0;
      const mi = meanIdx / nTargets;
      for (let i = 0; i < nTargets; i++) {
        varIdx += (action.targetNeurons[i] - mi) ** 2;
      }
      embed[4] = Math.sqrt(varIdx / nTargets) / maxNeurons;
    }
    return embed;
  }

  /** Predict next latent state */
  predict(z: Float64Array, actionEmbed: Float64Array): Float64Array {
    // Action modulation: shift = W_a · a_embed + b_a
    const actionMod = vecAdd(this.Wa.mulVec(actionEmbed), this.ba);

    // Hidden: GELU(W1 · z + b1 + actionMod)
    const h1 = vecAdd(vecAdd(this.W1.mulVec(z), this.b1), actionMod);
    const h1Act = applyGELU(h1);

    // Output: W2 · LayerNorm(h1) + b2
    const h1Norm = layerNorm(h1Act);
    return vecAdd(this.W2.mulVec(h1Norm), this.b2);
  }

  /** Online weight update for prediction loss */
  updateWeights(z: Float64Array, actionEmbed: Float64Array, gradOutput: Float64Array, lr: number): void {
    // Update W2 using hidden activations
    const actionMod = vecAdd(this.Wa.mulVec(actionEmbed), this.ba);
    const h1 = vecAdd(vecAdd(this.W1.mulVec(z), this.b1), actionMod);
    const h1Act = applyGELU(h1);
    const h1Norm = layerNorm(h1Act);

    this.W2.addOuterProduct(gradOutput, h1Norm, -lr);
    for (let i = 0; i < this.b2.length; i++) this.b2[i] -= lr * gradOutput[i];

    // Propagate gradient to W1 via W2^T (manual transpose-multiply)
    const gradH = new Float64Array(this.hiddenDim);
    for (let j = 0; j < this.hiddenDim; j++) {
      let sum = 0;
      for (let i = 0; i < this.latentDim; i++) {
        sum += this.W2.data[i * this.hiddenDim + j] * gradOutput[i];
      }
      gradH[j] = sum;
    }
    this.W1.addOuterProduct(gradH, z, -lr * 0.1);  // dampened
  }
}

// ─── SIGReg: Sketch Isotropic Gaussian Regularizer ──────────────────────────

/**
 * SIGReg — prevents representation collapse by enforcing Gaussian-distributed
 * latent embeddings. Uses the Epps-Pulley characteristic function test.
 *
 * From LeWM/LeJEPA: tests whether the empirical characteristic function of
 * random 1D projections matches that of a standard Gaussian N(0,1).
 *
 * The statistic is computed as:
 *   E_A [ ∫ |φ̂(t; A^T Z) - e^{-t²/2}|² w(t) dt ]
 *
 * where A are random unit projections and w(t) = e^{-t²/2} is the weight kernel.
 */
export class SIGReg {
  private readonly t: Float64Array;       // Evaluation knots [0, 3]
  private readonly phi: Float64Array;     // Gaussian CF: e^{-t²/2}
  private readonly weights: Float64Array; // Integration weights × window
  private projections: Float64Array | null = null; // Lazy-initialized random projections
  private projDim = 0;

  constructor(
    private readonly knots: number,
    private readonly numProjections: number,
  ) {
    const dt = 3.0 / (knots - 1);
    this.t = new Float64Array(knots);
    this.phi = new Float64Array(knots);
    this.weights = new Float64Array(knots);

    for (let k = 0; k < knots; k++) {
      const tk = (k * 3.0) / (knots - 1);
      this.t[k] = tk;
      const window = Math.exp(-tk * tk / 2.0);
      this.phi[k] = window;
      let w = 2 * dt;
      if (k === 0 || k === knots - 1) w = dt;
      this.weights[k] = w * window;
    }
  }

  /** Ensure random projections are initialized for given dimension */
  private ensureProjections(dim: number): void {
    if (this.projections !== null && this.projDim === dim) return;
    this.projDim = dim;
    this.projections = new Float64Array(dim * this.numProjections);
    // Generate and normalize random projection vectors
    for (let p = 0; p < this.numProjections; p++) {
      let norm = 0;
      for (let d = 0; d < dim; d++) {
        const val = gaussianRandom();
        this.projections[p * dim + d] = val;
        norm += val * val;
      }
      norm = Math.sqrt(norm);
      for (let d = 0; d < dim; d++) {
        this.projections[p * dim + d] /= norm;
      }
    }
  }

  /**
   * Compute SIGReg loss over a batch of embeddings.
   * @param batch - Array of latent embeddings (the "Z" matrix)
   * @returns Regularization loss value
   */
  compute(batch: Float64Array[]): number {
    if (batch.length < 2) return 0;
    const dim = batch[0].length;
    this.ensureProjections(dim);

    const B = batch.length;
    let totalStatistic = 0;

    for (let p = 0; p < this.numProjections; p++) {
      // Project all embeddings onto direction p
      const projected = new Float64Array(B);
      for (let b = 0; b < B; b++) {
        let dot = 0;
        for (let d = 0; d < dim; d++) {
          dot += batch[b][d] * this.projections![p * dim + d];
        }
        projected[b] = dot;
      }

      // Compute empirical CF vs Gaussian CF at each knot
      for (let k = 0; k < this.knots; k++) {
        const tk = this.t[k];
        let cosSum = 0, sinSum = 0;
        for (let b = 0; b < B; b++) {
          const angle = projected[b] * tk;
          cosSum += Math.cos(angle);
          sinSum += Math.sin(angle);
        }
        cosSum /= B;
        sinSum /= B;

        const cosErr = cosSum - this.phi[k];
        const sinErr = sinSum; // Gaussian CF is real-valued, so imaginary part should be 0
        const err = cosErr * cosErr + sinErr * sinErr;
        totalStatistic += err * this.weights[k] * B;
      }
    }

    return totalStatistic / this.numProjections;
  }
}

// ─── CEM Planner ────────────────────────────────────────────────────────────

/**
 * Cross-Entropy Method planner in latent space.
 *
 * Given a current state z_current and a goal state z_goal, optimizes an
 * action sequence [a_1, ..., a_H] by:
 *   1. Sampling candidate action sequences from a Gaussian distribution
 *   2. Rolling out each sequence through the predictor
 *   3. Selecting the elite fraction (closest to goal)
 *   4. Refitting the Gaussian to elites
 *   5. Repeating until convergence
 */
export class CEMPlanner {
  constructor(private readonly config: WorldModelConfig) {}

  /**
   * Plan an optimal action sequence to reach goalZ from currentZ.
   */
  plan(
    currentZ: Float64Array,
    goalZ: Float64Array,
    predictor: LatentPredictor,
    maxNeurons: number,
  ): PlanResult {
    const H = this.config.planningHorizon;
    const P = this.config.cemPopulation;
    const eliteCount = Math.max(2, Math.floor(P * this.config.cemEliteFraction));
    const aDim = 5; // Action encoding dimensions used

    // Initialize distribution: mean and std for each action parameter at each timestep
    const mean = new Float64Array(H * aDim);
    const std = new Float64Array(H * aDim);
    // Initial: uniform exploration
    for (let i = 0; i < H * aDim; i++) {
      mean[i] = 0.5;
      std[i] = 0.3;
    }

    let bestActions: SpikeAction[] = [];
    let bestTrajectory: Float64Array[] = [];
    let bestDist = Infinity;
    let converged = false;
    let iter = 0;

    for (iter = 0; iter < this.config.cemMaxIter; iter++) {
      // Sample P candidate action sequences
      const candidates: { actions: SpikeAction[]; trajectory: Float64Array[]; dist: number }[] = [];

      for (let p = 0; p < P; p++) {
        // Sample action parameters
        const actionSeq: SpikeAction[] = [];
        const trajectory: Float64Array[] = [currentZ];
        let z = currentZ;

        for (let h = 0; h < H; h++) {
          const offset = h * aDim;
          // Sample and clamp action parameters
          const density = Math.max(0, Math.min(1, mean[offset] + gaussianRandom() * std[offset]));
          const position = Math.max(0, Math.min(1, mean[offset + 1] + gaussianRandom() * std[offset + 1]));
          const strength = Math.max(-5, Math.min(30, (mean[offset + 2] + gaussianRandom() * std[offset + 2]) * 20));
          const duration = Math.max(1, Math.round((mean[offset + 3] + gaussianRandom() * std[offset + 3]) * 10));

          // Convert to SpikeAction
          const nTargets = Math.max(1, Math.round(density * 10));
          const centerIdx = Math.round(position * (maxNeurons - 1));
          const targets: number[] = [];
          const strengths: number[] = [];
          for (let t = 0; t < nTargets; t++) {
            targets.push(Math.max(0, Math.min(maxNeurons - 1, centerIdx + t - Math.floor(nTargets / 2))));
            strengths.push(strength);
          }

          const action: SpikeAction = { targetNeurons: targets, strengths, duration };
          actionSeq.push(action);

          // Roll out through predictor
          const aEmbed = predictor.encodeAction(action, maxNeurons);
          z = predictor.predict(z, aEmbed);
          trajectory.push(z);
        }

        // Compute distance to goal
        const dist = vecMSE(z, goalZ);
        candidates.push({ actions: actionSeq, trajectory, dist });
      }

      // Sort by distance and select elites
      candidates.sort((a, b) => a.dist - b.dist);
      const elites = candidates.slice(0, eliteCount);

      if (elites[0].dist < bestDist) {
        bestDist = elites[0].dist;
        bestActions = elites[0].actions;
        bestTrajectory = elites[0].trajectory;
      }

      // Check convergence
      if (bestDist < this.config.cemThreshold) {
        converged = true;
        break;
      }

      // Refit distribution to elites
      for (let d = 0; d < H * aDim; d++) {
        let eliteMean = 0, eliteVar = 0;
        const values: number[] = [];
        for (const e of elites) {
          const h = Math.floor(d / aDim);
          const paramIdx = d % aDim;
          const action = e.actions[h];
          let val: number;
          switch (paramIdx) {
            case 0: val = action.targetNeurons.length / 10; break;
            case 1: val = action.targetNeurons.length > 0 ? action.targetNeurons[0] / maxNeurons : 0.5; break;
            case 2: val = action.strengths.length > 0 ? action.strengths[0] / 20 : 0.5; break;
            case 3: val = action.duration / 10; break;
            default: val = 0.5;
          }
          values.push(val);
          eliteMean += val;
        }
        eliteMean /= eliteCount;
        for (const v of values) eliteVar += (v - eliteMean) ** 2;
        eliteVar /= eliteCount;

        mean[d] = eliteMean;
        std[d] = Math.max(0.01, Math.sqrt(eliteVar)); // Floor to prevent collapse
      }
    }

    return {
      actions: bestActions,
      trajectory: bestTrajectory,
      goalDistance: bestDist,
      iterations: iter + 1,
      converged,
    };
  }
}

// ─── World Model Engine ─────────────────────────────────────────────────────

/**
 * Main World Model class orchestrating encoder, predictor, SIGReg, and CEM planner.
 */
export class WorldModelEngine {
  public readonly config: WorldModelConfig;
  public readonly encoder: SNNStateEncoder;
  public readonly predictor: LatentPredictor;
  public readonly sigreg: SIGReg;
  public readonly planner: CEMPlanner;

  private embeddingHistory: Float64Array[] = [];
  private predictionHistory: Prediction[] = [];
  private metrics: WorldModelMetrics;
  private lastEmbedding: LatentEmbedding | null = null;
  private planSuccessCount = 0;

  constructor(config: Partial<WorldModelConfig> = {}) {
    this.config = { ...DEFAULT_WM_CONFIG, ...config };
    const c = this.config;

    this.encoder = new SNNStateEncoder(c.observationDim, c.hiddenDim, c.latentDim);
    this.predictor = new LatentPredictor(c.latentDim, c.hiddenDim, c.actionDim);
    this.sigreg = new SIGReg(c.sigregKnots, c.sigregProjections);
    this.planner = new CEMPlanner(c);

    this.metrics = {
      trainingSteps: 0,
      avgPredictionLoss: 0,
      avgSigregLoss: 0,
      avgTotalLoss: 0,
      avgSurprise: 0,
      latentVariance: 1.0,
      latentDrift: 0,
      planningSuccessRate: 0,
      plansExecuted: 0,
      lastUpdated: Date.now(),
    };
  }

  // ─── Core Operations ────────────────────────────────────────────────────

  /**
   * Flatten an SNNObservation into a fixed-size vector for encoding.
   */
  flattenObservation(obs: SNNObservation): Float64Array {
    const parts = [obs.membranePotentials, obs.firingRates, obs.weightStats, obs.bioCoupling];
    void parts.reduce((s, p) => s + p.length, 0);

    // Pad or truncate to observationDim
    const flat = new Float64Array(this.config.observationDim);
    let offset = 0;
    for (const part of parts) {
      for (let i = 0; i < part.length && offset < flat.length; i++) {
        flat[offset++] = part[i];
      }
    }
    return flat;
  }

  /**
   * Encode an SNN observation into latent space.
   * LeWM equivalent: z_t = enc(o_t)
   */
  encode(obs: SNNObservation): LatentEmbedding {
    const flat = this.flattenObservation(obs);
    const z = this.encoder.encode(flat);

    // Compute encoding confidence from latent norm (well-trained → ~unit norm)
    const norm = vecNorm(z);
    const confidence = Math.min(1.0, norm / Math.sqrt(this.config.latentDim));

    const embedding: LatentEmbedding = {
      z: z,
      timestep: obs.timestep,
      confidence,
    };

    // Update history for SIGReg
    this.embeddingHistory.push(z);
    if (this.embeddingHistory.length > this.config.historySize) {
      this.embeddingHistory.shift();
    }

    // Track latent drift
    if (this.lastEmbedding) {
      const cosine = vecDot(z, this.lastEmbedding.z) / (vecNorm(z) * vecNorm(this.lastEmbedding.z) + 1e-8);
      this.metrics.latentDrift = 0.95 * this.metrics.latentDrift + 0.05 * cosine;
    }

    this.lastEmbedding = embedding;
    return embedding;
  }

  /**
   * Predict next latent state given current embedding and action.
   * LeWM equivalent: ẑ_{t+1} = pred(z_t, a_t)
   */
  predict(currentZ: Float64Array, action: SpikeAction): Prediction {
    const aEmbed = this.predictor.encodeAction(action, this.config.observationDim);
    const zHat = this.predictor.predict(currentZ, aEmbed);

    const prediction: Prediction = {
      zHat,
      predictionLoss: 0,       // Computed on next encode() when ground truth available
      surprise: 0,
      action,
      fromTimestep: this.lastEmbedding?.timestep ?? 0,
    };

    this.predictionHistory.push(prediction);
    if (this.predictionHistory.length > 100) {
      this.predictionHistory.shift();
    }

    return prediction;
  }

  /**
   * Train one step: given the actual next observation, compute losses and update.
   * LeWM equivalent: L = L_pred + λ·SIGReg(Z)
   */
  trainStep(
    prevObs: SNNObservation,
    action: SpikeAction,
    nextObs: SNNObservation,
  ): { predLoss: number; sigregLoss: number; totalLoss: number; surprise: number } {
    const lr = this.config.learningRate;

    // Encode both observations
    const prevFlat = this.flattenObservation(prevObs);
    const nextFlat = this.flattenObservation(nextObs);
    const zPrev = this.encoder.encode(prevFlat);
    const zNext = this.encoder.encode(nextFlat);

    // Predict next state
    const aEmbed = this.predictor.encodeAction(action, this.config.observationDim);
    const zHat = this.predictor.predict(zPrev, aEmbed);

    // L_pred: MSE between predicted and actual next embedding
    const predLoss = vecMSE(zHat, zNext);

    // SIGReg regularization on embedding history
    const sigregLoss = this.embeddingHistory.length >= 8
      ? this.sigreg.compute(this.embeddingHistory)
      : 0;

    // Total loss: L = L_pred + λ·SIGReg
    const totalLoss = predLoss + this.config.sigregLambda * sigregLoss;

    // Compute surprise: normalized prediction error
    const predNorm = vecNorm(zHat);
    const errNorm = vecNorm(vecSub(zHat, zNext));
    const surprise = errNorm / (predNorm + 1e-8);

    // Online weight update (simplified SGD)
    const grad = vecScale(vecSub(zHat, zNext), 2.0 / zHat.length);
    this.predictor.updateWeights(zPrev, aEmbed, grad, lr);
    this.encoder.updateWeights(nextFlat, vecScale(grad, -1), lr * 0.5);

    // Update running metrics (exponential moving average)
    const α = 0.05;
    this.metrics.trainingSteps++;
    this.metrics.avgPredictionLoss = (1 - α) * this.metrics.avgPredictionLoss + α * predLoss;
    this.metrics.avgSigregLoss = (1 - α) * this.metrics.avgSigregLoss + α * sigregLoss;
    this.metrics.avgTotalLoss = (1 - α) * this.metrics.avgTotalLoss + α * totalLoss;
    this.metrics.avgSurprise = (1 - α) * this.metrics.avgSurprise + α * surprise;
    this.metrics.lastUpdated = Date.now();

    // Update latent variance (collapse indicator)
    if (this.embeddingHistory.length > 2) {
      const dim = this.config.latentDim;
      const mean = new Float64Array(dim);
      for (const emb of this.embeddingHistory) {
        for (let d = 0; d < dim; d++) mean[d] += emb[d];
      }
      for (let d = 0; d < dim; d++) mean[d] /= this.embeddingHistory.length;
      let variance = 0;
      for (const emb of this.embeddingHistory) {
        for (let d = 0; d < dim; d++) variance += (emb[d] - mean[d]) ** 2;
      }
      variance /= this.embeddingHistory.length * dim;
      this.metrics.latentVariance = variance;
    }

    return { predLoss, sigregLoss, totalLoss, surprise };
  }

  /**
   * Compute surprise score for a single transition (violation-of-expectation).
   *
   * LeWM uses prediction error to detect physically implausible events.
   * Here we detect neurodynamically implausible SNN state transitions.
   */
  computeSurprise(prevObs: SNNObservation, action: SpikeAction, nextObs: SNNObservation): number {
    const prevFlat = this.flattenObservation(prevObs);
    const nextFlat = this.flattenObservation(nextObs);
    const zPrev = this.encoder.encode(prevFlat);
    const zNext = this.encoder.encode(nextFlat);

    const aEmbed = this.predictor.encodeAction(action, this.config.observationDim);
    const zHat = this.predictor.predict(zPrev, aEmbed);

    const errNorm = vecNorm(vecSub(zHat, zNext));
    const expectedNorm = vecNorm(vecSub(zNext, zPrev));

    return errNorm / (expectedNorm + 1e-8);
  }

  /**
   * Plan an optimal spike injection sequence to reach a goal SNN state.
   * Uses CEM in latent space (LeWM planning paradigm adapted to neuromorphic control).
   */
  planToGoal(currentObs: SNNObservation, goalObs: SNNObservation): PlanResult {
    const currentZ = this.encoder.encode(this.flattenObservation(currentObs));
    const goalZ = this.encoder.encode(this.flattenObservation(goalObs));

    const result = this.planner.plan(currentZ, goalZ, this.predictor, this.config.observationDim);

    // Update planning metrics
    this.metrics.plansExecuted++;
    if (result.converged) this.planSuccessCount++;
    this.metrics.planningSuccessRate = this.planSuccessCount / this.metrics.plansExecuted;

    return result;
  }

  // ─── State Access ───────────────────────────────────────────────────────

  /** Get current metrics */
  getMetrics(): WorldModelMetrics {
    return { ...this.metrics };
  }

  /** Get last latent embedding */
  getLastEmbedding(): LatentEmbedding | null {
    return this.lastEmbedding;
  }

  /** Get embedding history for visualization */
  getEmbeddingHistory(): Float64Array[] {
    return [...this.embeddingHistory];
  }

  /** Get prediction history */
  getPredictionHistory(): Prediction[] {
    return [...this.predictionHistory];
  }

  /** Get full state snapshot */
  getSnapshot(): {
    config: WorldModelConfig;
    metrics: WorldModelMetrics;
    lastEmbedding: LatentEmbedding | null;
    historySize: number;
    predictionCount: number;
  } {
    return {
      config: { ...this.config },
      metrics: this.getMetrics(),
      lastEmbedding: this.lastEmbedding,
      historySize: this.embeddingHistory.length,
      predictionCount: this.predictionHistory.length,
    };
  }

  /** Reset the world model (preserve architecture, clear learned weights) */
  reset(): void {
    this.embeddingHistory = [];
    this.predictionHistory = [];
    this.lastEmbedding = null;
    this.planSuccessCount = 0;
    this.metrics = {
      trainingSteps: 0,
      avgPredictionLoss: 0,
      avgSigregLoss: 0,
      avgTotalLoss: 0,
      avgSurprise: 0,
      latentVariance: 1.0,
      latentDrift: 0,
      planningSuccessRate: 0,
      plansExecuted: 0,
      lastUpdated: Date.now(),
    };
  }
}
