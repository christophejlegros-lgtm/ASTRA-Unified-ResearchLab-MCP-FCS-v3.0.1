/**
 * ASTRA — Reproducibility of the seeded random streams
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 *
 * Same seed ⇒ same SNN connectivity, same dynamics, same encoder outputs.
 * Different seed ⇒ different streams. Guards against a component quietly
 * reverting to an unseeded Math.random.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

import { reseed, random, seedInfo, DEFAULT_SEED } from '../src/utils/rng.js';
import { SNNEngine } from '../src/engine/snn.js';
import { MultimodalSensorPipeline, type AudioSegment } from '../src/engine/multimodal-sensors.js';

function snnRun(seed: number): { synapses: number; weights: string; trace: number[] } {
  reseed(seed);
  const snn = new SNNEngine();
  const trace: number[] = [];
  for (let i = 0; i < 40; i++) trace.push(snn.step());
  return {
    synapses: snn.getSynapseCount(),
    weights: JSON.stringify(snn.getWeightStats()),
    trace,
  };
}

function fixedAudio(): AudioSegment {
  const sr = 16000, n = 3200;
  const waveform = new Float64Array(n);
  for (let i = 0; i < n; i++) waveform[i] = Math.sin((2 * Math.PI * 440 * i) / sr);
  return { waveform, sampleRate: sr, duration: 200, channels: 1, timestamp: 0, source: 'test' };
}

function fusedZ(seed: number): number[] {
  reseed(seed);
  const pipeline = new MultimodalSensorPipeline({ latentDim: 32, visualPatchDim: 64, fusionHiddenDim: 64, visualMaxPatches: 16 });
  const fused = pipeline.process({ audio: fixedAudio(), timestamp: 0 }, new Float64Array(32).fill(0.3));
  return Array.from(fused.z);
}

describe('Seeded random streams', () => {
  after(() => reseed(DEFAULT_SEED));

  it('reports a 32-bit seed and its source', () => {
    const info = seedInfo();
    assert.equal(info.algorithm, 'mulberry32');
    assert.ok(Number.isInteger(info.seed) && info.seed >= 0 && info.seed <= 0xffffffff);
  });

  it('produces values in [0, 1)', () => {
    reseed(7);
    for (let i = 0; i < 10000; i++) {
      const x = random();
      assert.ok(x >= 0 && x < 1);
    }
  });

  it('same seed ⇒ identical SNN connectivity and dynamics', () => {
    assert.deepEqual(snnRun(12345), snnRun(12345));
  });

  it('different seed ⇒ different SNN connectivity', () => {
    assert.notEqual(snnRun(12345).weights, snnRun(54321).weights);
  });

  it('same seed ⇒ identical fused sensory embedding', () => {
    assert.deepEqual(fusedZ(99), fusedZ(99));
  });

  it('different seed ⇒ different (randomly initialised) encoder weights', () => {
    assert.notDeepEqual(fusedZ(99), fusedZ(100));
  });
});
