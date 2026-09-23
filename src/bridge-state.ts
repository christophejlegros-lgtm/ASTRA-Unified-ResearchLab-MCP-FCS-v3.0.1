/**
 * ASTRA — Bridge state contract
 * ═════════════════════════════
 * Shape of the snapshot that `server.ts` (getStateForWM) hands to the
 * World-Model, sensor, TCAI and NeuroPlatform tool families. Every field is
 * optional because consumers read it defensively (`?.` / `??` with defaults),
 * and tests or future callers may supply a partial state.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 */

/** Per-layer activity summary. */
export interface LayerMetric {
  firingRate: number;
}

/** Per-layer synaptic weight statistics. */
export interface WeightStat {
  mean: number;
  std: number;
  sparsity: number;
}

/** Coupling coefficient of one bio-computing platform. */
export interface PlatformCoupling {
  coupling: number;
}

export type PlatformName = 'finalspark' | 'corticalLabs' | 'koniku' | 'loihi2';

/** Last spike-injection action planned by the World Model. */
export interface SpikeAction {
  targetNeurons: number[];
  strengths: number[];
  duration: number;
}

export interface AstraBridgeState {
  mode?: string;
  snn?: {
    timestep?: number;
    neuronCount?: number;
    layerSizes?: number[];
    layerMetrics?: LayerMetric[];
    weightStats?: Partial<WeightStat>[];
    /** Per-neuron membrane state, when a caller provides it. */
    neurons?: { voltage?: number }[];
  };
  platforms?: Partial<Record<PlatformName, PlatformCoupling>>;
  _lastSpikeAction?: SpikeAction | null;
}

/** Accessor passed to the tool-family registration functions. */
export type GetBridgeState = () => AstraBridgeState;
