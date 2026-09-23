/**
 * ASTRA × the_consciousness_ai — Oscillatory Binding (Kuramoto / AKOrN)
 * ═════════════════════════════════════════════════════════════════════
 * TypeScript port of models/core/oscillatory_binding.py:
 *   KuramotoLayer            → KuramotoLayer
 *   WorkspaceBindingSystem   → WorkspaceBindingSystem  (bind_bids → bindBids)
 *
 * Each specialist module is an oscillator. Bids drive coupling strength;
 * after N Kuramoto iterations, phase coherence (order parameter R) gates
 * the bids: synchronized coalitions are amplified, desynchronized ones
 * suppressed. This implements the "synchrony binding" upgrade of the GNW.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 * Upstream Python: © tlcdv/the_consciousness_ai (vendored in /python)
 */

export class KuramotoLayer {
  readonly n: number;
  private naturalFreq: number[];
  private coupling: number;
  private dt: number;
  phases: number[];

  constructor(n: number, coupling = 2.0, dt = 0.1, seed = 42) {
    this.n = n;
    this.coupling = coupling;
    this.dt = dt;
    // Deterministic pseudo-random natural frequencies (mulberry32)
    let s = seed >>> 0;
    const rng = () => {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    this.naturalFreq = Array.from({ length: n }, () => 0.8 + 0.4 * rng());
    this.phases = Array.from({ length: n }, () => 2 * Math.PI * rng());
  }

  /** One Kuramoto update; couplingWeights[i] scales how strongly node i couples. */
  step(couplingWeights: number[]): void {
    const next = new Array<number>(this.n);
    for (let i = 0; i < this.n; i++) {
      let interaction = 0;
      for (let j = 0; j < this.n; j++) {
        if (j === i) continue;
        interaction += couplingWeights[j] * Math.sin(this.phases[j] - this.phases[i]);
      }
      next[i] = this.phases[i] + this.dt *
        (this.naturalFreq[i] + (this.coupling / this.n) * couplingWeights[i] * interaction);
    }
    for (let i = 0; i < this.n; i++) this.phases[i] = next[i] % (2 * Math.PI);
  }

  /** Kuramoto order parameter R ∈ [0, 1]: global phase coherence. */
  orderParameter(): number {
    let re = 0, im = 0;
    for (const p of this.phases) { re += Math.cos(p); im += Math.sin(p); }
    return Math.sqrt(re * re + im * im) / this.n;
  }

  /** Pairwise coherence matrix cos(θᵢ − θⱼ) ∈ [−1, 1]. */
  pairwiseCoherence(): number[][] {
    return this.phases.map((pi) => this.phases.map((pj) => Math.cos(pi - pj)));
  }

  reset(seed = 42): void {
    let s = seed >>> 0;
    const rng = () => {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    this.phases = Array.from({ length: this.n }, () => 2 * Math.PI * rng());
  }
}

export class WorkspaceBindingSystem {
  private layer: KuramotoLayer;
  private iterations: number;
  private moduleNames: string[] = [];

  constructor(numModules: number, iterations = 5) {
    this.layer = new KuramotoLayer(numModules);
    this.iterations = iterations;
  }

  registerModules(names: string[]): void {
    this.moduleNames = [...names];
    if (names.length !== this.layer.n) {
      this.layer = new KuramotoLayer(names.length);
    }
  }

  resetState(): void { this.layer.reset(); }

  /**
   * Bind bids through oscillatory dynamics.
   * Returns gated bids and the global sync order parameter R.
   * Port of WorkspaceBindingSystem.bind_bids().
   */
  bindBids(bids: Record<string, number>): { boundBids: Record<string, number>; syncR: number } {
    const weights = this.moduleNames.map((n) => bids[n] ?? 0);
    for (let it = 0; it < this.iterations; it++) this.layer.step(weights);
    const r = this.layer.orderParameter();

    // Gate each bid by its mean coherence with the rest of the network
    const coh = this.layer.pairwiseCoherence();
    const bound: Record<string, number> = {};
    this.moduleNames.forEach((name, i) => {
      let meanCoh = 0;
      for (let j = 0; j < this.moduleNames.length; j++) {
        if (j !== i) meanCoh += coh[i][j];
      }
      meanCoh /= Math.max(1, this.moduleNames.length - 1);
      const gate = 0.5 * (1 + meanCoh);          // map [−1,1] → [0,1]
      bound[name] = (bids[name] ?? 0) * (0.3 + 0.7 * gate);
    });
    return { boundBids: bound, syncR: r };
  }

  getPairwiseCoherence(): number[][] { return this.layer.pairwiseCoherence(); }
  getModuleNames(): string[] { return [...this.moduleNames]; }
}
