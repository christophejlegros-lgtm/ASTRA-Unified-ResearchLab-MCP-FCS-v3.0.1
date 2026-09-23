# ASTRA v2.2 × FinalSpark NeuroPlatform v2 — Integration Guide
## Guide d'intégration · 2026

**ASTRA Unified ResearchLab MCP** now integrates the **[FinalSpark NeuroPlatform v2](https://finalspark-np.github.io/np-docs/np_core/doc_v2.html)** wetware control API — the closed-loop interface to living neural organoids cultured on a 128-electrode MEA — at two levels:

1. **Native TypeScript port + biophysical simulator** running live inside the MCP server (`src/engine/neuroplatform.ts`), exposing the full NeuroPlatform v2 controller surface (Intan stimulation, trigger generator, spike database, MEA camera) backed by a seeded organoid model when no hardware is attached.
2. **Live Python bridge** (`python/neuroplatform/astra_np_bridge.py`) using the real `neuroplatformv2` SDK to run a homeostatic closed loop against the physical platform and stream couplings into the ASTRA MCP server over JSON-RPC.

> ⚠ **Disclaimer.** With no hardware attached, ASTRA runs in **simulate mode**: spike trains, viability and evoked responses are produced by a deterministic biophysical model (`OrganoidMEA`), **not** by living tissue. The simulator is a research scaffold for developing and testing closed-loop logic; it is **not** a substitute for wetware measurements. The live Python bridge switches to the genuine FinalSpark SDK when `neuroplatformv2` and platform credentials are available.

---

## 1. NeuroPlatform v2 API → TypeScript mapping

| Upstream NeuroPlatform v2 (Python SDK) | TypeScript port | Behaviour preserved |
|---|---|---|
| `StimParam` (enable, index 0–127, trigger_key 0–15, polarity, phase_duration1/2 µs, phase_amplitude1/2 µA) | `StimParam` class | Doc defaults (100 µs / 1 µA / 100 µs / 1 µA) · charge per phase (pC) · net-charge & charge-balance check (D1·A1 = D2·A2) · `validate()` · `display_attributes()` |
| `StimPolarity` (NegativeFirst / PositiveFirst) | `StimPolarity` enum | Leading-phase sign for biphasic pulses |
| `IntanController` (`_send_stimparam` / `_upload_stimparam` / `_count_spike(ms)` / `_close`) | `IntanController` | Per-electrode StimParam upload (replace-by-index) · `countSpike(ms)` closed-loop read · `paramsForTrigger()` · `close()`/`reopen()` |
| `TriggerController("admin")` (uint8 array, len 16) | `TriggerController` | 16-bit trigger array dispatch · trigger-event recording |
| `DatabaseController` + `TriggersQuery` / `SpikeCountQuery` / `SpikeEventQuery` / `RawSpikeQuery` (+ `get_raw_spike`) | `DatabaseController` + query value-objects | Window queries for spikes/minute, individual spike timings, trigger history, raw 3-ms spike windows |
| `CameraController` (MEA enum, `_last_capture` / `_image_from`) | `CameraController` | MEA capture descriptor + viability snapshot |
| platform orchestration | `NeuroPlatformBridge` | `closedLoopRead(windowMs)` → `BridgeCoupling` {fusionCoefficient, firingRateHz, viability, meanRateHz, spikeDrive[128]} · rate normalisation (rate / 40 Hz → [0,1]) · active-electrode count · status · reset |
| organoid tissue | `OrganoidMEA` (simulator) | Poisson background (seeded `mulberry32`) · 1.5 ms refractory · sigmoidal evoked response on injected charge · viability degraded by residual charge · `advance(ms)` → `Int32Array` |

**Substitutions (no wetware in the Node runtime):** living organoid → deterministic `OrganoidMEA` biophysical model; hardware Intan/MaxWell acquisition → seeded Poisson + evoked-response kernel. The genuine SDK path remains available through the Python bridge (`python/neuroplatform/requirements.txt`).

## 2. New MCP surface (v2.2.0 — 41 tools · 10 resources · 7 prompts)

The NeuroPlatform integration adds **9 tools**:

| Tool | Description |
|---|---|
| `np_status` | Platform & controller status (electrodes, viability, mode) |
| `np_configure_stim` | Define, validate & upload a `StimParam` (charge-balanced biphasic stimulation; `enforce_charge_balance`) |
| `np_send_trigger` | Fire trigger(s) via a 16-bit trigger array; couples to ASTRA `fu.fs` / `ros.fs` |
| `np_count_spikes` | Closed-loop `_count_spike`: spikes per electrode over an N-ms window |
| `np_query_spike_count` | DB `SpikeCountQuery`: spikes/minute per electrode over a window |
| `np_query_spike_events` | DB `SpikeEventQuery`: individual spike timings over a window |
| `np_query_triggers` | DB `TriggersQuery`: trigger history sent to the organoid |
| `np_camera_capture` | Last MEA camera capture (descriptor + viability) |
| `np_closed_loop` | Read organoid → couple to ASTRA fusion / ROS / ethics; optionally drive the SNN |

Resource `astra://neuroplatform/state` · Prompt `neuroplatform-experiment` (guided closed-loop protocol).

## 3. Architecture coupling with ASTRA

```
                 ┌─────────────── FinalSpark NeuroPlatform v2 ───────────────┐
                 │  128-electrode MEA · living organoid (or OrganoidMEA sim) │
                 └───────────────────────────┬───────────────────────────────┘
   StimParam (biphasic, charge-balanced)      │      spikes / minute · raw 3 ms
         ▲ IntanController · TriggerController │ ▼ DatabaseController · CameraController
                 ┌───────────────────── NeuroPlatformBridge ─────────────────┐
                 │  closedLoopRead(ms) → BridgeCoupling                       │
                 │  firingRate / 40 Hz → fusionCoefficient ∈ [0,1]           │
                 └───────────┬───────────────────────────────┬───────────────┘
                  fu.fs / ros.fs coupling            spikeDrive[128] (optional)
                             │                                 │
                    StateStore (eth.viab)            SNN LIF+STDP (injectSpikes)
                             │                                 │
                    IRB ethics gateway              World Model (recordAction)
```

The MEA's 128 electrodes map one-to-one onto the ASTRA SNN's 128-neuron substrate, giving a natural bidirectional coupling: organoid firing rates drive the fusion coefficient and (optionally) inject spikes into the SNN, while ASTRA's stimulation policy is expressed as charge-balanced `StimParam`s fired through the trigger array.

## 4. Live bridge (physical platform)

`python/neuroplatform/astra_np_bridge.py` runs the genuine closed loop:

- imports `neuroplatformv2` (guarded by `HARDWARE_AVAILABLE`); falls back gracefully when absent;
- `AstraMCPClient` — JSON-RPC client to the ASTRA Streamable-HTTP endpoint (`/mcp`, port 9003);
- `build_balanced_stimparam(...)` — constructs a charge-balanced biphasic `StimParam`;
- `run_closed_loop(...)` — `count_spike` → homeostatic set-point on `fu.fs` / `ros.fs` → corrective stimulation, streamed to ASTRA.

```bash
pip install -r python/neuroplatform/requirements.txt   # neuroplatformv2, numpy, requests
python python/neuroplatform/astra_np_bridge.py
```

## 5. Dashboard

`dashboard/ASTRA-NeuroPlatform-Dashboard.html` — a standalone console (ASTRA palette · Syne / IBM Plex Mono) with a live 16×8 MEA raster, Intan interface, spike scope (biphasic waveforms · RMS · draggable threshold), `StimParam` editor with live charge-balance readout, 16-bit trigger generator, closed-loop telemetry (`fu.fs` / viability bars) and a database panel. It embeds a JS mirror of the TS simulator and connects to the MCP `/mcp` endpoint when available, with automatic fallback to simulate mode.

## 6. Validation

- `npm run build` — 0 TypeScript errors (strict, Node16 ESM)
- `npm test` — **188/188 passing** (166 prior + 22 NeuroPlatform)
- `npm run test:np` — NeuroPlatform suite only (StimParam, OrganoidMEA, controllers, bridge)

---
© 2026 Christophe Jean Legros — Genève · Assistance Multi IA · Assistant-Multi-AI@proton.me
Upstream API: © FinalSpark NeuroPlatform v2 (see [np-docs](https://finalspark-np.github.io/np-docs/) for terms).
