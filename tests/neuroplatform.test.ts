/**
 * ASTRA v2.2 — FinalSpark NeuroPlatform v2 Integration Test Suite
 * Tests the TypeScript port of the NeuroPlatform v2 control API:
 * StimParam charge balance, Intan/Trigger/Database/Camera controllers,
 * the organoid MEA simulator, and the ASTRA closed-loop bridge.
 *
 * © 2026 Christophe Jean Legros — Geneva
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  StimParam, StimPolarity, StimShape, MEA,
  OrganoidMEA, IntanController, TriggerController, DatabaseController, CameraController,
  NeuroPlatformBridge, TriggersQuery, SpikeCountQuery, SpikeEventQuery, RawSpikeQuery,
  ELECTRODE_COUNT, TRIGGER_COUNT,
} from '../src/engine/neuroplatform.js';

// ── StimParam ─────────────────────────────────────────────────────

describe('NeuroPlatform · StimParam', () => {
  test('defaults match the documented StimParam reference table', () => {
    const sp = new StimParam();
    assert.equal(sp.enable, true);
    assert.equal(sp.index, 0);
    assert.equal(sp.trigger_key, 0);
    assert.equal(sp.polarity, StimPolarity.NegativeFirst);
    assert.equal(sp.phase_duration1, 100);
    assert.equal(sp.phase_amplitude1, 1);
    assert.equal(sp.pulse_train_period, 10000);
    assert.equal(sp.post_stim_ref_period, 1000);
    assert.equal(sp.stim_shape, StimShape.Biphasic);
  });

  test('charge balance: equal D·A products are balanced, unequal are not', () => {
    const balanced = new StimParam({ phase_duration1: 100, phase_amplitude1: 2, phase_duration2: 200, phase_amplitude2: 1 });
    assert.ok(balanced.isChargeBalanced(1e-6));
    assert.equal(balanced.netCharge_pC, 0);

    const unbalanced = new StimParam({ phase_duration1: 100, phase_amplitude1: 2, phase_duration2: 100, phase_amplitude2: 1 });
    assert.ok(!unbalanced.isChargeBalanced(1e-3));
    assert.ok(Math.abs(unbalanced.netCharge_pC) > 0);
  });

  test('charge accessors compute D·A in pC', () => {
    const sp = new StimParam({ phase_duration1: 150, phase_amplitude1: 3, phase_duration2: 100, phase_amplitude2: 4 });
    assert.equal(sp.charge1_pC, 450);
    assert.equal(sp.charge2_pC, 400);
  });

  test('validate flags out-of-range index, trigger_key and excessive amplitude', () => {
    assert.ok(new StimParam({ index: 999 }).validate().some((e) => e.includes('index')));
    assert.ok(new StimParam({ trigger_key: 42 }).validate().some((e) => e.includes('trigger_key')));
    assert.ok(new StimParam({ phase_amplitude1: 80 }).validate().some((e) => e.includes('amplitude')));
    assert.equal(new StimParam({ index: 23, trigger_key: 2 }).validate().length, 0);
  });

  test('display_attributes returns a complete, JSON-safe record', () => {
    const d = new StimParam({ index: 23, trigger_key: 2 }).display_attributes();
    assert.equal(d.index, 23);
    assert.equal(d.trigger_key, 2);
    assert.equal(typeof d.charge1_pC, 'number');
    assert.equal(typeof d.balanced, 'boolean');
  });
});

// ── OrganoidMEA simulator ─────────────────────────────────────────

describe('NeuroPlatform · OrganoidMEA simulator', () => {
  test('initialises 128 electrodes with plausible viability', () => {
    const mea = new OrganoidMEA();
    assert.equal(mea.electrodes.length, ELECTRODE_COUNT);
    for (const e of mea.electrodes) {
      assert.ok(e.viability > 80 && e.viability <= 100);
      assert.ok(e.baselineRateHz >= 0);
    }
  });

  test('advance() accumulates spontaneous spikes and is deterministic for a fixed seed', () => {
    const a = new OrganoidMEA({ seed: 123, baselineRateHz: 5 });
    const b = new OrganoidMEA({ seed: 123, baselineRateHz: 5 });
    const ca = a.advance(1000);
    const cb = b.advance(1000);
    const totalA = ca.reduce((s, c) => s + c, 0);
    assert.ok(totalA > 0, 'should record spontaneous spikes over 1 s');
    assert.deepEqual(Array.from(ca), Array.from(cb), 'same seed → same spike pattern');
  });

  test('stimulate() with higher charge yields more evoked spikes on average', () => {
    const mea = new OrganoidMEA({ seed: 7, baselineRateHz: 0 });
    let lowEvoked = 0, highEvoked = 0;
    for (let i = 0; i < 40; i++) {
      lowEvoked += mea.stimulate(new StimParam({ index: 10, phase_duration1: 100, phase_amplitude1: 1, phase_duration2: 100, phase_amplitude2: 1 }));
      highEvoked += mea.stimulate(new StimParam({ index: 20, phase_duration1: 300, phase_amplitude1: 10, phase_duration2: 300, phase_amplitude2: 10 }));
    }
    assert.ok(highEvoked > lowEvoked, `high charge (${highEvoked}) should evoke more than low (${lowEvoked})`);
  });

  test('heavy unbalanced stimulation degrades local viability', () => {
    const mea = new OrganoidMEA({ seed: 9 });
    const before = mea.electrodes[5].viability;
    for (let i = 0; i < 50; i++) {
      mea.stimulate(new StimParam({ index: 5, phase_duration1: 500, phase_amplitude1: 20, phase_duration2: 100, phase_amplitude2: 5 }));
    }
    assert.ok(mea.electrodes[5].viability < before, 'unbalanced charge should reduce viability');
  });

  test('spike-count / spike-event DB queries are consistent', () => {
    const mea = new OrganoidMEA({ seed: 42, baselineRateHz: 8 });
    mea.advance(2000);
    const stop = mea.simClockSec;
    const events = mea.querySpikeEvents(0, stop);
    const counts = mea.querySpikeCount(0, stop);
    const totalFromCounts = counts.reduce((s, r) => s + r.spikes, 0);
    assert.equal(events.length, totalFromCounts, 'event count must equal summed per-electrode counts');
    for (const r of counts) assert.ok(r.perMinute >= 0);
  });

  test('getRawSpike returns ~3 ms window with a biphasic deflection', () => {
    const mea = new OrganoidMEA();
    const raw = mea.getRawSpike(12, 0.5, 30000);
    assert.equal(raw.channel, 12);
    assert.equal(raw.samples.length, Math.round((3 / 1000) * 30000));
    assert.ok(Math.min(...raw.samples) < -50, 'should contain a negative-going spike trough');
  });
});

// ── Controllers ───────────────────────────────────────────────────

describe('NeuroPlatform · Controllers', () => {
  test('IntanController stages, uploads and resolves params per trigger; refractory replace by index', async () => {
    const mea = new OrganoidMEA();
    const intan = new IntanController(mea);
    await intan.sendStimParam([new StimParam({ index: 23, trigger_key: 2 })]);
    await intan.uploadStimParam();
    assert.equal(intan.activeParams.length, 1);
    assert.equal(intan.paramsForTrigger(2).length, 1);
    // Same index overwrites previous param.
    await intan.sendStimParam([new StimParam({ index: 23, trigger_key: 5 })]);
    await intan.uploadStimParam();
    assert.equal(intan.activeParams.length, 1, 'same electrode index should not duplicate');
    assert.equal(intan.paramsForTrigger(5).length, 1);
  });

  test('IntanController.countSpike returns a 128-length closed-loop vector', async () => {
    const intan = new IntanController(new OrganoidMEA({ baselineRateHz: 10 }));
    const counts = await intan.countSpike(100);
    assert.equal(counts.length, ELECTRODE_COUNT);
  });

  test('IntanController throws after close until reopen', async () => {
    const intan = new IntanController(new OrganoidMEA());
    await intan.close();
    await assert.rejects(() => intan.countSpike(10));
    intan.reopen();
    await assert.doesNotReject(() => intan.countSpike(10));
  });

  test('TriggerController requires a 16-length array and fires bound params', async () => {
    const mea = new OrganoidMEA({ seed: 3, baselineRateHz: 0 });
    const intan = new IntanController(mea);
    await intan.sendStimParam([new StimParam({ index: 30, trigger_key: 3, phase_duration1: 200, phase_amplitude1: 8, phase_duration2: 200, phase_amplitude2: 8 })]);
    await intan.uploadStimParam();
    const trigger = new TriggerController(intan, mea);
    await assert.rejects(() => trigger.send(new Uint8Array(8)), /length 16/);
    const arr = new Uint8Array(TRIGGER_COUNT); arr[3] = 1;
    const r = await trigger.send(arr);
    assert.deepEqual(r.fired, [3]);
    assert.ok(r.evoked >= 0);
  });

  test('DatabaseController query objects round-trip through the store', async () => {
    const mea = new OrganoidMEA({ seed: 11, baselineRateHz: 6 });
    mea.advance(1000);
    const db = new DatabaseController(mea);
    const stop = mea.simClockSec;
    const sc = await db.getSpikeCount(new SpikeCountQuery(0, stop, 'fs264'));
    const se = await db.getSpikeEvent(new SpikeEventQuery(0, stop, 'fs264'));
    const raw = await db.getRawSpike(new RawSpikeQuery(0, stop, 4));
    assert.equal(sc.length, ELECTRODE_COUNT);
    assert.ok(Array.isArray(se));
    assert.equal(raw.channel, 4);
  });

  test('CameraController returns a capture id and image descriptor', async () => {
    const mea = new OrganoidMEA();
    const cam = new CameraController(mea, MEA.Five);
    const last = await cam.lastCapture();
    assert.ok(last[0].id.length > 0);
    const img = cam.imageFrom(last[0].id);
    assert.ok(img.width > 0 && img.height > 0);
    assert.ok(img.meanViability >= 0 && img.meanViability <= 100);
  });
});

// ── ASTRA Bridge & closed loop ────────────────────────────────────

describe('NeuroPlatform · ASTRA Bridge', () => {
  test('closedLoopRead produces bounded coupling signals and a 128-length spike drive', async () => {
    const bridge = new NeuroPlatformBridge({ seed: 5, baselineRateHz: 12 });
    const c = await bridge.closedLoopRead(200);
    assert.ok(c.fusionCoefficient >= 0 && c.fusionCoefficient <= 1);
    assert.ok(c.firingRateHz >= 0);
    assert.ok(c.viability >= 0 && c.viability <= 100);
    assert.equal(c.spikeDrive.length, ELECTRODE_COUNT);
  });

  test('triggers recorded in the DB are queryable and de-duplicated', async () => {
    const bridge = new NeuroPlatformBridge({ seed: 8 });
    await bridge.intan.sendStimParam([new StimParam({ index: 40, trigger_key: 1, phase_amplitude1: 5, phase_amplitude2: 5 })]);
    await bridge.intan.uploadStimParam();
    const arr = new Uint8Array(TRIGGER_COUNT); arr[1] = 1;
    await bridge.trigger.send(arr);
    await bridge.trigger.send(arr);
    const all = await bridge.db.getAllTriggers(new TriggersQuery(0, bridge.mea.simClockSec));
    const up = all.filter((t) => t.up === 1);
    assert.equal(up.length, 2, 'two fires → two up==1 records');
    assert.ok(all.length >= up.length, 'raw log includes up and down transitions');
  });

  test('activeElectrodes reflects the most recent closed-loop window', async () => {
    const bridge = new NeuroPlatformBridge({ seed: 2, baselineRateHz: 20 });
    await bridge.closedLoopRead(300);
    const active = bridge.activeElectrodes(1);
    assert.ok(active.length > 0);
    assert.ok(active.every((i) => i >= 0 && i < ELECTRODE_COUNT));
  });

  test('status() reports controller + organoid telemetry', () => {
    const bridge = new NeuroPlatformBridge();
    const s: any = bridge.status();
    assert.equal(s.electrodes, ELECTRODE_COUNT);
    assert.equal(s.triggers, TRIGGER_COUNT);
    assert.equal(s.mode, 'simulate');
    assert.ok('organoid' in s && 'meanViability' in s.organoid);
  });

  test('reset restores deterministic baseline', async () => {
    const bridge = new NeuroPlatformBridge({ seed: 99, baselineRateHz: 10 });
    await bridge.closedLoopRead(500);
    bridge.reset();
    assert.equal(bridge.mea.simClockSec, 0);
    assert.equal(bridge.mea.totalStimulations, 0);
  });
});
