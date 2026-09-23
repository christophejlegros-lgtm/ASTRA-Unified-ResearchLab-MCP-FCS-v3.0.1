/**
 * ASTRA v2.2 — TCAI Integration Test Suite
 * Tests the TypeScript port of tlcdv/the_consciousness_ai:
 * oscillatory binding, GNW workspace, emotional memory, reward shaping,
 * self-model, metrics, and full-cycle orchestration.
 *
 * © 2026 Christophe Jean Legros — Geneva
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { KuramotoLayer, WorkspaceBindingSystem } from '../src/engine/tcai/oscillatory-binding.js';
import { GlobalWorkspace, PhenomenologicalMapper } from '../src/engine/tcai/global-workspace.js';
import { EmotionalMemoryCore, cosineSimilarity } from '../src/engine/tcai/emotional-memory.js';
import { EmotionalProcessor, EmotionalRewardShaper } from '../src/engine/tcai/emotion.js';
import { SelfRepresentationCore, AttentionSchema } from '../src/engine/tcai/self-model.js';
import {
  GNWMetrics, RIIUPhi, computeEffectiveInformation, discretizeContinuous,
} from '../src/engine/tcai/metrics.js';
import { TCAIConsciousnessSystem } from '../src/engine/tcai/acm-bridge.js';

// ── Oscillatory Binding ───────────────────────────────────────────

describe('TCAI · Oscillatory Binding (Kuramoto/AKOrN)', () => {
  test('order parameter stays in [0,1] and rises under strong uniform coupling', () => {
    const layer = new KuramotoLayer(8, 6.0, 0.1);
    const r0 = layer.orderParameter();
    for (let i = 0; i < 200; i++) layer.step(new Array(8).fill(1));
    const r1 = layer.orderParameter();
    assert.ok(r0 >= 0 && r0 <= 1);
    assert.ok(r1 >= 0 && r1 <= 1);
    assert.ok(r1 > r0, `expected synchronization to increase R (${r0} → ${r1})`);
  });

  test('bindBids returns gated bids for all registered modules + syncR', () => {
    const bs = new WorkspaceBindingSystem(5);
    bs.registerModules(['vision', 'audio', 'memory', 'body', 'semantic']);
    const { boundBids, syncR } = bs.bindBids({ vision: 0.9, audio: 0.4, memory: 0.2, body: 0.1, semantic: 0.5 });
    assert.equal(Object.keys(boundBids).length, 5);
    assert.ok(syncR >= 0 && syncR <= 1);
    for (const v of Object.values(boundBids)) assert.ok(v >= 0 && v <= 1);
    assert.ok(boundBids['vision'] > boundBids['body'], 'ordering of dominant bid preserved');
  });
});

// ── Global Workspace ──────────────────────────────────────────────

describe('TCAI · Global Neuronal Workspace', () => {
  const strongMessages = (t = 0) => ['vision', 'audio', 'memory', 'body', 'semantic'].map((s, i) => ({
    source: s,
    content: Array.from({ length: 64 }, (_, j) => Math.sin(0.1 * j * (i + 1))),
    priority: s === 'vision' ? 0.95 : 0.3,
    timestamp: t,
  }));

  test('high bid triggers sigmoid ignition and a winner', () => {
    const gw = new GlobalWorkspace();
    let lastIgnited = false;
    for (let i = 0; i < 5; i++) lastIgnited = gw.runCompetition(strongMessages(i)).ignited;
    assert.ok(lastIgnited, 'workspace should ignite under a dominant bid');
    assert.ok(gw.state.focusTopic !== 'idle');
    assert.ok(gw.state.broadcastPayload !== null);
  });

  test('low bids fail to ignite (no conscious access)', () => {
    const gw = new GlobalWorkspace();
    const weak = strongMessages().map((m) => ({ ...m, priority: 0.05 }));
    const res = gw.runCompetition(weak);
    assert.equal(res.ignited, false);
    assert.equal(res.winners.length, 0);
  });

  test('qualia vector components are bounded', () => {
    const mapper = new PhenomenologicalMapper();
    const q = mapper.mapState([0.5, -0.3, 0.8, 0.1], [1, 1, 1, 1]);
    assert.ok(q.intensity >= 0 && q.intensity <= 1);
    assert.ok(q.valence >= -1 && q.valence <= 1);
    assert.ok(q.complexity >= 0 && q.complexity <= 1);
  });

  test('unity metrics report stable focus under repeated winner', () => {
    const gw = new GlobalWorkspace();
    for (let i = 0; i < 10; i++) gw.runCompetition(strongMessages(i));
    const u = gw.getUnityMetrics();
    assert.equal(u.focus, 'vision');
    assert.ok(u.unity > 0.5);
  });
});

// ── Emotional Memory ──────────────────────────────────────────────

describe('TCAI · Emotional Memory Core', () => {
  test('attention gate blocks low-attention storage', () => {
    const mem = new EmotionalMemoryCore();
    const res = mem.store({ embedding: [1, 0, 0], emotionalContext: { valence: 0.5 }, attentionLevel: 0.01 });
    assert.equal(res.stored, false);
  });

  test('store + retrieve ranks by similarity, congruence and salience', () => {
    const mem = new EmotionalMemoryCore();
    mem.store({ narrative: 'joyful A', embedding: [1, 0, 0, 0], emotionalContext: { valence: 0.9, arousal: 0.8 }, attentionLevel: 0.9 });
    mem.store({ narrative: 'neutral B', embedding: [0, 1, 0, 0], emotionalContext: { valence: 0.0, arousal: 0.2 }, attentionLevel: 0.5 });
    mem.store({ narrative: 'fearful C', embedding: [0, 0, 1, 0], emotionalContext: { valence: -0.8, arousal: 0.9 }, attentionLevel: 0.9 });
    const hits = mem.retrieve({ embedding: [1, 0.1, 0, 0], emotion: { valence: 0.8, arousal: 0.7 }, topK: 3 });
    assert.equal(hits.length, 3);
    assert.equal(hits[0].record.narrative, 'joyful A');
    assert.ok(hits[0].score > hits[2].score);
  });

  test('capacity eviction removes lowest-salience records', () => {
    const mem = new EmotionalMemoryCore({ capacity: 5 });
    for (let i = 0; i < 10; i++) {
      mem.store({ embedding: [i, 1], emotionalContext: { valence: i / 10, arousal: i / 10 }, attentionLevel: 0.9 });
    }
    assert.equal(mem.stats().count, 5);
    assert.ok(mem.stats().meanSalience > 0.1, 'high-salience records retained');
  });

  test('salience-weighted RL batch is deterministic and unique', () => {
    const mem = new EmotionalMemoryCore();
    for (let i = 0; i < 8; i++) {
      mem.store({ embedding: [i], emotionalContext: { valence: 0.5, arousal: 0.7 }, attentionLevel: 0.8 });
    }
    const batch = mem.retrieveBatchForRL(4);
    assert.equal(batch.length, 4);
    assert.equal(new Set(batch.map((r) => r.id)).size, 4);
  });

  test('cosineSimilarity sanity', () => {
    assert.ok(Math.abs(cosineSimilarity([1, 0], [1, 0]) - 1) < 1e-9);
    assert.ok(Math.abs(cosineSimilarity([1, 0], [0, 1])) < 1e-9);
  });
});

// ── Emotion & Reward Shaping ──────────────────────────────────────

describe('TCAI · Emotional Processing & Reward Shaping', () => {
  test('appraisal maps reward/threat into PAD with inertia', () => {
    const ep = new EmotionalProcessor(0.5);
    const e1 = ep.appraise({ rewardSignal: 1.0, novelty: 0.2, controllability: 0.9 });
    assert.ok(e1.valence > 0);
    const e2 = ep.appraise({ threat: 1.0, rewardSignal: -0.5 });
    assert.ok(e2.valence < e1.valence, 'threat should depress valence');
    assert.ok(e2.arousal > 0.4, 'threat should raise arousal');
  });

  test('shaped reward includes emotional and memory terms', () => {
    const ep = new EmotionalProcessor(0.3);
    const shaper = new EmotionalRewardShaper();
    const mem = new EmotionalMemoryCore();
    mem.store({ embedding: [1, 1, 1, 1], emotionalContext: { valence: 0.9, arousal: 0.6 }, attentionLevel: 0.9 });
    const emotion = ep.appraise({ rewardSignal: 0.8, controllability: 0.8 });
    const m = shaper.computeReward({
      baseReward: 1.0, emotion, stability: ep.stability(),
      memory: mem, contextEmbedding: [1, 1, 1, 1],
    });
    assert.ok(m.totalReward > m.baseReward, 'positive emotion + congruent memory should amplify reward');
    assert.ok(m.memoryInfluence > 0);
    assert.equal(shaper.getMetricsHistory().length, 1);
  });
});

// ── Self Model ────────────────────────────────────────────────────

describe('TCAI · Self Model & Attention Schema', () => {
  test('effort drains energy; stress tracks negative arousal', () => {
    const sm = new SelfRepresentationCore();
    const s = sm.update({
      emotionalState: { valence: -0.8, arousal: 0.9, dominance: 0.3 },
      effort: 1.0, predictionError: 1.5, predictionConfidence: 0.9, reward: -0.5,
      attentionTarget: 'threat-source', attentionIntensity: 0.9,
    });
    assert.ok(s.interoceptive.energy < 1.0);
    assert.ok(s.interoceptive.stress > 0.1);
    assert.ok(s.epistemic.uncertainty > 0.5);
    assert.ok(s.temporalContinuity >= 0 && s.temporalContinuity <= 1);
    assert.equal(sm.attentionSchema.getCurrentFocus().target, 'threat-source');
  });

  test('attention schema stability reflects focus persistence', () => {
    const as = new AttentionSchema();
    for (let i = 0; i < 5; i++) as.update('vision', 0.8);
    assert.equal(as.getCurrentFocus().stability, 1);
    as.update('audio', 0.5);
    assert.ok(as.getCurrentFocus().stability < 1);
  });
});

// ── Metrics ───────────────────────────────────────────────────────

describe('TCAI · Consciousness Metrics', () => {
  test('GNW metrics accumulate ignition and broadcast availability', () => {
    const m = new GNWMetrics(0.5);
    m.update(0.9, true); m.update(0.2, false); m.update(0.8, true); m.logReuse();
    const r = m.report();
    assert.equal(r.steps, 3);
    assert.equal(r.ignitionEvents, 2);
    assert.ok(Math.abs(r.broadcastAvailability - 2 / 3) < 1e-9);
    assert.equal(r.reuseEvents, 1);
  });

  test('effective information: deterministic cycle > random walk', () => {
    const det: number[] = [];
    for (let i = 0; i < 200; i++) det.push(i % 8);
    const rnd: number[] = [];
    let s = 123;
    for (let i = 0; i < 200; i++) { s = (s * 1103515245 + 12345) % 2 ** 31; rnd.push(s % 8); }
    const eiDet = computeEffectiveInformation(det, 8);
    const eiRnd = computeEffectiveInformation(rnd, 8);
    assert.ok(eiDet > eiRnd, `deterministic TPM should carry more EI (${eiDet} vs ${eiRnd})`);
    assert.ok(eiDet <= 3.0001, 'EI bounded by log2(8)=3 bits');
  });

  test('discretizeContinuous maps range onto [0, n−1]', () => {
    const d = discretizeContinuous([0, 0.5, 1.0], 4);
    assert.equal(d[0], 0);
    assert.equal(d[2], 3);
  });

  test('Φ̃-RIIU: correlated latents > independent-ish latents', () => {
    const corr = new RIIUPhi();
    const indep = new RIIUPhi();
    let s = 7;
    const rng = () => { s = (s * 1103515245 + 12345) % 2 ** 31; return s / 2 ** 31; };
    for (let i = 0; i < 32; i++) {
      const base = rng();
      corr.push([base, base * 0.9 + 0.05, base * 1.1 - 0.05, base]);
      indep.push([rng(), rng(), rng(), rng()]);
    }
    assert.ok(corr.isWarm() && indep.isWarm());
    assert.ok(corr.computeValue() > indep.computeValue(),
      'shared variance should yield higher integration proxy');
  });
});

// ── Full Cycle Orchestration ──────────────────────────────────────

describe('TCAI · Consciousness System (full cycle)', () => {
  test('runCycle wires workspace → emotion → reward → memory → self', () => {
    const sys = new TCAIConsciousnessSystem();
    const signals = {
      vision: Array.from({ length: 64 }, (_, j) => Math.sin(0.2 * j)),
      audio: Array.from({ length: 64 }, (_, j) => 0.3 * Math.cos(0.1 * j)),
      memory: new Array(64).fill(0.1),
      body: new Array(64).fill(0.05),
      semantic: Array.from({ length: 64 }, (_, j) => 0.4 * Math.sin(0.05 * j + 1)),
    };
    let res = sys.runCycle({ signals, rewardSignal: 0.7, novelty: 0.6, predictionError: 0.4, predictionConfidence: 0.7 });
    for (let i = 0; i < 9; i++) {
      res = sys.runCycle({ signals, rewardSignal: 0.7, novelty: 0.3, predictionError: 0.2, predictionConfidence: 0.8 });
    }
    assert.equal(sys.getCycles(), 10);
    assert.ok(res.competition.syncR >= 0 && res.competition.syncR <= 1);
    assert.ok(res.emotion.valence > 0, 'sustained positive reward → positive valence');
    assert.ok(res.phiRIIU >= 0 && res.phiRIIU <= 1);
    assert.ok(res.selfContinuity > 0.5, 'stable input → high temporal continuity');
  });

  test('report() produces bounded composite with disclaimer', () => {
    const sys = new TCAIConsciousnessSystem();
    const signals = { vision: Array.from({ length: 64 }, (_, j) => Math.sin(0.3 * j)) };
    for (let i = 0; i < 12; i++) sys.runCycle({ signals, rewardSignal: 0.5 });
    const rep = sys.report();
    assert.ok(rep.composite >= 0 && rep.composite <= 1);
    assert.ok(rep.gnw.steps === 12);
    assert.ok(rep.disclaimer.toLowerCase().includes('proxies'));
  });

  test('reset clears all subsystems', () => {
    const sys = new TCAIConsciousnessSystem();
    sys.runCycle({ signals: { vision: [1, 2, 3] }, rewardSignal: 0.5 });
    sys.reset();
    assert.equal(sys.getCycles(), 0);
    assert.equal(sys.memory.stats().count, 0);
    assert.equal(sys.gnwMetrics.report().steps, 0);
  });
});
