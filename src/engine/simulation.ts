/**
 * ASTRA Simulation Loop
 * © 2026 Christophe Jean Legros — Geneva
 *
 * Background interval that drives the SNN engine, ACM assessments,
 * ethics monitoring, and biomarker simulation in demo/sim mode.
 */

import { state } from './state.js';
import { snnEngine } from './snn.js';
import { acmModule } from './acm.js';
import { ethicsMonitor } from './ethics.js';

export interface SimConfig {
  intervalMs: number;     // tick interval (default 250ms)
  snnStepsPerTick: number; // SNN steps per interval
  acmEveryNTicks: number;  // ACM assessment frequency
  ethicsEveryNTicks: number;
  simulateBio: boolean;    // simulate biomarker drift
}

const DEFAULT_SIM_CONFIG: SimConfig = {
  intervalMs: 250,
  snnStepsPerTick: 5,
  acmEveryNTicks: 4,      // ~1 Hz at 250ms ticks
  ethicsEveryNTicks: 8,   // ~0.5 Hz
  simulateBio: true,
};

let _timer: ReturnType<typeof setInterval> | null = null;
let _config: SimConfig = { ...DEFAULT_SIM_CONFIG };

export function startSimulation(config?: Partial<SimConfig>): void {
  if (_timer) return; // already running
  _config = { ...DEFAULT_SIM_CONFIG, ...config };

  _timer = setInterval(() => {
    state.tick();
    const tick = state.snapshot.tick;

    // SNN steps
    snnEngine.run(_config.snnStepsPerTick);

    // Simulated bio-signal metrics
    if (_config.simulateBio) {
      state.set('loihi.bio', +(30 + Math.sin(tick * 0.05) * 15 + Math.random() * 5).toFixed(1));
      state.set('loihi.nrg', +(1.5 + Math.random() * 1.5).toFixed(2));

      // ROS2 topic rates (simulated)
      state.set('ros.fs', +(95 + Math.random() * 10).toFixed(0));
      state.set('ros.cl', +(92 + Math.random() * 10).toFixed(0));
      state.set('ros.sp', +(98 + Math.random() * 5).toFixed(0));
      state.set('ros.st', +(96 + Math.random() * 6).toFixed(0));

      // V-JEPA / A-JEPA metrics (simulated)
      state.set('vj.cos', +(0.80 + Math.random() * 0.15).toFixed(3));
      state.set('vj.loss', +(0.05 + Math.random() * 0.1).toFixed(3));
      state.set('vj.ar', +(72 + Math.random() * 12).toFixed(1));
      state.set('aj.cos', +(0.82 + Math.random() * 0.12).toFixed(3));
      state.set('aj.sp', +(76 + Math.random() * 10).toFixed(1));

      // Fusion coherence
      state.set('fu.va', +(0.6 + Math.random() * 0.25).toFixed(3));
      state.set('fu.ci', +(0.5 + Math.random() * 0.3).toFixed(3));

      // Ethics biomarker drift
      ethicsMonitor.simulateDrift();
    }

    // Periodic ACM assessment
    if (tick % _config.acmEveryNTicks === 0) {
      acmModule.assess();
    }

    // Periodic ethics check
    if (tick % _config.ethicsEveryNTicks === 0) {
      ethicsMonitor.assess();
    }

    // Update MCP internal counter
    state.set('mcp.uptime', Math.floor((Date.now() - state.snapshot.startTime) / 1000));

  }, _config.intervalMs);
}

export function stopSimulation(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

export function isRunning(): boolean {
  return _timer !== null;
}

export function getSimConfig(): Readonly<SimConfig> {
  return _config;
}
