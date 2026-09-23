/**
 * ASTRA — Multimodal Sensor Pipeline
 * ════════════════════════════════════
 *
 * JEPA-based encoders for three sensory modalities + cross-modal fusion:
 *
 *   V-JEPA 2 (Vision)  : Image/Video → Patch Embedding → ViT Encoder → z_visual
 *   A-JEPA   (Audio)   : Waveform → Mel Spectrogram → Patch Embedding → z_audio
 *   Koniku   (Olfactory): Molecular Signature → Chemoreceptor Array → z_olfactory
 *
 * Fusion: Cross-modal attention projecting all modalities into a unified
 * latent representation compatible with the World Model's z ∈ ℝ⁶⁴.
 *
 * Architecture references:
 *   V-JEPA 2: Bardes et al. (2024) — ViT-H/16, 1.2B params, 3D-RoPE, 60-80% masking
 *   A-JEPA:   Fei et al. (2024) — ViT-B/16, Mel 128 bins, EMA τ=0.996
 *   Koniku:   Koniku Kore — biological olfactory neurons, molecular pattern recognition
 *   LeWM:     Maes et al. (2026) — JEPA world model with SIGReg
 *
 * © 2026 Christophe Jean Legros — Geneva
 * Assistance Multi IA · Assistant-Multi-AI@proton.me
 */

// ─── Linear Algebra Helpers (shared) ────────────────────────────────────────

function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

class DenseMatrix {
  constructor(public readonly rows: number, public readonly cols: number, public data: Float64Array) {}

  static xavier(rows: number, cols: number): DenseMatrix {
    const scale = Math.sqrt(2.0 / (rows + cols));
    const data = new Float64Array(rows * cols);
    for (let i = 0; i < data.length; i++) data[i] = gaussianRandom() * scale;
    return new DenseMatrix(rows, cols, data);
  }

  mulVec(x: Float64Array): Float64Array {
    const y = new Float64Array(this.rows);
    for (let i = 0; i < this.rows; i++) {
      let sum = 0;
      const offset = i * this.cols;
      for (let j = 0; j < this.cols; j++) sum += this.data[offset + j] * x[j];
      y[i] = sum;
    }
    return y;
  }

  addOuterProduct(a: Float64Array, b: Float64Array, lr: number): void {
    for (let i = 0; i < this.rows; i++) {
      const offset = i * this.cols;
      const ai = a[i] * lr;
      for (let j = 0; j < this.cols; j++) this.data[offset + j] += ai * b[j];
    }
  }
}

function gelu(x: number): number {
  return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)));
}

function layerNorm(v: Float64Array, eps = 1e-5): Float64Array {
  const n = v.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += v[i];
  mean /= n;
  let var_ = 0;
  for (let i = 0; i < n; i++) var_ += (v[i] - mean) ** 2;
  var_ /= n;
  const std = Math.sqrt(var_ + eps);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = (v[i] - mean) / std;
  return out;
}

function vecAdd(a: Float64Array, b: Float64Array): Float64Array {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i];
  return out;
}

function vecDot(a: Float64Array, b: Float64Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function vecNorm(a: Float64Array): number {
  return Math.sqrt(vecDot(a, a));
}

function softmax(v: Float64Array): Float64Array {
  let max = -Infinity;
  for (let i = 0; i < v.length; i++) if (v[i] > max) max = v[i];
  const out = new Float64Array(v.length);
  let sum = 0;
  for (let i = 0; i < v.length; i++) { out[i] = Math.exp(v[i] - max); sum += out[i]; }
  for (let i = 0; i < v.length; i++) out[i] /= sum;
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES — Multimodal Sensor Data
// ═══════════════════════════════════════════════════════════════════════════

/** Image frame input */
export interface ImageFrame {
  /** Pixel data as flattened array [H × W × C], normalized [0, 1] */
  pixels: Float64Array;
  /** Image dimensions */
  width: number;
  height: number;
  channels: number;   // 1 = grayscale, 3 = RGB
  /** Frame timestamp (ms) */
  timestamp: number;
  /** Source identifier */
  source: string;
}

/** Video clip input (sequence of frames) */
export interface VideoClip {
  /** Sequence of frames (temporal order) */
  frames: ImageFrame[];
  /** Frames per second */
  fps: number;
  /** Clip duration (ms) */
  duration: number;
}

/** Audio segment input */
export interface AudioSegment {
  /** Raw waveform samples, normalized [-1, 1] */
  waveform: Float64Array;
  /** Sample rate (Hz) */
  sampleRate: number;
  /** Duration (ms) */
  duration: number;
  /** Number of channels (1 = mono, 2 = stereo) */
  channels: number;
  /** Timestamp */
  timestamp: number;
  /** Source identifier */
  source: string;
}

/** Mel spectrogram (precomputed or generated) */
export interface MelSpectrogram {
  /** Mel bins × time frames, row-major */
  data: Float64Array;
  /** Number of Mel frequency bins */
  melBins: number;
  /** Number of time frames */
  timeFrames: number;
  /** Frequency range (Hz) */
  fMin: number;
  fMax: number;
}

/** Koniku olfactory sensor data */
export interface OlfactoryReading {
  /** Molecular binding affinities per chemoreceptor [0, 1] */
  receptorActivations: Float64Array;
  /** Number of active chemoreceptors */
  numReceptors: number;
  /** Detected molecular signatures (SMILES or identifiers) */
  detectedCompounds: string[];
  /** Concentration estimates (ppb) */
  concentrations: Float64Array;
  /** Temporal pattern: onset, sustained, offset */
  temporalPhase: 'onset' | 'sustained' | 'offset' | 'none';
  /** Koniku Kore device state */
  deviceState: 'active' | 'calibrating' | 'standby' | 'error';
  /** Biological neuron viability (%) */
  neuronViability: number;
  /** Timestamp */
  timestamp: number;
}

/** Multimodal observation combining all modalities */
export interface MultimodalObservation {
  visual?: ImageFrame | VideoClip;
  audio?: AudioSegment;
  olfactory?: OlfactoryReading;
  timestamp: number;
}

/** Per-modality latent embedding with metadata */
export interface ModalityEmbedding {
  z: Float64Array;
  modality: 'visual' | 'audio' | 'olfactory';
  confidence: number;
  timestamp: number;
  metadata: Record<string, number | string>;
}

/** Fused multimodal embedding */
export interface FusedEmbedding {
  /** Fused latent vector (same dim as World Model z) */
  z: Float64Array;
  /** Per-modality contributions (attention weights) */
  modalityWeights: { visual: number; audio: number; olfactory: number; snn: number };
  /** Per-modality individual embeddings */
  modalityEmbeddings: ModalityEmbedding[];
  /** Cross-modal coherence score */
  coherence: number;
  /** Timestamp */
  timestamp: number;
}

/** Sensor pipeline configuration */
export interface SensorConfig {
  /** V-JEPA patch size (default: 16) */
  visualPatchSize: number;
  /** V-JEPA embedding dim per patch (default: 192) */
  visualPatchDim: number;
  /** V-JEPA maximum patches per frame (default: 196 = 224/16 × 224/16) */
  visualMaxPatches: number;
  /** V-JEPA masking ratio (default: 0.7 — 70% patches masked) */
  visualMaskRatio: number;
  /** V-JEPA 3D-RoPE wavelength for temporal encoding */
  visualRoPEWavelength: number;
  /** A-JEPA mel bins (default: 128) */
  audioMelBins: number;
  /** A-JEPA hop length for mel spectrogram (default: 160 — 10ms at 16kHz) */
  audioHopLength: number;
  /** A-JEPA masking ratio (default: 0.5) */
  audioMaskRatio: number;
  /** A-JEPA EMA decay τ (default: 0.996) */
  audioEMADecay: number;
  /** Koniku receptor count (default: 64) */
  olfactoryReceptors: number;
  /** Koniku temporal integration window (ms) */
  olfactoryIntegrationMs: number;
  /** Output latent dim (must match WorldModel.latentDim, default: 64) */
  latentDim: number;
  /** Cross-modal attention heads (default: 4) */
  fusionHeads: number;
  /** Fusion hidden dim (default: 128) */
  fusionHiddenDim: number;
}

export const DEFAULT_SENSOR_CONFIG: SensorConfig = {
  visualPatchSize: 16,
  visualPatchDim: 192,
  visualMaxPatches: 196,      // (224/16)² = 14×14
  visualMaskRatio: 0.7,
  visualRoPEWavelength: 10000,
  audioMelBins: 128,
  audioHopLength: 160,
  audioMaskRatio: 0.5,
  audioEMADecay: 0.996,
  olfactoryReceptors: 64,
  olfactoryIntegrationMs: 200,
  latentDim: 64,
  fusionHeads: 4,
  fusionHiddenDim: 128,
};

// ═══════════════════════════════════════════════════════════════════════════
// V-JEPA 2 — Visual Encoder (Image & Video)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * V-JEPA 2 Visual Encoder
 *
 * Pipeline: pixels → patchify → patch embedding → positional encoding (3D-RoPE)
 *           → masked context encoder → CLS token → linear projection → z_visual
 *
 * Architecture inspired by Bardes et al. (2024) V-JEPA 2:
 *   - ViT-H/16 with 1.2B parameters (here simplified to MLP-based)
 *   - 3D Rotary Position Embeddings for spatiotemporal awareness
 *   - 60-80% masking ratio (predict masked patches from visible context)
 *   - CLS token aggregation for global representation
 */
export class VJEPAEncoder {
  private patchEmbed: DenseMatrix;    // Flatten patch → d_patch
  private posEmbed: Float64Array;     // Positional embedding (learnable)
  private contextW1: DenseMatrix;     // Transformer layer 1 (simplified)
  private contextB1: Float64Array;
  private contextW2: DenseMatrix;     // Transformer layer 2
  private contextB2: Float64Array;
  private clsToken: Float64Array;     // Learnable CLS token
  private projector: DenseMatrix;     // d_patch → latentDim
  private projBias: Float64Array;
  private readonly config: SensorConfig;

  constructor(config: SensorConfig = DEFAULT_SENSOR_CONFIG) {
    this.config = config;
    const patchPixels = config.visualPatchSize * config.visualPatchSize * 3; // RGB
    const d = config.visualPatchDim;

    this.patchEmbed = DenseMatrix.xavier(d, patchPixels);
    this.posEmbed = new Float64Array(config.visualMaxPatches * d);
    for (let i = 0; i < this.posEmbed.length; i++) this.posEmbed[i] = gaussianRandom() * 0.02;

    this.contextW1 = DenseMatrix.xavier(d, d);
    this.contextB1 = new Float64Array(d);
    this.contextW2 = DenseMatrix.xavier(d, d);
    this.contextB2 = new Float64Array(d);

    this.clsToken = new Float64Array(d);
    for (let i = 0; i < d; i++) this.clsToken[i] = gaussianRandom() * 0.02;

    this.projector = DenseMatrix.xavier(config.latentDim, d);
    this.projBias = new Float64Array(config.latentDim);
  }

  /**
   * Patchify an image: extract non-overlapping patches as flat vectors.
   */
  private patchify(frame: ImageFrame): Float64Array[] {
    const P = this.config.visualPatchSize;
    const patches: Float64Array[] = [];
    const nH = Math.floor(frame.height / P);
    const nW = Math.floor(frame.width / P);
    const C = frame.channels || 3;

    for (let py = 0; py < nH && patches.length < this.config.visualMaxPatches; py++) {
      for (let px = 0; px < nW && patches.length < this.config.visualMaxPatches; px++) {
        const patch = new Float64Array(P * P * C);
        let idx = 0;
        for (let dy = 0; dy < P; dy++) {
          for (let dx = 0; dx < P; dx++) {
            const y = py * P + dy;
            const x = px * P + dx;
            for (let c = 0; c < C; c++) {
              const srcIdx = (y * frame.width + x) * C + c;
              patch[idx++] = srcIdx < frame.pixels.length ? frame.pixels[srcIdx] : 0;
            }
          }
        }
        patches.push(patch);
      }
    }
    return patches;
  }

  /**
   * Apply 3D Rotary Position Embedding (RoPE).
   * Encodes spatial (x, y) and temporal (t) position.
   */
  private applyRoPE(embedding: Float64Array, patchIdx: number, frameIdx: number): Float64Array {
    const d = embedding.length;
    const result = new Float64Array(d);
    const nW = Math.floor(Math.sqrt(this.config.visualMaxPatches));
    const px = patchIdx % nW;
    const py = Math.floor(patchIdx / nW);
    const wl = this.config.visualRoPEWavelength;

    for (let i = 0; i < d - 1; i += 2) {
      const freqSpatial = 1.0 / Math.pow(wl, i / d);
      const freqTemporal = 1.0 / Math.pow(wl, (i + 1) / d);

      const theta_x = px * freqSpatial;
      const theta_y = py * freqSpatial;
      const theta_t = frameIdx * freqTemporal;
      const theta = theta_x + theta_y + theta_t;

      result[i] = embedding[i] * Math.cos(theta) - embedding[i + 1] * Math.sin(theta);
      result[i + 1] = embedding[i] * Math.sin(theta) + embedding[i + 1] * Math.cos(theta);
    }
    return result;
  }

  /**
   * Apply masking: randomly select visible patches (1 - maskRatio).
   */
  private selectVisiblePatches(patches: Float64Array[]): { visible: Float64Array[]; visibleIdx: number[] } {
    const nVisible = Math.max(1, Math.floor(patches.length * (1 - this.config.visualMaskRatio)));
    const indices = Array.from({ length: patches.length }, (_, i) => i);
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const visibleIdx = indices.slice(0, nVisible).sort((a, b) => a - b);
    return { visible: visibleIdx.map(i => patches[i]), visibleIdx };
  }

  /**
   * Encode a single image frame → latent z_visual.
   */
  encodeFrame(frame: ImageFrame, frameIdx = 0): ModalityEmbedding {
    // 1. Patchify
    const patches = this.patchify(frame);
    if (patches.length === 0) return this.emptyEmbedding('visual', frame.timestamp);

    // 2. Patch embedding + positional encoding + RoPE
    const d = this.config.visualPatchDim;
    const patchPixels = this.config.visualPatchSize * this.config.visualPatchSize * (frame.channels || 3);
    const embeddings: Float64Array[] = [];

    for (let i = 0; i < patches.length; i++) {
      // Pad or truncate patch to expected size
      const padded = new Float64Array(patchPixels);
      padded.set(patches[i].subarray(0, Math.min(patches[i].length, patchPixels)));

      let emb = this.patchEmbed.mulVec(padded);
      // Add positional embedding
      const posOffset = i * d;
      for (let j = 0; j < d; j++) emb[j] += this.posEmbed[posOffset + j] ?? 0;
      // Apply 3D-RoPE
      emb = this.applyRoPE(emb, i, frameIdx);
      embeddings.push(emb);
    }

    // 3. Masking: encode only visible patches
    const { visible } = this.selectVisiblePatches(embeddings);

    // 4. Context encoder (simplified self-attention → MLP)
    // Aggregate visible patches via mean pooling + CLS token
    const aggregated = new Float64Array(d);
    for (const v of visible) for (let j = 0; j < d; j++) aggregated[j] += v[j];
    for (let j = 0; j < d; j++) aggregated[j] = aggregated[j] / visible.length + this.clsToken[j];

    // Transformer block 1: LayerNorm → W1 → GELU → W2
    let h = layerNorm(aggregated);
    h = vecAdd(this.contextW1.mulVec(h), this.contextB1);
    for (let i = 0; i < h.length; i++) h[i] = gelu(h[i]);
    h = layerNorm(h);
    h = vecAdd(this.contextW2.mulVec(h), this.contextB2);

    // 5. Project to World Model latent dim
    const z = vecAdd(this.projector.mulVec(layerNorm(h)), this.projBias);
    const norm = vecNorm(z);

    return {
      z,
      modality: 'visual',
      confidence: Math.min(1, norm / Math.sqrt(this.config.latentDim)),
      timestamp: frame.timestamp,
      metadata: {
        patches: patches.length,
        visiblePatches: visible.length,
        maskRatio: this.config.visualMaskRatio,
        width: frame.width,
        height: frame.height,
        source: frame.source,
        encoder: 'V-JEPA 2 (ViT-H/16 adapted)',
      },
    };
  }

  /**
   * Encode a video clip → latent z_visual with temporal aggregation.
   * Uses 3D-RoPE to encode spatiotemporal position across frames.
   */
  encodeVideo(clip: VideoClip): ModalityEmbedding {
    if (clip.frames.length === 0) return this.emptyEmbedding('visual', 0);

    const frameEmbeddings: Float64Array[] = [];
    for (let f = 0; f < clip.frames.length; f++) {
      const emb = this.encodeFrame(clip.frames[f], f);
      frameEmbeddings.push(emb.z);
    }

    // Temporal aggregation: exponential decay weighting (recent frames matter more)
    const d = this.config.latentDim;
    const z = new Float64Array(d);
    let totalWeight = 0;
    for (let f = 0; f < frameEmbeddings.length; f++) {
      const w = Math.exp(-0.3 * (frameEmbeddings.length - 1 - f));
      totalWeight += w;
      for (let j = 0; j < d; j++) z[j] += frameEmbeddings[f][j] * w;
    }
    for (let j = 0; j < d; j++) z[j] /= totalWeight;

    return {
      z,
      modality: 'visual',
      confidence: Math.min(1, vecNorm(z) / Math.sqrt(d)),
      timestamp: clip.frames[clip.frames.length - 1].timestamp,
      metadata: {
        frames: clip.frames.length,
        fps: clip.fps,
        duration: clip.duration,
        aggregation: 'exponential_decay',
        encoder: 'V-JEPA 2 (temporal 3D-RoPE)',
      },
    };
  }

  private emptyEmbedding(modality: 'visual' | 'audio' | 'olfactory', ts: number): ModalityEmbedding {
    return { z: new Float64Array(this.config.latentDim), modality, confidence: 0, timestamp: ts, metadata: { empty: 'true' } };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// A-JEPA — Audio Encoder (Speech, Sound, Music)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A-JEPA Audio Encoder
 *
 * Pipeline: waveform → Mel spectrogram → patch embedding → masked encoder
 *           → CLS aggregation → projection → z_audio
 *
 * Architecture inspired by Fei et al. (2024) A-JEPA:
 *   - ViT-B/16 on Mel spectrogram patches
 *   - 128 Mel bins × variable time frames
 *   - Masking ratio ρ ∈ U(0.4, 0.6)
 *   - EMA target encoder τ = 0.996
 */
export class AJEPAEncoder {
  private melFilterBank: DenseMatrix;  // STFT → Mel conversion
  private patchEmbed: DenseMatrix;     // Mel patch → d
  private encoderW1: DenseMatrix;
  private encoderB1: Float64Array;
  private encoderW2: DenseMatrix;
  private encoderB2: Float64Array;
  private clsToken: Float64Array;
  private projector: DenseMatrix;
  private projBias: Float64Array;
  private readonly config: SensorConfig;

  // EMA target encoder (shadow weights)
  private targetW1: DenseMatrix;
  private targetW2: DenseMatrix;
  private emaStep = 0;

  constructor(config: SensorConfig = DEFAULT_SENSOR_CONFIG) {
    this.config = config;
    const melPatchDim = config.audioMelBins * 4; // 4 time frames per patch
    const d = config.visualPatchDim; // Reuse same hidden dim

    // Mel filter bank: simplified triangular filters
    const fftBins = 256;
    this.melFilterBank = DenseMatrix.xavier(config.audioMelBins, fftBins);
    // Initialize as triangular filters
    for (let m = 0; m < config.audioMelBins; m++) {
      const center = (m + 1) / (config.audioMelBins + 1) * fftBins;
      const bandwidth = fftBins / (config.audioMelBins + 1) * 1.5;
      for (let f = 0; f < fftBins; f++) {
        const dist = Math.abs(f - center);
        this.melFilterBank.data[m * fftBins + f] = Math.max(0, 1 - dist / bandwidth);
      }
    }

    this.patchEmbed = DenseMatrix.xavier(d, melPatchDim);
    this.encoderW1 = DenseMatrix.xavier(d, d);
    this.encoderB1 = new Float64Array(d);
    this.encoderW2 = DenseMatrix.xavier(d, d);
    this.encoderB2 = new Float64Array(d);
    this.clsToken = new Float64Array(d);
    for (let i = 0; i < d; i++) this.clsToken[i] = gaussianRandom() * 0.02;
    this.projector = DenseMatrix.xavier(config.latentDim, d);
    this.projBias = new Float64Array(config.latentDim);

    // EMA target encoder (clone of online encoder)
    this.targetW1 = DenseMatrix.xavier(d, d);
    this.targetW1.data.set(this.encoderW1.data);
    this.targetW2 = DenseMatrix.xavier(d, d);
    this.targetW2.data.set(this.encoderW2.data);
  }

  /**
   * Compute Mel spectrogram from raw waveform.
   * Uses simplified STFT → Mel filter bank → log compression.
   */
  computeMelSpectrogram(audio: AudioSegment): MelSpectrogram {
    const hopLen = this.config.audioHopLength;
    const fftSize = 512;
    const nFrames = Math.floor((audio.waveform.length - fftSize) / hopLen) + 1;
    const melBins = this.config.audioMelBins;

    const mel = new Float64Array(melBins * Math.max(1, nFrames));

    for (let t = 0; t < nFrames; t++) {
      // Simple magnitude spectrum (no actual FFT — approximation for sim)
      const spectrum = new Float64Array(256);
      const offset = t * hopLen;
      for (let f = 0; f < 256; f++) {
        let power = 0;
        const freq = f / 256;
        for (let n = 0; n < Math.min(fftSize, audio.waveform.length - offset); n++) {
          const sample = audio.waveform[offset + n] ?? 0;
          power += sample * Math.cos(2 * Math.PI * freq * n) / fftSize;
        }
        spectrum[f] = power * power; // Power spectrum
      }

      // Apply Mel filter bank
      const melFrame = this.melFilterBank.mulVec(spectrum);

      // Log compression: log(1 + x)
      for (let m = 0; m < melBins; m++) {
        mel[m * nFrames + t] = Math.log1p(Math.max(0, melFrame[m]) * 1000);
      }
    }

    return {
      data: mel,
      melBins,
      timeFrames: Math.max(1, nFrames),
      fMin: 20,
      fMax: audio.sampleRate / 2,
    };
  }

  /**
   * Extract patches from Mel spectrogram.
   * Each patch: melBins × 4 time frames.
   */
  private patchifyMel(spec: MelSpectrogram): Float64Array[] {
    const framesPerPatch = 4;
    const patches: Float64Array[] = [];
    const nPatches = Math.floor(spec.timeFrames / framesPerPatch);

    for (let p = 0; p < nPatches; p++) {
      const patch = new Float64Array(spec.melBins * framesPerPatch);
      for (let m = 0; m < spec.melBins; m++) {
        for (let t = 0; t < framesPerPatch; t++) {
          const srcT = p * framesPerPatch + t;
          if (srcT < spec.timeFrames) {
            patch[m * framesPerPatch + t] = spec.data[m * spec.timeFrames + srcT];
          }
        }
      }
      patches.push(patch);
    }

    return patches;
  }

  /**
   * Update EMA target encoder.
   */
  private updateEMA(): void {
    const tau = this.config.audioEMADecay;
    for (let i = 0; i < this.targetW1.data.length; i++) {
      this.targetW1.data[i] = tau * this.targetW1.data[i] + (1 - tau) * this.encoderW1.data[i];
    }
    for (let i = 0; i < this.targetW2.data.length; i++) {
      this.targetW2.data[i] = tau * this.targetW2.data[i] + (1 - tau) * this.encoderW2.data[i];
    }
    this.emaStep++;
  }

  /**
   * Encode audio segment → latent z_audio.
   */
  encode(audio: AudioSegment): ModalityEmbedding {
    // 1. Compute Mel spectrogram
    const spec = this.computeMelSpectrogram(audio);

    // 2. Patchify
    const patches = this.patchifyMel(spec);
    if (patches.length === 0) {
      return { z: new Float64Array(this.config.latentDim), modality: 'audio', confidence: 0, timestamp: audio.timestamp, metadata: { empty: 'true' } };
    }

    // 3. Patch embedding
    const d = this.config.visualPatchDim;
    const melPatchDim = this.config.audioMelBins * 4;
    const embeddings: Float64Array[] = [];
    for (const patch of patches) {
      const padded = new Float64Array(melPatchDim);
      padded.set(patch.subarray(0, Math.min(patch.length, melPatchDim)));
      embeddings.push(this.patchEmbed.mulVec(padded));
    }

    // 4. Masking
    const maskRatio = 0.4 + Math.random() * 0.2; // ρ ∈ U(0.4, 0.6)
    const nVisible = Math.max(1, Math.floor(embeddings.length * (1 - maskRatio)));
    const visible = embeddings.slice(0, nVisible);

    // 5. Context encoder: aggregate + transformer block
    const aggregated = new Float64Array(d);
    for (const v of visible) for (let j = 0; j < d; j++) aggregated[j] += v[j];
    for (let j = 0; j < d; j++) aggregated[j] = aggregated[j] / visible.length + this.clsToken[j];

    let h = layerNorm(aggregated);
    h = vecAdd(this.encoderW1.mulVec(h), this.encoderB1);
    for (let i = 0; i < h.length; i++) h[i] = gelu(h[i]);
    h = layerNorm(h);
    h = vecAdd(this.encoderW2.mulVec(h), this.encoderB2);

    // 6. Project to latent
    const z = vecAdd(this.projector.mulVec(layerNorm(h)), this.projBias);

    // 7. EMA update
    this.updateEMA();

    return {
      z,
      modality: 'audio',
      confidence: Math.min(1, vecNorm(z) / Math.sqrt(this.config.latentDim)),
      timestamp: audio.timestamp,
      metadata: {
        melBins: spec.melBins,
        timeFrames: spec.timeFrames,
        patches: patches.length,
        visiblePatches: nVisible,
        maskRatio: +maskRatio.toFixed(3),
        sampleRate: audio.sampleRate,
        duration: audio.duration,
        emaStep: this.emaStep,
        source: audio.source,
        encoder: 'A-JEPA (ViT-B/16, Mel128, EMA τ=0.996)',
      },
    };
  }

  /** Get the precomputed Mel spectrogram (for dashboard visualization) */
  getLastMel(audio: AudioSegment): MelSpectrogram {
    return this.computeMelSpectrogram(audio);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// KONIKU — Olfactory Encoder (Chemoreceptor Array)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Koniku Kore Olfactory Encoder
 *
 * Pipeline: receptor activations → temporal integration → molecular fingerprint
 *           → MLP encoder → latent z_olfactory
 *
 * The Koniku Kore uses biological olfactory neurons interfaced with CMOS:
 *   - 64 chemoreceptor channels (default)
 *   - Molecular pattern recognition via combinatorial receptor codes
 *   - Temporal dynamics: onset (fast), sustained, offset (adaptation)
 *   - Concentration-dependent response (Hill equation kinetics)
 *
 * The encoder maps the full receptor array state + temporal phase + concentration
 * into the shared latent space for cross-modal fusion with vision and audio.
 */
export class KonikuOlfactoryEncoder {
  private receptorEmbed: DenseMatrix;   // Receptor activations → hidden
  private concentrationEmbed: DenseMatrix; // Log-concentrations → hidden
  private temporalEmbed: Float64Array;  // Phase encoding (learnable)
  private encoderW1: DenseMatrix;
  private encoderB1: Float64Array;
  private encoderW2: DenseMatrix;
  private encoderB2: Float64Array;
  private projector: DenseMatrix;
  private projBias: Float64Array;
  private readonly config: SensorConfig;

  // Temporal integration buffer
  private activationHistory: Float64Array[] = [];
  private readonly historyMaxLen: number;

  // Molecular fingerprint library (learned codebook)
  private codebook: DenseMatrix; // K molecular prototypes × receptor_dim
  private readonly codebookSize = 32;

  constructor(config: SensorConfig = DEFAULT_SENSOR_CONFIG) {
    this.config = config;
    const nR = config.olfactoryReceptors;
    const d = config.fusionHiddenDim;
    this.historyMaxLen = Math.max(1, Math.floor(config.olfactoryIntegrationMs / 10));

    this.receptorEmbed = DenseMatrix.xavier(d, nR);
    this.concentrationEmbed = DenseMatrix.xavier(d, nR);

    // Temporal phase: 4 learnable embeddings (onset, sustained, offset, none)
    this.temporalEmbed = new Float64Array(4 * d);
    for (let i = 0; i < this.temporalEmbed.length; i++) this.temporalEmbed[i] = gaussianRandom() * 0.1;

    this.encoderW1 = DenseMatrix.xavier(d, d * 3); // Concat: receptor + concentration + temporal
    this.encoderB1 = new Float64Array(d);
    this.encoderW2 = DenseMatrix.xavier(d, d);
    this.encoderB2 = new Float64Array(d);
    this.projector = DenseMatrix.xavier(config.latentDim, d);
    this.projBias = new Float64Array(config.latentDim);

    // Molecular prototype codebook
    this.codebook = DenseMatrix.xavier(this.codebookSize, nR);
  }

  /**
   * Apply Hill equation for concentration-dependent response.
   * response = c^n / (K_d^n + c^n)
   */
  private hillResponse(concentration: number, Kd = 100, n = 1.5): number {
    if (concentration <= 0) return 0;
    const cn = Math.pow(concentration, n);
    return cn / (Math.pow(Kd, n) + cn);
  }

  /**
   * Match receptor pattern against molecular codebook.
   * Returns top-K matching prototype indices and similarity scores.
   */
  private matchCodebook(activations: Float64Array): { prototypeIdx: number; similarity: number }[] {
    const results: { prototypeIdx: number; similarity: number }[] = [];
    const nR = this.config.olfactoryReceptors;

    for (let k = 0; k < this.codebookSize; k++) {
      let dot = 0, normA = 0, normB = 0;
      for (let r = 0; r < nR; r++) {
        const a = activations[r] ?? 0;
        const b = this.codebook.data[k * nR + r];
        dot += a * b;
        normA += a * a;
        normB += b * b;
      }
      const sim = dot / (Math.sqrt(normA * normB) + 1e-8);
      results.push({ prototypeIdx: k, similarity: sim });
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }

  /**
   * Temporal integration: apply exponential decay over activation history.
   */
  private temporalIntegrate(current: Float64Array): Float64Array {
    this.activationHistory.push(new Float64Array(current));
    while (this.activationHistory.length > this.historyMaxLen) this.activationHistory.shift();

    const nR = current.length;
    const integrated = new Float64Array(nR);
    let totalWeight = 0;

    for (let t = 0; t < this.activationHistory.length; t++) {
      const w = Math.exp(-0.5 * (this.activationHistory.length - 1 - t));
      totalWeight += w;
      for (let r = 0; r < nR; r++) {
        integrated[r] += (this.activationHistory[t][r] ?? 0) * w;
      }
    }

    for (let r = 0; r < nR; r++) integrated[r] /= totalWeight;
    return integrated;
  }

  /**
   * Encode olfactory reading → latent z_olfactory.
   */
  encode(reading: OlfactoryReading): ModalityEmbedding {
    if (reading.deviceState !== 'active' || reading.receptorActivations.length === 0) {
      return {
        z: new Float64Array(this.config.latentDim),
        modality: 'olfactory',
        confidence: 0,
        timestamp: reading.timestamp,
        metadata: { deviceState: reading.deviceState, empty: 'true' },
      };
    }

    const nR = this.config.olfactoryReceptors;
    const d = this.config.fusionHiddenDim;

    // 1. Process receptor activations with Hill equation
    const hillActivations = new Float64Array(nR);
    for (let r = 0; r < nR; r++) {
      const raw = reading.receptorActivations[r] ?? 0;
      const conc = reading.concentrations[r] ?? 0;
      hillActivations[r] = raw * this.hillResponse(conc);
    }

    // 2. Temporal integration
    const integrated = this.temporalIntegrate(hillActivations);

    // 3. Embed receptor activations
    const receptorH = this.receptorEmbed.mulVec(integrated);

    // 4. Embed concentrations (log-scale)
    const logConc = new Float64Array(nR);
    for (let r = 0; r < nR; r++) logConc[r] = Math.log1p(reading.concentrations[r] ?? 0);
    const concH = this.concentrationEmbed.mulVec(logConc);

    // 5. Temporal phase embedding
    const phaseIdx = reading.temporalPhase === 'onset' ? 0
      : reading.temporalPhase === 'sustained' ? 1
        : reading.temporalPhase === 'offset' ? 2 : 3;
    const phaseH = new Float64Array(d);
    for (let i = 0; i < d; i++) phaseH[i] = this.temporalEmbed[phaseIdx * d + i];

    // 6. Concatenate and encode: [receptor || concentration || phase]
    const concat = new Float64Array(d * 3);
    concat.set(receptorH, 0);
    concat.set(concH, d);
    concat.set(phaseH, d * 2);

    let h = layerNorm(concat);
    h = vecAdd(this.encoderW1.mulVec(h), this.encoderB1);
    for (let i = 0; i < h.length; i++) h[i] = gelu(h[i]);
    h = layerNorm(h);
    h = vecAdd(this.encoderW2.mulVec(h), this.encoderB2);

    // 7. Project to latent
    const z = vecAdd(this.projector.mulVec(layerNorm(h)), this.projBias);

    // 8. Codebook matching for interpretability
    const matches = this.matchCodebook(integrated);

    return {
      z,
      modality: 'olfactory',
      confidence: Math.min(1, vecNorm(z) / Math.sqrt(this.config.latentDim)) *
        (reading.neuronViability / 100),
      timestamp: reading.timestamp,
      metadata: {
        activeReceptors: Array.from(integrated).filter(v => v > 0.05).length,
        totalReceptors: nR,
        temporalPhase: reading.temporalPhase,
        neuronViability: reading.neuronViability,
        detectedCompounds: reading.detectedCompounds.join(', '),
        topPrototype: matches[0]?.prototypeIdx ?? -1,
        topSimilarity: +(matches[0]?.similarity ?? 0).toFixed(4),
        integrationWindow: this.activationHistory.length,
        encoder: 'Koniku Kore (64-channel chemoreceptor, Hill kinetics)',
      },
    };
  }

  /** Reset temporal history (e.g. new trial) */
  resetHistory(): void {
    this.activationHistory = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CROSS-MODAL FUSION — Attention-Based Multimodal Integration
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cross-Modal Fusion Module
 *
 * Fuses modality-specific embeddings (visual, audio, olfactory) with the
 * SNN state embedding from the World Model into a unified latent z.
 *
 * Architecture:
 *   z_fused = Σ_m α_m · W_m · z_m   (attention-weighted projection)
 *
 * Where α_m are learned attention weights computed via:
 *   α = softmax(W_q · z_snn ⊙ W_k · z_modality)
 *
 * This allows the SNN state to "attend" to the most relevant modalities,
 * implementing a form of neural workspace bottleneck (GWT-inspired).
 */
export class CrossModalFusion {
  private queryProj: DenseMatrix;      // SNN z → query
  private keyProjs: Map<string, DenseMatrix>;   // Per-modality key projections
  private valueProjs: Map<string, DenseMatrix>; // Per-modality value projections
  private outputProj: DenseMatrix;     // Fused → output
  private outputBias: Float64Array;
  private readonly config: SensorConfig;
  

  constructor(config: SensorConfig = DEFAULT_SENSOR_CONFIG) {
    this.config = config;
    const d = config.latentDim;
    

    this.queryProj = DenseMatrix.xavier(d, d);
    this.keyProjs = new Map();
    this.valueProjs = new Map();

    for (const mod of ['visual', 'audio', 'olfactory', 'snn']) {
      this.keyProjs.set(mod, DenseMatrix.xavier(d, d));
      this.valueProjs.set(mod, DenseMatrix.xavier(d, d));
    }

    this.outputProj = DenseMatrix.xavier(d, d);
    this.outputBias = new Float64Array(d);
  }

  /**
   * Fuse modality embeddings with the SNN state embedding.
   *
   * @param snnZ     - World Model SNN state embedding (z_t from encoder)
   * @param modalities - Array of per-modality embeddings
   * @returns Fused embedding compatible with the World Model latent space
   */
  fuse(snnZ: Float64Array, modalities: ModalityEmbedding[]): FusedEmbedding {
    const d = this.config.latentDim;

    // Prepare all inputs (SNN + available modalities)
    const inputs: { key: string; z: Float64Array; confidence: number }[] = [
      { key: 'snn', z: snnZ, confidence: 1.0 },
    ];

    for (const m of modalities) {
      if (m.confidence > 0) {
        inputs.push({ key: m.modality, z: m.z, confidence: m.confidence });
      }
    }

    // Query from SNN state
    const q = this.queryProj.mulVec(layerNorm(snnZ));

    // Compute attention scores for each input
    const scores = new Float64Array(inputs.length);
    for (let i = 0; i < inputs.length; i++) {
      const keyProj = this.keyProjs.get(inputs[i].key) ?? this.keyProjs.get('snn')!;
      const k = keyProj.mulVec(layerNorm(inputs[i].z));
      // Scaled dot-product attention
      scores[i] = vecDot(q, k) / Math.sqrt(d) + Math.log(inputs[i].confidence + 1e-8);
    }

    // Softmax attention weights
    const weights = softmax(scores);

    // Weighted sum of values
    const fused = new Float64Array(d);
    for (let i = 0; i < inputs.length; i++) {
      const valueProj = this.valueProjs.get(inputs[i].key) ?? this.valueProjs.get('snn')!;
      const v = valueProj.mulVec(layerNorm(inputs[i].z));
      for (let j = 0; j < d; j++) fused[j] += weights[i] * v[j];
    }

    // Output projection
    const z = vecAdd(this.outputProj.mulVec(layerNorm(fused)), this.outputBias);

    // Extract per-modality weights
    const modalityWeights = { visual: 0, audio: 0, olfactory: 0, snn: 0 };
    for (let i = 0; i < inputs.length; i++) {
      const key = inputs[i].key as keyof typeof modalityWeights;
      modalityWeights[key] = Math.round(weights[i] * 1e4) / 1e4;
    }

    // Compute cross-modal coherence (mean pairwise cosine between modality embeddings)
    let coherence = 0;
    let pairs = 0;
    for (let i = 0; i < modalities.length; i++) {
      for (let j = i + 1; j < modalities.length; j++) {
        const ni = vecNorm(modalities[i].z);
        const nj = vecNorm(modalities[j].z);
        if (ni > 0 && nj > 0) {
          coherence += vecDot(modalities[i].z, modalities[j].z) / (ni * nj);
          pairs++;
        }
      }
    }
    if (pairs > 0) coherence /= pairs;

    return {
      z,
      modalityWeights,
      modalityEmbeddings: modalities,
      coherence: Math.round(coherence * 1e4) / 1e4,
      timestamp: Math.max(...inputs.map(i => modalities.find(m => m.modality === i.key)?.timestamp ?? 0), 0),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SENSOR PIPELINE — Orchestrator
// ═══════════════════════════════════════════════════════════════════════════

/**
 * MultimodalSensorPipeline
 *
 * Orchestrates all encoders and the fusion module.
 * Provides a unified API for processing multimodal observations.
 */
export class MultimodalSensorPipeline {
  public readonly visual: VJEPAEncoder;
  public readonly audio: AJEPAEncoder;
  public readonly olfactory: KonikuOlfactoryEncoder;
  public readonly fusion: CrossModalFusion;
  public readonly config: SensorConfig;

  private processedCount = 0;
  private lastFused: FusedEmbedding | null = null;
  private modalityCounts = { visual: 0, audio: 0, olfactory: 0 };

  constructor(config: Partial<SensorConfig> = {}) {
    this.config = { ...DEFAULT_SENSOR_CONFIG, ...config };
    this.visual = new VJEPAEncoder(this.config);
    this.audio = new AJEPAEncoder(this.config);
    this.olfactory = new KonikuOlfactoryEncoder(this.config);
    this.fusion = new CrossModalFusion(this.config);
  }

  /**
   * Process a full multimodal observation and fuse with SNN state.
   *
   * @param observation - Multimodal sensor data (any/all modalities)
   * @param snnZ - Current SNN state embedding from World Model encoder
   * @returns Fused embedding integrating all available modalities
   */
  process(observation: MultimodalObservation, snnZ: Float64Array): FusedEmbedding {
    const embeddings: ModalityEmbedding[] = [];

    // V-JEPA: Process visual input
    if (observation.visual) {
      let visualEmb: ModalityEmbedding;
      if ('frames' in observation.visual) {
        visualEmb = this.visual.encodeVideo(observation.visual as VideoClip);
      } else {
        visualEmb = this.visual.encodeFrame(observation.visual as ImageFrame);
      }
      embeddings.push(visualEmb);
      this.modalityCounts.visual++;
    }

    // A-JEPA: Process audio input
    if (observation.audio) {
      const audioEmb = this.audio.encode(observation.audio);
      embeddings.push(audioEmb);
      this.modalityCounts.audio++;
    }

    // Koniku: Process olfactory input
    if (observation.olfactory) {
      const olfEmb = this.olfactory.encode(observation.olfactory);
      embeddings.push(olfEmb);
      this.modalityCounts.olfactory++;
    }

    // Cross-modal fusion with SNN state
    const fused = this.fusion.fuse(snnZ, embeddings);

    this.processedCount++;
    this.lastFused = fused;

    return fused;
  }

  /** Get processing statistics */
  getStats(): Record<string, any> {
    return {
      processed: this.processedCount,
      modalities: { ...this.modalityCounts },
      lastFusion: this.lastFused ? {
        weights: this.lastFused.modalityWeights,
        coherence: this.lastFused.coherence,
        modalitiesActive: this.lastFused.modalityEmbeddings.length,
      } : null,
      config: {
        visualPatchSize: this.config.visualPatchSize,
        visualMaskRatio: this.config.visualMaskRatio,
        audioMelBins: this.config.audioMelBins,
        audioMaskRatio: this.config.audioMaskRatio,
        olfactoryReceptors: this.config.olfactoryReceptors,
        latentDim: this.config.latentDim,
        fusionHeads: this.config.fusionHeads,
      },
    };
  }

  /** Get last fused embedding */
  getLastFused(): FusedEmbedding | null { return this.lastFused; }

  /** Reset all temporal state */
  reset(): void {
    this.olfactory.resetHistory();
    this.processedCount = 0;
    this.lastFused = null;
    this.modalityCounts = { visual: 0, audio: 0, olfactory: 0 };
  }
}
