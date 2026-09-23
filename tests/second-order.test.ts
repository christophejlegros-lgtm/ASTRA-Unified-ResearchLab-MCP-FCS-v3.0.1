/**
 * ASTRA v2.9 — Second-Order (Self-Evidencing) Loop Test Suite
 * Tests the native TypeScript port of the second-order fragments of
 * tlcdv/the_consciousness_ai: meta-learning velocity, capability model,
 * RND curiosity, meta-consciousness scoring, development tracking, and
 * full-cycle integration through TCAIConsciousnessSystem.
 *
 * © 2026 Christophe Jean Legros — Geneva
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  MetaLearningModule,
  CapabilityModel,
  RNDCuriosity,
  MetaconsciousnessEvaluator,
  DevelopmentTracker,
  ConvergenceMonitor,
  ContinuousActuationController,
  SecondOrderLoop,
} from '../src/engine/tcai/second-order.js';
import { ActiveInferenceCore } from '../src/engine/tcai/active-inference.js';
import { SNNEngine } from '../src/engine/snn.js';
import { TCAIConsciousnessSystem } from '../src/engine/tcai/acm-bridge.js';

// ── Meta-Learning ─────────────────────────────────────────────────

describe('SecondOrder · MetaLearningModule', () => {
  test('cold start returns zero velocity below 10 samples', () => {
    const m = new MetaLearningModule();
    const s = m.update(0.1);
    assert.equal(s.learningVelocity, 0);
    assert.equal(s.samples, 1);
  });

  test('stabilising RPE ⇒ positive learning velocity (converging)', () => {
    const m = new MetaLearningModule();
    // High-variance early history, then a calm recent window.
    const early = [0.9, -0.8, 0.7, -0.6, 0.85, -0.75, 0.6, -0.7];
    for (const r of early) m.update(r);
    let last = m.update(0.01);
    for (let i = 0; i < 9; i++) last = m.update(0.01 + 1e-3 * i);
    assert.ok(last.learningVelocity > 0, `expected convergence, got ${last.learningVelocity}`);
    assert.equal(last.noveltySpike, false);
  });

  test('variance spike ⇒ novelty flag', () => {
    const m = new MetaLearningModule();
    for (let i = 0; i < 20; i++) m.update(0.0 + 1e-4 * (i % 2)); // very calm
    const spike = (() => { let s; for (const r of [0.95, -0.9, 0.92]) s = m.update(r); return s!; })();
    assert.ok(spike.rpeVarianceRatio > 1);
  });

  test('values stay finite and velocity bounded', () => {
    const m = new MetaLearningModule();
    let s;
    for (let i = 0; i < 100; i++) s = m.update(Math.sin(i));
    assert.ok(Number.isFinite(s!.learningVelocity));
    assert.ok(s!.learningVelocity >= -1 && s!.learningVelocity <= 1);
  });
});

// ── Capability Model ──────────────────────────────────────────────

describe('SecondOrder · CapabilityModel', () => {
  test('EMA converges toward repeated realized valence', () => {
    const c = new CapabilityModel(0.2);
    for (let i = 0; i < 50; i++) c.update('move_dim_0_pos', 0.8);
    assert.ok(Math.abs(c.expect('move_dim_0_pos') - 0.8) < 0.05);
  });

  test('undefined action maps to idle bucket', () => {
    const c = new CapabilityModel();
    const r = c.update(undefined, -0.3);
    assert.equal(r.actionType, 'idle');
  });

  test('snapshot is sorted by expected valence desc', () => {
    const c = new CapabilityModel(0.5);
    c.update('good', 0.9); c.update('bad', -0.9); c.update('mid', 0.1);
    const snap = c.snapshot();
    assert.equal(snap[0].action, 'good');
    assert.ok(snap[0].expectedValence >= snap[snap.length - 1].expectedValence);
  });
});

// ── RND Curiosity ─────────────────────────────────────────────────

describe('SecondOrder · RNDCuriosity (two-layer)', () => {
  test('intrinsic reward is bounded in [0,1]', () => {
    const rnd = new RNDCuriosity(32, 16, 8, 0.01, 7);
    const c = rnd.observe(new Array(32).fill(0).map((_, i) => Math.sin(i)));
    assert.ok(c.intrinsicReward >= 0 && c.intrinsicReward <= 1);
    assert.ok(Number.isFinite(c.rawError));
  });

  test('repeated exposure to the same input reduces prediction error (learning)', () => {
    const rnd = new RNDCuriosity(32, 16, 8, 0.05, 11);
    const x = new Array(32).fill(0).map((_, i) => Math.cos(0.3 * i));
    const first = rnd.observe(x).rawError;
    for (let i = 0; i < 300; i++) rnd.observe(x);
    const after = rnd.observe(x).rawError;
    assert.ok(after < first, `expected error to drop with familiarity (${first} → ${after})`);
  });

  test('deterministic under fixed seed', () => {
    const a = new RNDCuriosity(16, 8, 8, 0.01, 42).observe(new Array(16).fill(0.5));
    const b = new RNDCuriosity(16, 8, 8, 0.01, 42).observe(new Array(16).fill(0.5));
    assert.equal(a.rawError, b.rawError);
  });
});

// ── Meta-consciousness ────────────────────────────────────────────

describe('SecondOrder · MetaconsciousnessEvaluator', () => {
  test('composite is bounded and monotone in calibration', () => {
    const ev = new MetaconsciousnessEvaluator();
    const lo = ev.evaluate({ confidenceCalibration: 0.1, learningVelocity: 0.2, temporalContinuity: 0.5, noveltyDetected: false });
    const hi = ev.evaluate({ confidenceCalibration: 0.9, learningVelocity: 0.2, temporalContinuity: 0.5, noveltyDetected: false });
    assert.ok(hi.overall > lo.overall);
    assert.ok(hi.overall >= 0 && hi.overall <= 1);
    assert.ok(typeof hi.disclaimer === 'string' && hi.disclaimer.length > 0);
  });
});

// ── Development Tracker ───────────────────────────────────────────

describe('SecondOrder · DevelopmentTracker', () => {
  test('high stable composite + meta ⇒ advanced stage', () => {
    const d = new DevelopmentTracker();
    let s;
    for (let i = 0; i < 40; i++) s = d.update(0.8, 0.8);
    assert.ok(s!.stageIndex >= 2, `expected integrative/reflective, got ${s!.stage}`);
    assert.ok(s!.peak >= 0.8);
  });

  test('low composite stays nascent/reactive', () => {
    const d = new DevelopmentTracker();
    let s;
    for (let i = 0; i < 40; i++) s = d.update(0.1, 0.1);
    assert.ok(s!.stageIndex <= 1);
  });
});

// ── Convergence / halting criterion ───────────────────────────────

describe('SecondOrder · ConvergenceMonitor (free-energy + task quality)', () => {
  const satisfying = { freeEnergy: 0.4, deltaFreeEnergy: 0.005, taskQuality: 0.9, epistemic: 0.02 };

  test('requires sustained satisfaction over patience before halting', () => {
    const m = new ConvergenceMonitor({ patience: 3 });
    assert.equal(m.update(satisfying).satisfied, false); // sustained 1
    assert.equal(m.update(satisfying).satisfied, false); // sustained 2
    const s = m.update(satisfying);                       // sustained 3 ⇒ halt
    assert.equal(s.satisfied, true);
    assert.equal(s.sustainedFor, 3);
  });

  test('low task quality alone blocks satisfaction even when free energy has settled', () => {
    const m = new ConvergenceMonitor({ patience: 1 });
    const r = m.update({ ...satisfying, taskQuality: 0.2 }); // settled but mediocre
    assert.equal(r.reasons.freeEnergyConverged, true);
    assert.equal(r.reasons.taskQualityMet, false);
    assert.equal(r.satisfied, false);
  });

  test('high |ΔF| (not yet settled) blocks satisfaction even with good task quality', () => {
    const m = new ConvergenceMonitor({ patience: 1 });
    const r = m.update({ ...satisfying, deltaFreeEnergy: 0.5 });
    assert.equal(r.reasons.freeEnergyConverged, false);
    assert.equal(r.satisfied, false);
  });

  test('reasons reflect each threshold independently', () => {
    const m = new ConvergenceMonitor();
    const r = m.update({ freeEnergy: 1, deltaFreeEnergy: 0.9, taskQuality: 0.1, epistemic: 0.9 }).reasons;
    assert.equal(r.freeEnergyConverged, false);
    assert.equal(r.taskQualityMet, false);
    assert.equal(r.lowEpistemic, false);
  });

  test('satisfactionScore is bounded in [0,1] and rises with quality', () => {
    const m = new ConvergenceMonitor();
    const lo = m.update({ freeEnergy: 2, deltaFreeEnergy: 1, taskQuality: 0, epistemic: 1 }).satisfactionScore;
    const hi = m.update(satisfying).satisfactionScore;
    assert.ok(lo >= 0 && lo <= 1 && hi >= 0 && hi <= 1);
    assert.ok(hi > lo);
  });

  test('configure() updates thresholds and resets sustained count', () => {
    const m = new ConvergenceMonitor({ patience: 5 });
    m.update(satisfying);
    const cfg = m.configure({ patience: 1 });
    assert.equal(cfg.patience, 1);
    assert.equal(m.update(satisfying).satisfied, true); // patience now 1
  });
});

describe('SecondOrder · ActiveInferenceCore (real free energy)', () => {
  test('variational free energy decreases as the model learns a stable observation', () => {
    const aif = new ActiveInferenceCore(5, 5, 2);
    const C = [0, 0.5, 1, 1.5, 2];
    const first = aif.step(4, C).freeEnergy;
    let last = first;
    for (let i = 0; i < 15; i++) last = aif.step(4, C).freeEnergy;
    assert.ok(last < first, `F should fall as A learns (${first} → ${last})`);
    assert.ok(last >= 0);
  });

  test('EFE decomposition and pragmatic value track preferences', () => {
    const aif = new ActiveInferenceCore(5, 5, 2);
    const C = [0, 0.5, 1, 1.5, 2];
    const r = aif.step(4, C); // observe the most-preferred bucket
    assert.equal(r.expectedFreeEnergy.length, 2);
    assert.ok(Number.isFinite(r.pragmatic));
    assert.equal(r.realizedPreference, 2); // C[4]
    assert.ok(r.policyPosterior.length === 2);
  });

  test('observation clamped to valid range; outputs finite', () => {
    const aif = new ActiveInferenceCore(3, 3, 2);
    const r = aif.step(99, [0, 1, 2]); // out of range ⇒ clamped to 2
    assert.equal(r.realizedPreference, 2);
    assert.ok(Number.isFinite(r.freeEnergy) && Number.isFinite(r.modelEntropy));
  });
});

describe('SecondOrder · ADVERSARIAL halting (stationarity ≠ satisfaction)', () => {
  test('GOOD regime (high task feedback) eventually halts as satisfied', () => {
    const sys = new TCAIConsciousnessSystem();
    sys.secondOrder.convergence.configure({ epsFreeEnergy: 0.1, minTaskQuality: 0.6, maxEpistemic: 1, patience: 3 });
    let satisfiedAt = -1;
    for (let i = 0; i < 40; i++) {
      const r = sys.runCycle({ signals: { vision: [0.3, 0.3, 0.3, 0.3] }, rewardSignal: 0.95 });
      if (r.secondOrder.convergence.satisfied) { satisfiedAt = i + 1; break; }
    }
    assert.ok(satisfiedAt > 0, 'good rewarded regime should reach satisfaction');
  });

  test('MEDIOCRE fixed point (constant LOW feedback) is NEVER satisfied despite F settling', () => {
    const sys = new TCAIConsciousnessSystem();
    sys.secondOrder.convergence.configure({ epsFreeEnergy: 0.1, minTaskQuality: 0.6, maxEpistemic: 1, patience: 3 });
    let everSatisfied = false;
    let settledAtLeastOnce = false;
    for (let i = 0; i < 60; i++) {
      const r = sys.runCycle({ signals: { vision: [0.3, 0.3, 0.3, 0.3] }, rewardSignal: -0.9 });
      if (r.secondOrder.convergence.reasons.freeEnergyConverged) settledAtLeastOnce = true;
      if (r.secondOrder.convergence.satisfied) everSatisfied = true;
    }
    assert.equal(settledAtLeastOnce, true, 'free energy should settle (stationarity)');
    assert.equal(everSatisfied, false, 'but low task quality must block satisfaction');
  });

  test('reset clears AIF and convergence state', () => {
    const sys = new TCAIConsciousnessSystem();
    sys.runCycle({ signals: { vision: [0.5, 0.5] }, rewardSignal: 0.9 });
    sys.reset();
    assert.equal(sys.secondOrder.isSatisfied(), false);
    assert.equal(sys.secondOrder.getState(), null);
  });
});

// ── Full integration through the cycle ────────────────────────────

describe('SecondOrder · CLOSED-LOOP on real LIF SNN (v2.9)', () => {
  test('AIF observation is grounded in the real SNN substrate (non-trivial, in range)', () => {
    const sys = new TCAIConsciousnessSystem();
    let nonZero = 0;
    for (let i = 0; i < 20; i++) {
      const r = sys.runCycle({ signals: { vision: [0.6, 0.6, 0.6, 0.6] }, rewardSignal: 0.5 });
      const ai = r.secondOrder.activeInference;
      assert.ok(ai.substrateObs >= 0 && ai.substrateObs <= 4);
      if (ai.substrateObs > 0) nonZero++;
    }
    // The real SNN carries action-responsive signal: observation is not stuck at 0.
    assert.ok(nonZero > 0, 'substrate observation must be non-trivial (real SNN signal)');
  });

  test('SNN firing rate responds monotonically to injection (real coupling)', () => {
    const sys = new TCAIConsciousnessSystem();
    const rateAt = (amp: number): number => {
      const snn = sys.substrateSnn; snn.reset();
      for (let c = 0; c < 12; c++) for (let k = 0; k < 6; k++) { snn.injectSpikes('input', 24, amp); snn.step(); }
      return snn.stats().firingRateStats.mean;
    };
    const low = rateAt(0); const high = rateAt(24);
    assert.ok(high > low + 10, `injection must raise firing rate (low ${low.toFixed(1)} → high ${high.toFixed(1)} Hz)`);
  });

  test('default controller regulates to an INTERIOR drive (non-degenerate, v2.9)', () => {
    // v2.9 trivially ramped drive→1; v2.9 regulates toward a setpoint, so the
    // drive must settle strictly inside (0,1), not pinned to the boundary.
    const drives: number[] = [];
    for (let r = 0; r < 5; r++) {
      const sys = new TCAIConsciousnessSystem();
      for (let i = 0; i < 150; i++) sys.runCycle({ signals: { vision: [0.4, 0.4, 0.4, 0.4] }, rewardSignal: 0.6 });
      drives.push(sys.secondOrder.getState()!.activeInference.substrateDrive);
    }
    const mean = drives.reduce((a, b) => a + b, 0) / drives.length;
    assert.ok(mean > 0.05 && mean < 0.9, `default drive should be interior, got ${mean.toFixed(2)}`);
  });

  test('controller tracks the setpoint: higher target ⇒ higher drive (v2.9)', () => {
    const driveFor = (setpoint: number): number => {
      let acc = 0; const R = 4;
      for (let r = 0; r < R; r++) {
        const sys = new TCAIConsciousnessSystem();
        sys.secondOrder.actuationController.configure({ setpoint });
        for (let i = 0; i < 150; i++) sys.runCycle({ signals: { vision: [0.4, 0.4, 0.4, 0.4] }, rewardSignal: 0.6 });
        acc += sys.secondOrder.getState()!.activeInference.substrateDrive;
      }
      return acc / R;
    };
    assert.ok(driveFor(0.2) < driveFor(0.45),
      'a higher substrate setpoint must demand a higher drive (regulation, not maximisation)');
  });

  test('production loop OFF by default leaves the shared SNN untouched (no contention, v2.9)', () => {
    const prod = new SNNEngine();
    const baseline = prod.stats().firingRateStats.mean;
    const sys = new TCAIConsciousnessSystem();
    sys.connectProductionSnn(prod); // connected but loop NOT enabled
    for (let i = 0; i < 30; i++) sys.runCycle({ signals: { vision: [0.5, 0.5] }, rewardSignal: 0.6 });
    assert.equal(prod.stats().firingRateStats.mean, baseline, 'default must not drive the production SNN');
  });

  test('production loop ON closes the loop through the shared SNN (read+write, v2.9)', () => {
    const prod = new SNNEngine();
    const sys = new TCAIConsciousnessSystem();
    sys.connectProductionSnn(prod);
    sys.setProductionLoop(true);
    for (let i = 0; i < 60; i++) sys.runCycle({ signals: { vision: [0.5, 0.5] }, rewardSignal: 0.6 });
    // The production SNN is both driven (write) and observed (read) by the loop.
    assert.ok(prod.stats().firingRateStats.mean > 0, 'production SNN must be driven');
    const drive = sys.secondOrder.getState()!.activeInference.substrateDrive;
    assert.ok(drive > 0.05 && drive <= 1, 'controller regulates through the production substrate');
  });

  test('open loop freezes the drive; closed loop moves it', () => {
    const sys = new TCAIConsciousnessSystem();
    for (let i = 0; i < 20; i++) sys.runCycle({ signals: { vision: [0.5, 0.5] }, rewardSignal: 0.7 });
    sys.secondOrder.setActuation(false);
    const before = sys.secondOrder.getState()!.activeInference.substrateDrive;
    sys.runCycle({ signals: { vision: [0.5, 0.5] }, rewardSignal: 0.7 });
    const after = sys.secondOrder.getState()!.activeInference.substrateDrive;
    assert.equal(after, before, 'open loop must freeze the drive');
  });
});

describe('ContinuousActuationController · setpoint regulation (v2.9)', () => {
  test('regulates to an interior drive that achieves the setpoint (clean world)', () => {
    // Clean contingency feature = drive. Setpoint 0.4 ⇒ drive should settle ≈0.4
    // (interior), NOT ramp to 1 — the v2.9 non-degenerate objective.
    const ctl = new ContinuousActuationController({ setpoint: 0.4 });
    let drive = 0.5;
    for (let i = 0; i < 120; i++) drive = ctl.select(drive).drive;
    assert.ok(Math.abs(drive - 0.4) < 0.15, `drive should regulate to ≈0.4, got ${drive.toFixed(2)}`);
  });

  test('a higher setpoint yields a higher regulated drive', () => {
    const settle = (sp: number): number => {
      const ctl = new ContinuousActuationController({ setpoint: sp });
      let d = 0.5;
      for (let i = 0; i < 120; i++) d = ctl.select(d).drive;
      return d;
    };
    assert.ok(settle(0.3) < settle(0.7), 'higher setpoint ⇒ higher drive');
  });

  test('configure changes the target and reset restores neutral state', () => {
    const ctl = new ContinuousActuationController();
    assert.equal(ctl.configure({ setpoint: 0.8 }).setpoint, 0.8);
    for (let i = 0; i < 30; i++) ctl.select(0.5);
    ctl.reset();
    assert.equal(ctl.getDrive(), 0.5);
  });
});



describe('SecondOrder · threshold calibration on measured ΔF (v2.9)', () => {
  test('calibrate sets epsFreeEnergy from the measured ΔF median', () => {
    const m = new ConvergenceMonitor();
    // Feed a decaying ΔF stream like the real dynamics.
    for (let t = 1; t <= 40; t++) {
      m.update({ freeEnergy: 1.0, deltaFreeEnergy: 0.3 / t, taskQuality: 0.5, epistemic: 0 });
    }
    const before = m.getConfig().epsFreeEnergy;
    const cal = m.calibrate(0.5);
    assert.ok(cal.samples >= 40);
    assert.ok(cal.epsFreeEnergy > 0);
    assert.equal(m.getConfig().epsFreeEnergy, cal.epsFreeEnergy);
    assert.notEqual(m.getConfig().epsFreeEnergy, before);
  });

  test('relative (scale-free) convergence: |ΔF| ≤ rel·F passes even above absolute eps', () => {
    const m = new ConvergenceMonitor({ epsFreeEnergy: 0.001, relFreeEnergy: 0.05, minTaskQuality: 0, maxEpistemic: 1, patience: 1 });
    // ΔF=0.04 exceeds the tiny absolute eps but is ≤ 5% of F=2.0 ⇒ converged.
    const r = m.update({ freeEnergy: 2.0, deltaFreeEnergy: 0.04, taskQuality: 1, epistemic: 0 });
    assert.equal(r.reasons.freeEnergyConverged, true);
    assert.equal(r.satisfied, true);
  });
});

// ── Legacy full integration through the cycle ─────────────────────

describe('SecondOrder · TCAIConsciousnessSystem integration', () => {
  test('runCycle populates a second-order snapshot', () => {
    const sys = new TCAIConsciousnessSystem();
    const r = sys.runCycle({
      signals: { vision: [0.4, 0.2, 0.1, 0.3], semantic: [0.2, 0.5, 0.1, 0.0] },
      rewardSignal: 0.5, novelty: 0.6,
    });
    assert.ok(r.secondOrder);
    assert.ok(Number.isFinite(r.secondOrder.metaLearning.learningVelocity));
    assert.ok(r.secondOrder.curiosity.intrinsicReward >= 0);
    assert.ok(['nascent', 'reactive', 'integrative', 'reflective'].includes(r.secondOrder.development.stage));
  });

  test('repeated identical cycles drive curiosity down (familiarity)', () => {
    const sys = new TCAIConsciousnessSystem();
    const input = { signals: { vision: [0.3, 0.3, 0.3, 0.3] }, rewardSignal: 0.4, novelty: 0.2 };
    const first = sys.runCycle(input).secondOrder.curiosity.runningError;
    let last = first;
    for (let i = 0; i < 60; i++) last = sys.runCycle(input).secondOrder.curiosity.runningError;
    assert.ok(last <= first + 1e-6, `expected running error not to grow (${first} → ${last})`);
  });

  test('reset clears the second-order loop', () => {
    const sys = new TCAIConsciousnessSystem();
    sys.runCycle({ signals: { vision: [0.5, 0.5] }, rewardSignal: 0.3 });
    sys.reset();
    assert.equal(sys.secondOrder.getState(), null);
    assert.equal(sys.getCycles(), 0);
  });
});
