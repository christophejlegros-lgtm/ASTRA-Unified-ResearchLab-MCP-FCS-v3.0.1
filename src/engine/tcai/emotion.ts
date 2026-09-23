/**
 * ASTRA × the_consciousness_ai — Emotional Processing & Reward Shaping
 * ═════════════════════════════════════════════════════════════════════
 * TypeScript port of:
 *   models/emotion/emotional_processing.py → EmotionalProcessor (PAD appraisal)
 *   models/emotion/reward_shaping.py       → EmotionalRewardShaper
 *   models/emotion/affective_modulator.py  → affect → workspace coupling
 *
 * The processor appraises raw signals into PAD space with inertia (EMA).
 * The shaper computes R_total = R_base + λ_e·R_emotional + λ_m·R_memory,
 * mirroring the upstream emotional RL formulation (LLaMA 3.3 fine-tuning
 * pipeline replaced here by the analytical appraisal — no GPU dependency).
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 * Upstream Python: © tlcdv/the_consciousness_ai (vendored in /python)
 */

import { type EmotionalState, clampEmotion } from './types.js';
import { type EmotionalMemoryCore } from './emotional-memory.js';

// ── Emotional Processor (PAD appraisal with inertia) ──────────────

export interface AppraisalInput {
  rewardSignal?: number;      // task feedback ∈ [−1, 1]
  novelty?: number;           // surprise/curiosity ∈ [0, 1]
  threat?: number;            // ∈ [0, 1]
  controllability?: number;   // ∈ [0, 1]
}

export class EmotionalProcessor {
  private state: EmotionalState = { valence: 0, arousal: 0.4, dominance: 0.5 };
  private inertia: number;
  private history: EmotionalState[] = [];

  constructor(inertia = 0.7) { this.inertia = Math.max(0, Math.min(0.99, inertia)); }

  /** Appraise raw signals → PAD update (emotional_processing.py). */
  appraise(input: AppraisalInput): EmotionalState {
    const reward = Math.max(-1, Math.min(1, input.rewardSignal ?? 0));
    const novelty = Math.max(0, Math.min(1, input.novelty ?? 0));
    const threat = Math.max(0, Math.min(1, input.threat ?? 0));
    const control = Math.max(0, Math.min(1, input.controllability ?? 0.5));

    const target = clampEmotion({
      valence: reward - 0.8 * threat + 0.2 * novelty * control,
      arousal: 0.3 + 0.5 * novelty + 0.6 * threat + 0.2 * Math.abs(reward),
      dominance: control * (1 - 0.5 * threat),
    });

    const a = this.inertia;
    this.state = clampEmotion({
      valence: a * this.state.valence + (1 - a) * target.valence,
      arousal: a * this.state.arousal + (1 - a) * target.arousal,
      dominance: a * this.state.dominance + (1 - a) * target.dominance,
    });
    this.history.push({ ...this.state });
    if (this.history.length > 200) this.history.shift();
    return { ...this.state };
  }

  getState(): EmotionalState { return { ...this.state }; }

  /** Emotional stability: 1 − mean recent PAD displacement (RewardMetrics). */
  stability(): number {
    const h = this.history.slice(-20);
    if (h.length < 2) return 1;
    let d = 0;
    for (let i = 1; i < h.length; i++) {
      d += Math.abs(h[i].valence - h[i - 1].valence)
         + Math.abs(h[i].arousal - h[i - 1].arousal)
         + Math.abs(h[i].dominance - h[i - 1].dominance);
    }
    return Math.max(0, 1 - d / (3 * (h.length - 1)));
  }

  reset(): void {
    this.state = { valence: 0, arousal: 0.4, dominance: 0.5 };
    this.history = [];
  }
}

// ── Emotional Reward Shaper (reward_shaping.py) ───────────────────

export interface RewardMetrics {
  baseReward: number;
  emotionalReward: number;
  memoryInfluence: number;
  totalReward: number;
  emotionalStability: number;
}

export interface ShaperConfig {
  lambdaEmotional: number;     // default 0.5
  lambdaMemory: number;        // default 0.3
  valenceWeight: number;       // default 0.7
  dominanceWeight: number;     // default 0.3
}

const DEFAULT_SHAPER: ShaperConfig = {
  lambdaEmotional: 0.5, lambdaMemory: 0.3, valenceWeight: 0.7, dominanceWeight: 0.3,
};

export class EmotionalRewardShaper {
  readonly config: ShaperConfig;
  private metricsHistory: RewardMetrics[] = [];

  constructor(config?: Partial<ShaperConfig>) {
    this.config = { ...DEFAULT_SHAPER, ...config };
  }

  /** Port of compute_reward(): base + emotional + memory-congruence terms. */
  computeReward(input: {
    baseReward: number;
    emotion: EmotionalState;
    stability: number;
    memory?: EmotionalMemoryCore;
    contextEmbedding?: number[];
  }): RewardMetrics {
    const { lambdaEmotional, lambdaMemory, valenceWeight, dominanceWeight } = this.config;
    const emo = clampEmotion(input.emotion);

    // Emotional reward: positive valence + agency, damped by instability
    const emotional =
      (valenceWeight * emo.valence + dominanceWeight * (emo.dominance - 0.5) * 2) *
      (0.5 + 0.5 * input.stability);

    // Memory influence (_calculate_memory_influence): mean signed congruence
    // of recalled experiences — past positive analogues reinforce, negative warn
    let memoryInfluence = 0;
    if (input.memory && input.contextEmbedding) {
      const hits = input.memory.retrieve({ embedding: input.contextEmbedding, emotion: emo, topK: 5 });
      if (hits.length > 0) {
        memoryInfluence = hits.reduce(
          (a, h) => a + h.record.emotionalContext.valence * h.score, 0,
        ) / hits.length;
      }
    }

    const total = input.baseReward + lambdaEmotional * emotional + lambdaMemory * memoryInfluence;
    const metrics: RewardMetrics = {
      baseReward: input.baseReward,
      emotionalReward: emotional,
      memoryInfluence,
      totalReward: total,
      emotionalStability: input.stability,
    };
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > 500) this.metricsHistory.shift();
    return metrics;
  }

  getMetricsHistory(): RewardMetrics[] { return [...this.metricsHistory]; }
}
