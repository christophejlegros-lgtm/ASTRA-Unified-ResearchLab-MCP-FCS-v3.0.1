/**
 * ASTRA × OVOMIND — Affective Exteroception Bridge
 * ═════════════════════════════════════════════════
 * Couples OVOMIND's real-time human affect stream (Geneva; smartwatch and DK1
 * wristband physiology → valence/arousal via a Russell circumplex model,
 * declared end-to-end latency < 300 ms) to the ASTRA TCAI cycle.
 *
 * ─── What this bridge is ───
 * A THIRD exteroceptive substrate for the same TCAI pipeline that already runs
 * over the silicon SNN and the organoid MEA. Its research value is that it is
 * the first channel supplying an EXTERNAL constraint on the PAD layer: until
 * now ASTRA's valence was defined analytically from its own reward signal and
 * therefore unfalsifiable. With a human in the loop under matched stimuli,
 * ASTRA's valence trajectory becomes comparable to a measured one — which is
 * the operational residue of Chalmers' functional-isomorphism argument.
 *
 * ─── What this bridge is NOT ───
 * OVOMIND measures a HUMAN's peripheral physiology. Nothing crossing this
 * boundary is a state of ASTRA, and nothing crossing it is evidence about
 * anyone's phenomenal experience. See ./tcai/phenomenal-guard.ts.
 *
 * ─── Interface status ───
 * ⚠ UNVERIFIED. OVOMIND publishes no public API specification. The wire types
 * below are reconstructed from the vendor's public technical statements
 * (Russell valence/arousal output; HR, skin temperature, galvanic skin
 * response inputs; cloud round-trip < 300 ms; SDK targets Unity, Unreal
 * Engine and C++). Treat `OvomindLiveAdapter` as a stub to be replaced against
 * a real contract, exactly as `neuroplatform.ts` treats the FinalSpark SDK.
 * `OvomindSimAdapter` is deterministic and requires no vendor access.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 */

import { type EmotionalState, clampEmotion } from './tcai/types.js';
import {
  type TaggedScalar,
  type RunConfiguration,
  type SyntheticPhenomenologyAssessment,
  assessSyntheticPhenomenology,
  tagged,
  withheld,
  SUBSTRATES,
} from './tcai/phenomenal-guard.js';

// ── 1. Wire types ─────────────────────────────────────────────────

export type OvomindSource = 'dk1' | 'wearos' | 'galaxy-watch' | 'sim';

/** One affect frame as delivered by the OVOMIND cloud. */
export interface OvomindReading {
  /** Device-side capture time, ms since epoch. NOT the arrival time. */
  capturedAtMs: number;
  /** Russell valence ∈ [−1, 1]. Negative = unpleasant. */
  valence: number;
  /** Russell arousal ∈ [0, 1]. */
  arousal: number;
  /** Vendor-reported confidence ∈ [0, 1]; undefined when not supplied. */
  confidence?: number;
  source: OvomindSource;
  /** Raw physiology, when the plan exposes it. All optional. */
  raw?: {
    heartRateBpm?: number;
    hrvRmssdMs?: number;
    edaMicroSiemens?: number;
    skinTempC?: number;
  };
}

export interface OvomindAdapter {
  readonly kind: 'live' | 'sim';
  /** Most recent frame, or null when the stream has not yet produced one. */
  poll(): OvomindReading | null;
  close(): void;
}

// ── 2. Simulated adapter (deterministic, no vendor access) ────────

/**
 * Seeded affect generator with realistic pathology: autonomic signals drift,
 * arousal responds faster than valence, and frames arrive with jitter around
 * the declared 300 ms budget. The point of the simulator is to make the
 * downstream staleness logic fail here rather than in a session with a subject.
 */
export class OvomindSimAdapter implements OvomindAdapter {
  readonly kind = 'sim' as const;
  private t = 0;
  private seed: number;
  private v = 0;
  private a = 0.35;

  constructor(seed = 42, private readonly meanLatencyMs = 300, private readonly jitterMs = 120) {
    this.seed = seed >>> 0;
  }

  private rand(): number {
    // xorshift32 — deterministic across platforms.
    this.seed ^= this.seed << 13; this.seed >>>= 0;
    this.seed ^= this.seed >> 17;
    this.seed ^= this.seed << 5;  this.seed >>>= 0;
    return this.seed / 0xffffffff;
  }

  poll(): OvomindReading {
    this.t += 1;
    // Arousal: fast Ornstein–Uhlenbeck around a slow sinusoidal engagement arc.
    const engagement = 0.35 + 0.25 * Math.sin(this.t / 40);
    this.a = 0.75 * this.a + 0.25 * engagement + 0.06 * (this.rand() - 0.5);
    // Valence: slower, weakly anti-correlated with arousal spikes (stress bias).
    this.v = 0.92 * this.v + 0.08 * (0.3 - 0.9 * Math.max(0, this.a - 0.6)) + 0.04 * (this.rand() - 0.5);

    const latency = this.meanLatencyMs + (this.rand() - 0.5) * 2 * this.jitterMs;
    return {
      capturedAtMs: Date.now() - Math.max(0, latency),
      valence: Math.max(-1, Math.min(1, this.v)),
      arousal: Math.max(0, Math.min(1, this.a)),
      confidence: 0.6 + 0.3 * this.rand(),
      source: 'sim',
      raw: {
        heartRateBpm: 62 + 45 * this.a + 4 * (this.rand() - 0.5),
        hrvRmssdMs: 55 - 30 * this.a + 6 * (this.rand() - 0.5),
        edaMicroSiemens: 1.5 + 6 * this.a + 0.4 * (this.rand() - 0.5),
        skinTempC: 33.2 + 0.6 * this.v + 0.15 * (this.rand() - 0.5),
      },
    };
  }

  close(): void { /* no resource held */ }
}

// ── 3. Live adapter (stub — replace against a real contract) ──────

export interface OvomindLiveConfig {
  endpoint: string;
  apiKey: string;
  /** Frames older than this are discarded rather than appraised. */
  staleAfterMs?: number;
}

export class OvomindLiveAdapter implements OvomindAdapter {
  readonly kind = 'live' as const;

  constructor(private readonly cfg: OvomindLiveConfig) {
    if (!cfg.apiKey) throw new Error('OVOMIND live adapter requires an API key.');
  }

  /**
   * ⚠ NOT IMPLEMENTED. The transport (WebSocket push vs HTTP poll), the frame
   * schema and the auth scheme are all unspecified in public material. Wiring a
   * guess here would produce a bridge that type-checks and silently emits
   * fabricated affect — the precise failure mode this file is written to avoid.
   */
  poll(): OvomindReading | null {
    throw new Error(
      'OvomindLiveAdapter.poll() is a stub. Implement against the vendor contract ' +
      `(${this.cfg.endpoint}); use OvomindSimAdapter for development.`,
    );
  }

  close(): void { /* no resource held */ }
}

// ── 4. Russell → PAD lift ─────────────────────────────────────────

/**
 * Russell's circumplex spans valence × arousal. ASTRA's TCAI layer is PAD
 * (Mehrabian): valence × arousal × dominance. The third axis is NOT recoverable
 * from peripheral autonomic signals — at matched arousal, a state of control
 * and a state of subordination are not reliably separated by heart rate,
 * HRV, electrodermal activity or skin temperature.
 *
 * Three admissible policies. There is deliberately no fourth policy that
 * estimates dominance from the human's physiology.
 */
export type DominancePolicy =
  /** Hold at the PAD-neutral prior. Honest, and inert in downstream reward. */
  | 'prior'
  /**
   * Take dominance from ASTRA's OWN controllability estimate. Conceptually the
   * correct reading: dominance is a property of the agent's relation to its
   * environment, so in a loop where ASTRA acts and the human observes, the
   * dominance axis belongs to ASTRA, not to the subject.
   */
  | 'endogenous'
  /** Emit null and force every consumer to handle a missing axis explicitly. */
  | 'withhold';

export interface AffectFrame {
  /** Valence axis — constrained by the human channel. */
  valence: TaggedScalar;
  /** Arousal axis — constrained by the human channel. */
  arousal: TaggedScalar;
  /** Dominance axis — never constrained by the human channel. */
  dominance: TaggedScalar;
  /** Age of the underlying reading at appraisal time, ms. */
  ageMs: number;
  /** True when the frame was too old to be used and the prior was substituted. */
  stale: boolean;
  source: OvomindSource;
  confidence: number | null;
}

export interface LiftOptions {
  dominancePolicy?: DominancePolicy;
  /** ASTRA's own controllability ∈ [0,1], used only under 'endogenous'. */
  endogenousControllability?: number;
  /** Frames older than this are marked stale. Default 900 ms = 3× the budget. */
  staleAfterMs?: number;
  nowMs?: number;
}

export function liftRussellToPAD(r: OvomindReading, opts: LiftOptions = {}): AffectFrame {
  const now = opts.nowMs ?? Date.now();
  const staleAfter = opts.staleAfterMs ?? 900;
  const ageMs = Math.max(0, now - r.capturedAtMs);
  const stale = ageMs > staleAfter;
  const policy = opts.dominancePolicy ?? 'prior';

  const vBasis = stale
    ? `Frame ${ageMs} ms old (> ${staleAfter} ms); held at prior rather than appraised.`
    : `OVOMIND ${r.source} · Russell circumplex valence · age ${ageMs} ms.`;
  const aBasis = stale
    ? `Frame ${ageMs} ms old (> ${staleAfter} ms); held at prior rather than appraised.`
    : `OVOMIND ${r.source} · Russell circumplex arousal · age ${ageMs} ms.`;

  const valence = stale
    ? tagged(0, 'functional', 'prior', vBasis)
    : tagged(clamp(r.valence, -1, 1), 'access', 'measured', vBasis);
  const arousal = stale
    ? tagged(0.4, 'functional', 'prior', aBasis)
    : tagged(clamp(r.arousal, 0, 1), 'access', 'measured', aBasis);

  let dominance: TaggedScalar;
  switch (policy) {
    case 'endogenous':
      dominance = tagged(
        clamp(opts.endogenousControllability ?? 0.5, 0, 1),
        'functional',
        'endogenous',
        'ASTRA controllability estimate. NOT derived from the human channel: ' +
        'dominance indexes the agent\'s relation to its environment, not the subject\'s physiology.',
      );
      break;
    case 'withhold':
      dominance = withheld(
        'Dominance is not identified by peripheral autonomic signals at matched arousal ' +
        '(Russell circumplex spans valence × arousal only). Axis deliberately absent.',
      );
      break;
    case 'prior':
    default:
      dominance = tagged(
        0.5, 'functional', 'prior',
        'PAD-neutral prior. No estimate is made from the human channel.',
      );
  }

  return {
    valence, arousal, dominance, ageMs, stale,
    source: r.source,
    confidence: r.confidence ?? null,
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : (lo + hi) / 2;
}

/**
 * Collapse an AffectFrame into the EmotionalState the TCAI cycle consumes.
 * A withheld dominance falls back to the neutral prior HERE and only here, so
 * the substitution happens at exactly one auditable point.
 */
export function toEmotionalState(f: AffectFrame): { state: EmotionalState; substituted: string[] } {
  const substituted: string[] = [];
  if (f.dominance.value === null) substituted.push('dominance ← 0.5 (withheld upstream)');
  if (f.stale) substituted.push('valence, arousal ← prior (stale frame)');
  return {
    state: clampEmotion({
      valence: f.valence.value ?? 0,
      arousal: f.arousal.value ?? 0.4,
      dominance: f.dominance.value ?? 0.5,
    }),
    substituted,
  };
}

// ── 5. Efferent path: the human as a controlled variable ──────────

/**
 * ASTRA v2.9's continuous controller regulates a substrate feature toward a
 * configurable setpoint. Pointing that controller at a HUMAN's arousal turns
 * the subject into a controlled variable — the game adapts in order to move
 * the player's physiological state toward a target.
 *
 * This is the genuinely novel capability of the bridge and simultaneously its
 * main hazard. It is gated, off by default, and bounded.
 */
export interface AffectiveControlPolicy {
  enabled: boolean;
  /** Target on the arousal axis ∈ [0,1]. Valence is never a control target. */
  arousalSetpoint: number;
  /** Maximum per-cycle change in the actuator, as a fraction of full range. */
  maxStepPerCycle: number;
  /** Hard session cap, ms. The loop refuses to run past it. */
  maxSessionMs: number;
  /** Consent + protocol reference. Loop refuses to arm without one. */
  protocolReference: string | null;
}

export const DEFAULT_CONTROL_POLICY: AffectiveControlPolicy = {
  enabled: false,
  arousalSetpoint: 0.5,
  maxStepPerCycle: 0.05,
  maxSessionMs: 20 * 60 * 1000,
  protocolReference: null,
};

export interface ControlCommand {
  /** Suggested actuator delta ∈ [−maxStep, +maxStep]; 0 when the loop is idle. */
  delta: number;
  /** Human-readable reason, surfaced to the subject on request. */
  rationale: string;
  /** True when the loop refused to act. */
  inhibited: boolean;
  inhibitionReason: string | null;
}

export class AffectiveController {
  private sessionStartMs: number | null = null;

  constructor(private policy: AffectiveControlPolicy = DEFAULT_CONTROL_POLICY) {}

  setPolicy(p: Partial<AffectiveControlPolicy>): void {
    this.policy = { ...this.policy, ...p };
  }

  getPolicy(): AffectiveControlPolicy { return { ...this.policy }; }

  arm(): { armed: boolean; reason: string } {
    if (!this.policy.enabled) return { armed: false, reason: 'Policy disabled.' };
    if (!this.policy.protocolReference) {
      return { armed: false, reason: 'No consent/protocol reference. Closed-loop affective control refused.' };
    }
    this.sessionStartMs = Date.now();
    return { armed: true, reason: `Armed under protocol ${this.policy.protocolReference}.` };
  }

  disarm(): void { this.sessionStartMs = null; }

  step(frame: AffectFrame, nowMs = Date.now()): ControlCommand {
    const idle = (reason: string): ControlCommand =>
      ({ delta: 0, rationale: 'No actuation.', inhibited: true, inhibitionReason: reason });

    if (this.sessionStartMs === null) return idle('Controller not armed.');
    if (nowMs - this.sessionStartMs > this.policy.maxSessionMs) {
      this.disarm();
      return idle('Session cap reached; controller disarmed.');
    }
    if (frame.stale) return idle('Stale affect frame — acting on a prior would be open-loop actuation.');
    if (frame.arousal.value === null) return idle('Arousal unavailable.');

    const error = this.policy.arousalSetpoint - frame.arousal.value;
    const delta = Math.max(-this.policy.maxStepPerCycle, Math.min(this.policy.maxStepPerCycle, error * 0.5));

    return {
      delta,
      rationale:
        `Arousal ${frame.arousal.value.toFixed(2)} vs setpoint ` +
        `${this.policy.arousalSetpoint.toFixed(2)}; environment nudged by ${delta.toFixed(3)}.`,
      inhibited: false,
      inhibitionReason: null,
    };
  }
}

// ── 6. Bridge façade ──────────────────────────────────────────────

export interface BridgeStatus {
  adapter: 'live' | 'sim';
  substrate: typeof SUBSTRATES['human-wearable'];
  framesSeen: number;
  framesStale: number;
  lastFrame: AffectFrame | null;
  controlArmed: boolean;
  ethics: SyntheticPhenomenologyAssessment;
  interfaceStatus: string;
}

export class OvomindBridge {
  private framesSeen = 0;
  private framesStale = 0;
  private lastFrame: AffectFrame | null = null;

  constructor(
    private readonly adapter: OvomindAdapter,
    private readonly controller = new AffectiveController(),
    private readonly liftOptions: LiftOptions = { dominancePolicy: 'prior' },
  ) {}

  /** Poll one frame and lift it. Returns null when the stream is empty. */
  read(controllability?: number): AffectFrame | null {
    const raw = this.adapter.poll();
    if (!raw) return null;
    const frame = liftRussellToPAD(raw, {
      ...this.liftOptions,
      endogenousControllability: controllability ?? this.liftOptions.endogenousControllability,
    });
    this.framesSeen++;
    if (frame.stale) this.framesStale++;
    this.lastFrame = frame;
    return frame;
  }

  /**
   * Build the `CycleInput` fragment for `TCAIConsciousnessSystem.runCycle`.
   *
   * Design note — the human channel enters as the `body` specialist, NOT as a
   * reward signal. Feeding measured human valence into `rewardSignal` would
   * make ASTRA optimise for the subject's pleasure, which is a different (and
   * far more consequential) system than the one being built here.
   */
  toCycleFragment(frame: AffectFrame): {
    signals: { body: number[] };
    bids: { body: number };
    novelty: number;
    narrative: string;
  } {
    const v = frame.valence.value ?? 0;
    const a = frame.arousal.value ?? 0.4;
    const conf = frame.confidence ?? 0.5;
    return {
      // Circumplex position + confidence, as a 4-vector the workspace can bid on.
      signals: { body: [v, a, Math.hypot(v, a), conf] },
      // A stale or low-confidence frame must not win the workspace competition.
      bids: { body: frame.stale ? 0.05 : Math.min(1, 0.3 + 0.6 * conf) },
      novelty: this.lastFrame ? Math.min(1, Math.abs(a - (this.lastFrame.arousal.value ?? a)) * 3) : 0,
      narrative:
        `OVOMIND ${frame.source} · v=${v.toFixed(2)} a=${a.toFixed(2)} ` +
        `age=${frame.ageMs}ms${frame.stale ? ' [STALE]' : ''}`,
    };
  }

  actuate(frame: AffectFrame): ControlCommand { return this.controller.step(frame); }

  status(runCfg?: Partial<RunConfiguration>): BridgeStatus {
    const cfg: RunConfiguration = {
      closedValenceLoop: this.controller.getPolicy().enabled,
      persistentSelfModel: true,
      aversiveSetpoints: false,
      interruptible: true,
      substrates: ['silicon-snn', 'human-wearable'],
      humanSubjectInLoop: this.adapter.kind === 'live',
      irbApproval: this.controller.getPolicy().protocolReference,
      ...runCfg,
    };
    return {
      adapter: this.adapter.kind,
      substrate: SUBSTRATES['human-wearable'],
      framesSeen: this.framesSeen,
      framesStale: this.framesStale,
      lastFrame: this.lastFrame,
      controlArmed: this.controller.getPolicy().enabled,
      ethics: assessSyntheticPhenomenology(cfg),
      interfaceStatus:
        this.adapter.kind === 'sim'
          ? 'SIMULATED — deterministic generator, no vendor access, no human subject.'
          : 'LIVE — UNVERIFIED vendor contract; validate schema and latency before use.',
    };
  }

  close(): void { this.controller.disarm(); this.adapter.close(); }
}
