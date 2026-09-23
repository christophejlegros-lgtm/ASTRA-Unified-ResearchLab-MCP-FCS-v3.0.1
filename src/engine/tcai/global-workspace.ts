/**
 * ASTRA × the_consciousness_ai — Global Neuronal Workspace (GNW)
 * ═══════════════════════════════════════════════════════════════
 * TypeScript port of:
 *   models/core/global_workspace.py    → GlobalWorkspace
 *   models/core/qualia_mapper.py       → PhenomenologicalMapper
 *   models/core/consciousness_gating.py→ (sigmoid ignition + reverberation,
 *                                         folded into the workspace)
 *
 * Upgrades preserved from upstream:
 *   1. Sigmoid Ignition  — non-linear phase transition on winning bid
 *   2. Recurrent Reverberation — working-memory decay (α)
 *   3. Synchrony Binding — Kuramoto/AKOrN gating of bids (oscillatory-binding)
 *   4. Broadcast modes   — 'winner_take_all' | 'attention_weighted'
 *   5. Affective modulation — emotion biases bids and ignition threshold
 *
 * ⚠ Φ̃ here is a variance/coherence proxy on the broadcast vector,
 *   NOT IIT Φ (partition search is intractable). Research heuristic only.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 * Upstream Python: © tlcdv/the_consciousness_ai (vendored in /python)
 */

import {
  type WorkspaceMessage, type WorkspaceState, type CompetitionResult,
  type PhenomenologicalState, type EmotionalState,
} from './types.js';
import { WorkspaceBindingSystem } from './oscillatory-binding.js';

// ── Qualia Mapper (qualia_mapper.py) ──────────────────────────────

export class PhenomenologicalMapper {
  /** Map broadcast vector + goal vector → [Intensity, Valence, Complexity]. */
  mapState(workspaceVec: number[], goalVec: number[]): PhenomenologicalState {
    const n = workspaceVec.length || 1;
    const norm = Math.sqrt(workspaceVec.reduce((a, v) => a + v * v, 0));
    const intensity = Math.tanh(norm / Math.sqrt(n));

    // Valence: cosine alignment between broadcast and goal
    let dot = 0, gn = 0;
    const m = Math.min(workspaceVec.length, goalVec.length);
    for (let i = 0; i < m; i++) { dot += workspaceVec[i] * goalVec[i]; gn += goalVec[i] * goalVec[i]; }
    const valence = norm > 1e-9 && gn > 1e-9 ? dot / (norm * Math.sqrt(gn)) : 0;

    // Complexity: normalized spectral entropy of |components|
    const abs = workspaceVec.map(Math.abs);
    const sum = abs.reduce((a, v) => a + v, 0);
    let entropy = 0;
    if (sum > 1e-9) {
      for (const v of abs) {
        const p = v / sum;
        if (p > 1e-12) entropy -= p * Math.log(p);
      }
      entropy /= Math.log(n);
    }
    return { intensity, valence, complexity: entropy };
  }
}

// ── Global Workspace ──────────────────────────────────────────────

export interface GWConfig {
  ignitionThreshold: number;       // default 0.6
  ignitionGain: number;            // sigmoid steepness, default 10
  reverberationAlpha: number;      // working-memory decay, default 0.7
  maxHistory: number;              // default 100
  broadcastMode: 'winner_take_all' | 'attention_weighted';
  attentionTemperature: number;    // default 0.5
  attentionFloor: number;          // default 0.05
  workspaceDim: number;            // default 64 (256 upstream; SNN-scaled here)
  moduleNames: string[];
}

const DEFAULT_GW: GWConfig = {
  ignitionThreshold: 0.6,
  ignitionGain: 10.0,
  reverberationAlpha: 0.7,
  maxHistory: 100,
  broadcastMode: 'attention_weighted',
  attentionTemperature: 0.5,
  attentionFloor: 0.05,
  workspaceDim: 64,
  moduleNames: ['vision', 'audio', 'memory', 'body', 'semantic'],
};

export class GlobalWorkspace {
  readonly config: GWConfig;
  private binding: WorkspaceBindingSystem;
  private qualiaMapper = new PhenomenologicalMapper();
  private reverberation: number[] | null = null;
  private step_ = 0;
  state: WorkspaceState;
  /** Optional affective modulator hook (Tier 2): emotion → bid bias + threshold shift. */
  affectiveState: EmotionalState | null = null;

  constructor(config?: Partial<GWConfig>) {
    this.config = { ...DEFAULT_GW, ...config };
    this.binding = new WorkspaceBindingSystem(this.config.moduleNames.length);
    this.binding.registerModules(this.config.moduleNames);
    this.state = {
      activeContent: {}, accessHistory: [], broadcastStrength: 0,
      competitionResults: {}, phiValue: 0, isConscious: false,
      focusTopic: 'idle', qualiaVector: { intensity: 0, valence: 0, complexity: 0 },
      broadcastPayload: null, syncR: 0,
    };
  }

  /** Port of GlobalWorkspace.run_competition(). */
  runCompetition(messages: WorkspaceMessage[], goalVec?: number[]): CompetitionResult {
    this.step_++;
    const dim = this.config.workspaceDim;

    // 1 — Collect raw bids and payloads
    const bids: Record<string, number> = {};
    const payloads: Record<string, number[]> = {};
    for (const m of messages) {
      bids[m.source] = Math.max(bids[m.source] ?? 0, m.priority);
      payloads[m.source] = this.fitDim(m.content, dim);
    }

    // 2 — Affective modulation (affective_modulator.py): arousal sharpens
    //     competition, negative valence lowers ignition threshold (alarm bias)
    let threshold = this.config.ignitionThreshold;
    if (this.affectiveState) {
      const { valence, arousal } = this.affectiveState;
      for (const k of Object.keys(bids)) bids[k] = Math.min(1, bids[k] * (1 + 0.3 * arousal));
      threshold = Math.min(0.95, Math.max(0.2, threshold - 0.15 * Math.max(0, -valence)));
    }

    // 3 — Synchrony binding (AKOrN): gate bids by phase coherence
    const { boundBids, syncR } = this.binding.bindBids(bids);

    // 4 — Sigmoid ignition on max bound bid (non-linear phase transition)
    const maxBid = Math.max(0, ...Object.values(boundBids));
    const ignition = 1 / (1 + Math.exp(-this.config.ignitionGain * (maxBid - threshold)));
    const ignited = ignition >= 0.5;

    // 5 — Winner resolution
    const sorted = Object.entries(boundBids).sort((a, b) => b[1] - a[1]);
    const winners = ignited ? sorted.filter(([, v]) => v >= 0.8 * maxBid).map(([k]) => k) : [];

    // 6 — Broadcast assembly
    const broadcast = new Array<number>(dim).fill(0);
    if (ignited && sorted.length > 0) {
      if (this.config.broadcastMode === 'winner_take_all') {
        for (const w of winners) {
          const p = payloads[w];
          if (p) for (let i = 0; i < dim; i++) broadcast[i] += p[i] / winners.length;
        }
      } else {
        // attention_weighted: softmax over bound bids (Phase A retest plan)
        const eligible = sorted.filter(([, v]) => v >= this.config.attentionFloor);
        const t = this.config.attentionTemperature;
        const exps = eligible.map(([, v]) => Math.exp(v / t));
        const z = exps.reduce((a, v) => a + v, 0) || 1;
        eligible.forEach(([name], idx) => {
          const w = exps[idx] / z;
          const p = payloads[name];
          if (p) for (let i = 0; i < dim; i++) broadcast[i] += w * p[i];
        });
      }
    }

    // 7 — Recurrent reverberation (working memory)
    const a = this.config.reverberationAlpha;
    if (this.reverberation) {
      for (let i = 0; i < dim; i++) broadcast[i] = a * this.reverberation[i] + (1 - a) * broadcast[i];
    }
    this.reverberation = ignited || this.reverberation ? [...broadcast] : null;

    // 8 — Qualia + Φ̃ proxy on broadcast
    const qualia = this.qualiaMapper.mapState(broadcast, goalVec ?? new Array(dim).fill(1 / dim));
    const phiProxy = this.phiProxy(broadcast, syncR);

    // 9 — State update + history
    this.state = {
      activeContent: ignited ? Object.fromEntries(winners.map((w) => [w, payloads[w] ?? []])) : {},
      accessHistory: [...this.state.accessHistory, { step: this.step_, winners, ignition }]
        .slice(-this.config.maxHistory),
      broadcastStrength: ignition,
      competitionResults: boundBids,
      phiValue: phiProxy,
      isConscious: ignited,
      focusTopic: winners[0] ?? 'idle',
      qualiaVector: qualia,
      broadcastPayload: ignited ? broadcast : null,
      syncR,
    };

    return { winners, ignition, ignited, boundBids, syncR, broadcast, qualia, phiProxy, step: this.step_ };
  }

  /** Port of get_unity_metrics(): coherence of recent winner sequence. */
  getUnityMetrics(): { unity: number; stableFocus: boolean; focus: string; ignitionTrace: number[] } {
    const recent = this.state.accessHistory.slice(-10);
    const focusCounts = new Map<string, number>();
    for (const h of recent) for (const w of h.winners) focusCounts.set(w, (focusCounts.get(w) ?? 0) + 1);
    const top = [...focusCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const unity = recent.length > 0 && top ? top[1] / recent.length : 0;
    return {
      unity,
      stableFocus: unity >= 0.6,
      focus: top?.[0] ?? 'idle',
      ignitionTrace: recent.map((h) => h.ignition),
    };
  }

  reset(): void {
    this.binding.resetState();
    this.reverberation = null;
    this.step_ = 0;
    this.state.accessHistory = [];
    this.state.isConscious = false;
    this.state.broadcastStrength = 0;
    this.state.focusTopic = 'idle';
  }

  private fitDim(v: number[], dim: number): number[] {
    if (v.length === dim) return [...v];
    if (v.length > dim) return v.slice(0, dim);
    return [...v, ...new Array(dim - v.length).fill(0)];
  }

  /** Φ̃ proxy: broadcast information density × phase coherence. NOT IIT Φ. */
  private phiProxy(broadcast: number[], syncR: number): number {
    const n = broadcast.length || 1;
    const mean = broadcast.reduce((a, v) => a + v, 0) / n;
    const variance = broadcast.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
    const density = Math.tanh(Math.sqrt(variance) * 4);
    return Math.max(0, Math.min(1, 0.6 * density + 0.4 * syncR));
  }
}
