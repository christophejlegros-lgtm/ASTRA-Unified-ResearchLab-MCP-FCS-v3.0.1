/**
 * ASTRA World Model — Simulation Integration
 * =============================================
 *
 * Couples the JEPA World Model to the existing ASTRA SNN simulation loop.
 * The WMSimulationManager:
 *   - Observes every SNN tick
 *   - Maintains a rolling buffer of (obs, action, next_obs) transitions
 *   - Trains the world model online at configurable frequency
 *   - Monitors latent space health (SIGReg collapse indicator)
 *   - Triggers surprise alerts for anomalous transitions
 *
 * Integration: import and attach to the existing simulation.ts tick callback.
 *
 * © 2026 Christophe Jean Legros — Geneva
 */

import {
  WorldModelEngine,
  type SNNObservation,
  type SpikeAction,
  type WorldModelConfig,
  type WorldModelMetrics,
} from './world-model.js';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Stored transition for experience replay */
interface Transition {
  prevObs: SNNObservation;
  action: SpikeAction;
  nextObs: SNNObservation;
  timestamp: number;
}

/** Surprise alert when prediction error exceeds threshold */
export interface SurpriseAlert {
  timestep: number;
  surprise: number;
  level: 'MILD' | 'SIGNIFICANT' | 'VIOLATION';
  action: SpikeAction;
  timestamp: number;
}

/** WM simulation manager configuration */
export interface WMSimulationConfig {
  /** Train every N ticks (default: 4) */
  trainFrequency: number;
  /** Maximum transitions in replay buffer (default: 512) */
  replayBufferSize: number;
  /** Mini-batch size for training (default: 8) */
  batchSize: number;
  /** Surprise threshold for alerts (default: 2.0) */
  surpriseAlertThreshold: number;
  /** Enable automatic training (default: true) */
  autoTrain: boolean;
  /** Enable surprise monitoring (default: true) */
  monitorSurprise: boolean;
  /** Log level: 'silent' | 'summary' | 'verbose' */
  logLevel: 'silent' | 'summary' | 'verbose';
}

const DEFAULT_SIM_CONFIG: WMSimulationConfig = {
  trainFrequency: 4,
  replayBufferSize: 512,
  batchSize: 8,
  surpriseAlertThreshold: 2.0,
  autoTrain: true,
  monitorSurprise: true,
  logLevel: 'summary',
};

// ─── Simulation Manager ─────────────────────────────────────────────────────

export class WMSimulationManager {
  public readonly wm: WorldModelEngine;
  public readonly config: WMSimulationConfig;

  private replayBuffer: Transition[] = [];
  private lastObservation: SNNObservation | null = null;
  private lastAction: SpikeAction | null = null;
  private tickCount = 0;
  private trainCount = 0;
  private surpriseAlerts: SurpriseAlert[] = [];
  private running = false;

  /** Callback for surprise alerts — set externally */
  public onSurpriseAlert: ((alert: SurpriseAlert) => void) | null = null;
  /** Callback for training summaries */
  public onTrainingSummary: ((metrics: WorldModelMetrics) => void) | null = null;

  constructor(
    wmConfig: Partial<WorldModelConfig> = {},
    simConfig: Partial<WMSimulationConfig> = {},
  ) {
    this.wm = new WorldModelEngine(wmConfig);
    this.config = { ...DEFAULT_SIM_CONFIG, ...simConfig };
  }

  // ─── Tick Interface ───────────────────────────────────────────────────

  /**
   * Called on every SNN simulation tick.
   * This is the main integration point — wire this into the existing
   * simulation.ts tick loop:
   *
   *   wmManager.onTick(currentObservation, lastAppliedAction);
   *
   * @param observation - Current SNN state observation
   * @param action - The spike action that was applied since last tick (null if none)
   */
  onTick(observation: SNNObservation, action: SpikeAction | null): void {
    this.tickCount++;

    // Always encode the observation (builds embedding history for SIGReg)
    this.wm.encode(observation);

    // Store transition if we have a previous observation
    if (this.lastObservation && this.lastAction) {
      const transition: Transition = {
        prevObs: this.lastObservation,
        action: this.lastAction,
        nextObs: observation,
        timestamp: Date.now(),
      };

      this.replayBuffer.push(transition);
      if (this.replayBuffer.length > this.config.replayBufferSize) {
        this.replayBuffer.shift();
      }

      // Surprise monitoring
      if (this.config.monitorSurprise) {
        const surprise = this.wm.computeSurprise(
          transition.prevObs,
          transition.action,
          transition.nextObs,
        );

        if (surprise > this.config.surpriseAlertThreshold) {
          const level: SurpriseAlert['level'] =
            surprise > 3.0 ? 'VIOLATION' :
            surprise > 1.5 ? 'SIGNIFICANT' : 'MILD';

          const alert: SurpriseAlert = {
            timestep: observation.timestep,
            surprise,
            level,
            action: transition.action,
            timestamp: Date.now(),
          };

          this.surpriseAlerts.push(alert);
          if (this.surpriseAlerts.length > 100) this.surpriseAlerts.shift();

          if (this.onSurpriseAlert) {
            this.onSurpriseAlert(alert);
          }
        }
      }
    }

    // Auto-train at configured frequency
    if (this.config.autoTrain && this.tickCount % this.config.trainFrequency === 0) {
      this.trainBatch();
    }

    // Update rolling state
    this.lastObservation = observation;
    this.lastAction = action ?? {
      targetNeurons: [],
      strengths: [],
      duration: 0,
    };
  }

  /**
   * Record an externally-applied spike injection action.
   * Call this when inject_spikes is used, before the next tick.
   */
  recordAction(action: SpikeAction): void {
    this.lastAction = action;
  }

  // ─── Training ─────────────────────────────────────────────────────────

  /**
   * Train on a mini-batch sampled from the replay buffer.
   */
  trainBatch(): { avgLoss: number; steps: number } {
    if (this.replayBuffer.length < this.config.batchSize) {
      return { avgLoss: 0, steps: 0 };
    }

    let totalLoss = 0;
    const batchSize = Math.min(this.config.batchSize, this.replayBuffer.length);

    // Sample random mini-batch from replay buffer
    const indices = new Set<number>();
    while (indices.size < batchSize) {
      indices.add(Math.floor(Math.random() * this.replayBuffer.length));
    }

    for (const idx of indices) {
      const t = this.replayBuffer[idx];
      const result = this.wm.trainStep(t.prevObs, t.action, t.nextObs);
      totalLoss += result.totalLoss;
    }

    this.trainCount += batchSize;

    const avgLoss = totalLoss / batchSize;

    if (this.onTrainingSummary) {
      this.onTrainingSummary(this.wm.getMetrics());
    }

    return { avgLoss, steps: batchSize };
  }

  /**
   * Force a full training pass over the entire replay buffer.
   * Useful for initial bootstrap or periodic deep training.
   */
  trainFull(): { avgLoss: number; steps: number } {
    if (this.replayBuffer.length < 2) {
      return { avgLoss: 0, steps: 0 };
    }

    let totalLoss = 0;
    for (const t of this.replayBuffer) {
      const result = this.wm.trainStep(t.prevObs, t.action, t.nextObs);
      totalLoss += result.totalLoss;
    }

    this.trainCount += this.replayBuffer.length;
    return {
      avgLoss: totalLoss / this.replayBuffer.length,
      steps: this.replayBuffer.length,
    };
  }

  // ─── Planning Interface ───────────────────────────────────────────────

  /**
   * Plan a spike injection sequence to drive the SNN toward a target state.
   * Uses the World Model's CEM planner in latent space.
   *
   * @param goalFiringRates - Target firing rates per layer [Hz]
   * @returns Planned action sequence or null if no current observation
   */
  planToFiringRates(goalFiringRates: number[]): SpikeAction[] | null {
    if (!this.lastObservation) return null;

    const goalObs: SNNObservation = {
      ...this.lastObservation,
      firingRates: new Float64Array(goalFiringRates),
      timestep: this.lastObservation.timestep + 1,
    };

    const result = this.wm.planToGoal(this.lastObservation, goalObs);
    return result.actions;
  }

  /**
   * Plan toward a target ACM composite score.
   * Translates ACM target to approximate neurodynamic parameters.
   */
  planToACMScore(targetACM: number): SpikeAction[] | null {
    if (!this.lastObservation) return null;

    // Map ACM score to target firing rates:
    // ACM ∈ [0, 1]: Higher ACM ≈ moderate, coordinated firing (25-35 Hz)
    // with cross-layer synchrony
    const targetRate = 15 + targetACM * 25;
    const nLayers = this.lastObservation.firingRates.length;
    const goalRates = Array.from({ length: nLayers }, () => targetRate);

    return this.planToFiringRates(goalRates);
  }

  // ─── State & Diagnostics ──────────────────────────────────────────────

  /** Get comprehensive status */
  getStatus(): {
    simulation: {
      ticks: number;
      trainSteps: number;
      bufferSize: number;
      bufferCapacity: number;
      running: boolean;
    };
    worldModel: WorldModelMetrics;
    surpriseAlerts: SurpriseAlert[];
    health: {
      latentCollapse: boolean;
      trainingActive: boolean;
      surpriseMonitoring: boolean;
      bufferFillRatio: number;
    };
  } {
    const metrics = this.wm.getMetrics();
    return {
      simulation: {
        ticks: this.tickCount,
        trainSteps: this.trainCount,
        bufferSize: this.replayBuffer.length,
        bufferCapacity: this.config.replayBufferSize,
        running: this.running,
      },
      worldModel: metrics,
      surpriseAlerts: [...this.surpriseAlerts.slice(-10)],
      health: {
        latentCollapse: metrics.latentVariance < 0.01,
        trainingActive: this.config.autoTrain,
        surpriseMonitoring: this.config.monitorSurprise,
        bufferFillRatio: this.replayBuffer.length / this.config.replayBufferSize,
      },
    };
  }

  /** Get recent surprise alerts */
  getRecentAlerts(n = 10): SurpriseAlert[] {
    return this.surpriseAlerts.slice(-n);
  }

  /** Clear replay buffer (e.g., after SNN reset) */
  clearBuffer(): void {
    this.replayBuffer = [];
    this.lastObservation = null;
    this.lastAction = null;
  }

  /** Full reset: clear buffer + reset world model weights */
  reset(): void {
    this.clearBuffer();
    this.wm.reset();
    this.tickCount = 0;
    this.trainCount = 0;
    this.surpriseAlerts = [];
  }
}
