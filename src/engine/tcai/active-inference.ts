/**
 * ASTRA v2.9 — Native Discrete Active-Inference Core
 * ═══════════════════════════════════════════════════
 * The production realisation of "Étage B": an exact discrete active-inference
 * agent computing REAL variational free energy F (surprise / negative log
 * evidence) and expected free energy G(π) = −pragmatic − epistemic, with an
 * online Dirichlet update of the generative model (A, B) — the genuine
 * self-evidencing organ (the model rewrites itself from data), not telemetry.
 *
 * This replaces the heuristic correlates of v2.3/2.4 as the quantity the
 * halting criterion thresholds on. The mathematics follow standard discrete
 * active inference (Da Costa et al. 2020, J. Math. Psych. — ref [10] of
 * Legros 2026); the Python NumPy counterpart in
 * python/second_order/active_inference_loop.py is numerically equivalent and
 * has been executed/verified.
 *
 * Formal grounding (Legros 2026 §2.2, §4.3):
 *   F[q] = E_q[−log p(o|s)]            (accuracy)
 *        + KL[q(s) ‖ p(s)]            (complexity)            = −log p(o)
 *   G(π) = −E_q[log p(o|C)]            (pragmatic value)
 *        − E_q[ KL[q(s|o,π) ‖ q(s|π)] ] (epistemic / info gain)
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 */

const EPS = 1e-12;

const normCols = (M: number[][]): number[][] => {
  const ns = M[0].length;
  const sums = new Array<number>(ns).fill(0);
  for (let r = 0; r < M.length; r++) for (let c = 0; c < ns; c++) sums[c] += M[r][c];
  return M.map((row) => row.map((v, c) => v / (sums[c] + EPS)));
};

const softmax = (x: number[]): number[] => {
  const m = Math.max(...x);
  const e = x.map((v) => Math.exp(v - m));
  const z = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / (z + EPS));
};

export interface AIFStepResult {
  freeEnergy: number;          // F = −log p(o): variational free energy (surprise)
  deltaFreeEnergy: number;     // |F_t − F_{t-1}|
  expectedFreeEnergy: number[]; // G(u) per action
  pragmatic: number;           // expected utility of the chosen action
  epistemic: number;           // expected info gain of the chosen action
  realizedPreference: number;  // C[o]: preference value of the observed outcome
  action: number;              // argmax q(π)
  policyPosterior: number[];   // q(π)
  modelEntropy: number;        // mean column entropy of A (model uncertainty)
}

/**
 * Exact one-step discrete active-inference agent with online model learning.
 */
export class ActiveInferenceCore {
  private pA: number[][];
  private A: number[][];
  private pB: number[][][];
  private B: number[][][];
  private readonly D: number[];
  private qsPrev: number[] | null = null;
  private aPrev = 0;
  private lastF: number | null = null;

  constructor(
    readonly numObs: number,
    readonly numStates: number,
    readonly numControls: number,
    private readonly gamma = 4.0,   // policy precision
    private readonly lr = 1.0,      // Dirichlet learning rate
    private readonly exploreRate = 0, // ε-greedy exploration (0 ⇒ deterministic argmax)
    private readonly seed = 12345,
  ) {
    this.pA = Array.from({ length: numObs }, () => new Array<number>(numStates).fill(1));
    this.A = normCols(this.pA);
    this.pB = Array.from({ length: numStates }, () =>
      Array.from({ length: numStates }, () => new Array<number>(numControls).fill(1)));
    this.B = this.normB(this.pB);
    this.D = new Array<number>(numStates).fill(1 / numStates);
    this.rngState = this.seed >>> 0;
  }

  private rngState: number;
  private tStep = 0;
  private readonly exploreTau = 35; // exploration decay time-constant (cycles)
  private rng(): number {
    this.rngState |= 0; this.rngState = (this.rngState + 0x6d2b79f5) | 0;
    let t = Math.imul(this.rngState ^ (this.rngState >>> 15), 1 | this.rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  private normB(pB: number[][][]): number[][][] {
    const { numStates, numControls } = this;
    const out: number[][][] = Array.from({ length: numStates }, () =>
      Array.from({ length: numStates }, () => new Array<number>(numControls).fill(0)));
    for (let u = 0; u < numControls; u++) {
      const colSum = new Array<number>(numStates).fill(0);
      for (let i = 0; i < numStates; i++) for (let j = 0; j < numStates; j++) colSum[j] += pB[i][j][u];
      for (let i = 0; i < numStates; i++) for (let j = 0; j < numStates; j++)
        out[i][j][u] = pB[i][j][u] / (colSum[j] + EPS);
    }
    return out;
  }

  /** One self-evidencing step: perceive o, plan via EFE, act, learn (A,B). */
  step(o: number, C: number[]): AIFStepResult {
    const { numObs, numStates, numControls } = this;
    const obs = Math.max(0, Math.min(numObs - 1, Math.round(o)));

    // ── Prior over states ────────────────────────────────────────
    let prior: number[];
    if (this.qsPrev === null) {
      prior = [...this.D];
    } else {
      prior = new Array<number>(numStates).fill(0);
      for (let i = 0; i < numStates; i++)
        for (let j = 0; j < numStates; j++) prior[i] += this.B[i][j][this.aPrev] * this.qsPrev[j];
    }

    // ── Perception: exact categorical posterior q(s) ─────────────
    const logPost = new Array<number>(numStates);
    for (let s = 0; s < numStates; s++)
      logPost[s] = Math.log(this.A[obs][s] + EPS) + Math.log(prior[s] + EPS);
    const qs = softmax(logPost);

    // ── Variational free energy F = accuracy + complexity = −log p(o) ─
    let accuracy = 0, complexity = 0;
    for (let s = 0; s < numStates; s++) {
      accuracy -= qs[s] * Math.log(this.A[obs][s] + EPS);
      complexity += qs[s] * (Math.log(qs[s] + EPS) - Math.log(prior[s] + EPS));
    }
    const F = accuracy + complexity;
    const deltaF = this.lastF === null ? F : Math.abs(F - this.lastF);

    // ── Expected free energy G(u) = −pragmatic − epistemic ───────
    const G = new Array<number>(numControls).fill(0);
    const pragArr = new Array<number>(numControls).fill(0);
    const epiArr = new Array<number>(numControls).fill(0);
    for (let u = 0; u < numControls; u++) {
      const qsU = new Array<number>(numStates).fill(0);
      for (let i = 0; i < numStates; i++)
        for (let j = 0; j < numStates; j++) qsU[i] += this.B[i][j][u] * qs[j];
      const qoU = new Array<number>(numObs).fill(0);
      for (let oo = 0; oo < numObs; oo++)
        for (let s = 0; s < numStates; s++) qoU[oo] += this.A[oo][s] * qsU[s];

      let prag = 0;
      for (let oo = 0; oo < numObs; oo++) prag += qoU[oo] * (C[oo] ?? 0);

      let infoGain = 0;
      for (let oo = 0; oo < numObs; oo++) {
        const post = new Array<number>(numStates);
        let Z = 0;
        for (let s = 0; s < numStates; s++) { post[s] = this.A[oo][s] * qsU[s]; Z += post[s]; }
        if (Z > EPS) {
          for (let s = 0; s < numStates; s++) {
            const p = post[s] / Z;
            infoGain += qoU[oo] * p * (Math.log(p + EPS) - Math.log(qsU[s] + EPS));
          }
        }
      }
      pragArr[u] = prag;
      epiArr[u] = infoGain;
      G[u] = -prag - infoGain;
    }

    const negG = G.map((g) => -this.gamma * g);
    const qpi = softmax(negG);
    let action = 0;
    for (let u = 1; u < numControls; u++) if (qpi[u] > qpi[action]) action = u;
    // Directed exploration with annealing: high early so the transition model
    // B can learn each control's effect, decaying toward 0 so the policy then
    // exploits what it learned (without annealing, constant ε pollutes the
    // realised behaviour). exploreRate=0 ⇒ deterministic argmax (golden path).
    if (this.exploreRate > 0) {
      const effExplore = this.exploreRate * Math.exp(-this.tStep / this.exploreTau);
      if (this.rng() < effExplore) {
        action = Math.min(numControls - 1, Math.floor(this.rng() * numControls));
      }
    }
    this.tStep++;

    // ── Learning: Dirichlet update of A and B (the 2nd-order organ) ─
    // A: observation o under inferred state qs.
    for (let s = 0; s < numStates; s++) this.pA[obs][s] += this.lr * qs[s];
    this.A = normCols(this.pA);
    // B: the transition qsPrev → qs was CAUSED by the PREVIOUS action
    // (B[s_t, s_{t-1}, u_{t-1}]), not the action just selected. Crediting the
    // current action breaks the contingency the agent must learn (v2.9 fix).
    if (this.qsPrev !== null) {
      for (let i = 0; i < numStates; i++)
        for (let j = 0; j < numStates; j++) this.pB[i][j][this.aPrev] += this.lr * qs[i] * this.qsPrev[j];
      this.B = this.normB(this.pB);
    }

    // Mean column entropy of A as a model-uncertainty readout.
    let ent = 0;
    for (let s = 0; s < numStates; s++) {
      let h = 0;
      for (let oo = 0; oo < numObs; oo++) h -= this.A[oo][s] * Math.log(this.A[oo][s] + EPS);
      ent += h;
    }
    const modelEntropy = ent / numStates;

    this.qsPrev = qs;
    this.aPrev = action;
    this.lastF = F;

    return {
      freeEnergy: F,
      deltaFreeEnergy: deltaF,
      expectedFreeEnergy: G,
      pragmatic: pragArr[action],
      epistemic: epiArr[action],
      realizedPreference: C[obs] ?? 0,
      action,
      policyPosterior: qpi,
      modelEntropy,
    };
  }

  getFreeEnergy(): number | null { return this.lastF; }

  reset(): void {
    this.pA = Array.from({ length: this.numObs }, () => new Array<number>(this.numStates).fill(1));
    this.A = normCols(this.pA);
    this.pB = Array.from({ length: this.numStates }, () =>
      Array.from({ length: this.numStates }, () => new Array<number>(this.numControls).fill(1)));
    this.B = this.normB(this.pB);
    this.qsPrev = null;
    this.aPrev = 0;
    this.lastF = null;
    this.rngState = this.seed >>> 0;
    this.tStep = 0;
  }
}
