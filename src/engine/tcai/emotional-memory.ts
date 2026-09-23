/**
 * ASTRA × the_consciousness_ai — Emotional Memory Core
 * ═════════════════════════════════════════════════════
 * TypeScript port of:
 *   models/memory/emotional_memory_core.py → EmotionalMemoryCore
 *   models/memory/emotional_indexing.py    → salience indexing / PAD congruence
 *   models/memory/optimized_store.py       → capacity-bounded store w/ eviction
 *
 * Experiences are indexed by PAD emotional context and a feature embedding.
 * Retrieval blends cosine similarity, emotional congruence and salience
 * (somatic-marker style), supporting both contextual recall and RL batches.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 * Upstream Python: © tlcdv/the_consciousness_ai (vendored in /python)
 */

import {
  type EmotionalState, type MemoryRecord, type RetrievalHit, clampEmotion,
} from './types.js';

export function cosineSimilarity(a: number[], b: number[]): number {
  const m = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < m; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na < 1e-12 || nb < 1e-12) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface EmotionalMemoryConfig {
  capacity: number;             // max records (eviction: lowest salience first)
  attentionGate: number;        // min attention for storage, default 0.15
  wSimilarity: number;          // retrieval blend weights
  wEmotion: number;
  wSalience: number;
}

const DEFAULT_MEM: EmotionalMemoryConfig = {
  capacity: 500, attentionGate: 0.15,
  wSimilarity: 0.5, wEmotion: 0.3, wSalience: 0.2,
};

export class EmotionalMemoryCore {
  readonly config: EmotionalMemoryConfig;
  private records: MemoryRecord[] = [];
  private nextId = 1;

  constructor(config?: Partial<EmotionalMemoryConfig>) {
    this.config = { ...DEFAULT_MEM, ...config };
  }

  /** Port of store_experience(): attention-gated, salience-indexed storage. */
  store(input: {
    narrative?: string;
    embedding: number[];
    emotionalContext: Partial<EmotionalState>;
    attentionLevel?: number;
    timestamp?: number;
  }): { stored: boolean; record?: MemoryRecord; reason?: string } {
    const attention = Math.max(0, Math.min(1, input.attentionLevel ?? 0.5));
    if (attention < this.config.attentionGate) {
      return { stored: false, reason: `attention ${attention.toFixed(2)} below gate ${this.config.attentionGate}` };
    }
    const emo = clampEmotion(input.emotionalContext);
    // Salience: emotional intensity weighted by attention (emotional_indexing.py)
    const salience = Math.min(1, (0.5 * Math.abs(emo.valence) + 0.5 * emo.arousal) * (0.5 + 0.5 * attention));
    const record: MemoryRecord = {
      id: this.nextId++,
      timestamp: input.timestamp ?? Date.now(),
      narrative: input.narrative ?? '',
      embedding: [...input.embedding],
      emotionalContext: emo,
      attentionLevel: attention,
      salience,
      accessCount: 0,
    };
    this.records.push(record);
    // Capacity eviction (optimized_store.py): drop lowest-salience, oldest first
    if (this.records.length > this.config.capacity) {
      this.records.sort((a, b) => a.salience - b.salience || a.timestamp - b.timestamp);
      this.records = this.records.slice(this.records.length - this.config.capacity);
    }
    return { stored: true, record };
  }

  /** Port of retrieve(): blended contextual + emotional + salience recall. */
  retrieve(query: {
    embedding?: number[];
    emotion?: Partial<EmotionalState>;
    topK?: number;
  }): RetrievalHit[] {
    const k = Math.max(1, Math.min(query.topK ?? 5, 25));
    const qEmo = query.emotion ? clampEmotion(query.emotion) : null;
    const { wSimilarity, wEmotion, wSalience } = this.config;

    const hits: RetrievalHit[] = this.records.map((r) => {
      const sim = query.embedding ? cosineSimilarity(query.embedding, r.embedding) : 0;
      let congr = 0.5;
      if (qEmo) {
        const dv = (qEmo.valence - r.emotionalContext.valence) / 2;
        const da = qEmo.arousal - r.emotionalContext.arousal;
        const dd = qEmo.dominance - r.emotionalContext.dominance;
        congr = 1 - Math.sqrt((dv * dv + da * da + dd * dd) / 3);
      }
      const score = wSimilarity * Math.max(0, sim) + wEmotion * congr + wSalience * r.salience;
      return { record: r, similarity: sim, emotionalCongruence: congr, score };
    });

    hits.sort((a, b) => b.score - a.score);
    const top = hits.slice(0, k);
    for (const h of top) h.record.accessCount++;
    return top;
  }

  /** Port of retrieve_batch_for_rl(): salience-weighted sampling for replay. */
  retrieveBatchForRL(batchSize: number, seed = 7): MemoryRecord[] {
    if (this.records.length === 0) return [];
    const n = Math.min(batchSize, this.records.length);
    let s = seed >>> 0;
    const rng = () => {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const total = this.records.reduce((a, r) => a + r.salience + 0.05, 0);
    const out: MemoryRecord[] = [];
    const used = new Set<number>();
    let guard = 0;
    while (out.length < n && guard++ < n * 20) {
      let x = rng() * total;
      for (const r of this.records) {
        x -= r.salience + 0.05;
        if (x <= 0) {
          if (!used.has(r.id)) { used.add(r.id); out.push(r); }
          break;
        }
      }
    }
    return out;
  }

  stats(): { count: number; capacity: number; meanSalience: number; meanValence: number; meanArousal: number } {
    const n = this.records.length;
    const mean = (f: (r: MemoryRecord) => number) => (n ? this.records.reduce((a, r) => a + f(r), 0) / n : 0);
    return {
      count: n, capacity: this.config.capacity,
      meanSalience: mean((r) => r.salience),
      meanValence: mean((r) => r.emotionalContext.valence),
      meanArousal: mean((r) => r.emotionalContext.arousal),
    };
  }

  clear(): void { this.records = []; this.nextId = 1; }
}
