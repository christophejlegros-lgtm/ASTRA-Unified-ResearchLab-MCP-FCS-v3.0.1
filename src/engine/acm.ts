/**
 * ASTRA ACM — Artificial Consciousness Module
 * © 2026 Christophe Jean Legros — Geneva
 *
 * Composite consciousness metric: ACM = α·Φ̃ + β·GW̃ + γ·PAD̃
 *
 * ⚠ IMPORTANT: The metrics computed here are computational PROXIES
 * inspired by the following frameworks, NOT faithful implementations:
 *
 *   - IIT (Tononi): Φ̃ is an integration proxy based on network statistics.
 *     True IIT Φ requires exponential-time partition search (NP-hard).
 *   - GWT (Baars): GW̃ is a synchrony proxy based on cross-layer
 *     firing rate variance. True GWT involves competitive coalition
 *     dynamics and ignition thresholds not modelled here.
 *   - PAD (Mehrabian): Only the Arousal dimension is approximated
 *     via excitation metrics. Pleasure and Dominance are not computed.
 *
 * These proxies serve as exploratory heuristics for the ASTRA research
 * pipeline. They should not be cited as measurements of consciousness.
 */

import { state } from './state.js';
import { snnEngine } from './snn.js';

// ── Types ─────────────────────────────────────────────────────────

export interface ACMWeights {
  alpha: number;  // integration proxy weight
  beta: number;   // broadcast proxy weight
  gamma: number;  // arousal proxy weight
}

export interface ACMResult {
  compositeScore: number;
  components: {
    integrationProxy: { value: number; weight: number; basis: string };
    broadcastProxy:   { value: number; weight: number; basis: string };
    arousalProxy:     { value: number; weight: number; basis: string };
  };
  decisionClass: number;
  classLabel: string;
  confidence: number;
  totalCycles: number;
  formula: string;
}

export type ConsciousnessLevel =
  | 'ABSENT'       // class 0
  | 'MINIMAL'      // class 1
  | 'PARTIAL'      // class 2
  | 'MODERATE'     // class 3
  | 'HIGH'         // class 4
  | 'FULL';        // class 5

// ── Default Weights ───────────────────────────────────────────────

const DEFAULT_WEIGHTS: ACMWeights = {
  alpha: 0.40,
  beta: 0.35,
  gamma: 0.25,
};

// ── ACM Engine ────────────────────────────────────────────────────

export class ACMModule {
  private weights: ACMWeights;
  private cycles: number = 0;

  constructor(weights?: Partial<ACMWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  /**
   * Compute integration proxy (Φ̃) from SNN dynamics.
   *
   * This is NOT IIT Φ. True Φ requires computing integrated information
   * over all bipartitions of the system, which is computationally
   * intractable for >20 elements. This proxy uses:
   *   - Active neuron fraction (population participation)
   *   - Mean firing rate (overall excitation)
   *   - Weight coefficient of variation (synaptic heterogeneity)
   */
  computeIntegrationProxy(): number {
    const stats = snnEngine.stats();
    const { active, mean } = stats.firingRateStats;
    const wsArr = snnEngine.weightStats();

    const activeFraction = active / stats.neurons;
    // Aggregate weight stats across layers
    const avgStd = wsArr.length > 0 ? wsArr.reduce((s, w) => s + w.std, 0) / wsArr.length : 0;
    const avgMean = wsArr.length > 0 ? wsArr.reduce((s, w) => s + w.mean, 0) / wsArr.length : 0.001;
    const weightComplexity = avgStd / (avgMean + 0.001);
    const proxy = activeFraction * 0.5 + mean * 2.0 + weightComplexity * 0.3;

    return Math.max(0, Math.min(1, proxy));
  }

  /**
   * Compute broadcast proxy (GW̃) from cross-layer synchrony.
   *
   * This is NOT a GWT implementation. True Global Workspace Theory
   * requires competitive coalitions, ignition dynamics, and gated
   * broadcast mechanisms. This proxy measures synchrony via the
   * coefficient of variation of per-layer firing rates: lower CV
   * suggests more uniform activation ≈ broader "broadcast".
   */
  computeBroadcastProxy(): number {
    const s = state.snapshot;
    const layers = s.loihi.ly;

    const rates = [layers.i, layers.h1, layers.h2, layers.o];
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    if (mean < 0.01) return 0;

    const variance = rates.reduce((s, v) => s + (v - mean) ** 2, 0) / rates.length;
    const cv = Math.sqrt(variance) / mean;

    const proxy = Math.max(0, 1 - cv * 0.5) * Math.min(1, mean / 50);
    return Math.max(0, Math.min(1, proxy));
  }

  /**
   * Compute arousal proxy (PAD̃) from network excitation.
   *
   * This approximates only the Arousal dimension of Mehrabian's
   * PAD model. Pleasure and Dominance are not computed. Arousal
   * is estimated from spike rate, bio-signal coupling, and energy.
   */
  computeArousalProxy(): number {
    const s = state.snapshot;

    const spikeNorm = Math.min(1, s.loihi.spk / 2000);
    const bioNorm = Math.min(1, s.loihi.bio / 100);
    const nrgNorm = Math.min(1, s.loihi.nrg / 5);

    const proxy = spikeNorm * 0.5 + bioNorm * 0.3 + nrgNorm * 0.2;
    return Math.max(0, Math.min(1, proxy));
  }

  /**
   * Run a full ACM assessment cycle.
   */
  assess(customWeights?: Partial<ACMWeights>): ACMResult {
    const w = { ...this.weights, ...customWeights };
    this.cycles++;

    const integration = this.computeIntegrationProxy();
    const broadcast = this.computeBroadcastProxy();
    const arousal = this.computeArousalProxy();

    const score = w.alpha * integration + w.beta * broadcast + w.gamma * arousal;
    const cls = this.classify(score);
    const confidence = this.computeConfidence(integration, broadcast, arousal);

    // Update state store
    state.set('acm.integrationProxy', +integration.toFixed(4));
    state.set('acm.broadcastProxy', +broadcast.toFixed(4));
    state.set('acm.arousalProxy', +arousal.toFixed(4));
    state.set('acm.compositeScore', +score.toFixed(4));
    state.set('acm.decisionClass', cls);
    state.set('acm.confidence', +confidence.toFixed(3));
    state.set('acm.cycles', this.cycles);

    return {
      compositeScore: +score.toFixed(4),
      components: {
        integrationProxy: {
          value: +integration.toFixed(4),
          weight: w.alpha,
          basis: 'Active fraction + mean firing rate + synaptic heterogeneity (IIT-inspired proxy, NOT Φ)',
        },
        broadcastProxy: {
          value: +broadcast.toFixed(4),
          weight: w.beta,
          basis: 'Cross-layer firing rate synchrony (GWT-inspired proxy, NOT ignition model)',
        },
        arousalProxy: {
          value: +arousal.toFixed(4),
          weight: w.gamma,
          basis: 'Spike rate + bio coupling + energy (Arousal only, Pleasure/Dominance omitted)',
        },
      },
      decisionClass: cls,
      classLabel: this.classLabel(cls),
      confidence: +(confidence * 100).toFixed(1),
      totalCycles: this.cycles,
      formula: `${w.alpha}×Φ̃ + ${w.beta}×GW̃ + ${w.gamma}×PAD̃ = ${score.toFixed(4)}`,
    };
  }

  // ── Classification ──────────────────────────────────────────────

  private classify(score: number): number {
    if (score < 0.1) return 0;
    if (score < 0.25) return 1;
    if (score < 0.4) return 2;
    if (score < 0.6) return 3;
    if (score < 0.8) return 4;
    return 5;
  }

  classLabel(cls: number): ConsciousnessLevel {
    const labels: ConsciousnessLevel[] = [
      'ABSENT', 'MINIMAL', 'PARTIAL', 'MODERATE', 'HIGH', 'FULL',
    ];
    return labels[Math.min(cls, labels.length - 1)];
  }

  // ── Confidence ──────────────────────────────────────────────────

  private computeConfidence(phi: number, gw: number, pad: number): number {
    const mean = (phi + gw + pad) / 3;
    const variance = ((phi - mean) ** 2 + (gw - mean) ** 2 + (pad - mean) ** 2) / 3;
    const coherence = Math.max(0, 1 - Math.sqrt(variance) * 2);

    const dataAvail = [phi, gw, pad].filter(v => v > 0.01).length / 3;

    return coherence * 0.7 + dataAvail * 0.3;
  }

  /** Update default weights */
  setWeights(w: Partial<ACMWeights>): void {
    Object.assign(this.weights, w);
  }

  /** Current cycle count */
  get totalCycles(): number { return this.cycles; }
}

/** Singleton ACM instance */
export const acmModule = new ACMModule();

// ── Adapter methods for server.ts compatibility ──

const _acmAdapter = {
  _lastResult: null as ACMResult | null,

  /** server.ts calls acm.update(snn) */
  update(_snn?: any): ACMResult {
    _acmAdapter._lastResult = acmModule.assess();
    return _acmAdapter._lastResult;
  },

  /** server.ts calls acm.getState() */
  getState(): ACMResult {
    return acmModule.assess();
  },

  /** server.ts calls acm.getMetrics() */
  getMetrics(): Record<string, number> {
    const r = _acmAdapter._lastResult ?? acmModule.assess();
    return {
      phi: r.components.integrationProxy.value,
      gw: r.components.broadcastProxy.value,
      pad: r.components.arousalProxy.value,
      score: r.compositeScore,
      class: r.decisionClass,
      confidence: r.confidence,
      cycles: r.totalCycles,
    };
  },
};

export { _acmAdapter as acmAdapter };
