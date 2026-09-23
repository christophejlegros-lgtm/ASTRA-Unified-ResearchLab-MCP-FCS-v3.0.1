/**
 * ASTRA × the_consciousness_ai — Self Model & Attention Schema
 * ═════════════════════════════════════════════════════════════
 * TypeScript port of:
 *   models/self_model/self_representation_core.py → SelfRepresentationCore
 *   models/memory/attention_schema.py             → AttentionSchema (Graziano AST)
 *
 * Maintains interoceptive state (energy/stress/effort), an epistemic model
 * (uncertainty, learning progress), temporal continuity (similarity to the
 * previous self-snapshot) and confidence calibration from prediction
 * outcomes — the upstream "metacognitive substrate".
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 * Upstream Python: © tlcdv/the_consciousness_ai (vendored in /python)
 */

import { type EmotionalState, type SelfState, type AttentionFocus, clampEmotion } from './types.js';

// ── Attention Schema (attention_schema.py) ────────────────────────

export class AttentionSchema {
  private focus: AttentionFocus = { target: 'idle', intensity: 0, stability: 1 };
  private trace: string[] = [];

  update(target: string, intensity: number): AttentionFocus {
    this.trace.push(target);
    if (this.trace.length > 20) this.trace.shift();
    const same = this.trace.filter((t) => t === target).length;
    this.focus = {
      target,
      intensity: Math.max(0, Math.min(1, intensity)),
      stability: this.trace.length ? same / this.trace.length : 1,
    };
    return { ...this.focus };
  }

  getCurrentFocus(): AttentionFocus { return { ...this.focus }; }
}

// ── Self Representation Core ──────────────────────────────────────

export class SelfRepresentationCore {
  private state: SelfState;
  private prevSnapshot: SelfState | null = null;
  private calibrationEMA = 0.5;
  readonly attentionSchema = new AttentionSchema();

  constructor() {
    this.state = {
      interoceptive: { energy: 1.0, stress: 0.1, effort: 0.0 },
      epistemic: { uncertainty: 0.5, learningProgress: 0.0 },
      temporalContinuity: 1.0,
      confidenceCalibration: 0.5,
      emotional: { valence: 0, arousal: 0.4, dominance: 0.5 },
      performanceEMA: 0,
      updates: 0,
      lastTimestamp: Date.now(),
    };
  }

  /** Port of update_self_model(). */
  update(input: {
    emotionalState: EmotionalState;
    effort?: number;                 // ∈ [0, 1]
    predictionError?: number;        // WM surprise, ≥ 0
    predictionConfidence?: number;   // ∈ [0, 1]
    reward?: number;
    attentionTarget?: string;
    attentionIntensity?: number;
    timestamp?: number;
  }): SelfState {
    const prev = { ...this.state, interoceptive: { ...this.state.interoceptive },
      epistemic: { ...this.state.epistemic }, emotional: { ...this.state.emotional } };
    const emo = clampEmotion(input.emotionalState);
    const effort = Math.max(0, Math.min(1, input.effort ?? 0.2));

    // Interoception (_update_interoceptive_state): effort drains energy,
    // arousal + negative valence raise stress; both recover toward baseline
    const io = this.state.interoceptive;
    io.energy = Math.max(0, Math.min(1, io.energy - 0.05 * effort + 0.02 * (1 - effort)));
    const stressDrive = 0.5 * emo.arousal + 0.5 * Math.max(0, -emo.valence);
    io.stress = Math.max(0, Math.min(1, 0.8 * io.stress + 0.2 * stressDrive));
    io.effort = effort;

    // Epistemic model (_update_epistemic_model)
    if (input.predictionError !== undefined) {
      const u = Math.tanh(input.predictionError);
      const ep = this.state.epistemic;
      const prevU = ep.uncertainty;
      ep.uncertainty = 0.7 * ep.uncertainty + 0.3 * u;
      ep.learningProgress = Math.max(-1, Math.min(1, prevU - ep.uncertainty));
    }

    // Confidence calibration (_update_confidence_calibration):
    // confidence should track (1 − surprise); EMA of calibration error
    if (input.predictionConfidence !== undefined && input.predictionError !== undefined) {
      const realized = 1 - Math.tanh(input.predictionError);
      const calibErr = Math.abs(input.predictionConfidence - realized);
      this.calibrationEMA = 0.85 * this.calibrationEMA + 0.15 * (1 - calibErr);
      this.state.confidenceCalibration = this.calibrationEMA;
    }

    // Performance EMA (update_performance)
    if (input.reward !== undefined) {
      this.state.performanceEMA = 0.9 * this.state.performanceEMA + 0.1 * input.reward;
    }

    // Attention schema
    if (input.attentionTarget) {
      this.attentionSchema.update(input.attentionTarget, input.attentionIntensity ?? 0.5);
    }

    this.state.emotional = emo;
    this.state.updates++;
    this.state.lastTimestamp = input.timestamp ?? Date.now();

    // Temporal continuity (_calculate_state_similarity): cosine-like overlap
    // between consecutive self-snapshots
    this.state.temporalContinuity = this.snapshotSimilarity(prev, this.state);
    this.prevSnapshot = prev;

    return this.getCurrentState();
  }

  getCurrentState(): SelfState {
    return {
      ...this.state,
      interoceptive: { ...this.state.interoceptive },
      epistemic: { ...this.state.epistemic },
      emotional: { ...this.state.emotional },
    };
  }

  hasHistory(): boolean { return this.prevSnapshot !== null; }

  private snapshotSimilarity(a: SelfState, b: SelfState): number {
    const va = [a.interoceptive.energy, a.interoceptive.stress, a.epistemic.uncertainty,
      a.emotional.valence, a.emotional.arousal, a.emotional.dominance];
    const vb = [b.interoceptive.energy, b.interoceptive.stress, b.epistemic.uncertainty,
      b.emotional.valence, b.emotional.arousal, b.emotional.dominance];
    let d = 0;
    for (let i = 0; i < va.length; i++) d += Math.abs(va[i] - vb[i]);
    return Math.max(0, 1 - d / va.length);
  }
}
