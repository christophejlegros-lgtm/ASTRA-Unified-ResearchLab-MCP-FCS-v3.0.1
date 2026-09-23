/**
 * ASTRA MCP Server v3.0 — Complete Server Factory
 * =================================================
 *
 * 62 Tools · 11 Resources · 8 Prompts
 *
 * Uses singleton modules: state (StateStore), snnEngine, acmModule, ethicsMonitor.
 * Returns a McpServer instance ready for transport connection.
 *
 * © 2026 Christophe Jean Legros — Geneva
 * Assistance Multi IA · Assistant-Multi-IA@proton.me
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ASTRA_VERSION } from './version.js';
import { z } from 'zod';
import { state } from './engine/state.js';
import { SNNEngine } from './engine/snn.js';
import { acmAdapter } from './engine/acm.js';
import { ethicsAdapter } from './engine/ethics.js';
import { startSimulation, stopSimulation, isRunning } from './engine/simulation.js';
import { WMSimulationManager } from './engine/wm-simulation.js';
import { registerWorldModelCapabilities, extractObservation } from './server-wm-tools.js';
import { registerSensorCapabilities } from './server-sensor-tools.js';
import { registerTCAICapabilities } from './server-tcai-tools.js';
import { tcaiSystem } from './engine/tcai/acm-bridge.js';
import { registerNeuroPlatformCapabilities } from './server-neuroplatform-tools.js';
import { registerOvomindTools } from './server-ovomind-tools.js';
import { registerOrchTools } from './server-orch-tools.js';
import { registerFcsCapabilities } from './server-fcs-tools.js';
import { logger } from './utils/logger.js';
import { seedInfo } from './utils/rng.js';
import type { AstraBridgeState, SpikeAction } from './bridge-state.js';
import { toolAnnotations } from './tool-annotations.js';

// ── Shared SNN + WM (singleton, survives across sessions) ──

const snn = new SNNEngine();

const wmManager = new WMSimulationManager(
  { observationDim: snn.getNeuronCount() + snn.getLayerSizes().length * 3 + 4,
    latentDim: 64, hiddenDim: 128, sigregLambda: 0.1,
    sigregProjections: 256, cemPopulation: 64, cemMaxIter: 10, planningHorizon: 8 },
  { trainFrequency: 4, replayBufferSize: 512, batchSize: 8,
    autoTrain: true, monitorSurprise: true, surpriseAlertThreshold: 2.0 },
);

wmManager.onSurpriseAlert = (alert) => {
  logger.warn({ msg: 'WM surprise alert', level: alert.level, surprise: alert.surprise, timestep: alert.timestep });
};

let _lastSpikeAction: SpikeAction | null = null;

/** Bridge: build WM-compatible state from singletons */
function getStateForWM(): AstraBridgeState {
  const snap = state.snapshot;
  return {
    mode: snap.mode,
    snn: { timestep: snap.tick, neuronCount: snn.getNeuronCount(), layerSizes: snn.getLayerSizes(),
      layerMetrics: snn.getLayerSizes().map(() => ({ firingRate: snn.getMetrics().meanFiringRate ?? 20 })),
      weightStats: snn.getWeightStats() },
    platforms: { finalspark: { coupling: snap.fu.fs }, corticalLabs: { coupling: snap.fu.cl },
      koniku: { coupling: snap.fu.kn }, loihi2: { coupling: 0 } },
    _lastSpikeAction,
  };
}

// ── Server Factory ──

export function createAstraServer(): McpServer {
  const server = new McpServer({ name: 'astra', version: ASTRA_VERSION });

  // ═══ CORE TOOLS (1–12) ═══

  server.tool('get_system_status', 'ASTRA System Status', {}, toolAnnotations('get_system_status'), async () => {
    const wm = wmManager.getStatus(); const snap = state.snapshot;
    const { neurons, synapses, ...snnMetrics } = snn.getMetrics();
    return { content: [{ type: 'text' as const, text: JSON.stringify({
      system: `ASTRA v${ASTRA_VERSION}`, mode: snap.mode, dataProvenance: 'simulated', rng: seedInfo(), uptime: process.uptime(), tick: snap.tick,
      snn: { neurons, synapses, layers: snn.getLayerSizes(), ...snnMetrics },
      acm: acmAdapter.getState(), ethics: ethicsAdapter.getReport(),
      worldModel: { status: wm.health.latentCollapse ? 'COLLAPSED' : 'ACTIVE', trainingSteps: wm.worldModel.trainingSteps,
        avgPredLoss: Math.round(wm.worldModel.avgPredictionLoss * 1e6) / 1e6, latentVariance: Math.round(wm.worldModel.latentVariance * 1e4) / 1e4,
        replayBuffer: wm.simulation.bufferSize, surpriseAlerts: wm.surpriseAlerts.length },
      platforms: { finalspark: { coupling: snap.fu.fs }, corticalLabs: { coupling: snap.fu.cl }, koniku: { coupling: snap.fu.kn } },
      timestamp: new Date().toISOString(),
    }, null, 2) }] };
  });

  server.tool('get_metrics', 'Real-time Metrics', {}, toolAnnotations('get_metrics'), async () => ({ content: [{ type: 'text' as const,
    text: JSON.stringify({ snn: snn.getMetrics(), acm: acmAdapter.getMetrics(), ethics: ethicsAdapter.getBiomarkers(),
      worldModel: wmManager.wm.getMetrics(), timestamp: new Date().toISOString() }, null, 2) }] }));

  server.tool('get_snn_state', 'SNN Engine State', {}, toolAnnotations('get_snn_state'), async () => ({
    content: [{ type: 'text' as const, text: JSON.stringify(snn.getState(), null, 2) }] }));

  server.tool('snn_step', 'Advance SNN Simulation',
    { steps: z.number().int().min(1).max(1000).default(1) },
    toolAnnotations('snn_step'), async ({ steps }: { steps: number }) => {
      const results = [];
      for (let i = 0; i < steps; i++) {
        results.push(snn.step(1.0));
        const obs = extractObservation(getStateForWM());
        wmManager.onTick(obs, _lastSpikeAction);
        _lastSpikeAction = null;
      }
      acmAdapter.update(); ethicsAdapter.update();
      return { content: [{ type: 'text' as const, text: JSON.stringify({
        stepsExecuted: steps, finalState: snn.getMetrics(), lastSpikes: results[results.length - 1] ?? 0,
      }, null, 2) }] };
    });

  server.tool('snn_reset', 'Reset SNN Engine', {}, toolAnnotations('snn_reset'), async () => {
    snn.reset(); wmManager.clearBuffer();
    return { content: [{ type: 'text' as const, text: '{"status":"SNN and WM buffer reset"}' }] };
  });

  server.tool('inject_spikes', 'Spike Injection',
    { neuronIds: z.array(z.number().int().min(0)), strength: z.number().min(-100).max(100).default(15) },
    toolAnnotations('inject_spikes'), async ({ neuronIds, strength }: { neuronIds: number[]; strength: number }) => {
      const result = snn.injectSpikes(neuronIds, strength);
      _lastSpikeAction = { targetNeurons: neuronIds, strengths: neuronIds.map(() => strength), duration: 1 };
      wmManager.recordAction(_lastSpikeAction);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ injected: neuronIds.length, strength, result }, null, 2) }] };
    });

  server.tool('get_acm_score', 'Composite proxy score inspired by IIT/GWT/PAD — a computed index, not a measurement of consciousness', {}, toolAnnotations('get_acm_score'), async () => {
    const wmM = wmManager.wm.getMetrics();
    return { content: [{ type: 'text' as const, text: JSON.stringify({
      ...acmAdapter.getState(),
      worldModelEnhancement: { latentIntegration: Math.round(wmM.latentVariance * 1e4) / 1e4,
        predictionAccuracy: Math.round((1 - wmM.avgPredictionLoss) * 1e4) / 1e4,
        surpriseLevel: Math.round(wmM.avgSurprise * 1e4) / 1e4,
        note: 'WM latent variance enriches Φ̃; prediction accuracy correlates with GW̃; surprise maps to PAD̃ arousal.' },
    }, null, 2) }] };
  });

  server.tool('check_ethics', 'IRB Neural Welfare Check', {}, toolAnnotations('check_ethics'), async () => ({
    content: [{ type: 'text' as const, text: JSON.stringify(ethicsAdapter.getReport(), null, 2) }] }));

  server.tool('set_parameter', 'Modify State Parameter',
    { path: z.string(), value: z.number() },
    toolAnnotations('set_parameter'), async ({ path, value }: { path: string; value: number }) => {
      const error = state.setChecked(path, value);
      return { content: [{ type: 'text' as const, text: JSON.stringify(
        error ? { success: false, path, value, error } : { success: true, path, value }, null, 2) }] };
    });

  server.tool('get_platform_status', 'Bio-Computing Platforms', {}, toolAnnotations('get_platform_status'), async () => {
    const s = state.snapshot;
    return { content: [{ type: 'text' as const, text: JSON.stringify({
      finalspark: { coupling: s.fu.fs, status: s.mode, neuroplatform: np.status() },
      corticalLabs: { coupling: s.fu.cl, status: s.mode }, koniku: { coupling: s.fu.kn, status: s.mode },
    }, null, 2) }] };
  });

  server.tool('export_snapshot', 'Full State Snapshot', {}, toolAnnotations('export_snapshot'), async () => ({
    content: [{ type: 'text' as const, text: JSON.stringify({
      snn: snn.getState(), acm: acmAdapter.getState(), ethics: ethicsAdapter.getReport(),
      worldModel: wmManager.wm.getSnapshot(), wmSimulation: wmManager.getStatus(),
      state: state.snapshot, rng: seedInfo(), dataProvenance: 'simulated', timestamp: new Date().toISOString(),
    }, null, 2) }] }));

  server.tool('simulation_control', 'Simulation Control',
    { command: z.enum(['start', 'stop', 'status']) },
    toolAnnotations('simulation_control'), async ({ command }: { command: string }) => {
      if (command === 'start') startSimulation();
      else if (command === 'stop') stopSimulation();
      return { content: [{ type: 'text' as const, text: JSON.stringify(
        { status: isRunning() ? 'running' : 'stopped', tick: state.snapshot.tick }) }] };
    });

  // ═══ WORLD MODEL TOOLS (13–18) ═══
  registerWorldModelCapabilities(server, getStateForWM, wmManager.wm.config);

  // ═══ SENSOR TOOLS (19–24) ═══
  registerSensorCapabilities(server, getStateForWM, { latentDim: wmManager.wm.config.latentDim });

  // ═══ TCAI / ACM TOOLS (25–32) + SECOND-ORDER LOOP (42–50) — the_consciousness_ai integration ═══
  tcaiSystem.connectProductionSnn(snn); // v2.9: close the actuation loop on the shared SNN
  registerTCAICapabilities(server, getStateForWM);

  // ═══ NEUROPLATFORM v2 TOOLS (33–41) — FinalSpark wetware closed loop ═══
  const np = registerNeuroPlatformCapabilities(server, getStateForWM, {
    driveSNN: (neuronIds: number[], strength: number) => {
      snn.injectSpikes(neuronIds, strength);
      _lastSpikeAction = { targetNeurons: neuronIds, strengths: neuronIds.map(() => strength), duration: 1 };
      wmManager.recordAction(_lastSpikeAction);
    },
  });

  // ═══ CORE RESOURCES (1–5) ═══
  server.resource('metrics-realtime', 'astra://metrics/realtime',
    { description: 'Live metrics', mimeType: 'application/json' },
    async () => ({ contents: [{ uri: 'astra://metrics/realtime', mimeType: 'application/json',
      text: JSON.stringify({ snn: snn.getMetrics(), acm: acmAdapter.getMetrics(), ethics: ethicsAdapter.getBiomarkers(), worldModel: wmManager.wm.getMetrics() }, null, 2) }] }));

  server.resource('snn-topology', 'astra://snn/topology',
    { description: 'SNN network architecture', mimeType: 'application/json' },
    async () => ({ contents: [{ uri: 'astra://snn/topology', mimeType: 'application/json', text: JSON.stringify(snn.getTopology(), null, 2) }] }));

  server.resource('acm-state', 'astra://acm/state',
    { description: 'Consciousness proxy assessment', mimeType: 'application/json' },
    async () => ({ contents: [{ uri: 'astra://acm/state', mimeType: 'application/json', text: JSON.stringify(acmAdapter.getState(), null, 2) }] }));

  server.resource('ethics-welfare', 'astra://ethics/welfare',
    { description: 'IRB compliance report', mimeType: 'application/json' },
    async () => ({ contents: [{ uri: 'astra://ethics/welfare', mimeType: 'application/json', text: JSON.stringify(ethicsAdapter.getReport(), null, 2) }] }));

  server.resource('snapshot-current', 'astra://snapshot/current',
    { description: 'Complete state dump', mimeType: 'application/json' },
    async () => ({ contents: [{ uri: 'astra://snapshot/current', mimeType: 'application/json',
      text: JSON.stringify({ snn: snn.getState(), acm: acmAdapter.getState(), ethics: ethicsAdapter.getReport(), worldModel: wmManager.wm.getSnapshot() }, null, 2) }] }));

  // ═══ CORE PROMPTS (1–3) ═══
  server.prompt('system-health-report', 'Comprehensive system health report', {}, async () => ({
    messages: [{ role: 'user' as const, content: { type: 'text' as const,
      text: 'Run: get_system_status, get_metrics, get_snn_state, check_ethics, get_platform_status, np_status, wm_status, sensor_status. Summarize and flag issues.' } }] }));

  server.prompt('snn-experiment', 'Controlled SNN experiment', {
    stimStrength: z.string().optional().describe('Spike injection strength in mV') },
    async (args: { stimStrength?: string }) => ({
      messages: [{ role: 'user' as const, content: { type: 'text' as const,
        text: `SNN experiment: snn_reset → snn_step 10 → inject_spikes [10-14] at ${args.stimStrength ?? '15'}mV → snn_step 20 → get_acm_score → wm_encode → wm_surprise. Analyze STDP and WM predictions.` } }] }));

  server.prompt('ethics-stress-test', 'Progressive biomarker degradation', {}, async () => ({
    messages: [{ role: 'user' as const, content: { type: 'text' as const,
      text: 'Ethics stress test: check_ethics → set_parameter "eth.viab" 85 → check_ethics → set_parameter "eth.viab" 75 → check_ethics → set_parameter "eth.viab" 95 → check_ethics. Analyze IRB compliance.' } }] }));

  // ═══ OVOMIND AFFECTIVE BRIDGE (51–56) — human exteroception (sim by default) ═══
  const ovomind = registerOvomindTools(server, {
    tcai: tcaiSystem,
    liveEndpoint: process.env.OVOMIND_ENDPOINT,
    liveApiKey: process.env.OVOMIND_API_KEY,
  });

  // ═══ ORCH OR CRITERION LAYER (57–62) — substrate criterion, surrogate gate ═══
  registerOrchTools(server, { tcai: tcaiSystem, ovomind });

  // ═══ FCS LAYER (63–70) — substrate-constrained functionalism, documents I/II/IV ═══
  // Binds the IRB welfare biomarkers to the seventeen species–function pairs and
  // enforces the series' five prohibitions on everything this layer emits.
  registerFcsCapabilities(server, { getState: () => state.snapshot });

  logger.info(`ASTRA MCP Server v${ASTRA_VERSION}: 70 tools · 15 resources · 10 prompts`);
  return server;
}
