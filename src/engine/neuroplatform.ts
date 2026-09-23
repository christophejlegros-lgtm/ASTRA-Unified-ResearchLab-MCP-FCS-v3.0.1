/**
 * ASTRA — FinalSpark NeuroPlatform v2 Integration Engine
 * ══════════════════════════════════════════════════════
 *
 * Faithful TypeScript port of the FinalSpark NeuroPlatform v2 control API
 * (https://finalspark-np.github.io/np-docs/np_core/doc_v2.html), backed by a
 * biophysically-plausible organoid simulator so the full closed-loop can run
 * without physical hardware. The class surface mirrors the official Python SDK:
 *
 *   StimParam · StimPolarity · StimShape · MEA            (utils.schemas / enumerations)
 *   IntanController   — _send_stimparam · _upload_stimparam · _count_spike · _close
 *   TriggerController — send(16×uint8) · close
 *   DatabaseController — get_all_triggers · get_spike_count · get_spike_event · get_raw_spike
 *   CameraController   — _last_capture · _image_from
 *
 * Simulation backend
 * ──────────────────
 * A 128-electrode MEA (matching ASTRA's 128-neuron SNN) of human-neuron
 * organoids. Each electrode carries a homogeneous-Poisson background process,
 * an absolute refractory period, RMS electrode noise, and a stimulation-evoked
 * post-synaptic response whose probability scales with delivered charge
 * (Q = phase_duration1 × phase_amplitude1). Heavy charge injection degrades
 * local viability, which the ASTRA IRB ethics gateway can monitor.
 *
 * ⚠ Disclaimer. In `simulate` mode the spike data are synthetic surrogates with
 * realistic statistics, NOT recordings from living tissue. A `live` transport
 * stub is provided for sites with NeuroPlatform credentials (see Python bridge).
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 * Upstream API: © FinalSpark, Vevey, Switzerland
 */

// ─── Enumerations (utils.enumerations) ──────────────────────────────────────

export enum StimPolarity {
  NegativeFirst = 'NegativeFirst',
  PositiveFirst = 'PositiveFirst',
}

export enum StimShape {
  Biphasic = 'Biphasic',
  Triphasic = 'Triphasic',
}

/** Multi-Electrode Array selector (NeuroPlatform hosts up to 4 organoids / MEA). */
export enum MEA {
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
}

export const ELECTRODE_COUNT = 128;
export const TRIGGER_COUNT = 16;
export const RAW_WINDOW_MS = 3; // NeuroPlatform stores ~3 ms of raw data around each spike

// ─── StimParam (utils.schemas) ──────────────────────────────────────────────

export interface StimParamFields {
  enable: boolean;
  index: number;             // electrode index [0-127]
  trigger_key: number;       // trigger key [0-15]
  polarity: StimPolarity;
  phase_duration1: number;   // D1 [us]
  phase_amplitude1: number;  // A1 [uA]
  phase_duration2: number;   // D2 [us]
  phase_amplitude2: number;  // A2 [uA]
  stim_shape: StimShape;
  interphase_delay: number;  // [us]
  trigger_delay: number;     // post-trigger delay [us]
  nb_pulse: number;          // number of pulses (burst)
  pulse_train_period: number;// [us]
  post_stim_ref_period: number;     // [us]
  enable_amp_settle: boolean;
  pre_stim_amp_settle: number;      // [us]
  post_stim_amp_settle: number;     // [us]
  enable_charge_recovery: boolean;
  post_charge_recovery_on: number;  // [us]
  post_charge_recovery_off: number; // [us]
}

/**
 * Stimulation parameter object — mirrors `neuroplatformv2.utils.schemas.StimParam`.
 * Defaults match the documented StimParam reference table.
 */
export class StimParam implements StimParamFields {
  enable = true;
  index = 0;
  trigger_key = 0;
  polarity: StimPolarity = StimPolarity.NegativeFirst;
  phase_duration1 = 100.0;
  phase_amplitude1 = 1.0;
  phase_duration2 = 100.0;
  phase_amplitude2 = 1.0;
  stim_shape: StimShape = StimShape.Biphasic;
  interphase_delay = 0.0;
  trigger_delay = 0;
  nb_pulse = 0;
  pulse_train_period = 10000;
  post_stim_ref_period = 1000.0;
  enable_amp_settle = true;
  pre_stim_amp_settle = 0.0;
  post_stim_amp_settle = 1000.0;
  enable_charge_recovery = true;
  post_charge_recovery_on = 0.0;
  post_charge_recovery_off = 100.0;

  constructor(init: Partial<StimParamFields> = {}) {
    Object.assign(this, init);
  }

  /** Charge of the leading phase, in picocoulombs (Q = D[us] × A[uA] = pC). */
  get charge1_pC(): number {
    return this.phase_duration1 * this.phase_amplitude1;
  }

  /** Charge of the second phase, in picocoulombs. */
  get charge2_pC(): number {
    return this.phase_duration2 * this.phase_amplitude2;
  }

  /**
   * Charge-balance check. The docs strongly recommend
   * phase_duration1 × phase_amplitude1 == phase_duration2 × phase_amplitude2
   * to protect organoid + electrode lifetime. `tol` is a relative tolerance.
   */
  isChargeBalanced(tol = 1e-6): boolean {
    const q1 = this.charge1_pC, q2 = this.charge2_pC;
    const denom = Math.max(Math.abs(q1), Math.abs(q2), 1e-12);
    return Math.abs(q1 - q2) / denom <= tol;
  }

  /** Net (unbalanced) residual charge in pC — should be ~0 for safe stimulation. */
  get netCharge_pC(): number {
    return this.charge1_pC - this.charge2_pC;
  }

  /** Validate field ranges. Returns a list of human-readable problems (empty = valid). */
  validate(): string[] {
    const errs: string[] = [];
    if (!Number.isInteger(this.index) || this.index < 0 || this.index >= ELECTRODE_COUNT)
      errs.push(`index ${this.index} out of range [0-${ELECTRODE_COUNT - 1}]`);
    if (!Number.isInteger(this.trigger_key) || this.trigger_key < 0 || this.trigger_key >= TRIGGER_COUNT)
      errs.push(`trigger_key ${this.trigger_key} out of range [0-${TRIGGER_COUNT - 1}]`);
    for (const k of ['phase_duration1', 'phase_amplitude1', 'phase_duration2', 'phase_amplitude2'] as const) {
      if (!Number.isFinite(this[k]) || this[k] < 0) errs.push(`${k} must be finite and ≥ 0`);
    }
    if (this.phase_amplitude1 > 50 || this.phase_amplitude2 > 50)
      errs.push('phase amplitude > 50 µA exceeds safe organoid stimulation range');
    if (this.nb_pulse < 0 || !Number.isInteger(this.nb_pulse))
      errs.push('nb_pulse must be a non-negative integer');
    return errs;
  }

  display_attributes(): StimParamFields & { charge1_pC: number; charge2_pC: number; balanced: boolean } {
    return {
      enable: this.enable, index: this.index, trigger_key: this.trigger_key, polarity: this.polarity,
      phase_duration1: this.phase_duration1, phase_amplitude1: this.phase_amplitude1,
      phase_duration2: this.phase_duration2, phase_amplitude2: this.phase_amplitude2,
      stim_shape: this.stim_shape, interphase_delay: this.interphase_delay,
      trigger_delay: this.trigger_delay, nb_pulse: this.nb_pulse, pulse_train_period: this.pulse_train_period,
      post_stim_ref_period: this.post_stim_ref_period, enable_amp_settle: this.enable_amp_settle,
      pre_stim_amp_settle: this.pre_stim_amp_settle, post_stim_amp_settle: this.post_stim_amp_settle,
      enable_charge_recovery: this.enable_charge_recovery, post_charge_recovery_on: this.post_charge_recovery_on,
      post_charge_recovery_off: this.post_charge_recovery_off,
      charge1_pC: this.charge1_pC, charge2_pC: this.charge2_pC, balanced: this.isChargeBalanced(1e-3),
    };
  }
}

// ─── Deterministic RNG (seedable, for reproducible tests) ───────────────────

/** Mulberry32 — small, fast, reproducible PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Exponential inter-spike interval for a homogeneous Poisson process of rate λ (Hz). */
function expInterval(rng: () => number, rateHz: number): number {
  const u = Math.max(1e-12, rng());
  return -Math.log(u) / Math.max(1e-6, rateHz); // seconds
}

// ─── Organoid MEA simulator ─────────────────────────────────────────────────

export interface ElectrodeState {
  index: number;
  baselineRateHz: number;   // spontaneous firing rate
  rmsNoise_uV: number;      // electrode RMS noise
  viability: number;        // local tissue viability [0-100]
  lastSpikeT: number;       // sim-clock seconds
  totalSpikes: number;
  cumulativeCharge_nC: number;
}

export interface SpikeEvent {
  channel: number;          // electrode index
  time: string;             // ISO timestamp
  tSec: number;             // sim-clock seconds (for raw fetch)
  amplitude_uV: number;
}

export interface TriggerEventRecord {
  time: string;
  trigger_key: number;
  up: 0 | 1;
}

export interface NeuroPlatformConfig {
  mode: 'simulate' | 'live';
  mea: MEA;
  fsname: string;           // experiment ID, e.g. "fs264"
  seed: number;
  baselineRateHz: number;   // mean spontaneous rate across electrodes
  evokedGain: number;       // evoked-response sensitivity to charge
  noiseFloor_uV: number;    // base RMS noise
}

const DEFAULT_CONFIG: NeuroPlatformConfig = {
  mode: 'simulate',
  mea: MEA.Five,
  fsname: 'fs264',
  seed: 0xA57A,
  baselineRateHz: 2.0,
  evokedGain: 0.018, // probability of evoked spike per pC of (balanced) charge
  noiseFloor_uV: 6.5,
};

/**
 * Biophysically-plausible 128-electrode organoid model.
 * Generates background + stimulation-evoked spiking, tracks per-electrode
 * viability, and logs spike/trigger events into an in-memory time-series DB.
 */
export class OrganoidMEA {
  readonly config: NeuroPlatformConfig;
  private rng: () => number;
  electrodes: ElectrodeState[] = [];
  private clockSec = 0; // monotonic sim clock
  private startWall = Date.now();

  // In-memory database (bounded ring buffers)
  private spikeLog: SpikeEvent[] = [];
  private triggerLog: TriggerEventRecord[] = [];
  private readonly maxLog = 200_000;

  // Aggregate stats
  totalStimulations = 0;
  totalChargeDelivered_nC = 0;

  constructor(config: Partial<NeuroPlatformConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rng = mulberry32(this.config.seed);
    this.initElectrodes();
  }

  private initElectrodes(): void {
    this.electrodes = [];
    for (let i = 0; i < ELECTRODE_COUNT; i++) {
      // Heterogeneous baseline: log-normal-ish around the configured mean
      const jitter = 0.4 + 1.2 * this.rng();
      this.electrodes.push({
        index: i,
        baselineRateHz: this.config.baselineRateHz * jitter,
        rmsNoise_uV: this.config.noiseFloor_uV * (0.8 + 0.5 * this.rng()),
        viability: 92 + 6 * this.rng(),
        lastSpikeT: 0,
        totalSpikes: 0,
        cumulativeCharge_nC: 0,
      });
    }
  }

  /** Wall-clock ISO for a given sim-clock offset (seconds). */
  private isoAt(tSec: number): string {
    return new Date(this.startWall + tSec * 1000).toISOString();
  }

  /** Append to spike log with bound. */
  private logSpike(ev: SpikeEvent): void {
    this.spikeLog.push(ev);
    if (this.spikeLog.length > this.maxLog) this.spikeLog.splice(0, this.spikeLog.length - this.maxLog);
  }

  /**
   * Advance the simulator by `ms` milliseconds, accumulating spontaneous spikes
   * on every electrode (homogeneous Poisson via exponential intervals).
   * Returns the per-electrode spike count over the interval — this is exactly
   * what `IntanController._count_spike(ms)` reports in closed-loop mode.
   */
  advance(ms: number): Int32Array {
    const dt = ms / 1000;
    const counts = new Int32Array(ELECTRODE_COUNT);
    const tEnd = this.clockSec + dt;
    const refractorySec = 0.0015; // 1.5 ms absolute refractory

    for (const e of this.electrodes) {
      // Viability scales effective firing rate (dead tissue is silent).
      const rate = e.baselineRateHz * (e.viability / 100);
      let t = e.lastSpikeT > this.clockSec ? e.lastSpikeT : this.clockSec;
      // Fast-forward to window start respecting refractory.
      while (true) {
        const next = t + Math.max(refractorySec, expInterval(this.rng, rate));
        if (next >= tEnd) break;
        if (next >= this.clockSec) {
          counts[e.index]++;
          e.totalSpikes++;
          const amp = 30 + 90 * this.rng(); // µV spike amplitude
          this.logSpike({ channel: e.index, time: this.isoAt(next), tSec: next, amplitude_uV: amp });
          e.lastSpikeT = next;
        }
        t = next;
      }
    }
    this.clockSec = tEnd;
    return counts;
  }

  /**
   * Apply a stimulation described by `sp` (already validated) on its electrode.
   * Generates a probabilistic evoked burst on the target electrode and weak
   * network propagation to neighbours; degrades local viability by net charge.
   * Returns the number of evoked spikes attributed to this stimulation.
   */
  stimulate(sp: StimParam): number {
    const e = this.electrodes[sp.index];
    if (!e) return 0;

    const pulses = Math.max(1, sp.nb_pulse || 1);
    const qBalanced = Math.min(sp.charge1_pC, sp.charge2_pC); // effective therapeutic charge
    const qResidual = Math.abs(sp.netCharge_pC);              // damaging unbalanced charge

    let evoked = 0;
    for (let p = 0; p < pulses; p++) {
      // Evoked-response probability saturates (sigmoid on charge).
      const drive = this.config.evokedGain * qBalanced;
      const pEvoke = 1 - Math.exp(-drive) * (e.viability / 100);
      if (this.rng() < pEvoke) {
        evoked++;
        e.totalSpikes++;
        const amp = 60 + 140 * this.rng();
        this.clockSec += 0.0008; // ~0.8 ms evoked latency
        this.logSpike({ channel: e.index, time: this.isoAt(this.clockSec), tSec: this.clockSec, amplitude_uV: amp });
        // Network propagation: stochastic neighbour recruitment.
        const neigh = [sp.index - 1, sp.index + 1, sp.index - 16, sp.index + 16];
        for (const n of neigh) {
          if (n >= 0 && n < ELECTRODE_COUNT && this.rng() < 0.25 * pEvoke) {
            const ne = this.electrodes[n];
            ne.totalSpikes++;
            this.clockSec += 0.0003;
            this.logSpike({ channel: n, time: this.isoAt(this.clockSec), tSec: this.clockSec, amplitude_uV: 40 + 80 * this.rng() });
            evoked++;
          }
        }
      }
    }

    // Bookkeeping + viability cost (residual charge is the harmful part).
    const deliveredCharge_nC = (qBalanced * pulses) / 1000; // pC → nC
    e.cumulativeCharge_nC += deliveredCharge_nC;
    this.totalChargeDelivered_nC += deliveredCharge_nC;
    this.totalStimulations++;
    const damage = (qResidual * pulses) / 5000 + (qBalanced > 6000 ? 0.02 : 0);
    e.viability = Math.max(0, e.viability - damage);

    return evoked;
  }

  recordTrigger(trigger_key: number): void {
    const t = this.isoAt(this.clockSec);
    this.triggerLog.push({ time: t, trigger_key, up: 1 });
    this.triggerLog.push({ time: this.isoAt(this.clockSec + 0.001), trigger_key, up: 0 });
    if (this.triggerLog.length > this.maxLog) this.triggerLog.splice(0, this.triggerLog.length - this.maxLog);
  }

  // ── Database query backends (window in seconds relative to sim start) ──

  querySpikeEvents(startSec: number, stopSec: number): SpikeEvent[] {
    return this.spikeLog.filter((s) => s.tSec >= startSec && s.tSec <= stopSec);
  }

  /** Spikes-per-minute per electrode within [startSec, stopSec]. */
  querySpikeCount(startSec: number, stopSec: number): Array<{ index: number; spikes: number; perMinute: number }> {
    const dur = Math.max(1e-6, stopSec - startSec);
    const counts = new Int32Array(ELECTRODE_COUNT);
    for (const s of this.spikeLog) if (s.tSec >= startSec && s.tSec <= stopSec) counts[s.channel]++;
    return Array.from(counts, (c, i) => ({ index: i, spikes: c, perMinute: (c / dur) * 60 }));
  }

  queryTriggers(startSec: number, stopSec: number): TriggerEventRecord[] {
    // Mirror docs: caller usually filters up==1 to drop duplicates.
    const lo = this.isoAt(startSec), hi = this.isoAt(stopSec);
    return this.triggerLog.filter((t) => t.time >= lo && t.time <= hi);
  }

  /** Reconstruct ~3 ms of raw waveform around a spike (band-limited noise + biphasic spike). */
  getRawSpike(channel: number, tSec: number, sampleRateHz = 30000): { channel: number; tSec: number; sampleRateHz: number; samples: number[] } {
    const e = this.electrodes[channel];
    const n = Math.round((RAW_WINDOW_MS / 1000) * sampleRateHz);
    const samples = new Array<number>(n);
    const noise = e ? e.rmsNoise_uV : this.config.noiseFloor_uV;
    const spikeCenter = Math.floor(n / 3);
    for (let i = 0; i < n; i++) {
      let v = (this.rng() * 2 - 1) * noise;
      // Biphasic extracellular spike shape.
      const d = (i - spikeCenter) / (sampleRateHz / 1000); // ms from center
      v += -120 * Math.exp(-(d * d) / 0.06) + 45 * Math.exp(-((d - 0.4) ** 2) / 0.25);
      samples[i] = v;
    }
    return { channel, tSec, sampleRateHz, samples };
  }

  /** Mean firing rate (Hz) over the whole array, integrated since start. */
  meanFiringRateHz(): number {
    const elapsed = Math.max(1e-3, this.clockSec);
    const total = this.electrodes.reduce((a, e) => a + e.totalSpikes, 0);
    return total / elapsed / ELECTRODE_COUNT;
  }

  meanViability(): number {
    return this.electrodes.reduce((a, e) => a + e.viability, 0) / ELECTRODE_COUNT;
  }

  get simClockSec(): number { return this.clockSec; }
  get activeSpikeRecords(): number { return this.spikeLog.length; }

  reset(): void {
    this.rng = mulberry32(this.config.seed);
    this.clockSec = 0;
    this.startWall = Date.now();
    this.spikeLog = [];
    this.triggerLog = [];
    this.totalStimulations = 0;
    this.totalChargeDelivered_nC = 0;
    this.initElectrodes();
  }
}

// ─── Controllers (core.intan / core.trigger / core.database / core.camera) ──

/**
 * IntanController — controls the Intan software for stimulation + closed-loop
 * spike counting. Mirrors `neuroplatformv2.core.intan.IntanController`.
 */
export class IntanController {
  private uploaded: StimParam[] = [];
  private pending: StimParam[] = [];
  private closed = false;

  constructor(private mea: OrganoidMEA) {}

  /** _send_stimparam — stage parameters (not yet active on the headstage). */
  async sendStimParam(params: StimParam[]): Promise<{ staged: number; errors: Record<number, string[]> }> {
    this.assertOpen();
    const errors: Record<number, string[]> = {};
    params.forEach((p, i) => { const e = p.validate(); if (e.length) errors[i] = e; });
    this.pending = params.map((p) => p instanceof StimParam ? p : new StimParam(p));
    return { staged: this.pending.length, errors };
  }

  /** _upload_stimparam — commit staged parameters to the (simulated) headstage. */
  async uploadStimParam(): Promise<{ uploaded: number }> {
    this.assertOpen();
    // Enabled params replace any prior param sharing the same electrode index.
    const byIndex = new Map<number, StimParam>();
    for (const p of this.uploaded) byIndex.set(p.index, p);
    for (const p of this.pending) {
      if (p.enable) byIndex.set(p.index, p);
      else byIndex.delete(p.index);
    }
    this.uploaded = [...byIndex.values()];
    this.pending = [];
    return { uploaded: this.uploaded.length };
  }

  /** Look up the active StimParam bound to a trigger key. */
  paramsForTrigger(trigger_key: number): StimParam[] {
    return this.uploaded.filter((p) => p.enable && p.trigger_key === trigger_key);
  }

  /**
   * _count_spike(ms) — closed-loop instantaneous read: returns the number of
   * counted spikes for each electrode during the requested millisecond window.
   */
  async countSpike(ms: number): Promise<Int32Array> {
    this.assertOpen();
    return this.mea.advance(ms);
  }

  get activeParams(): StimParam[] { return this.uploaded; }

  /** _close — release the controller. */
  async close(): Promise<void> { this.closed = true; }
  get isClosed(): boolean { return this.closed; }
  reopen(): void { this.closed = false; }

  private assertOpen(): void {
    if (this.closed) throw new Error('IntanController is closed — reopen() before use.');
  }
}

/**
 * TriggerController — sends 16-length uint8 trigger arrays.
 * Mirrors `neuroplatformv2.core.trigger.TriggerController`.
 */
export class TriggerController {
  private closed = false;
  lastTriggerArray: Uint8Array = new Uint8Array(TRIGGER_COUNT);

  constructor(private intan: IntanController, private mea: OrganoidMEA, public readonly role: string = 'admin') {}

  /**
   * send(array) — a 16-length uint8 array; value 1 fires that trigger, executing
   * every StimParam whose trigger_key matches. Returns evoked-spike attribution.
   */
  async send(array: Uint8Array | number[]): Promise<{ fired: number[]; evoked: number }> {
    if (this.closed) throw new Error('TriggerController is closed.');
    const arr = array instanceof Uint8Array ? array : Uint8Array.from(array);
    if (arr.length !== TRIGGER_COUNT) throw new Error(`trigger array must have length ${TRIGGER_COUNT}, got ${arr.length}`);
    this.lastTriggerArray = arr;
    const fired: number[] = [];
    let evoked = 0;
    for (let k = 0; k < TRIGGER_COUNT; k++) {
      if (arr[k] === 1) {
        fired.push(k);
        this.mea.recordTrigger(k);
        for (const sp of this.intan.paramsForTrigger(k)) evoked += this.mea.stimulate(sp);
      }
    }
    return { fired, evoked };
  }

  close(): void { this.closed = true; }
  get isClosed(): boolean { return this.closed; }
}

// Query value objects mirroring the Python SDK ------------------------------

export class TriggersQuery { constructor(public start: number, public stop: number) {} }
export class SpikeCountQuery { constructor(public start: number, public stop: number, public fsname = 'fs264') {} }
export class SpikeEventQuery { constructor(public start: number, public stop: number, public fsname = 'fs264') {} }
export class RawSpikeQuery { constructor(public start: number, public stop: number, public index: number) {} }

/**
 * DatabaseController — retrieves experimental data from the (in-memory) store.
 * Mirrors `neuroplatformv2.core.database.DatabaseController`.
 */
export class DatabaseController {
  constructor(private mea: OrganoidMEA) {}

  async getAllTriggers(q: TriggersQuery): Promise<TriggerEventRecord[]> {
    return this.mea.queryTriggers(q.start, q.stop);
  }
  async getSpikeCount(q: SpikeCountQuery): Promise<Array<{ index: number; spikes: number; perMinute: number }>> {
    return this.mea.querySpikeCount(q.start, q.stop);
  }
  async getSpikeEvent(q: SpikeEventQuery): Promise<SpikeEvent[]> {
    return this.mea.querySpikeEvents(q.start, q.stop);
  }
  async getRawSpike(q: RawSpikeQuery): Promise<ReturnType<OrganoidMEA['getRawSpike']>> {
    return this.mea.getRawSpike(q.index, (q.start + q.stop) / 2);
  }
}

/**
 * CameraController — fetches MEA imaging.
 * Mirrors `neuroplatformv2.core.camera.CameraController`.
 */
export class CameraController {
  private captureCount = 0;
  constructor(private mea: OrganoidMEA, public readonly meaId: MEA = MEA.Five) {}

  async lastCapture(): Promise<Array<{ id: string; time: string; mea: MEA }>> {
    this.captureCount++;
    return [{ id: `cap_${this.meaId}_${this.captureCount}`, time: new Date().toISOString(), mea: this.meaId }];
  }

  /** Synthetic image descriptor (metadata + viability heatmap summary). */
  imageFrom(id: string): { id: string; width: number; height: number; channels: number; meanViability: number; note: string } {
    return {
      id, width: 1280, height: 1024, channels: 3,
      meanViability: Math.round(this.mea.meanViability() * 10) / 10,
      note: 'Synthetic MEA capture descriptor (simulate mode).',
    };
  }
}

// ─── ASTRA ↔ NeuroPlatform Bridge ───────────────────────────────────────────

export interface BridgeCoupling {
  /** FinalSpark fusion coefficient target [0-1] (state path fu.fs). */
  fusionCoefficient: number;
  /** ROS-published FinalSpark firing rate (Hz) (state path ros.fs). */
  firingRateHz: number;
  /** Organoid viability % (mirrors ethics gateway eth.viab when live). */
  viability: number;
  /** Mean array firing rate (Hz). */
  meanRateHz: number;
  /** Spike count vector usable as SNN spike-injection drive (length 128). */
  spikeDrive: number[];
}

/**
 * NeuroPlatformBridge — single entry point wiring the organoid + controllers to
 * ASTRA. Owns the controller lifecycle and converts organoid telemetry into the
 * coupling signals ASTRA's SNN / fusion / ethics layers consume.
 */
export class NeuroPlatformBridge {
  readonly mea: OrganoidMEA;
  readonly intan: IntanController;
  readonly trigger: TriggerController;
  readonly db: DatabaseController;
  readonly camera: CameraController;

  private lastCounts: Int32Array = new Int32Array(ELECTRODE_COUNT);

  constructor(config: Partial<NeuroPlatformConfig> = {}) {
    this.mea = new OrganoidMEA(config);
    this.intan = new IntanController(this.mea);
    this.trigger = new TriggerController(this.intan, this.mea, 'admin');
    this.db = new DatabaseController(this.mea);
    this.camera = new CameraController(this.mea, this.mea.config.mea);
  }

  /**
   * Closed-loop tick: read `windowMs` of organoid activity and translate it into
   * ASTRA coupling signals. Normalisation maps a biologically typical 0–40 Hz
   * mean rate onto the [0,1] fusion coefficient range.
   */
  async closedLoopRead(windowMs = 100): Promise<BridgeCoupling> {
    if (this.intan.isClosed) this.intan.reopen();
    const counts = await this.intan.countSpike(windowMs);
    this.lastCounts = counts;
    const total = counts.reduce((a, c) => a + c, 0);
    const windowSec = windowMs / 1000;
    const meanRateHz = total / windowSec / ELECTRODE_COUNT;
    const fusionCoefficient = Math.max(0, Math.min(1, meanRateHz / 40));
    const viability = this.mea.meanViability();
    return {
      fusionCoefficient: Math.round(fusionCoefficient * 1e4) / 1e4,
      firingRateHz: Math.round(meanRateHz * 1e2) / 1e2,
      viability: Math.round(viability * 1e2) / 1e2,
      meanRateHz: Math.round(meanRateHz * 1e2) / 1e2,
      spikeDrive: Array.from(counts),
    };
  }

  /** Electrode indices that fired in the most recent closed-loop window. */
  activeElectrodes(threshold = 1): number[] {
    const out: number[] = [];
    this.lastCounts.forEach((c, i) => { if (c >= threshold) out.push(i); });
    return out;
  }

  status(): Record<string, unknown> {
    return {
      mode: this.mea.config.mode,
      mea: this.mea.config.mea,
      fsname: this.mea.config.fsname,
      electrodes: ELECTRODE_COUNT,
      triggers: TRIGGER_COUNT,
      intan: { closed: this.intan.isClosed, activeParams: this.intan.activeParams.length },
      trigger: { closed: this.trigger.isClosed, lastTriggers: Array.from(this.trigger.lastTriggerArray) },
      organoid: {
        meanFiringRateHz: Math.round(this.mea.meanFiringRateHz() * 1e3) / 1e3,
        meanViability: Math.round(this.mea.meanViability() * 1e2) / 1e2,
        totalStimulations: this.mea.totalStimulations,
        totalChargeDelivered_nC: Math.round(this.mea.totalChargeDelivered_nC * 1e3) / 1e3,
        simClockSec: Math.round(this.mea.simClockSec * 1e3) / 1e3,
        spikeRecords: this.mea.activeSpikeRecords,
      },
    };
  }

  reset(): void {
    this.mea.reset();
    this.intan.reopen();
    this.lastCounts = new Int32Array(ELECTRODE_COUNT);
  }
}
