/**
 * ASTRA × the_consciousness_ai — Consciousness Metrics Suite
 * ═══════════════════════════════════════════════════════════
 * TypeScript port of:
 *   models/evaluation/gnw_metrics.py            → GNWMetrics
 *   models/evaluation/effective_information.py  → computeEffectiveInformation
 *   models/evaluation/phi_riiu.py               → RIIUPhi (covariance surrogate)
 *
 * ⚠ DISCLAIMER — Φ̃-RIIU here replaces the upstream learned low-rank
 *   surrogate (AutoPhiSurrogate, PyTorch) with an analytical covariance
 *   integration ratio over a sliding latent buffer. Effective Information
 *   follows the Hoel/Tononi TPM formulation on discretized trajectories.
 *   All values are research proxies, not measurements of consciousness.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 * Upstream Python: © tlcdv/the_consciousness_ai (vendored in /python)
 */

import { type GNWMetricsReport } from './types.js';

// ── GNW Metrics (gnw_metrics.py) ──────────────────────────────────

export class GNWMetrics {
  private ignitionEvents = 0;
  private ignitionSum = 0;
  private broadcastSteps = 0;
  private reuseEvents = 0;
  private steps = 0;
  private threshold: number;

  constructor(ignitionThreshold = 0.5) { this.threshold = ignitionThreshold; }

  /** Port of update_workspace_status(): one call per workspace step. */
  update(ignition: number, broadcastActive: boolean): void {
    this.steps++;
    this.ignitionSum += ignition;
    if (ignition >= this.threshold) this.ignitionEvents++;
    if (broadcastActive) this.broadcastSteps++;
  }

  /** Port of log_event_reuse(): broadcast content reused by another module. */
  logReuse(): void { this.reuseEvents++; }

  report(): GNWMetricsReport {
    return {
      ignitionEvents: this.ignitionEvents,
      ignitionRate: this.steps ? this.ignitionEvents / this.steps : 0,
      meanIgnition: this.steps ? this.ignitionSum / this.steps : 0,
      broadcastAvailability: this.steps ? this.broadcastSteps / this.steps : 0,
      reuseEvents: this.reuseEvents,
      steps: this.steps,
    };
  }

  reset(): void {
    this.ignitionEvents = 0; this.ignitionSum = 0;
    this.broadcastSteps = 0; this.reuseEvents = 0; this.steps = 0;
  }
}

// ── Effective Information (effective_information.py) ──────────────

/** Port of discretize_continuous(): scalar trajectory → state indices. */
export function discretizeContinuous(values: number[], numStates = 8): number[] {
  if (values.length === 0) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  return values.map((v) => Math.min(numStates - 1, Math.floor(((v - lo) / span) * numStates)));
}

function entropyRow(row: number[]): number {
  let h = 0;
  for (const p of row) if (p > 1e-12) h -= p * Math.log2(p);
  return h;
}

/**
 * Port of compute_effective_information():
 *   EI = H(⟨row⟩) − ⟨H(row)⟩  over the transition probability matrix
 * built from discretized state trajectories (Hoel-style determinism −
 * degeneracy balance). Returns bits ∈ [0, log2(numStates)].
 */
export function computeEffectiveInformation(stateTrajectory: number[], numStates = 8): number {
  if (stateTrajectory.length < 3) return 0;
  // _build_tpm
  const tpm: number[][] = Array.from({ length: numStates }, () => new Array(numStates).fill(0));
  for (let t = 0; t + 1 < stateTrajectory.length; t++) {
    const s = stateTrajectory[t], sn = stateTrajectory[t + 1];
    if (s >= 0 && s < numStates && sn >= 0 && sn < numStates) tpm[s][sn] += 1;
  }
  const validRows: number[][] = [];
  for (const row of tpm) {
    const total = row.reduce((a, v) => a + v, 0);
    if (total > 0) validRows.push(row.map((v) => v / total));
  }
  if (validRows.length === 0) return 0;

  const avgRow = new Array<number>(numStates).fill(0);
  for (const row of validRows) for (let j = 0; j < numStates; j++) avgRow[j] += row[j] / validRows.length;

  const hAvg = entropyRow(avgRow);
  const avgH = validRows.reduce((a, row) => a + entropyRow(row), 0) / validRows.length;
  return Math.max(0, hAvg - avgH);
}

// ── Φ̃-RIIU Surrogate (phi_riiu.py) ───────────────────────────────

export interface RIIUConfig {
  bufferSize: number;     // sliding window of latent vectors, default 64
  warmup: number;         // min samples before compute, default 8
}

export class RIIUPhi {
  readonly config: RIIUConfig;
  private buffer: number[][] = [];

  constructor(config?: Partial<RIIUConfig>) {
    this.config = { bufferSize: 64, warmup: 8, ...config };
  }

  /** Port of push(): append a latent vector z to the sliding buffer. */
  push(z: number[]): void {
    this.buffer.push([...z]);
    if (this.buffer.length > this.config.bufferSize) this.buffer.shift();
  }

  isWarm(): boolean { return this.buffer.length >= this.config.warmup; }
  size(): number { return this.buffer.length; }
  reset(): void { this.buffer = []; }

  /**
   * Port of compute_value(): integration ratio of the latent covariance.
   * Φ̃ = off-diagonal covariance energy / total covariance energy, i.e. the
   * share of variance that is *shared* across dimensions (integration)
   * rather than independent (segregation). Analytical surrogate for the
   * upstream learned low-rank Φ estimator. Returns ∈ [0, 1].
   */
  computeValue(): number {
    if (!this.isWarm()) return 0;
    const n = this.buffer.length;
    const d = this.buffer[0].length;
    const mean = new Array<number>(d).fill(0);
    for (const z of this.buffer) for (let j = 0; j < d; j++) mean[j] += z[j] / n;

    let diag = 0, off = 0;
    for (let a = 0; a < d; a++) {
      for (let b = a; b < d; b++) {
        let c = 0;
        for (const z of this.buffer) c += (z[a] - mean[a]) * (z[b] - mean[b]);
        c /= n;
        if (a === b) diag += Math.abs(c);
        else off += 2 * Math.abs(c);
      }
    }
    const total = diag + off;
    return total > 1e-12 ? off / total : 0;
  }
}
