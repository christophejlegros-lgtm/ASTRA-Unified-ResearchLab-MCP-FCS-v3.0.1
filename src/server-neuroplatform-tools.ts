/**
 * ASTRA — FinalSpark NeuroPlatform v2 MCP Tools
 * ══════════════════════════════════════════════
 * Registers 9 tools + 1 resource + 1 prompt into the ASTRA MCP server, exposing
 * the NeuroPlatform v2 closed-loop wetware control surface:
 *
 *   np_status            — platform / MEA / controller status
 *   np_configure_stim    — define + validate + upload a StimParam (charge-balance check)
 *   np_send_trigger      — fire a 16-bit trigger array → evoked stimulation
 *   np_count_spikes      — closed-loop instantaneous spike count (_count_spike)
 *   np_query_spike_count — DB: spikes/min per electrode over a window
 *   np_query_spike_events— DB: per-spike timings over a window
 *   np_query_triggers    — DB: triggers sent over a window
 *   np_camera_capture    — last MEA camera capture (synthetic descriptor)
 *   np_closed_loop       — read organoid → couple to ASTRA fusion/ROS/ethics (+ optional SNN drive)
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 * Upstream API: © FinalSpark, Vevey, Switzerland
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { state } from './engine/state.js';
import {
  NeuroPlatformBridge, StimParam, StimPolarity, StimShape, MEA,
  TriggersQuery, SpikeCountQuery, SpikeEventQuery,
  ELECTRODE_COUNT, TRIGGER_COUNT,
} from './engine/neuroplatform.js';

const json = (o: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(o, null, 2) }] });

const NP_DISCLAIMER =
  'NeuroPlatform telemetry in simulate mode is a biophysically-plausible surrogate, ' +
  'NOT a recording from living neural tissue. Switch to live mode (Python bridge + ' +
  'FinalSpark credentials) for hardware acquisition.';

export interface NeuroPlatformDeps {
  /** Optional hook to drive the ASTRA SNN with organoid spikes (injectSpikes-compatible). */
  driveSNN?: (neuronIds: number[], strength: number) => void;
}

export function registerNeuroPlatformCapabilities(
  server: McpServer,
  getState: () => any,
  deps: NeuroPlatformDeps = {},
): NeuroPlatformBridge {
  const bridge = new NeuroPlatformBridge({ mode: 'simulate' });

  // ── Tool 1: np_status ────────────────────────────────────────────
  server.tool('np_status', 'NeuroPlatform v2 — Platform & Controller Status', {}, async () => {
    void getState();
    return json({ ...bridge.status(), disclaimer: NP_DISCLAIMER });
  });

  // ── Tool 2: np_configure_stim ────────────────────────────────────
  server.tool(
    'np_configure_stim',
    'NeuroPlatform v2 — Define, validate & upload a StimParam (charge-balanced biphasic stimulation)',
    {
      index: z.number().int().min(0).max(ELECTRODE_COUNT - 1).default(23).describe('Electrode index [0-127]'),
      trigger_key: z.number().int().min(0).max(TRIGGER_COUNT - 1).default(0).describe('Trigger key [0-15]'),
      polarity: z.enum(['NegativeFirst', 'PositiveFirst']).default('NegativeFirst'),
      phase_duration1: z.number().min(0).default(100).describe('D1 [µs]'),
      phase_amplitude1: z.number().min(0).max(50).default(1).describe('A1 [µA]'),
      phase_duration2: z.number().min(0).default(100).describe('D2 [µs]'),
      phase_amplitude2: z.number().min(0).max(50).default(1).describe('A2 [µA]'),
      nb_pulse: z.number().int().min(0).default(0).describe('Number of pulses (0/1 = single)'),
      pulse_train_period: z.number().min(0).default(10000).describe('Pulse train period [µs]'),
      enable: z.boolean().default(true),
      enforce_charge_balance: z.boolean().default(true).describe('Reject upload if phases are not charge-balanced'),
    },
    async (a: any) => {
      const sp = new StimParam({
        index: a.index, trigger_key: a.trigger_key,
        polarity: a.polarity === 'PositiveFirst' ? StimPolarity.PositiveFirst : StimPolarity.NegativeFirst,
        phase_duration1: a.phase_duration1, phase_amplitude1: a.phase_amplitude1,
        phase_duration2: a.phase_duration2, phase_amplitude2: a.phase_amplitude2,
        nb_pulse: a.nb_pulse, pulse_train_period: a.pulse_train_period,
        stim_shape: StimShape.Biphasic, enable: a.enable,
      });
      const fieldErrors = sp.validate();
      const balanced = sp.isChargeBalanced(1e-3);
      if (fieldErrors.length) return json({ success: false, errors: fieldErrors, param: sp.display_attributes() });
      if (a.enforce_charge_balance && !balanced) {
        return json({
          success: false,
          error: 'Stimulation is not charge-balanced (D1·A1 ≠ D2·A2). This shortens organoid/electrode lifetime.',
          netCharge_pC: Math.round(sp.netCharge_pC * 1e3) / 1e3,
          hint: 'Set phase_duration1·phase_amplitude1 = phase_duration2·phase_amplitude2, or pass enforce_charge_balance=false.',
          param: sp.display_attributes(),
        });
      }
      const staged = await bridge.intan.sendStimParam([sp]);
      const uploaded = await bridge.intan.uploadStimParam();
      return json({
        success: true, balanced, staged, uploaded,
        activeParams: bridge.intan.activeParams.length,
        param: sp.display_attributes(), disclaimer: NP_DISCLAIMER,
      });
    });

  // ── Tool 3: np_send_trigger ──────────────────────────────────────
  server.tool(
    'np_send_trigger',
    'NeuroPlatform v2 — Fire trigger(s): execute uploaded StimParams via a 16-bit trigger array',
    {
      triggers: z.array(z.number().int().min(0).max(TRIGGER_COUNT - 1)).min(1)
        .describe('Trigger keys to fire, e.g. [2] sends trigger 2'),
      repeats: z.number().int().min(1).max(100).default(1).describe('How many times to send the trigger array'),
    },
    async ({ triggers, repeats }: { triggers: number[]; repeats: number }) => {
      const arr = new Uint8Array(TRIGGER_COUNT);
      for (const k of triggers) arr[k] = 1;
      let totalEvoked = 0; const firedSets: number[][] = [];
      for (let i = 0; i < repeats; i++) {
        const r = await bridge.trigger.send(arr);
        totalEvoked += r.evoked; firedSets.push(r.fired);
      }
      // Couple resulting activity into ASTRA fusion / ethics state.
      const coupling = await bridge.closedLoopRead(50);
      state.set('fu.fs', coupling.fusionCoefficient);
      state.set('ros.fs', coupling.firingRateHz);
      return json({
        firedTriggers: triggers, repeats, totalEvokedSpikes: totalEvoked,
        boundParams: triggers.map((k) => ({ trigger: k, params: bridge.intan.paramsForTrigger(k).map((p) => p.index) })),
        coupling, disclaimer: NP_DISCLAIMER,
      });
    });

  // ── Tool 4: np_count_spikes (closed-loop instantaneous read) ─────
  server.tool(
    'np_count_spikes',
    'NeuroPlatform v2 — Closed-loop _count_spike: spikes per electrode over an N-ms window',
    {
      window_ms: z.number().min(1).max(60000).default(100).describe('Recording window in milliseconds'),
      top_k: z.number().int().min(1).max(ELECTRODE_COUNT).default(10).describe('Report the K most active electrodes'),
    },
    async ({ window_ms, top_k }: { window_ms: number; top_k: number }) => {
      const counts = await bridge.intan.countSpike(window_ms);
      const total = counts.reduce((a, c) => a + c, 0);
      const ranked = Array.from(counts, (c, i) => ({ electrode: i, spikes: c }))
        .filter((e) => e.spikes > 0).sort((a, b) => b.spikes - a.spikes).slice(0, top_k);
      return json({
        window_ms, totalSpikes: total,
        meanRateHz: Math.round((total / (window_ms / 1000) / ELECTRODE_COUNT) * 1e2) / 1e2,
        topElectrodes: ranked, disclaimer: NP_DISCLAIMER,
      });
    });

  // ── Tool 5: np_query_spike_count ─────────────────────────────────
  server.tool(
    'np_query_spike_count',
    'NeuroPlatform v2 DB — SpikeCountQuery: spikes/minute per electrode over a time window',
    {
      window_sec: z.number().min(0.01).default(5).describe('Look back this many seconds of sim-clock'),
      fsname: z.string().default('fs264').describe('Experiment ID'),
      nonzero_only: z.boolean().default(true),
    },
    async ({ window_sec, fsname, nonzero_only }: { window_sec: number; fsname: string; nonzero_only: boolean }) => {
      const stop = bridge.mea.simClockSec; const start = Math.max(0, stop - window_sec);
      const rows = await bridge.db.getSpikeCount(new SpikeCountQuery(start, stop, fsname));
      const filtered = nonzero_only ? rows.filter((r) => r.spikes > 0) : rows;
      return json({
        fsname, window: { start, stop, seconds: window_sec },
        electrodesReporting: filtered.length,
        rows: filtered.map((r) => ({ electrode: r.index, spikes: r.spikes, spikesPerMin: Math.round(r.perMinute * 1e2) / 1e2 })),
        disclaimer: NP_DISCLAIMER,
      });
    });

  // ── Tool 6: np_query_spike_events ────────────────────────────────
  server.tool(
    'np_query_spike_events',
    'NeuroPlatform v2 DB — SpikeEventQuery: individual spike timings over a window',
    {
      window_sec: z.number().min(0.01).default(1).describe('Look back this many seconds'),
      fsname: z.string().default('fs264'),
      limit: z.number().int().min(1).max(2000).default(50),
    },
    async ({ window_sec, fsname, limit }: { window_sec: number; fsname: string; limit: number }) => {
      const stop = bridge.mea.simClockSec; const start = Math.max(0, stop - window_sec);
      const events = await bridge.db.getSpikeEvent(new SpikeEventQuery(start, stop, fsname));
      return json({
        fsname, window: { start, stop }, totalEvents: events.length,
        events: events.slice(0, limit).map((e) => ({ channel: e.channel, time: e.time, amplitude_uV: Math.round(e.amplitude_uV * 10) / 10 })),
        disclaimer: NP_DISCLAIMER,
      });
    });

  // ── Tool 7: np_query_triggers ────────────────────────────────────
  server.tool(
    'np_query_triggers',
    'NeuroPlatform v2 DB — TriggersQuery: triggers sent to the organoid over a window',
    {
      window_sec: z.number().min(0.01).default(60).describe('Look back this many seconds'),
      dedup: z.boolean().default(true).describe('Keep only up==1 transitions (drop duplicates)'),
    },
    async ({ window_sec, dedup }: { window_sec: number; dedup: boolean }) => {
      const stop = bridge.mea.simClockSec; const start = Math.max(0, stop - window_sec);
      let rows = await bridge.db.getAllTriggers(new TriggersQuery(start, stop));
      if (dedup) rows = rows.filter((r) => r.up === 1);
      return json({ window: { start, stop }, count: rows.length, triggers: rows.slice(0, 200), disclaimer: NP_DISCLAIMER });
    });

  // ── Tool 8: np_camera_capture ────────────────────────────────────
  server.tool('np_camera_capture', 'NeuroPlatform v2 — Last MEA camera capture (descriptor + viability)', {
    mea: z.number().int().min(1).max(5).default(5).describe('MEA selector [1-5]'),
  }, async ({ mea }: { mea: number }) => {
    const last = await bridge.camera.lastCapture();
    const id = last[0]?.id ?? `cap_${mea}_0`;
    return json({ mea: mea as MEA, lastCapture: last[0], image: bridge.camera.imageFrom(id), disclaimer: NP_DISCLAIMER });
  });

  // ── Tool 9: np_closed_loop ───────────────────────────────────────
  server.tool(
    'np_closed_loop',
    'NeuroPlatform v2 — Closed loop: read organoid → couple to ASTRA fusion/ROS/ethics, optionally drive the SNN',
    {
      window_ms: z.number().min(1).max(5000).default(100),
      drive_snn: z.boolean().default(false).describe('Inject organoid-active electrodes as spikes into the ASTRA SNN'),
      drive_strength: z.number().min(-100).max(100).default(15).describe('Spike injection strength (mV) when drive_snn=true'),
      couple_ethics: z.boolean().default(true).describe('Mirror organoid viability into the IRB ethics gateway (eth.viab)'),
    },
    async (a: any) => {
      const coupling = await bridge.closedLoopRead(a.window_ms);
      state.set('fu.fs', coupling.fusionCoefficient);
      state.set('ros.fs', coupling.firingRateHz);
      if (a.couple_ethics) state.setChecked('eth.viab', Math.max(0, Math.min(100, coupling.viability)));

      let snnDriven: { neurons: number[]; strength: number } | null = null;
      if (a.drive_snn && deps.driveSNN) {
        const active = bridge.activeElectrodes(1).filter((i) => i < ELECTRODE_COUNT);
        if (active.length) { deps.driveSNN(active, a.drive_strength); snnDriven = { neurons: active, strength: a.drive_strength }; }
      }
      return json({
        window_ms: a.window_ms, coupling,
        stateUpdates: { 'fu.fs': coupling.fusionCoefficient, 'ros.fs': coupling.firingRateHz, ...(a.couple_ethics ? { 'eth.viab': coupling.viability } : {}) },
        snnDriven, activeElectrodes: bridge.activeElectrodes(1).length, disclaimer: NP_DISCLAIMER,
      });
    });

  // ── Resource: neuroplatform state ────────────────────────────────
  server.resource('neuroplatform-state', 'astra://neuroplatform/state',
    { description: 'FinalSpark NeuroPlatform v2 organoid + controller telemetry', mimeType: 'application/json' },
    async () => ({ contents: [{ uri: 'astra://neuroplatform/state', mimeType: 'application/json',
      text: JSON.stringify({ ...bridge.status(), disclaimer: NP_DISCLAIMER }, null, 2) }] }));

  // ── Prompt: neuroplatform-experiment ─────────────────────────────
  server.prompt('neuroplatform-experiment',
    'Full NeuroPlatform v2 closed-loop wetware stimulation experiment',
    { electrode: z.string().optional().describe('Target electrode index [0-127]') },
    async (args: { electrode?: string }) => ({
      messages: [{ role: 'user' as const, content: { type: 'text' as const, text: [
        'Run a complete NeuroPlatform v2 closed-loop experiment:',
        '',
        '1. **Baseline**: `np_status`, then `np_count_spikes` (window_ms=200) for the spontaneous rate.',
        `2. **Configure**: np_configure_stim on electrode ${args.electrode ?? '23'}, trigger_key=2, charge-balanced biphasic (D1·A1 = D2·A2).`,
        '3. **Stimulate**: `np_send_trigger` with triggers=[2], repeats=10.',
        '4. **Evoked read**: `np_count_spikes` again — compare to baseline.',
        '5. **DB**: `np_query_spike_count` and `np_query_spike_events` over the last 5 s.',
        '6. **Couple**: `np_closed_loop` with drive_snn=true to feed organoid spikes into the ASTRA SNN.',
        '7. **Welfare**: `check_ethics` — confirm viability remained within IRB bounds after stimulation.',
        '',
        'Analyse: did stimulation raise the evoked rate over baseline? Was charge balanced?',
        'How did the FinalSpark fusion coefficient (fu.fs) and ROS firing rate (ros.fs) shift?',
      ].join('\n') } }] }));

  return bridge;
}
