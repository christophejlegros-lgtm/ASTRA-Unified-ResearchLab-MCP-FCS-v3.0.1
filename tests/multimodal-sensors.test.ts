/**
 * ASTRA — Multimodal Sensor Tests
 * ════════════════════════════════
 * Run: node --import tsx --test tests/multimodal-sensors.test.ts
 * © 2026 Christophe Jean Legros — Geneva
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  VJEPAEncoder,
  AJEPAEncoder,
  KonikuOlfactoryEncoder,
  CrossModalFusion,
  MultimodalSensorPipeline,
  DEFAULT_SENSOR_CONFIG,
  type ImageFrame,
  type VideoClip,
  type AudioSegment,
  type OlfactoryReading,
} from '../src/engine/multimodal-sensors.js';

// ─── Factories ──────────────────────────────────────────────────────────────

function makeFrame(w = 64, h = 64, c = 3): ImageFrame {
  const pixels = new Float64Array(w * h * c);
  for (let i = 0; i < pixels.length; i++) pixels[i] = Math.random();
  return { pixels, width: w, height: h, channels: c, timestamp: Date.now(), source: 'test' };
}

function makeAudio(sampleRate = 16000, durationMs = 500): AudioSegment {
  const n = Math.floor(sampleRate * durationMs / 1000);
  const waveform = new Float64Array(n);
  for (let i = 0; i < n; i++) waveform[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
  return { waveform, sampleRate, duration: durationMs, channels: 1, timestamp: Date.now(), source: 'test' };
}

function makeOlfactory(nR = 64): OlfactoryReading {
  const activations = new Float64Array(nR);
  const concentrations = new Float64Array(nR);
  for (let i = 0; i < nR; i++) {
    activations[i] = Math.random() * 0.5;
    concentrations[i] = Math.random() * 200;
  }
  return {
    receptorActivations: activations,
    numReceptors: nR,
    detectedCompounds: ['ethanol', 'acetone'],
    concentrations,
    temporalPhase: 'sustained',
    deviceState: 'active',
    neuronViability: 94,
    timestamp: Date.now(),
  };
}

// ─── V-JEPA 2 Encoder Tests ────────────────────────────────────────────────

describe('VJEPAEncoder', () => {
  const config = { ...DEFAULT_SENSOR_CONFIG, latentDim: 32, visualPatchDim: 64, visualMaxPatches: 16 };

  it('should encode a single frame to correct latent dim', () => {
    const enc = new VJEPAEncoder(config);
    const frame = makeFrame(64, 64, 3);
    const emb = enc.encodeFrame(frame);
    assert.equal(emb.z.length, 32);
    assert.equal(emb.modality, 'visual');
    assert.ok(emb.confidence >= 0);
  });

  it('should encode video with temporal aggregation', () => {
    const enc = new VJEPAEncoder(config);
    const frames = Array.from({ length: 4 }, () => makeFrame(64, 64, 3));
    const clip: VideoClip = { frames, fps: 30, duration: 133 };
    const emb = enc.encodeVideo(clip);
    assert.equal(emb.z.length, 32);
    assert.ok(emb.metadata.frames === 4);
  });

  it('should produce different embeddings for different images', () => {
    const enc = new VJEPAEncoder(config);
    const a = makeFrame(64, 64, 3);
    const b = makeFrame(64, 64, 3);
    // Make structurally different
    for (let i = 0; i < 100; i++) { a.pixels[i] = 0; b.pixels[i] = 1; }
    const za = enc.encodeFrame(a);
    const zb = enc.encodeFrame(b);
    let diff = 0;
    for (let i = 0; i < za.z.length; i++) diff += Math.abs(za.z[i] - zb.z[i]);
    assert.ok(diff > 0.001, `Should differentiate images, diff=${diff}`);
  });

  it('should produce finite values', () => {
    const enc = new VJEPAEncoder(config);
    const emb = enc.encodeFrame(makeFrame());
    for (let i = 0; i < emb.z.length; i++) {
      assert.ok(Number.isFinite(emb.z[i]), `z[${i}] should be finite`);
    }
  });
});

// ─── A-JEPA Encoder Tests ───────────────────────────────────────────────────

describe('AJEPAEncoder', () => {
  const config = { ...DEFAULT_SENSOR_CONFIG, latentDim: 32, visualPatchDim: 64 };

  it('should encode audio to correct latent dim', () => {
    const enc = new AJEPAEncoder(config);
    const audio = makeAudio(16000, 500);
    const emb = enc.encode(audio);
    assert.equal(emb.z.length, 32);
    assert.equal(emb.modality, 'audio');
  });

  it('should compute mel spectrogram', () => {
    const enc = new AJEPAEncoder(config);
    const audio = makeAudio(16000, 200);
    const mel = enc.getLastMel(audio);
    assert.equal(mel.melBins, 128);
    assert.ok(mel.timeFrames > 0);
    assert.ok(mel.data.length > 0);
  });

  it('should update EMA target encoder', () => {
    const enc = new AJEPAEncoder(config);
    enc.encode(makeAudio());
    enc.encode(makeAudio());
    // Just verify it doesn't crash with EMA updates
    const emb = enc.encode(makeAudio());
    assert.ok(emb.metadata.emaStep >= 2);
  });

  it('should produce finite values for various durations', () => {
    const enc = new AJEPAEncoder(config);
    for (const dur of [50, 200, 1000]) {
      const emb = enc.encode(makeAudio(16000, dur));
      for (let i = 0; i < emb.z.length; i++) {
        assert.ok(Number.isFinite(emb.z[i]), `z[${i}] finite at ${dur}ms`);
      }
    }
  });
});

// ─── Koniku Olfactory Encoder Tests ─────────────────────────────────────────

describe('KonikuOlfactoryEncoder', () => {
  const config = { ...DEFAULT_SENSOR_CONFIG, latentDim: 32, fusionHiddenDim: 64 };

  it('should encode olfactory reading to correct latent dim', () => {
    const enc = new KonikuOlfactoryEncoder(config);
    const reading = makeOlfactory();
    const emb = enc.encode(reading);
    assert.equal(emb.z.length, 32);
    assert.equal(emb.modality, 'olfactory');
  });

  it('should scale confidence with neuron viability', () => {
    const enc = new KonikuOlfactoryEncoder(config);
    const high = makeOlfactory(); high.neuronViability = 98;
    const low = makeOlfactory(); low.neuronViability = 50;
    // Same activations but different viability
    low.receptorActivations = new Float64Array(high.receptorActivations);
    const embHigh = enc.encode(high);
    enc.resetHistory();
    const embLow = enc.encode(low);
    // Lower viability → lower confidence
    assert.ok(embLow.confidence <= embHigh.confidence + 0.01,
      `Low viability confidence (${embLow.confidence}) should be ≤ high (${embHigh.confidence})`);
  });

  it('should handle inactive device gracefully', () => {
    const enc = new KonikuOlfactoryEncoder(config);
    const reading = makeOlfactory();
    reading.deviceState = 'error';
    const emb = enc.encode(reading);
    assert.equal(emb.confidence, 0);
  });

  it('should integrate temporal history', () => {
    const enc = new KonikuOlfactoryEncoder(config);
    // Feed multiple readings
    for (let t = 0; t < 5; t++) {
      enc.encode(makeOlfactory());
    }
    const emb = enc.encode(makeOlfactory());
    assert.ok(Number.parseInt(emb.metadata.integrationWindow as string) >= 1);
  });

  it('should differentiate different compound profiles', () => {
    const enc = new KonikuOlfactoryEncoder(config);
    const r1 = makeOlfactory(); r1.detectedCompounds = ['ethanol'];
    const r2 = makeOlfactory(); r2.detectedCompounds = ['ammonia'];
    // Give them distinct receptor patterns
    r1.receptorActivations.fill(0); r1.receptorActivations[0] = 1; r1.receptorActivations[1] = 0.8;
    r2.receptorActivations.fill(0); r2.receptorActivations[30] = 1; r2.receptorActivations[31] = 0.8;
    const z1 = enc.encode(r1);
    enc.resetHistory();
    const z2 = enc.encode(r2);
    let diff = 0;
    for (let i = 0; i < z1.z.length; i++) diff += Math.abs(z1.z[i] - z2.z[i]);
    assert.ok(diff > 0.001, `Should differentiate compounds, diff=${diff}`);
  });
});

// ─── Cross-Modal Fusion Tests ───────────────────────────────────────────────

describe('CrossModalFusion', () => {
  const config = { ...DEFAULT_SENSOR_CONFIG, latentDim: 32 };

  it('should fuse multiple modalities', () => {
    const fusion = new CrossModalFusion(config);
    const snnZ = new Float64Array(32); snnZ[0] = 1;
    const modalities = [
      { z: new Float64Array(32).fill(0.5), modality: 'visual' as const, confidence: 0.9, timestamp: 0, metadata: {} },
      { z: new Float64Array(32).fill(0.3), modality: 'audio' as const, confidence: 0.8, timestamp: 0, metadata: {} },
    ];
    const fused = fusion.fuse(snnZ, modalities);
    assert.equal(fused.z.length, 32);
    assert.ok(fused.modalityWeights.visual > 0);
    assert.ok(fused.modalityWeights.audio > 0);
    assert.ok(fused.modalityWeights.snn > 0);
  });

  it('should assign zero weight to missing modalities', () => {
    const fusion = new CrossModalFusion(config);
    const snnZ = new Float64Array(32).fill(0.5);
    const fused = fusion.fuse(snnZ, []);
    assert.equal(fused.modalityWeights.visual, 0);
    assert.equal(fused.modalityWeights.audio, 0);
    assert.equal(fused.modalityWeights.olfactory, 0);
    assert.ok(fused.modalityWeights.snn > 0);
  });

  it('should compute cross-modal coherence', () => {
    const fusion = new CrossModalFusion(config);
    const snnZ = new Float64Array(32).fill(0.5);
    const similar = new Float64Array(32).fill(0.4);
    const modalities = [
      { z: similar, modality: 'visual' as const, confidence: 1, timestamp: 0, metadata: {} },
      { z: new Float64Array(similar), modality: 'audio' as const, confidence: 1, timestamp: 0, metadata: {} },
    ];
    const fused = fusion.fuse(snnZ, modalities);
    // Similar embeddings → high coherence
    assert.ok(fused.coherence > 0.5, `Coherence should be high for similar embeddings, got ${fused.coherence}`);
  });
});

// ─── Full Pipeline Tests ────────────────────────────────────────────────────

describe('MultimodalSensorPipeline', () => {
  it('should process all three modalities', () => {
    const pipeline = new MultimodalSensorPipeline({ latentDim: 32, visualPatchDim: 64, fusionHiddenDim: 64, visualMaxPatches: 16 });
    const snnZ = new Float64Array(32).fill(0.3);
    const fused = pipeline.process({
      visual: makeFrame(64, 64, 3),
      audio: makeAudio(16000, 200),
      olfactory: makeOlfactory(),
      timestamp: Date.now(),
    }, snnZ);

    assert.equal(fused.z.length, 32);
    assert.equal(fused.modalityEmbeddings.length, 3);
    assert.ok(fused.modalityWeights.visual > 0);
    assert.ok(fused.modalityWeights.audio > 0);
    assert.ok(fused.modalityWeights.olfactory > 0);
  });

  it('should handle partial modalities', () => {
    const pipeline = new MultimodalSensorPipeline({ latentDim: 32, visualPatchDim: 64, fusionHiddenDim: 64, visualMaxPatches: 16 });
    const snnZ = new Float64Array(32).fill(0.3);
    // Audio only
    const fused = pipeline.process({ audio: makeAudio(), timestamp: Date.now() }, snnZ);
    assert.equal(fused.modalityEmbeddings.length, 1);
    assert.equal(fused.modalityEmbeddings[0].modality, 'audio');
  });

  it('should track statistics', () => {
    const pipeline = new MultimodalSensorPipeline({ latentDim: 32, visualPatchDim: 64, fusionHiddenDim: 64, visualMaxPatches: 16 });
    const snnZ = new Float64Array(32);
    pipeline.process({ visual: makeFrame(64, 64), timestamp: Date.now() }, snnZ);
    pipeline.process({ audio: makeAudio(), timestamp: Date.now() }, snnZ);
    pipeline.process({ olfactory: makeOlfactory(), timestamp: Date.now() }, snnZ);

    const stats = pipeline.getStats();
    assert.equal(stats.processed, 3);
    assert.equal(stats.modalities.visual, 1);
    assert.equal(stats.modalities.audio, 1);
    assert.equal(stats.modalities.olfactory, 1);
  });

  it('should reset cleanly', () => {
    const pipeline = new MultimodalSensorPipeline({ latentDim: 32, visualPatchDim: 64, fusionHiddenDim: 64, visualMaxPatches: 16 });
    const snnZ = new Float64Array(32);
    pipeline.process({ visual: makeFrame(64, 64), timestamp: Date.now() }, snnZ);
    pipeline.reset();
    const stats = pipeline.getStats();
    assert.equal(stats.processed, 0);
    assert.equal(stats.lastFusion, null);
  });
});
