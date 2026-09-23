/**
 * ASTRA — MCP tool annotations (single source of truth)
 * ══════════════════════════════════════════════════════
 * One entry per registered tool. `tests/annotations.test.ts` asserts that the
 * table and the live `tools/list` match exactly (no missing, no stale entry).
 *
 * Classification rules — derived from each handler's code, not its name:
 *
 *  readOnlyHint     true  ⇔ the call changes no state, except bookkeeping
 *                          counters or "last seen" caches that no later
 *                          computation depends on (e.g. assessment counters,
 *                          memory access counts, last fused embedding shown
 *                          by sensor_status).
 *                   false ⇔ the call changes state that later results depend
 *                          on (simulation clock, histories, learned weights,
 *                          configuration, stored memories).
 *  destructiveHint  true  ⇔ the call discards or overwrites existing state the
 *                          tool cannot restore (resets, parameter/config
 *                          overwrites), or drives an actuator (stimulation
 *                          triggers into the MEA). ovo_cycle only *computes*
 *                          a suggested control command; nothing is sent to a
 *                          device, so it stays additive.
 *                   false ⇔ the update is additive (time evolution, learning,
 *                          appended history, stored records).
 *  idempotentHint   true  ⇔ repeating the call with the same arguments has no
 *                          further effect on state.
 *  openWorldHint    true  ⇔ the call can reach a system outside this process.
 *                          Only the OVOMIND reads do (live API when
 *                          OVOMIND_ENDPOINT / OVOMIND_API_KEY are set). The
 *                          NeuroPlatform bridge is constructed in simulate mode
 *                          and never leaves the process; flip np_* to true if a
 *                          live bridge is wired into the MCP server.
 *
 * Tools with several modes (e.g. tcai_meta_learning reads, or updates when
 * `rpe` is given) carry the annotations of their most permissive mode.
 *
 * Hints are advisory: MCP clients must not treat them as a security boundary.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 */

import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

type Hints = Required<Pick<ToolAnnotations,
  'title' | 'readOnlyHint' | 'destructiveHint' | 'idempotentHint' | 'openWorldHint'>>;

/** Read-only, closed-world, repeatable. */
const read = (title: string): Hints =>
  ({ title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });

/** Read-only observation of an external stream: each call may return a new value. */
const observe = (title: string): Hints =>
  ({ title, readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true });

/** Additive state change (evolution, learning, appended history). */
const evolve = (title: string, openWorld = false): Hints =>
  ({ title, readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: openWorld });

/** Overwrite / reset / configuration that is repeatable with the same arguments. */
const overwrite = (title: string, openWorld = false): Hints =>
  ({ title, readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: openWorld });

/** Overwrite or actuation whose repetition has further effect. */
const actuate = (title: string, openWorld = false): Hints =>
  ({ title, readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: openWorld });

export const TOOL_ANNOTATIONS = {
  // ── Core (server.ts) ──
  get_system_status: read('ASTRA System Status'),
  get_metrics: read('Real-time Metrics'),
  get_snn_state: read('SNN Engine State'),
  snn_step: evolve('Advance SNN Simulation'),
  snn_reset: overwrite('Reset SNN Engine'),
  inject_spikes: evolve('Spike Injection'),
  get_acm_score: read('Consciousness Assessment (Proxy)'),
  check_ethics: read('IRB Neural Welfare Check'),
  set_parameter: overwrite('Modify State Parameter'),
  get_platform_status: read('Bio-Computing Platforms'),
  export_snapshot: read('Full State Snapshot'),
  // start/stop the background loop: no data lost, repeatable
  simulation_control: { title: 'Simulation Control', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },

  // ── World Model (server-wm-tools.ts) — encode/predict/plan/surprise append to histories used by later calls ──
  wm_encode: evolve('World Model — Latent Encoding'),
  wm_predict: evolve('World Model — Latent Prediction'),
  wm_plan: evolve('World Model — CEM Latent Planning'),
  wm_surprise: evolve('World Model — Violation-of-Expectation'),
  wm_train_step: evolve('World Model — Online Training Step'),
  wm_status: read('World Model — Status & Metrics'),

  // ── Multimodal sensors (server-sensor-tools.ts) — pure encoders; fusion updates status counters only ──
  sensor_visual: read('V-JEPA 2 Visual Encoding'),
  sensor_audio: read('A-JEPA Audio Encoding'),
  sensor_olfactory: read('Koniku Kore Olfactory Encoding'),
  sensor_fuse: read('Cross-Modal Attention Fusion'),
  sensor_process: read('Full Multimodal Pipeline'),
  sensor_status: read('Multimodal Sensor Pipeline Status'),

  // ── TCAI / ACM (server-tcai-tools.ts) ──
  tcai_cycle: actuate('TCAI — ACM Cycle (may reconfigure actuation / production loop)'),
  tcai_workspace_state: read('TCAI — Global Workspace State'),
  tcai_emotion_appraise: evolve('TCAI — PAD Emotion Appraisal'),
  tcai_memory_store: evolve('TCAI — Store Emotional Memory'),
  tcai_memory_retrieve: read('TCAI — Retrieve Emotional Memories'),
  tcai_self_model: read('TCAI — Self-Model State'),
  tcai_metrics: read('TCAI — Consciousness Proxy Report'),
  tcai_reset: overwrite('TCAI — Reset Consciousness System'),
  tcai_second_order: read('TCAI — Second-Order Loop Snapshot'),
  tcai_meta_learning: evolve('TCAI — Meta-Learning (read, or inject RPE)'),
  tcai_capability_model: read('TCAI — Agency Capability Model'),
  tcai_curiosity: evolve('TCAI — Curiosity / Intrinsic Reward (trains predictor)'),
  tcai_metaconsciousness: read('TCAI — Meta-Consciousness Composite'),
  tcai_development: read('TCAI — Developmental Tracking'),
  tcai_convergence: overwrite('TCAI — Halting Criterion (inspect or configure)'),
  tcai_active_inference: read('TCAI — Active-Inference Telemetry'),
  tcai_calibrate: actuate('TCAI — Calibrate Halting Threshold'),

  // ── NeuroPlatform v2 (server-neuroplatform-tools.ts) — simulate mode ──
  np_status: read('NeuroPlatform — Status'),
  np_configure_stim: overwrite('NeuroPlatform — Configure & Upload StimParam'),
  np_send_trigger: actuate('NeuroPlatform — Fire Stimulation Trigger'),
  np_count_spikes: evolve('NeuroPlatform — Count Spikes (advances MEA clock)'),
  np_query_spike_count: read('NeuroPlatform — Spike Count Query'),
  np_query_spike_events: read('NeuroPlatform — Spike Event Query'),
  np_query_triggers: read('NeuroPlatform — Triggers Query'),
  np_camera_capture: read('NeuroPlatform — MEA Camera Capture'),
  np_closed_loop: actuate('NeuroPlatform — Closed-Loop Coupling to ASTRA'),

  // ── OVOMIND (server-ovomind-tools.ts) ──
  ovo_status: read('OVOMIND — Bridge Status'),
  ovo_read: observe('OVOMIND — Read Affect Frame'),
  ovo_cycle: evolve('OVOMIND — Affect Frame → TCAI Cycle', true),
  ovo_set_policy: overwrite('OVOMIND — Set Dominance & Control Policy'),
  ovo_arm_control: overwrite('OVOMIND — Arm / Disarm Closed-Loop Controller'),
  ovo_isomorphism: read('OVOMIND — Substrate Isomorphism'),

  // ── Orch OR (server-orch-tools.ts) ──
  orch_report: read('Orch OR — Status Report'),
  orch_criterion: read('Orch OR — Penrose Criterion τ = ℏ/E_G'),
  orch_decoherence: read('Orch OR — Decoherence Budget'),
  orch_substrate: read('Orch OR — Substrate Verdict'),
  orch_gate_config: overwrite('Orch OR — Configure Surrogate Gate'),
  orch_cycle: evolve('Orch OR — Gated TCAI Cycle', true),

  // ── FCS (server-fcs-tools.ts) — pure computations over the series' values ──
  fcs_report: read('FCS — Consolidated Status'),
  fcs_taxonomy: read('FCS — Species–Function Taxonomy'),
  fcs_stratify: read('FCS — Pareto Stratification'),
  fcs_compare: read('FCS — Compare Two Pairs'),
  fcs_levels: read('FCS — Four-Level Framework'),
  fcs_conformance: read('FCS — Substrate Conformance Audit'),
  fcs_withdrawal: read('FCS — Withdrawal Conditions'),
  fcs_lint: read('FCS — Negative-Heuristic Linter'),
} as const satisfies Record<string, Hints>;

export type ToolName = keyof typeof TOOL_ANNOTATIONS;

/** Annotations for a registered tool (typed: an unknown name fails to compile). */
export function toolAnnotations(name: ToolName): ToolAnnotations {
  return TOOL_ANNOTATIONS[name];
}
