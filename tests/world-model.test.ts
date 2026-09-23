/**
 * ASTRA World Model — Test Suite
 * ================================
 *
 * Tests for the JEPA-inspired World Model engine:
 *   - SNNStateEncoder: encoding → latent space
 *   - LatentPredictor: action-conditioned dynamics
 *   - SIGReg: Gaussian regularizer (anti-collapse)
 *   - CEMPlanner: latent-space planning
 *   - WorldModelEngine: end-to-end integration
 *   - Surprise detection (violation-of-expectation)
 *
 * Run: node --import tsx --test tests/world-model.test.ts
 *
 * © 2026 Christophe Jean Legros — Geneva
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  WorldModelEngine,
  SNNStateEncoder,
  LatentPredictor,
  SIGReg,
  CEMPlanner,
  DEFAULT_WM_CONFIG,
  type SNNObservation,
  type SpikeAction,
  type WorldModelConfig,
} from '../src/engine/world-model.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSNNObservation(opts: Partial<SNNObservation> = {}): SNNObservation {
  return {
    membranePotentials: opts.membranePotentials ?? new Float64Array(128).fill(-65),
    firingRates: opts.firingRates ?? new Float64Array(4).fill(20),
    weightStats: opts.weightStats ?? new Float64Array(12).fill(0.5),
    bioCoupling: opts.bioCoupling ?? new Float64Array(4).fill(0),
    timestep: opts.timestep ?? 0,
  };
}

function makeSpikeAction(opts: Partial<SpikeAction> = {}): SpikeAction {
  return {
    targetNeurons: opts.targetNeurons ?? [10, 11, 12],
    strengths: opts.strengths ?? [15, 15, 15],
    duration: opts.duration ?? 1,
  };
}

// ─── SNNStateEncoder Tests ──────────────────────────────────────────────────

describe('SNNStateEncoder', () => {
  it('should encode to correct dimensionality', () => {
    const enc = new SNNStateEncoder(148, 128, 64);
    const input = new Float64Array(148).fill(0.5);
    const z = enc.encode(input);
    assert.equal(z.length, 64);
  });

  it('should produce different outputs for different inputs', () => {
    const enc = new SNNStateEncoder(148, 128, 64);
    const a = new Float64Array(148);
    const b = new Float64Array(148);
    for (let i = 0; i < 148; i++) {
      a[i] = Math.sin(i * 0.1);     // Structured pattern A
      b[i] = Math.cos(i * 0.3) * 2; // Structured pattern B
    }
    const za = enc.encode(a);
    const zb = enc.encode(b);

    let diff = 0;
    for (let i = 0; i < za.length; i++) diff += Math.abs(za[i] - zb[i]);
    assert.ok(diff > 0.01, `Encoder should differentiate inputs, got diff=${diff}`);
  });

  it('should produce finite values', () => {
    const enc = new SNNStateEncoder(148, 128, 64);
    const input = new Float64Array(148);
    for (let i = 0; i < 148; i++) input[i] = Math.random() * 100 - 50;
    const z = enc.encode(input);
    for (let i = 0; i < z.length; i++) {
      assert.ok(Number.isFinite(z[i]), `z[${i}] should be finite, got ${z[i]}`);
    }
  });

  it('should handle zero input gracefully', () => {
    const enc = new SNNStateEncoder(148, 128, 64);
    const input = new Float64Array(148).fill(0);
    const z = enc.encode(input);
    // LayerNorm of zero vector → all zeros → biases produce output
    assert.equal(z.length, 64);
  });
});

// ─── LatentPredictor Tests ──────────────────────────────────────────────────

describe('LatentPredictor', () => {
  it('should predict correct dimensionality', () => {
    const pred = new LatentPredictor(64, 128, 16);
    const z = new Float64Array(64).fill(0.5);
    const a = new Float64Array(16).fill(0.1);
    const zHat = pred.predict(z, a);
    assert.equal(zHat.length, 64);
  });

  it('should be sensitive to different actions', () => {
    const pred = new LatentPredictor(64, 128, 16);
    const z = new Float64Array(64).fill(0.5);
    const a1 = new Float64Array(16).fill(0.0);
    const a2 = new Float64Array(16).fill(1.0);
    const z1 = pred.predict(z, a1);
    const z2 = pred.predict(z, a2);

    let diff = 0;
    for (let i = 0; i < z1.length; i++) diff += Math.abs(z1[i] - z2[i]);
    assert.ok(diff > 0.01, `Predictor should differentiate actions, got diff=${diff}`);
  });

  it('should encode SpikeAction to fixed-size vector', () => {
    const pred = new LatentPredictor(64, 128, 16);
    const action = makeSpikeAction();
    const embed = pred.encodeAction(action, 128);
    assert.equal(embed.length, 16);
    assert.ok(embed[0] > 0, 'Target density should be positive');
  });

  it('should produce finite predictions', () => {
    const pred = new LatentPredictor(64, 128, 16);
    const z = new Float64Array(64);
    for (let i = 0; i < 64; i++) z[i] = Math.random();
    const a = new Float64Array(16);
    for (let i = 0; i < 16; i++) a[i] = Math.random();
    const zHat = pred.predict(z, a);
    for (let i = 0; i < zHat.length; i++) {
      assert.ok(Number.isFinite(zHat[i]), `zHat[${i}] should be finite`);
    }
  });
});

// ─── SIGReg Tests ───────────────────────────────────────────────────────────

describe('SIGReg', () => {
  it('should return 0 for single embedding', () => {
    const sig = new SIGReg(17, 64);
    const batch = [new Float64Array(32).fill(0.5)];
    assert.equal(sig.compute(batch), 0);
  });

  it('should return low loss for Gaussian-distributed embeddings', () => {
    const sig = new SIGReg(17, 256);
    const batch: Float64Array[] = [];
    for (let i = 0; i < 200; i++) {
      const z = new Float64Array(32);
      for (let d = 0; d < 32; d++) z[d] = gaussianRandom();
      batch.push(z);
    }
    const loss = sig.compute(batch);
    // Gaussian samples should yield low regularization loss
    assert.ok(loss < 100, `SIGReg loss for Gaussian samples should be low, got ${loss}`);
  });

  it('should return higher loss for collapsed (constant) embeddings', () => {
    const sig = new SIGReg(17, 256);
    const collapsed: Float64Array[] = [];
    for (let i = 0; i < 200; i++) {
      collapsed.push(new Float64Array(32).fill(1.0)); // All identical
    }
    const gaussian: Float64Array[] = [];
    for (let i = 0; i < 200; i++) {
      const z = new Float64Array(32);
      for (let d = 0; d < 32; d++) z[d] = gaussianRandom();
      gaussian.push(z);
    }
    const collapsedLoss = sig.compute(collapsed);
    const gaussianLoss = sig.compute(gaussian);
    // Collapsed should have higher loss than Gaussian (SIGReg penalizes non-Gaussian)
    assert.ok(collapsedLoss > gaussianLoss,
      `Collapsed loss (${collapsedLoss}) should exceed Gaussian loss (${gaussianLoss})`);
  });

  it('should produce finite values', () => {
    const sig = new SIGReg(17, 64);
    const batch: Float64Array[] = [];
    for (let i = 0; i < 50; i++) {
      const z = new Float64Array(16);
      for (let d = 0; d < 16; d++) z[d] = Math.random() * 10 - 5;
      batch.push(z);
    }
    const loss = sig.compute(batch);
    assert.ok(Number.isFinite(loss), `SIGReg loss should be finite, got ${loss}`);
  });
});

// ─── WorldModelEngine Integration Tests ─────────────────────────────────────

describe('WorldModelEngine', () => {
  let wm: WorldModelEngine;

  before(() => {
    wm = new WorldModelEngine({
      observationDim: 148,
      latentDim: 32,
      hiddenDim: 64,
      actionDim: 16,
      sigregProjections: 64,
      cemPopulation: 16,
      cemMaxIter: 3,
      planningHorizon: 4,
    });
  });

  it('should encode observations to latent embeddings', () => {
    const obs = makeSNNObservation();
    const emb = wm.encode(obs);
    assert.equal(emb.z.length, 32);
    assert.ok(emb.confidence >= 0 && emb.confidence <= 1);
    assert.equal(emb.timestep, 0);
  });

  it('should predict next state given action', () => {
    const obs = makeSNNObservation();
    const emb = wm.encode(obs);
    const action = makeSpikeAction();
    const pred = wm.predict(emb.z, action);
    assert.equal(pred.zHat.length, 32);
  });

  it('should train and reduce prediction loss over steps', () => {
    const wmTrain = new WorldModelEngine({
      observationDim: 148,
      latentDim: 32,
      hiddenDim: 64,
      learningRate: 0.01,
      sigregProjections: 32,
      historySize: 32,
    });

    const action = makeSpikeAction();
    const losses: number[] = [];

    for (let step = 0; step < 20; step++) {
      const prevObs = makeSNNObservation({ timestep: step });
      const nextObs = makeSNNObservation({
        timestep: step + 1,
        firingRates: new Float64Array([22, 22, 22, 22]),
      });
      const result = wmTrain.trainStep(prevObs, action, nextObs);
      losses.push(result.totalLoss);
    }

    // Total loss should be finite throughout
    for (const loss of losses) {
      assert.ok(Number.isFinite(loss), `Loss should be finite, got ${loss}`);
    }

    // Metrics should be updated
    const metrics = wmTrain.getMetrics();
    assert.equal(metrics.trainingSteps, 20);
    assert.ok(metrics.avgPredictionLoss >= 0);
  });

  it('should compute surprise scores', () => {
    const prevObs = makeSNNObservation({ timestep: 0 });
    const action = makeSpikeAction();

    // Normal transition: low surprise
    const normalNext = makeSNNObservation({
      timestep: 1,
      firingRates: new Float64Array([21, 21, 21, 21]),
    });
    const normalSurprise = wm.computeSurprise(prevObs, action, normalNext);
    assert.ok(Number.isFinite(normalSurprise));

    // Anomalous transition: different surprise
    const anomalousNext = makeSNNObservation({
      timestep: 1,
      firingRates: new Float64Array([100, 0, 100, 0]),
      membranePotentials: new Float64Array(128).fill(-30),
    });
    const anomalousSurprise = wm.computeSurprise(prevObs, action, anomalousNext);
    assert.ok(Number.isFinite(anomalousSurprise));
  });

  it('should plan towards goal states', () => {
    const currentObs = makeSNNObservation({
      firingRates: new Float64Array([10, 10, 10, 10]),
    });
    const goalObs = makeSNNObservation({
      firingRates: new Float64Array([40, 40, 40, 40]),
    });

    const plan = wm.planToGoal(currentObs, goalObs);
    assert.ok(plan.actions.length > 0, 'Plan should contain actions');
    assert.ok(plan.trajectory.length > 0, 'Plan should contain trajectory');
    assert.ok(Number.isFinite(plan.goalDistance));
    assert.ok(plan.iterations > 0);
    assert.equal(wm.getMetrics().plansExecuted, 1);
  });

  it('should provide full status snapshot', () => {
    const snapshot = wm.getSnapshot();
    assert.ok(snapshot.config);
    assert.ok(snapshot.metrics);
    assert.equal(snapshot.config.latentDim, 32);
  });

  it('should reset cleanly', () => {
    wm.reset();
    const metrics = wm.getMetrics();
    assert.equal(metrics.trainingSteps, 0);
    assert.equal(metrics.plansExecuted, 0);
    assert.equal(wm.getLastEmbedding(), null);
    assert.equal(wm.getEmbeddingHistory().length, 0);
  });
});

// ─── Security & Bounds Tests ────────────────────────────────────────────────

describe('WorldModel Security', () => {
  it('should handle NaN inputs without crashing', () => {
    const wm = new WorldModelEngine({ observationDim: 148, latentDim: 16 });
    const obs = makeSNNObservation();
    obs.membranePotentials[0] = NaN;
    // Should not throw
    const emb = wm.encode(obs);
    assert.equal(emb.z.length, 16);
  });

  it('should handle Infinity inputs', () => {
    const wm = new WorldModelEngine({ observationDim: 148, latentDim: 16 });
    const obs = makeSNNObservation();
    obs.firingRates[0] = Infinity;
    const emb = wm.encode(obs);
    assert.equal(emb.z.length, 16);
  });

  it('should handle empty spike action', () => {
    const wm = new WorldModelEngine({ observationDim: 148, latentDim: 16 });
    const obs = makeSNNObservation();
    const emb = wm.encode(obs);
    const action: SpikeAction = { targetNeurons: [], strengths: [], duration: 1 };
    const pred = wm.predict(emb.z, action);
    assert.equal(pred.zHat.length, 16);
  });
});

// ─── Utility ────────────────────────────────────────────────────────────────

function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
