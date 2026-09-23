/**
 * ASTRA — Layered SNN LIF+STDP Engine
 * Sparse weights (Map-indexed adjacency lists), event-driven STDP, ring buffer spike history.
 * Default: 32→64→16→16 = 128 neurons.
 * © 2026 Christophe Jean Legros — Geneva
 */

interface LayerConfig { name: string; size: number; }


export class SNNEngine {
  private _N: number;
  private layers: LayerConfig[];
  private layerOffsets: number[];
  private v: Float64Array;          // Membrane potentials
  private firingRates: Float64Array; // Per-neuron firing rates
  private lastSpike: Float64Array;  // Last spike time per neuron
  private refractory: Float64Array; // Refractory countdown
  private weights: Map<number, Map<number, number>>; // Sparse adjacency
  private timestep = 0;
  private _stdpCount = 0;
  private spikeHistory: { neuron: number; time: number }[] = [];
  private readonly maxHistory = 2000;

  // Biophysical parameters
  private readonly tauM = 20;    // ms
  private readonly vRest = -65;  // mV
  private readonly vTh = -50;    // mV
  private readonly vReset = -70; // mV
  private readonly refractMs = 2;

  // STDP parameters
  private readonly aPlus = 0.01;
  private readonly aMinus = 0.012;
  private readonly tauPlus = 20;
  private readonly tauMinus = 20;

  // Noise
  private readonly noiseMin = 10;
  private readonly noiseMax = 22;

  constructor(config?: any) {
    this.layers = config?.layers ?? [
      { name: 'input', size: 32 },
      { name: 'hidden_1', size: 64 },
      { name: 'hidden_2', size: 16 },
      { name: 'output', size: 16 },
    ];
    this._N = this.layers.reduce((s, l) => s + l.size, 0);
    this.layerOffsets = [];
    let off = 0;
    for (const l of this.layers) { this.layerOffsets.push(off); off += l.size; }

    this.v = new Float64Array(this._N).fill(this.vRest);
    this.firingRates = new Float64Array(this._N);
    this.lastSpike = new Float64Array(this._N).fill(-Infinity);
    this.refractory = new Float64Array(this._N);
    this.weights = new Map();

    this.initConnectivity();
  }

  private initConnectivity(): void {
    const ffProb = 0.3;
    const recProb = 0.1;
    for (let l = 0; l < this.layers.length - 1; l++) {
      const srcOff = this.layerOffsets[l];
      const srcSize = this.layers[l].size;
      const dstOff = this.layerOffsets[l + 1];
      const dstSize = this.layers[l + 1].size;
      // Feed-forward
      for (let s = 0; s < srcSize; s++) {
        for (let d = 0; d < dstSize; d++) {
          if (Math.random() < ffProb) {
            const w = (Math.random() - 0.3) * 0.5;
            this.setWeight(srcOff + s, dstOff + d, w);
          }
        }
      }
    }
    // Recurrent within layers
    for (let l = 0; l < this.layers.length; l++) {
      const off = this.layerOffsets[l];
      const size = this.layers[l].size;
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          if (i !== j && Math.random() < recProb) {
            this.setWeight(off + i, off + j, (Math.random() - 0.5) * 0.2);
          }
        }
      }
    }
  }

  private setWeight(src: number, dst: number, w: number): void {
    if (!this.weights.has(src)) this.weights.set(src, new Map());
    this.weights.get(src)!.set(dst, w);
  }

  step(dt: number = 1.0): number {
    this.timestep++;
    let spikes = 0;
    const spiked: number[] = [];

    for (let i = 0; i < this._N; i++) {
      if (this.refractory[i] > 0) { this.refractory[i] -= dt; continue; }

      // LIF dynamics: dv/dt = -(v - vRest) / tauM + noise
      const noise = this.noiseMin + Math.random() * (this.noiseMax - this.noiseMin);
      this.v[i] += (-(this.v[i] - this.vRest) / this.tauM + noise * 0.1) * dt;

      // Synaptic input
      // Synaptic input handled via spike propagation
      // (In a proper implementation, input comes from pre-synaptic spikes)

      // Spike?
      if (this.v[i] >= this.vTh) {
        this.v[i] = this.vReset;
        this.refractory[i] = this.refractMs;
        this.lastSpike[i] = this.timestep;
        spiked.push(i);
        spikes++;

        // Propagate to post-synaptic neurons
        const targets = this.weights.get(i);
        if (targets) {
          for (const [dst, w] of targets) {
            this.v[dst] += w * 5; // PSP
          }
        }
      }
    }

    // Event-driven STDP
    for (const pre of spiked) {
      const targets = this.weights.get(pre);
      if (!targets) continue;
      for (const [post, w] of targets) {
        const dtSpike = this.lastSpike[post] - this.timestep;
        if (dtSpike !== 0 && Math.abs(dtSpike) < 50) {
          const dw = dtSpike > 0
            ? this.aPlus * Math.exp(-Math.abs(dtSpike) / this.tauPlus)
            : -this.aMinus * Math.exp(-Math.abs(dtSpike) / this.tauMinus);
          targets.set(post, Math.max(-1, Math.min(1, w + dw)));
          this._stdpCount++;
        }
      }
    }

    // Update firing rates (exponential moving average)
    const alpha = 0.05;
    for (let i = 0; i < this._N; i++) {
      const fired = spiked.includes(i) ? 1 : 0;
      this.firingRates[i] = (1 - alpha) * this.firingRates[i] + alpha * (fired * 1000 / dt);
    }

    // Ring buffer spike history
    for (const n of spiked) {
      this.spikeHistory.push({ neuron: n, time: this.timestep });
    }
    while (this.spikeHistory.length > this.maxHistory) this.spikeHistory.shift();

    return spikes;
  }

  reset(): void {
    this.v.fill(this.vRest);
    this.firingRates.fill(0);
    this.lastSpike.fill(-Infinity);
    this.refractory.fill(0);
    this.timestep = 0;
    this._stdpCount = 0;
    this.spikeHistory = [];
    this.initConnectivity();
  }

  getNeuronCount(): number { return this.N; }
  getLayerSizes(): number[] { return this.layers.map(l => l.size); }
  getSynapseCount(): number {
    let count = 0;
    for (const targets of this.weights.values()) count += targets.size;
    return count;
  }

  getMetrics(): Record<string, any> {
    const meanFR = this.firingRates.reduce((a, b) => a + b, 0) / this._N;
    const active = Array.from(this.firingRates).filter(r => r > 0.1).length;
    return {
      timestep: this.timestep,
      neurons: this.N,
      synapses: this.getSynapseCount(),
      stdpUpdates: this._stdpCount,
      meanFiringRate: Math.round(meanFR * 100) / 100,
      activeNeurons: active,
      recentSpikes: this.spikeHistory.slice(-20).length,
    };
  }

  getState(): Record<string, any> {
    return {
      ...this.getMetrics(),
      layers: this.layers,
      params: { tauM: this.tauM, vTh: this.vTh, vReset: this.vReset, refractMs: this.refractMs },
      stdp: { aPlus: this.aPlus, aMinus: this.aMinus, tauPlus: this.tauPlus, tauMinus: this.tauMinus },
    };
  }

  getTopology(): Record<string, any> {
    return {
      layers: this.layers,
      totalNeurons: this.N,
      totalSynapses: this.getSynapseCount(),
      connectivity: { feedForward: 0.3, recurrent: 0.1 },
      weightStorage: 'Map-indexed sparse adjacency lists',
    };
  }

  /** Weight stats per layer for WM observation */
  getWeightStats(): { mean: number; std: number; sparsity: number }[] {
    return this.layers.map((layer, idx) => {
      const off = this.layerOffsets[idx];
      const size = layer.size;
      const ws: number[] = [];
      for (let i = off; i < off + size; i++) {
        const targets = this.weights.get(i);
        if (targets) for (const w of targets.values()) ws.push(w);
      }
      if (ws.length === 0) return { mean: 0, std: 0, sparsity: 1 };
      const mean = ws.reduce((a, b) => a + b, 0) / ws.length;
      const variance = ws.reduce((a, b) => a + (b - mean) ** 2, 0) / ws.length;
      return { mean, std: Math.sqrt(variance), sparsity: 1 - ws.length / (size * size) };
    });
  }

  // ── Public getters (test-compatible API) ──

  /** Total neuron count */
  get N(): number { return this._N; }

  /** Layer configuration array with offset */
  get layerInfo(): { name: string; size: number; offset: number }[] {
    return this.layers.map((l, i) => ({ name: l.name, size: l.size, offset: this.layerOffsets[i] }));
  }

  /** Total synapse count */
  get synCount(): number { return this.getSynapseCount(); }

  /** Simulation time (ms) */
  get time(): number { return this.timestep; }
  set time(v: number) { this.timestep = v; }

  /** Total step count */
  get stepCount(): number { return this.timestep; }

  /** STDP update count */
  get stdpCount(): number { return this._stdpCount; }
  set stdpCount(v: number) { this._stdpCount = v; }

  /** Engine parameters (read-only) */
  get config(): { vRest: number; vTh: number; vReset: number; tauM: number; refractMs: number } {
    return { vRest: this.vRest, vTh: this.vTh, vReset: this.vReset, tauM: this.tauM, refractMs: this.refractMs };
  }

  /** Raw voltage array (read-only view) */
  get voltages(): Float64Array { return this.v; }

  /** Run N steps, return aggregate result */
  run(n: number): { totalSpikes: number; time: number } {
    let total = 0;
    for (let i = 0; i < n; i++) total += this.step();
    return { totalSpikes: total, time: this.timestep };
  }

  /** Alias for reset() */
  init(): void { this.reset(); }

  /** Stats in test-expected format */
  stats(): {
    neurons: number; synapses: number; layers: LayerConfig[];
    firingRateStats: { mean: number; active: number };
  } {
    const fr = Array.from(this.firingRates);
    const mean = fr.reduce((a, b) => a + b, 0) / this._N;
    const active = fr.filter(r => r > 0.1).length;
    return {
      neurons: this._N,
      synapses: this.getSynapseCount(),
      layers: [...this.layers],
      firingRateStats: { mean, active },
    };
  }

  /**
   * Aggregate weight statistics (test-compatible format).
   * Note: getWeightStats() returns per-layer; this returns aggregate.
   */
  weightStats(): { mean: number; std: number; nonZero: number; total: number; sparsity: number; max: number; min: number } {
    const allW: number[] = [];
    for (const targets of this.weights.values()) {
      for (const w of targets.values()) allW.push(w);
    }
    if (allW.length === 0) return { mean: 0, std: 0, nonZero: 0, total: 0, sparsity: 1, max: 0, min: 0 };
    const mean = allW.reduce((a, b) => a + b, 0) / allW.length;
    const variance = allW.reduce((a, b) => a + (b - mean) ** 2, 0) / allW.length;
    const nonZero = allW.filter(w => Math.abs(w) > 1e-6).length;
    const max = Math.max(...allW);
    const min = Math.min(...allW);
    return { mean, std: Math.sqrt(variance), nonZero, total: allW.length, sparsity: 1 - nonZero / Math.max(1, allW.length), max, min };
  }

  /** Per-layer firing rates keyed by layer name */
  layerRates(): Record<string, number> {
    const result: Record<string, number> = {};
    for (let l = 0; l < this.layers.length; l++) {
      const off = this.layerOffsets[l];
      const size = this.layers[l].size;
      let sum = 0;
      for (let i = off; i < off + size; i++) sum += this.firingRates[i];
      result[this.layers[l].name] = sum / size;
    }
    return result;
  }

  /**
   * Inject spikes by layer name (test-compatible overload).
   * Signature: injectSpikes(layerName, count, amplitude) → { count, target, amplitude, stimulatedNeurons }
   * Also supports: injectSpikes(neuronIds[], strength) → { injected, affected }
   */
  injectSpikes(targetOrIds: string | number[], countOrStrength: number, amplitude?: number):
    { count: number; target: string; amplitude: number; stimulatedNeurons: number[] } |
    { injected: number; affected: number[] } {

    // Overload: layer-name API (test-compatible)
    if (typeof targetOrIds === 'string') {
      const layerName = targetOrIds;
      const count = countOrStrength;
      const amp = amplitude ?? 3.0;
      const layerIdx = this.layers.findIndex(l => l.name === layerName);
      if (layerIdx < 0) return { count: 0, target: layerName, amplitude: amp, stimulatedNeurons: [] };

      const off = this.layerOffsets[layerIdx];
      const size = this.layers[layerIdx].size;
      const n = Math.min(count, size);
      const indices: number[] = [];

      // Pick random neurons in the layer
      const available = Array.from({ length: size }, (_, i) => off + i);
      for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
      }
      for (let i = 0; i < n; i++) {
        this.v[available[i]] += amp;
        indices.push(available[i]);
      }

      return { count: n, target: layerName, amplitude: amp, stimulatedNeurons: indices.sort((a, b) => a - b) };
    }

    // Overload: array API (server.ts compatible)
    const neuronIds = targetOrIds;
    const strength = countOrStrength;
    const affected: number[] = [];
    for (const id of neuronIds) {
      if (id >= 0 && id < this._N) {
        this.v[id] += strength;
        affected.push(id);
      }
    }
    return { injected: affected.length, affected };
  }
}

// ── Singleton & legacy API aliases ──
const _defaultEngine = new SNNEngine();

export const snnEngine = {
  /** Run N steps */
  run(n: number) { return _defaultEngine.run(n); },
  /** Stats for ACM */
  stats() { return _defaultEngine.stats(); },
  /** Weight stats for ACM */
  weightStats() { return _defaultEngine.getWeightStats(); },
  /** Get underlying engine instance */
  get engine() { return _defaultEngine; },
};
