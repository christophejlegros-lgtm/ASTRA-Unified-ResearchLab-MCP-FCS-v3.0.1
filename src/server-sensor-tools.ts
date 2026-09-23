/**
 * ASTRA — Multimodal Sensor MCP Tools
 * ═════════════════════════════════════
 *
 * Registers 6 sensor tools + 1 resource + 1 prompt into the ASTRA MCP server.
 *
 *   sensor_visual   — V-JEPA 2 visual encoding (image/video)
 *   sensor_audio    — A-JEPA audio encoding (waveform → Mel → latent)
 *   sensor_olfactory — Koniku olfactory encoding (chemoreceptor → latent)
 *   sensor_fuse     — Cross-modal attention fusion
 *   sensor_process  — Full pipeline (all modalities → fused z)
 *   sensor_status   — Pipeline status and statistics
 *
 * © 2026 Christophe Jean Legros — Geneva
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  MultimodalSensorPipeline,
  type ImageFrame,
  type VideoClip,
  type AudioSegment,
  type OlfactoryReading,
  type MultimodalObservation,
  type SensorConfig,
} from './engine/multimodal-sensors.js';

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const ImageFrameSchema = z.object({
  width: z.number().int().min(1).max(4096).default(224),
  height: z.number().int().min(1).max(4096).default(224),
  channels: z.number().int().min(1).max(4).default(3),
  source: z.string().default('camera_0'),
  simulate: z.boolean().default(true).describe('Generate simulated pixel data'),
});

const AudioSegmentSchema = z.object({
  sampleRate: z.number().int().min(8000).max(96000).default(16000),
  durationMs: z.number().min(10).max(30000).default(1000),
  channels: z.number().int().min(1).max(2).default(1),
  source: z.string().default('mic_0'),
  simulate: z.boolean().default(true).describe('Generate simulated waveform'),
  frequency: z.number().min(20).max(20000).default(440).describe('Sim: tone frequency (Hz)'),
});

const OlfactorySchema = z.object({
  numReceptors: z.number().int().min(1).max(256).default(64),
  compounds: z.array(z.string()).default(['ethanol', 'acetone', 'limonene']),
  concentrations: z.array(z.number()).default([150, 80, 200]),
  temporalPhase: z.enum(['onset', 'sustained', 'offset', 'none']).default('sustained'),
  neuronViability: z.number().min(0).max(100).default(94),
  simulate: z.boolean().default(true),
});

// ─── Simulation Helpers ─────────────────────────────────────────────────────

function simulateImage(w: number, h: number, c: number): Float64Array {
  const pixels = new Float64Array(w * h * c);
  // Generate structured pattern (gradient + noise + objects)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * c;
      const gradX = x / w;
      const gradY = y / h;
      // Circle object
      const dx = x / w - 0.5, dy = y / h - 0.5;
      const circle = Math.sqrt(dx * dx + dy * dy) < 0.2 ? 0.8 : 0;
      for (let ch = 0; ch < c; ch++) {
        pixels[idx + ch] = Math.min(1, gradX * 0.3 + gradY * 0.2 + circle * (ch === 0 ? 1 : 0.3) + Math.random() * 0.05);
      }
    }
  }
  return pixels;
}

function simulateAudio(sampleRate: number, durationMs: number, frequency: number): Float64Array {
  const nSamples = Math.floor(sampleRate * durationMs / 1000);
  const waveform = new Float64Array(nSamples);
  for (let i = 0; i < nSamples; i++) {
    const t = i / sampleRate;
    // Composite: tone + harmonics + noise
    waveform[i] = 0.5 * Math.sin(2 * Math.PI * frequency * t)
      + 0.2 * Math.sin(2 * Math.PI * frequency * 2 * t)
      + 0.1 * Math.sin(2 * Math.PI * frequency * 3 * t)
      + 0.05 * (Math.random() * 2 - 1);
    // Envelope
    const env = Math.min(1, t * 20) * Math.min(1, (durationMs / 1000 - t) * 10);
    waveform[i] *= env;
  }
  return waveform;
}

function simulateOlfactory(nR: number, compounds: string[], concentrations: number[]): OlfactoryReading {
  const activations = new Float64Array(nR);
  const conc = new Float64Array(nR);
  // Each compound activates a subset of receptors with a specific pattern
  for (let c = 0; c < compounds.length; c++) {
    const hash = compounds[c].split('').reduce((h, ch) => ((h << 5) - h + ch.charCodeAt(0)) | 0, 0);
    const center = Math.abs(hash) % nR;
    const spread = 3 + (Math.abs(hash >> 8) % 5);
    const amplitude = concentrations[c] ? Math.min(1, concentrations[c] / 300) : 0.5;
    for (let r = 0; r < nR; r++) {
      const dist = Math.min(Math.abs(r - center), nR - Math.abs(r - center));
      if (dist <= spread) {
        activations[r] += amplitude * Math.exp(-dist * dist / (2 * spread));
        conc[r] += concentrations[c] ?? 100;
      }
    }
  }
  // Clamp activations to [0, 1]
  for (let r = 0; r < nR; r++) activations[r] = Math.min(1, activations[r]);

  return {
    receptorActivations: activations,
    numReceptors: nR,
    detectedCompounds: compounds,
    concentrations: conc,
    temporalPhase: 'sustained',
    deviceState: 'active',
    neuronViability: 94,
    timestamp: Date.now(),
  };
}

// ─── Registration Function ──────────────────────────────────────────────────

export function registerSensorCapabilities(
  server: McpServer,
  getState: () => any,
  sensorConfig: Partial<SensorConfig> = {},
): MultimodalSensorPipeline {
  const pipeline = new MultimodalSensorPipeline(sensorConfig);

  // ─── Tool 1: sensor_visual ────────────────────────────────────────────

  server.tool(
    'sensor_visual',
    'V-JEPA 2 Visual Encoding (Image/Video)',
    {
      input: ImageFrameSchema.describe('Image parameters'),
      videoFrames: z.number().int().min(1).max(32).default(1).describe('Number of frames (>1 = video)'),
    },
    async ({ input, videoFrames }) => {
      const frames: ImageFrame[] = [];
      for (let f = 0; f < videoFrames; f++) {
        const pixels = input.simulate
          ? simulateImage(input.width, input.height, input.channels)
          : new Float64Array(input.width * input.height * input.channels);
        frames.push({
          pixels,
          width: input.width,
          height: input.height,
          channels: input.channels,
          timestamp: Date.now() + f * 33, // ~30fps
          source: input.source,
        });
      }

      let emb;
      if (videoFrames > 1) {
        const clip: VideoClip = { frames, fps: 30, duration: videoFrames * 33 };
        emb = pipeline.visual.encodeVideo(clip);
      } else {
        emb = pipeline.visual.encodeFrame(frames[0]);
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            tool: 'sensor_visual',
            title: 'V-JEPA 2 — Visual Encoding',
            embedding: {
              z: Array.from(emb.z).slice(0, 8).map(v => Math.round(v * 1e4) / 1e4),
              dimensionality: emb.z.length,
              norm: Math.round(Math.sqrt(emb.z.reduce((s, v) => s + v * v, 0)) * 1e4) / 1e4,
              confidence: Math.round(emb.confidence * 1e4) / 1e4,
            },
            metadata: emb.metadata,
            architecture: 'V-JEPA 2: ViT-H/16, 3D-RoPE, ' + (videoFrames > 1 ? 'temporal aggregation' : 'single frame') +
              ', masking=' + pipeline.config.visualMaskRatio,
          }, null, 2),
        }],
      };
    },
  );

  // ─── Tool 2: sensor_audio ─────────────────────────────────────────────

  server.tool(
    'sensor_audio',
    'A-JEPA Audio Encoding (Waveform → Mel → Latent)',
    {
      input: AudioSegmentSchema.describe('Audio parameters'),
    },
    async ({ input }) => {
      const waveform = input.simulate
        ? simulateAudio(input.sampleRate, input.durationMs, input.frequency)
        : new Float64Array(Math.floor(input.sampleRate * input.durationMs / 1000));

      const audio: AudioSegment = {
        waveform,
        sampleRate: input.sampleRate,
        duration: input.durationMs,
        channels: input.channels,
        timestamp: Date.now(),
        source: input.source,
      };

      const emb = pipeline.audio.encode(audio);
      const mel = pipeline.audio.getLastMel(audio);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            tool: 'sensor_audio',
            title: 'A-JEPA — Audio Encoding',
            embedding: {
              z: Array.from(emb.z).slice(0, 8).map(v => Math.round(v * 1e4) / 1e4),
              dimensionality: emb.z.length,
              norm: Math.round(Math.sqrt(emb.z.reduce((s, v) => s + v * v, 0)) * 1e4) / 1e4,
              confidence: Math.round(emb.confidence * 1e4) / 1e4,
            },
            melSpectrogram: {
              bins: mel.melBins,
              timeFrames: mel.timeFrames,
              fRange: [mel.fMin, mel.fMax],
            },
            metadata: emb.metadata,
            architecture: 'A-JEPA: ViT-B/16, Mel' + pipeline.config.audioMelBins +
              ', EMA τ=' + pipeline.config.audioEMADecay + ', masking ρ∈U(0.4,0.6)',
          }, null, 2),
        }],
      };
    },
  );

  // ─── Tool 3: sensor_olfactory ─────────────────────────────────────────

  server.tool(
    'sensor_olfactory',
    'Koniku Kore Olfactory Encoding (Chemoreceptor → Latent)',
    {
      input: OlfactorySchema.describe('Olfactory sensor parameters'),
    },
    async ({ input }) => {
      const reading = input.simulate
        ? simulateOlfactory(input.numReceptors, input.compounds, input.concentrations)
        : {
          receptorActivations: new Float64Array(input.numReceptors),
          numReceptors: input.numReceptors,
          detectedCompounds: input.compounds,
          concentrations: new Float64Array(input.concentrations),
          temporalPhase: input.temporalPhase as OlfactoryReading['temporalPhase'],
          deviceState: 'active' as const,
          neuronViability: input.neuronViability,
          timestamp: Date.now(),
        };

      const emb = pipeline.olfactory.encode(reading);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            tool: 'sensor_olfactory',
            title: 'Koniku Kore — Olfactory Encoding',
            embedding: {
              z: Array.from(emb.z).slice(0, 8).map(v => Math.round(v * 1e4) / 1e4),
              dimensionality: emb.z.length,
              norm: Math.round(Math.sqrt(emb.z.reduce((s, v) => s + v * v, 0)) * 1e4) / 1e4,
              confidence: Math.round(emb.confidence * 1e4) / 1e4,
            },
            receptor: {
              active: Array.from(reading.receptorActivations).filter(v => v > 0.05).length,
              total: reading.numReceptors,
              compounds: reading.detectedCompounds,
              viability: reading.neuronViability + '%',
            },
            metadata: emb.metadata,
            architecture: 'Koniku Kore: ' + pipeline.config.olfactoryReceptors +
              '-channel chemoreceptor, Hill kinetics, temporal integration ' +
              pipeline.config.olfactoryIntegrationMs + 'ms',
          }, null, 2),
        }],
      };
    },
  );

  // ─── Tool 4: sensor_fuse ──────────────────────────────────────────────

  server.tool(
    'sensor_fuse',
    'Cross-Modal Attention Fusion',
    {
      includeVisual: z.boolean().default(true),
      includeAudio: z.boolean().default(true),
      includeOlfactory: z.boolean().default(true),
    },
    async ({ includeVisual, includeAudio, includeOlfactory }) => {
      // Build multimodal observation
      const obs: MultimodalObservation = { timestamp: Date.now() };
      if (includeVisual) {
        obs.visual = {
          pixels: simulateImage(224, 224, 3),
          width: 224, height: 224, channels: 3,
          timestamp: Date.now(), source: 'camera_0',
        };
      }
      if (includeAudio) {
        obs.audio = {
          waveform: simulateAudio(16000, 500, 440),
          sampleRate: 16000, duration: 500, channels: 1,
          timestamp: Date.now(), source: 'mic_0',
        };
      }
      if (includeOlfactory) {
        obs.olfactory = simulateOlfactory(64, ['ethanol', 'limonene'], [150, 200]);
      }

      // Get SNN state embedding (mock or from state)
      const state = getState();
      const snnZ = new Float64Array(pipeline.config.latentDim);
      // Simple SNN encoding from available state
      if (state.snn?.layerMetrics) {
        for (let i = 0; i < state.snn.layerMetrics.length && i < snnZ.length; i++) {
          snnZ[i] = (state.snn.layerMetrics[i]?.firingRate ?? 20) / 50;
        }
      }

      const fused = pipeline.process(obs, snnZ);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            tool: 'sensor_fuse',
            title: 'Cross-Modal Attention Fusion',
            fused: {
              z: Array.from(fused.z).slice(0, 8).map(v => Math.round(v * 1e4) / 1e4),
              dimensionality: fused.z.length,
              norm: Math.round(Math.sqrt(fused.z.reduce((s, v) => s + v * v, 0)) * 1e4) / 1e4,
            },
            attentionWeights: fused.modalityWeights,
            coherence: fused.coherence,
            modalitiesActive: fused.modalityEmbeddings.map(m => m.modality),
            architecture: 'Cross-modal attention: Q=SNN, K/V=per-modality, ' +
              pipeline.config.fusionHeads + ' heads, softmax weighting',
          }, null, 2),
        }],
      };
    },
  );

  // ─── Tool 5: sensor_process ───────────────────────────────────────────

  server.tool(
    'sensor_process',
    'Full Multimodal Pipeline (All Modalities → Fused z)',
    {
      visualSource: z.string().optional().describe('Visual source (default: simulated)'),
      audioFrequency: z.number().optional().describe('Audio tone frequency for simulation'),
      compounds: z.array(z.string()).optional().describe('Olfactory compounds to simulate'),
    },
    async ({ visualSource, audioFrequency, compounds }) => {
      const obs: MultimodalObservation = {
        timestamp: Date.now(),
        visual: {
          pixels: simulateImage(224, 224, 3),
          width: 224, height: 224, channels: 3,
          timestamp: Date.now(), source: visualSource ?? 'camera_0',
        },
        audio: {
          waveform: simulateAudio(16000, 1000, audioFrequency ?? 440),
          sampleRate: 16000, duration: 1000, channels: 1,
          timestamp: Date.now(), source: 'mic_0',
        },
        olfactory: simulateOlfactory(64, compounds ?? ['ethanol', 'acetone'], [150, 80]),
      };

      const snnZ = new Float64Array(pipeline.config.latentDim);
      const state = getState();
      if (state.snn?.layerMetrics) {
        for (let i = 0; i < state.snn.layerMetrics.length && i < snnZ.length; i++) {
          snnZ[i] = (state.snn.layerMetrics[i]?.firingRate ?? 20) / 50;
        }
      }

      const fused = pipeline.process(obs, snnZ);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            tool: 'sensor_process',
            title: 'Multimodal Sensor Pipeline — Full Processing',
            result: {
              fusedZ: Array.from(fused.z).slice(0, 8).map(v => Math.round(v * 1e4) / 1e4),
              dimensionality: fused.z.length,
              modalityWeights: fused.modalityWeights,
              coherence: fused.coherence,
              modalitiesProcessed: fused.modalityEmbeddings.map(m => ({
                modality: m.modality,
                confidence: Math.round(m.confidence * 1e4) / 1e4,
              })),
            },
            pipeline: pipeline.getStats(),
          }, null, 2),
        }],
      };
    },
  );

  // ─── Tool 6: sensor_status ────────────────────────────────────────────

  server.tool(
    'sensor_status',
    'Multimodal Sensor Pipeline Status',
    {},
    async () => {
      const stats = pipeline.getStats();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            tool: 'sensor_status',
            title: 'Multimodal Sensor Pipeline — Status',
            encoders: {
              visual: {
                type: 'V-JEPA 2',
                architecture: 'ViT-H/16, 3D-RoPE',
                patchSize: stats.config.visualPatchSize,
                maskRatio: stats.config.visualMaskRatio,
                maxPatches: 196,
                processed: stats.modalities.visual,
              },
              audio: {
                type: 'A-JEPA',
                architecture: 'ViT-B/16, Mel spectrogram',
                melBins: stats.config.audioMelBins,
                maskRatio: stats.config.audioMaskRatio,
                emaDecay: 0.996,
                processed: stats.modalities.audio,
              },
              olfactory: {
                type: 'Koniku Kore',
                architecture: 'Chemoreceptor array + Hill kinetics',
                receptors: stats.config.olfactoryReceptors,
                integrationMs: 200,
                processed: stats.modalities.olfactory,
              },
            },
            fusion: {
              type: 'Cross-modal attention',
              heads: stats.config.fusionHeads,
              latentDim: stats.config.latentDim,
              lastWeights: stats.lastFusion?.weights ?? null,
              lastCoherence: stats.lastFusion?.coherence ?? null,
            },
            total: {
              processed: stats.processed,
              modalities: stats.modalities,
            },
          }, null, 2),
        }],
      };
    },
  );

  // ─── Resource: astra://sensors/state ──────────────────────────────────

  server.resource(
    'sensors-state',
    'astra://sensors/state',
    { description: 'Multimodal sensor pipeline state and last fusion', mimeType: 'application/json' },
    async () => ({
      contents: [{
        uri: 'astra://sensors/state',
        mimeType: 'application/json',
        text: JSON.stringify(pipeline.getStats(), null, 2),
      }],
    }),
  );

  // ─── Prompt: multimodal-experiment ────────────────────────────────────

  server.prompt(
    'multimodal-experiment',
    'Full multimodal sensor experiment: visual + audio + olfactory → fused → WM',
    {},
    async () => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: [
            'Run a complete multimodal sensor experiment:',
            '',
            '1. **Visual**: Encode a simulated 224×224 image using `sensor_visual`',
            '2. **Audio**: Encode a 1s 440Hz tone using `sensor_audio`',
            '3. **Olfactory**: Encode ethanol+limonene via `sensor_olfactory`',
            '4. **Fuse**: Cross-modal fusion using `sensor_fuse`',
            '5. **Full Pipeline**: Process all modalities together using `sensor_process`',
            '6. **Status**: Check pipeline state using `sensor_status`',
            '7. **World Model**: Encode the fused representation using `wm_encode`',
            '8. **Surprise**: Check if the multimodal input was expected using `wm_surprise`',
            '',
            'Analyze: Which modality dominates the attention weights?',
            'Is cross-modal coherence high? How does the fused embedding compare',
            'to the SNN-only World Model encoding?',
          ].join('\n'),
        },
      }],
    }),
  );

  return pipeline;
}
