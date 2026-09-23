/**
 * ASTRA MCP Server — Unit Test Suite (v2)
 * © 2026 Christophe Jean Legros — Geneva
 *
 * Node.js built-in test runner (node --test).
 * Covers: State store (with bounds), SNN engine (layered), ACM (proxies),
 *         Ethics (mode-aware), Simulation loop.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { state, StateStore } from '../src/engine/state.js';
import { SNNEngine } from '../src/engine/snn.js';
import { ACMModule } from '../src/engine/acm.js';
import { EthicsMonitor } from '../src/engine/ethics.js';
import { startSimulation, stopSimulation, isRunning } from '../src/engine/simulation.js';

// ═══════════════════════════════════════════════════════════════════
// Suite 1: State Store
// ═══════════════════════════════════════════════════════════════════

describe('StateStore', () => {
  let store: StateStore;

  before(() => {
    store = new StateStore();
  });

  it('initialises with default values', () => {
    const s = store.snapshot;
    assert.equal(s.tick, 0);
    assert.equal(s.mode, 'sim');
    assert.equal(typeof s.startTime, 'number');
    assert.equal(s.loihi.spk, 0);
    assert.equal(s.eth.viab, 95);
    assert.equal(s.fu.fs, 0.45);
  });

  it('initialises ACM with proxy names', () => {
    const s = store.snapshot;
    assert.equal(s.acm.integrationProxy, 0);
    assert.equal(s.acm.broadcastProxy, 0);
    assert.equal(s.acm.arousalProxy, 0);
    assert.equal(s.acm.compositeScore, 0);
    assert.equal(s.acm.decisionClass, 0);
  });

  it('get() retrieves nested values via dot-notation', () => {
    assert.equal(store.get('mode'), 'sim');
    assert.equal(store.get('loihi.spk'), 0);
    assert.equal(store.get('eth.viab'), 95);
    assert.equal(store.get('acm.integrationProxy'), 0);
  });

  it('set() updates values and returns true', () => {
    const ok = store.set('loihi.spk', 1250);
    assert.equal(ok, true);
    assert.equal(store.get('loihi.spk'), 1250);
  });

  it('set() rejects invalid namespaces', () => {
    const ok = store.set('invalid.key', 42);
    assert.equal(ok, false);
  });

  it('emits change events', () => {
    let fired = false;
    store.on('change', (evt: { path: string; value: unknown }) => {
      if (evt.path === 'acm.integrationProxy') fired = true;
    });
    store.set('acm.integrationProxy', 0.42);
    assert.equal(fired, true);
  });

  it('tick() increments counter', () => {
    const before = store.snapshot.tick;
    store.tick();
    assert.equal(store.snapshot.tick, before + 1);
  });

  it('reset() restores defaults', () => {
    store.set('loihi.spk', 9999);
    store.reset();
    assert.equal(store.snapshot.loihi.spk, 0);
    assert.equal(store.snapshot.tick, 0);
  });

  it('merge() applies bulk updates', () => {
    store.merge({
      loihi: { spk: 500, bio: 35.2 },
      eth: { viab: 88 },
    });
    assert.equal(store.get('loihi.spk'), 500);
    assert.equal(store.get('loihi.bio'), 35.2);
    assert.equal(store.get('eth.viab'), 88);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Suite 2: State Bounds Validation
// ═══════════════════════════════════════════════════════════════════

describe('StateStore Bounds Validation', () => {
  let store: StateStore;

  before(() => {
    store = new StateStore();
  });

  it('setChecked() accepts values within bounds', () => {
    const err = store.setChecked('eth.viab', 85);
    assert.equal(err, null);
    assert.equal(store.get('eth.viab'), 85);
  });

  it('setChecked() rejects values below minimum', () => {
    const err = store.setChecked('eth.viab', -10);
    assert.ok(err);
    assert.ok(err.includes('out of bounds'));
  });

  it('setChecked() rejects values above maximum', () => {
    const err = store.setChecked('eth.viab', 150);
    assert.ok(err);
    assert.ok(err.includes('out of bounds'));
  });

  it('setChecked() rejects Infinity', () => {
    const err = store.setChecked('loihi.spk', Infinity);
    assert.ok(err);
    assert.ok(err.includes('finite'));
  });

  it('setChecked() rejects NaN', () => {
    const err = store.setChecked('loihi.spk', NaN);
    assert.ok(err);
    assert.ok(err.includes('finite'));
  });

  it('setChecked() rejects invalid paths', () => {
    const err = store.setChecked('invalid.path', 42);
    assert.ok(err);
    assert.ok(err.includes('Invalid path'));
  });

  it('getBounds() returns bounds for known paths', () => {
    const bounds = store.getBounds('eth.viab');
    assert.ok(bounds);
    assert.equal(bounds.min, 0);
    assert.equal(bounds.max, 100);
  });

  it('getBounds() returns undefined for unknown paths', () => {
    const bounds = store.getBounds('nonexistent.path');
    assert.equal(bounds, undefined);
  });

  it('boundedPaths lists all registered paths', () => {
    const paths = store.boundedPaths;
    assert.ok(paths.length > 20);
    assert.ok(paths.includes('eth.viab'));
    assert.ok(paths.includes('acm.integrationProxy'));
    assert.ok(paths.includes('loihi.spk'));
  });
});

// ═══════════════════════════════════════════════════════════════════
// Suite 3: SNN Engine (Layered Architecture)
// ═══════════════════════════════════════════════════════════════════

describe('SNNEngine', () => {
  let engine: SNNEngine;

  before(() => {
    engine = new SNNEngine();
  });

  it('initialises with correct total neuron count', () => {
    // Default: 32 + 64 + 16 + 16 = 128
    assert.equal(engine.N, 128);
  });

  it('reports layer configuration', () => {
    const layers = engine.layerInfo;
    assert.equal(layers.length, 4);
    assert.equal(layers[0].name, 'input');
    assert.equal(layers[0].size, 32);
    assert.equal(layers[0].offset, 0);
    assert.equal(layers[1].name, 'hidden_1');
    assert.equal(layers[1].size, 64);
    assert.equal(layers[1].offset, 32);
    assert.equal(layers[2].name, 'hidden_2');
    assert.equal(layers[2].size, 16);
    assert.equal(layers[2].offset, 96);
    assert.equal(layers[3].name, 'output');
    assert.equal(layers[3].size, 16);
    assert.equal(layers[3].offset, 112);
  });

  it('creates sparse synaptic connections', () => {
    assert.ok(engine.synCount > 0);
    // With ff=0.3 and rec=0.1, expect thousands of synapses
    assert.ok(engine.synCount > 500, `Expected >500 synapses, got ${engine.synCount}`);
  });

  it('supports custom layer configurations', () => {
    const custom = new SNNEngine({
      layers: [
        { name: 'in', size: 10 },
        { name: 'out', size: 5 },
      ],
    });
    assert.equal(custom.N, 15);
    assert.equal(custom.layerInfo.length, 2);
  });

  it('step() returns spike count', () => {
    const spikes = engine.step();
    assert.equal(typeof spikes, 'number');
    assert.ok(spikes >= 0);
  });

  it('run() accumulates spikes across steps', () => {
    const { totalSpikes, time } = engine.run(50);
    assert.equal(typeof totalSpikes, 'number');
    assert.ok(time > 0);
  });

  it('voltages initialise to vRest', () => {
    const fresh = new SNNEngine();
    const vRest = fresh.config.vRest;
    for (let i = 0; i < fresh.N; i++) {
      assert.equal(fresh.voltages[i], vRest);
    }
  });

  it('init() resets state completely', () => {
    engine.run(100);
    const before = engine.stdpCount;
    engine.init();
    assert.equal(engine.time, 0);
    assert.equal(engine.stdpCount, 0);
    assert.equal(engine.stepCount, 0);
    assert.ok(engine.synCount > 0); // reconnected
  });

  it('injectSpikes() modifies targeted neurons', () => {
    engine.init();
    const result = engine.injectSpikes('input', 5, 3.0);
    assert.equal(result.count, 5);
    assert.equal(result.target, 'input');
    assert.equal(result.amplitude, 3.0);
    assert.equal(result.stimulatedNeurons.length, 5);
    // All stimulated neurons should be in input layer [0, 32)
    for (const n of result.stimulatedNeurons) {
      assert.ok(n >= 0 && n < 32, `Neuron ${n} not in input layer`);
    }
  });

  it('injectSpikes() respects output layer boundaries', () => {
    const result = engine.injectSpikes('output', 5, 2.0);
    // Output layer starts at offset 112
    for (const n of result.stimulatedNeurons) {
      assert.ok(n >= 112 && n < 128, `Neuron ${n} not in output layer`);
    }
  });

  it('stats() includes layer information', () => {
    const stats = engine.stats();
    assert.ok(stats.layers);
    assert.equal(stats.layers.length, 4);
    assert.equal(stats.neurons, 128);
  });

  it('weightStats() returns valid statistics', () => {
    engine.init();
    const ws = engine.weightStats();
    assert.ok(ws.nonZero > 0);
    assert.ok(ws.mean > 0);
    assert.ok(ws.max >= ws.mean);
    assert.ok(ws.min <= ws.mean);
    assert.ok(ws.std >= 0);
  });

  it('layerRates() returns per-layer firing rates', () => {
    engine.run(20);
    const lr = engine.layerRates();
    assert.ok('input' in lr);
    assert.ok('hidden_1' in lr);
    assert.ok('output' in lr);
  });

  it('STDP modifies weights over time', () => {
    // Use a high-excitability configuration to guarantee reliable STDP events
    // Noise range [10,25] produces steady-state V above threshold (-50mV)
    const excitable = new SNNEngine({
      layers: [{ name: 'in', size: 16 }, { name: 'out', size: 16 }],
      inputNoiseMin: 10,
      inputNoiseMax: 25,
      ffConnectivity: 0.5,
      recurrentConnectivity: 0.3,
    });
    const wsBefore = excitable.weightStats();
    excitable.run(200);
    const wsAfter = excitable.weightStats();
    assert.ok(excitable.stdpCount > 0, `Expected STDP updates, got ${excitable.stdpCount}`);
    assert.ok(wsBefore.mean !== wsAfter.mean || wsBefore.std !== wsAfter.std,
      'Expected weight distribution to change after STDP');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Suite 4: ACM Module (Honest Proxy Naming)
// ═══════════════════════════════════════════════════════════════════

describe('ACMModule', () => {
  let acm: ACMModule;

  before(() => {
    // Reset state for clean ACM tests
    state.reset();
    acm = new ACMModule();
  });

  it('assess() returns correctly named proxy fields', () => {
    // Prime state with some activity
    state.set('loihi.spk', 500);
    state.set('loihi.bio', 40);
    state.set('loihi.nrg', 2.5);
    state.set('loihi.ly', { i: 25, h1: 30, h2: 28, o: 22 });

    const result = acm.assess();
    assert.ok('compositeScore' in result);
    assert.ok('integrationProxy' in result.components);
    assert.ok('broadcastProxy' in result.components);
    assert.ok('arousalProxy' in result.components);
    assert.ok(!('phiIIT' in result.components), 'Should not use phiIIT name');
  });

  it('components include methodological basis', () => {
    const result = acm.assess();
    assert.ok(result.components.integrationProxy.basis.includes('proxy'));
    assert.ok(result.components.broadcastProxy.basis.includes('proxy'));
    assert.ok(result.components.arousalProxy.basis.includes('Arousal only'));
  });

  it('formula uses proxy notation (tilde)', () => {
    const result = acm.assess();
    assert.ok(result.formula.includes('Φ̃'), 'Formula should use Φ̃ not Φ');
    assert.ok(result.formula.includes('GW̃'), 'Formula should use GW̃ not GW');
    assert.ok(result.formula.includes('PAD̃'), 'Formula should use PAD̃ not PAD');
  });

  it('includes classLabel in results', () => {
    const result = acm.assess();
    assert.ok(result.classLabel);
    assert.ok(['ABSENT', 'MINIMAL', 'PARTIAL', 'MODERATE', 'HIGH', 'FULL'].includes(result.classLabel));
  });

  it('score is bounded [0, 1]', () => {
    const result = acm.assess();
    assert.ok(result.compositeScore >= 0);
    assert.ok(result.compositeScore <= 1);
  });

  it('supports custom weights', () => {
    const r1 = acm.assess({ alpha: 1, beta: 0, gamma: 0 });
    const r2 = acm.assess({ alpha: 0, beta: 1, gamma: 0 });
    // Different weight emphasis should yield different scores (unless all components equal)
    assert.equal(typeof r1.compositeScore, 'number');
    assert.equal(typeof r2.compositeScore, 'number');
  });

  it('increments cycle count', () => {
    const c1 = acm.totalCycles;
    acm.assess();
    assert.equal(acm.totalCycles, c1 + 1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Suite 5: Ethics Monitor (Mode-Aware)
// ═══════════════════════════════════════════════════════════════════

describe('EthicsMonitor', () => {
  let monitor: EthicsMonitor;

  before(() => {
    state.reset();
    monitor = new EthicsMonitor();
  });

  it('assess() returns NORMAL for default values', () => {
    const report = monitor.assess();
    assert.equal(report.status, 'NORMAL');
    assert.equal(report.alerts.length, 0);
  });

  it('reports data source from state mode', () => {
    const report = monitor.assess();
    assert.equal(report.dataSource, 'simulated');
    assert.ok(report.disclaimer.includes('SIMULATED'));
  });

  it('irbRequired is false in sim mode', () => {
    const report = monitor.assess();
    assert.equal(report.irbRequired, false);
  });

  it('irbRequired is true in live mode', () => {
    state.set('mode', 'live');
    const report = monitor.assess();
    assert.equal(report.irbRequired, true);
    assert.ok(report.disclaimer.includes('LIVE'));
    state.set('mode', 'sim'); // restore
  });

  it('detects STRESS state', () => {
    state.set('eth.viab', 88);
    const report = monitor.assess();
    assert.equal(report.status, 'STRESS');
    assert.ok(report.alerts.length > 0);
    state.set('eth.viab', 95); // restore
  });

  it('detects DISTRESS state', () => {
    state.set('eth.viab', 75);
    const report = monitor.assess();
    assert.equal(report.status, 'DISTRESS');
    assert.ok(report.alerts.some(a => a.severity === 'critical'));
    state.set('eth.viab', 95); // restore
  });

  it('provides mode-aware recommendations', () => {
    state.set('eth.viab', 75);
    const simReport = monitor.assess();
    assert.ok(simReport.recommendation.includes('[SIM]'));

    state.set('mode', 'live');
    const liveReport = monitor.assess();
    assert.ok(liveReport.recommendation.includes('HALT'));
    assert.ok(liveReport.recommendation.includes('IRB'));

    state.set('mode', 'sim');
    state.set('eth.viab', 95);
  });

  it('detects firing rate anomalies', () => {
    state.set('eth.fr', 3);
    const report = monitor.assess();
    assert.ok(report.alerts.some(a => a.metric === 'firing_rate'));
    state.set('eth.fr', 28);
  });

  it('detects ATP/ADP anomalies', () => {
    state.set('eth.atp', 1.5);
    const report = monitor.assess();
    assert.ok(report.alerts.some(a => a.metric === 'atp_adp' && a.severity === 'critical'));
    state.set('eth.atp', 3.5);
  });

  it('detects calcium anomalies', () => {
    state.set('eth.ca', 250);
    const report = monitor.assess();
    assert.ok(report.alerts.some(a => a.metric === 'calcium_nm'));
    state.set('eth.ca', 65);
  });

  it('simulateDrift() keeps values in plausible range', () => {
    for (let i = 0; i < 100; i++) monitor.simulateDrift();
    const s = state.snapshot.eth;
    assert.ok(s.viab >= 70 && s.viab <= 100);
    assert.ok(s.fr >= 5 && s.fr <= 60);
    assert.ok(s.atp >= 1.5 && s.atp <= 5);
    assert.ok(s.ca >= 20 && s.ca <= 300);
  });

  it('maintains history with data source', () => {
    const report = monitor.assess();
    const last = monitor.history[monitor.history.length - 1];
    assert.ok(last);
    assert.equal(last.dataSource, 'simulated');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Suite 6: Simulation Loop
// ═══════════════════════════════════════════════════════════════════

describe('Simulation', () => {
  after(() => {
    stopSimulation();
  });

  it('starts and stops cleanly', () => {
    startSimulation({ intervalMs: 50 });
    assert.equal(isRunning(), true);
    stopSimulation();
    assert.equal(isRunning(), false);
  });

  it('does not start twice', () => {
    startSimulation({ intervalMs: 50 });
    startSimulation({ intervalMs: 50 }); // should be no-op
    assert.equal(isRunning(), true);
    stopSimulation();
  });

  it('advances tick counter', async () => {
    const before = state.snapshot.tick;
    startSimulation({ intervalMs: 30 });
    await new Promise(r => setTimeout(r, 150));
    stopSimulation();
    assert.ok(state.snapshot.tick > before, 'Tick should have advanced');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Suite 7: Security
// ═══════════════════════════════════════════════════════════════════

describe('Security', () => {
  it('rejects prototype pollution paths', () => {
    const ok = state.set('__proto__.polluted', 'yes');
    assert.equal(ok, false);
  });

  it('rejects constructor paths', () => {
    const ok = state.set('constructor.name', 'Hacked');
    assert.equal(ok, false);
  });

  it('bounds validation prevents extreme values', () => {
    const store = new StateStore();
    assert.ok(store.setChecked('eth.viab', -500) !== null);
    assert.ok(store.setChecked('loihi.spk', Infinity) !== null);
    assert.ok(store.setChecked('acm.confidence', 999) !== null);
  });
});
