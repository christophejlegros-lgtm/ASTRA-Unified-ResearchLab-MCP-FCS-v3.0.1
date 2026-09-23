/**
 * ASTRA Reactive State Store
 * © 2026 Christophe Jean Legros — Geneva
 *
 * Centralised observable state for all ASTRA subsystems.
 * Emits typed events on mutation; consumed by MCP tools and transports.
 *
 * v2 — Added parameter bounds registry for safe external mutations.
 */

import { EventEmitter } from 'node:events';

// ── Type Definitions ──────────────────────────────────────────────

export interface LoihiState {
  spk: number;   // spikes/sec
  bio: number;   // bio rate Hz
  coh: number;   // coherence [0,1]
  phi: number;   // integration proxy
  nrg: number;   // energy mJ
  ly: { i: number; h1: number; h2: number; o: number };
  wM: number;    // mean weight
  wU: number;    // weight updates
  vM: number;    // mean voltage
  vA: number;    // voltage amplitude
}

export interface RosState {
  fs: number;    // FinalSpark Hz
  cl: number;    // Cortical Labs Hz
  sp: number;    // spikes output Hz
  st: number;    // state output Hz
}

export interface VJepaState {
  cos: number;   // cosine similarity
  loss: number;  // predictor loss
  ar: number;    // action recognition %
}

export interface AJepaState {
  cos: number;   // cosine similarity
  sp: number;    // speech recognition %
}

export interface FusionState {
  fs: number;    // FinalSpark coefficient
  cl: number;    // Cortical Labs coefficient
  kn: number;    // Koniku coefficient
  va: number;    // vision-audio fusion
  ci: number;    // coherence index
}

export interface AcmState {
  integrationProxy: number;  // IIT-inspired integration proxy (formerly phi)
  broadcastProxy: number;    // GWT-inspired broadcast proxy (formerly gw)
  arousalProxy: number;      // PAD-inspired arousal proxy (formerly pad)
  compositeScore: number;    // weighted composite score (formerly sc)
  decisionClass: number;     // consciousness level class (formerly cls)
  confidence: number;        // assessment confidence [0,1] (formerly conf)
  cycles: number;            // total assessment cycles (formerly cyc)
}

export interface EthicsState {
  viab: number;  // viability %
  fr: number;    // firing rate Hz
  atp: number;   // ATP/ADP ratio
  ca: number;    // calcium nM
}

export interface McpInternalState {
  calls: number;
  tools: number;
  resources: number;
  connected: number;
  uptime: number;
}

export interface AstraState {
  tick: number;
  mode: 'sim' | 'live' | 'replay';
  startTime: number;
  loihi: LoihiState;
  ros: RosState;
  vj: VJepaState;
  aj: AJepaState;
  fu: FusionState;
  acm: AcmState;
  eth: EthicsState;
  mcp: McpInternalState;
}

// ── Parameter Bounds ──────────────────────────────────────────────

export interface ParameterBounds {
  min: number;
  max: number;
}

/**
 * Registry of plausible bounds for externally-settable parameters.
 * Prevents injection of absurd values (negative viability, Infinity, etc.).
 */
const PARAMETER_BOUNDS: Record<string, ParameterBounds> = {
  // Loihi
  'loihi.spk': { min: 0, max: 100_000 },
  'loihi.bio': { min: 0, max: 200 },
  'loihi.coh': { min: 0, max: 1 },
  'loihi.phi': { min: 0, max: 1 },
  'loihi.nrg': { min: 0, max: 100 },
  'loihi.wM':  { min: 0, max: 10_000 },
  'loihi.wU':  { min: 0, max: 1_000_000 },
  'loihi.vM':  { min: -100, max: 50 },
  'loihi.vA':  { min: 0, max: 100 },

  // ROS
  'ros.fs': { min: 0, max: 500 },
  'ros.cl': { min: 0, max: 500 },
  'ros.sp': { min: 0, max: 500 },
  'ros.st': { min: 0, max: 500 },

  // V-JEPA
  'vj.cos':  { min: -1, max: 1 },
  'vj.loss': { min: 0, max: 100 },
  'vj.ar':   { min: 0, max: 100 },

  // A-JEPA
  'aj.cos': { min: -1, max: 1 },
  'aj.sp':  { min: 0, max: 100 },

  // Fusion
  'fu.fs': { min: 0, max: 1 },
  'fu.cl': { min: 0, max: 1 },
  'fu.kn': { min: 0, max: 1 },
  'fu.va': { min: 0, max: 1 },
  'fu.ci': { min: 0, max: 1 },

  // ACM
  'acm.integrationProxy': { min: 0, max: 1 },
  'acm.broadcastProxy':   { min: 0, max: 1 },
  'acm.arousalProxy':     { min: 0, max: 1 },
  'acm.compositeScore':   { min: 0, max: 1 },
  'acm.decisionClass':    { min: 0, max: 5 },
  'acm.confidence':       { min: 0, max: 1 },
  'acm.cycles':           { min: 0, max: 1_000_000 },

  // Ethics — biophysically plausible ranges
  'eth.viab': { min: 0, max: 100 },
  'eth.fr':   { min: 0, max: 200 },
  'eth.atp':  { min: 0, max: 10 },
  'eth.ca':   { min: 0, max: 1000 },
};

// ── Default State ─────────────────────────────────────────────────

function createDefaultState(): AstraState {
  return {
    tick: 0,
    mode: 'sim',
    startTime: Date.now(),
    loihi: {
      spk: 0, bio: 0, coh: 0, phi: 0, nrg: 0,
      ly: { i: 0, h1: 0, h2: 0, o: 0 },
      wM: 0, wU: 0, vM: 0, vA: 0,
    },
    ros: { fs: 0, cl: 0, sp: 0, st: 0 },
    vj: { cos: 0, loss: 0, ar: 0 },
    aj: { cos: 0, sp: 0 },
    fu: { fs: 0.45, cl: 0.40, kn: 0.15, va: 0, ci: 0 },
    acm: {
      integrationProxy: 0, broadcastProxy: 0, arousalProxy: 0,
      compositeScore: 0, decisionClass: 0, confidence: 0, cycles: 0,
    },
    eth: { viab: 95, fr: 28, atp: 3.5, ca: 65 },
    mcp: { calls: 0, tools: 12, resources: 5, connected: 0, uptime: 0 },
  };
}

// ── State Store ───────────────────────────────────────────────────

export type StateChangeEvent = {
  path: string;
  value: unknown;
  previous: unknown;
};

export class StateStore extends EventEmitter {
  private _state: AstraState;

  constructor() {
    super();
    this._state = createDefaultState();
  }

  /** Read-only snapshot */
  get snapshot(): Readonly<AstraState> {
    return this._state;
  }

  /** Get a nested value via dot-notation path */
  get<T = unknown>(path: string): T | undefined {
    const parts = path.split('.');
    let current: unknown = this._state;
    for (const key of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    return current as T;
  }

  /**
   * Set a value via dot-notation. Emits 'change' event.
   * Internal use — no bounds checking (engine updates).
   */
  set(path: string, value: unknown): boolean {
    const parts = path.split('.');
    if (parts.length < 1) return false;

    const allowed = new Set([
      'tick', 'mode', 'loihi', 'ros', 'vj', 'aj', 'fu', 'acm', 'eth', 'mcp',
    ]);
    if (!allowed.has(parts[0])) return false;

    let current: Record<string, unknown> = this._state as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      const next = current[parts[i]];
      if (next == null || typeof next !== 'object') return false;
      current = next as Record<string, unknown>;
    }

    const key = parts[parts.length - 1];
    const previous = current[key];
    current[key] = value;

    this.emit('change', { path, value, previous } satisfies StateChangeEvent);
    return true;
  }

  /**
   * Set a numeric value via dot-notation WITH bounds validation.
   * Use for external (MCP tool) mutations. Returns error string or null.
   */
  setChecked(path: string, value: number): string | null {
    if (!Number.isFinite(value)) {
      return `Value must be finite, got ${value}`;
    }

    const bounds = PARAMETER_BOUNDS[path];
    if (bounds) {
      if (value < bounds.min || value > bounds.max) {
        return `Value ${value} out of bounds for ${path} (allowed: ${bounds.min}–${bounds.max})`;
      }
    }

    const ok = this.set(path, value);
    if (!ok) return `Invalid path: ${path}`;
    return null;
  }

  /** Query bounds for a given path */
  getBounds(path: string): ParameterBounds | undefined {
    return PARAMETER_BOUNDS[path];
  }

  /** List all bounded parameter paths */
  get boundedPaths(): string[] {
    return Object.keys(PARAMETER_BOUNDS);
  }

  /** Bulk merge a partial state update */
  merge(patch: Record<string, Record<string, unknown>>): void {
    for (const [ns, fields] of Object.entries(patch)) {
      for (const [key, value] of Object.entries(fields)) {
        this.set(`${ns}.${key}`, value);
      }
    }
  }

  /** Advance tick counter and update derived metrics */
  tick(): void {
    this._state.tick++;
    this._state.mcp.uptime = Math.floor(
      (Date.now() - this._state.startTime) / 1000
    );
    this.emit('tick', this._state.tick);
  }

  /** Reset state to defaults */
  reset(): void {
    this._state = createDefaultState();
    this.emit('reset');
  }
}

/** Singleton state instance */
export const state = new StateStore();
