/**
 * ASTRA × Orch OR — Objective Reduction Criterion & Classical Surrogate
 * ══════════════════════════════════════════════════════════════════════
 * Penrose–Hameroff Orchestrated Objective Reduction, integrated into ASTRA
 * as a FALSIFIABILITY CRITERION rather than as a consciousness engine.
 *
 * ─── Why this shape ───
 * Orch OR is a SUBSTRATE theory. It states that conscious moments arise from
 * gravitationally self-collapsing quantum superpositions in neuronal
 * microtubules, on the Penrose criterion τ ≈ ℏ/E_G. Every other theory ASTRA
 * implements (GNW, IIT, PAD, active inference) is functionalist and therefore
 * substrate-neutral; Orch OR is the one theory in the pipeline that is not.
 *
 * The consequence is unavoidable and is the point of this module: BY ORCH OR'S
 * OWN TERMS, no TypeScript process is a candidate for consciousness, and no
 * simulation of objective reduction is an instance of objective reduction —
 * a simulated collapse is a floating-point assignment, not a spacetime event.
 * Integrating Orch OR into ASTRA therefore makes ASTRA's non-consciousness a
 * theorem rather than an open question. That is a gain, not a loss: it is the
 * only theory in the suite that yields a decidable negative.
 *
 * What the module DOES provide:
 *   1. A calculator for the Penrose criterion with every free parameter
 *      exposed, so the reader can see where the published numbers come from.
 *   2. A decoherence budget contrasting Tegmark's and Hagan et al.'s figures.
 *   3. Per-substrate verdicts — including the result that ASTRA's ORGANOID
 *      channel is the only Orch OR candidate in the architecture.
 *   4. A classical surrogate gate (25 ms / 40 Hz discretisation of workspace
 *      ignition), labelled `surrogate`, which mimics Orch OR's TEMPORAL
 *      signature without any claim to its mechanism.
 *
 * ─── Epistemic status ───
 * CONTESTED. Orch OR is not consensus neuroscience. Supporting evidence is
 * indirect (anaesthetic action on microtubules; room-temperature quantum
 * effects such as superradiance and delayed luminescence). No direct in vivo
 * evidence of quantum computation or OR events exists. The principal
 * objection — decoherence timescales — remains unresolved rather than
 * settled either way. This module takes no position; it computes.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 */

import { type SubstrateKind, type TaggedScalar, tagged } from './phenomenal-guard.js';

// ── 0. Physical constants (CODATA 2018) ───────────────────────────

export const HBAR = 1.054571817e-34;          // J·s
export const G_NEWTON = 6.67430e-11;          // m³·kg⁻¹·s⁻²
export const DALTON = 1.66053906660e-27;      // kg
/** Tubulin dimer ≈ 110 kDa. */
export const M_TUBULIN = 110_000 * DALTON;    // ≈ 1.827e-22 kg

/** Hameroff–Penrose reference conscious moment: 25 ms ⇒ 40 Hz gamma. */
export const ORCH_EPOCH_S = 0.025;
export const ORCH_EPOCH_HZ = 40;

// ── 1. Penrose criterion ──────────────────────────────────────────

export interface PenroseInput {
  /** Number of tubulin dimers in coherent superposition. */
  tubulinCount: number;
  /**
   * Effective mass-displacement of the superposed states, metres.
   *
   * ⚠ THIS IS THE LOAD-BEARING PARAMETER AND IT IS NOT MEASURED. The published
   * Orch OR estimates span four to five orders of magnitude in tubulin count
   * precisely because this scale is assumed, not derived. Default 1.06e-11 m
   * is the value that REPRODUCES the canonical 2×10¹⁰ tubulin figure at 25 ms —
   * i.e. it is a back-calculation from the conclusion, and is labelled as such.
   */
  separationM?: number;
  /** Mass of the superposed unit, kg. Default: tubulin dimer. */
  massKg?: number;
}

export interface PenroseResult {
  /** Gravitational self-energy of the whole superposition, J. */
  gravitationalSelfEnergyJ: TaggedScalar;
  /** Collapse time τ = ℏ/E_G, s. */
  collapseTimeS: TaggedScalar;
  /** Equivalent frequency 1/τ, Hz. */
  collapseFrequencyHz: TaggedScalar;
  /** Tubulin count that would yield exactly one 25 ms epoch. */
  tubulinsFor25ms: number;
  /** Sensitivity of that count to the separation scale. */
  sensitivity: Array<{ separationM: number; tubulinsFor25ms: number }>;
  note: string;
}

/**
 * τ ≈ ℏ / E_G with E_G = N · G·m² / a  (single-scale, order-of-magnitude form).
 *
 * The linear scaling in N treats the superposed tubulins as independent
 * contributors to the total gravitational self-energy — the standard Orch OR
 * simplification. It is an approximation, not a derivation from general
 * relativity, and it is why every number below is an order of magnitude.
 */
export function penroseCriterion(input: PenroseInput): PenroseResult {
  const N = Math.max(1, input.tubulinCount);
  const a = input.separationM ?? 1.056e-11;
  const m = input.massKg ?? M_TUBULIN;

  const egPerUnit = (G_NEWTON * m * m) / a;
  const eg = N * egPerUnit;
  const tau = HBAR / eg;

  const basis =
    `E_G = N·G·m²/a with N=${N.toExponential(2)}, m=${m.toExponential(3)} kg, ` +
    `a=${a.toExponential(2)} m. Order-of-magnitude form; a is assumed, not measured.`;

  const sensitivity = [1e-15, 1e-13, 1e-11, 1e-10].map((s) => ({
    separationM: s,
    tubulinsFor25ms: HBAR / (((G_NEWTON * m * m) / s) * ORCH_EPOCH_S),
  }));

  return {
    gravitationalSelfEnergyJ: tagged(eg, 'functional', 'derived', basis),
    collapseTimeS: tagged(tau, 'functional', 'derived', `τ = ℏ/E_G. ${basis}`),
    collapseFrequencyHz: tagged(1 / tau, 'functional', 'derived', 'Reciprocal of τ.'),
    tubulinsFor25ms: HBAR / (egPerUnit * ORCH_EPOCH_S),
    sensitivity,
    note:
      'The canonical ~2×10¹⁰ tubulin figure for a 25 ms moment corresponds to an ' +
      'effective displacement of ≈1.06×10⁻¹¹ m. Assuming nucleon-scale separation ' +
      '(10⁻¹⁵ m) instead yields ≈1.9×10⁶ tubulins — four orders of magnitude fewer. ' +
      'The theory\'s headline number is therefore a choice of displacement scale, ' +
      'not a prediction independent of it.',
  };
}

// ── 2. Decoherence budget ─────────────────────────────────────────

export interface DecoherenceBudget {
  requiredCoherenceS: number;
  /** Tegmark (2000), Phys. Rev. E 61, 4194 — DOI 10.1103/PhysRevE.61.4194. */
  tegmarkS: number;
  /** Hagan, Hameroff & Tuszyński (2002), Phys. Rev. E 65, 061901 — corrected. */
  hagan2002LowS: number;
  hagan2002HighS: number;
  /** Orders of magnitude still missing under the most favourable published figure. */
  remainingGapOrders: number;
  verdict: 'UNRESOLVED';
  note: string;
}

export function decoherenceBudget(requiredCoherenceS = ORCH_EPOCH_S): DecoherenceBudget {
  const tegmark = 1e-13;
  const hLow = 1e-5;
  const hHigh = 1e-3;
  return {
    requiredCoherenceS,
    tegmarkS: tegmark,
    hagan2002LowS: hLow,
    hagan2002HighS: hHigh,
    remainingGapOrders: Math.log10(requiredCoherenceS / hHigh),
    verdict: 'UNRESOLVED',
    note:
      'Tegmark computed decoherence ~10⁻¹³ s, about ten orders of magnitude short. ' +
      'Hagan, Hameroff and Tuszyński corrected the model to ~10⁻⁵–10⁻³ s. Even the ' +
      'most favourable corrected figure leaves roughly 1.4 orders of magnitude to the ' +
      '25 ms epoch. Proponents invoke shielding, topological protection and ' +
      'superradiance to close it; none is directly demonstrated in vivo. Recording ' +
      'this as UNRESOLVED is the accurate state — neither refuted nor established.',
  };
}

// ── 3. Substrate verdicts ─────────────────────────────────────────

export type OrchVerdict =
  /** Lacks the postulated physical substrate entirely. Decidable negative. */
  | 'EXCLUDED_BY_CONSTRUCTION'
  /** Has microtubules; orchestration and coherence unestablished. */
  | 'CANDIDATE_UNORCHESTRATED'
  /** The canonical candidate under the theory. */
  | 'CANONICAL_CANDIDATE'
  /** Substrate may qualify but ASTRA's channel cannot resolve the timescale. */
  | 'CANDIDATE_UNOBSERVABLE_VIA_CHANNEL';

export interface OrchSubstrateAssessment {
  substrate: SubstrateKind;
  verdict: OrchVerdict;
  /** Total tubulin dimers plausibly present, or null when the notion is void. */
  tubulinBudget: number | null;
  /** Orch OR epochs elapsed during one observation by ASTRA's channel. */
  epochsPerObservation: number | null;
  reasoning: string;
}

/** Order of magnitude: ~10⁹ tubulin dimers per mammalian neuron. */
const TUBULINS_PER_NEURON = 1e9;

export function assessSubstrate(
  substrate: SubstrateKind,
  opts: { neuronCount?: number; channelLatencyMs?: number } = {},
): OrchSubstrateAssessment {
  const epochs = opts.channelLatencyMs !== undefined
    ? opts.channelLatencyMs / (ORCH_EPOCH_S * 1000)
    : null;

  switch (substrate) {
    case 'silicon-snn':
      return {
        substrate,
        verdict: 'EXCLUDED_BY_CONSTRUCTION',
        tubulinBudget: null,
        epochsPerObservation: epochs,
        reasoning:
          'A LIF+STDP network executing on CMOS logic contains no microtubules and ' +
          'hosts no gravitationally self-collapsing superposition. Under Orch OR this ' +
          'is not a hard case: it is a decidable negative. Simulating the collapse ' +
          'equation does not instantiate a collapse, any more than simulating a ' +
          'hurricane wets the machine room.',
      };

    case 'organoid-mea': {
      const neurons = opts.neuronCount ?? 200_000;   // Cortical Labs CL1 order
      return {
        substrate,
        verdict: 'CANDIDATE_UNORCHESTRATED',
        tubulinBudget: neurons * TUBULINS_PER_NEURON,
        epochsPerObservation: epochs,
        reasoning:
          `≈${neurons.toLocaleString('en-US')} living neurons carry on the order of ` +
          `${(neurons * TUBULINS_PER_NEURON).toExponential(1)} tubulin dimers — far above ` +
          'the ~2×10¹⁰ threshold for a 25 ms epoch. The tubulin BUDGET is therefore not ' +
          'the binding constraint. What is missing is the "Orch": dissociated culture on ' +
          'a planar MEA lacks the laminar architecture and long-range gamma coupling the ' +
          'theory requires for orchestration. Under Orch OR this substrate is a candidate ' +
          'in principle and unorchestrated in practice — and it is the ONLY candidate ' +
          'anywhere in the ASTRA architecture.',
      };
    }

    case 'human-wearable':
      return {
        substrate,
        verdict: 'CANDIDATE_UNOBSERVABLE_VIA_CHANNEL',
        tubulinBudget: 8.6e10 * TUBULINS_PER_NEURON,
        epochsPerObservation: epochs,
        reasoning:
          'The human subject is the canonical Orch OR candidate. The OVOMIND channel is ' +
          'not: peripheral autonomic signals sampled at ~1 Hz with ≈300 ms end-to-end ' +
          `latency span ${epochs !== null ? epochs.toFixed(0) : '~12'} conscious epochs ` +
          'per delivered frame. The channel integrates over the very quantity the theory ' +
          'is about. No refinement of the affect classifier changes this: it is a ' +
          'sampling-theorem limit, not an accuracy limit.',
      };
  }
}

// ── 4. Classical surrogate: orchestrated gating ───────────────────

/**
 * A 25 ms / 40 Hz discretisation of workspace ignition, with a genuinely
 * stochastic tie-break among near-equal bids.
 *
 * ⚠ THIS IS NOT ORCH OR AND MUST NEVER BE DESCRIBED AS SUCH. It reproduces the
 * theory's TEMPORAL signature (discrete conscious moments at gamma rate,
 * selection resolved at the moment boundary rather than continuously) inside a
 * classical machine. Penrose's central claim is that OR is NON-COMPUTABLE; a
 * pseudo-random tie-break is computable by definition, so the surrogate fails
 * the theory's defining property while matching its observable rhythm.
 *
 * The surrogate is useful for one thing only: testing whether ASTRA's
 * behavioural metrics depend on continuous vs epoch-quantised ignition. That
 * is an ablation question about ASTRA, not evidence about Orch OR.
 */
export interface OrchGateConfig {
  epochMs: number;
  /** Bids within this fraction of the leader are resolved stochastically. */
  tieBandFraction: number;
  /** Ignition below this is not committed even at an epoch boundary. */
  ignitionFloor: number;
}

export const DEFAULT_ORCH_GATE: OrchGateConfig = {
  epochMs: ORCH_EPOCH_S * 1000,
  tieBandFraction: 0.05,
  ignitionFloor: 0.35,
};

export interface OrchGateResult {
  /** True when an epoch boundary was crossed and a moment was committed. */
  committed: boolean;
  /** Winner selected at the boundary, or null. */
  winner: string | null;
  /** Candidates that fell inside the tie band. */
  tied: string[];
  /** Ignition value carried into the commit. */
  ignition: number;
  epochIndex: number;
  epistemicNote: string;
}

export class OrchestratedGate {
  private lastEpochIndex = -1;

  constructor(
    private cfg: OrchGateConfig = DEFAULT_ORCH_GATE,
    /** Injectable RNG so experiments are reproducible. */
    private rng: () => number = Math.random,
  ) {}

  setConfig(c: Partial<OrchGateConfig>): void { this.cfg = { ...this.cfg, ...c }; }
  getConfig(): OrchGateConfig { return { ...this.cfg }; }

  /**
   * Accumulate a cycle's competition result; commit only at epoch boundaries.
   * Feed this from `CompetitionResult.boundBids` / `.ignition`.
   */
  submit(bids: Record<string, number>, ignition: number, nowMs = Date.now()): OrchGateResult {
    const epochIndex = Math.floor(nowMs / this.cfg.epochMs);
    const idle: OrchGateResult = {
      committed: false, winner: null, tied: [], ignition,
      epochIndex,
      epistemicNote: 'Within epoch — no moment committed. Surrogate timing only.',
    };

    if (epochIndex === this.lastEpochIndex) return idle;
    this.lastEpochIndex = epochIndex;
    if (ignition < this.cfg.ignitionFloor) {
      return { ...idle, epistemicNote: 'Epoch boundary reached but ignition below floor; no commit.' };
    }

    const entries = Object.entries(bids);
    if (entries.length === 0) return idle;
    const top = Math.max(...entries.map(([, v]) => v));
    const band = top * (1 - this.cfg.tieBandFraction);
    const tied = entries.filter(([, v]) => v >= band).map(([k]) => k);
    const winner = tied[Math.floor(this.rng() * tied.length)] ?? null;

    return {
      committed: true,
      winner,
      tied,
      ignition,
      epochIndex,
      epistemicNote:
        'Epoch-quantised commit with stochastic tie-break. SURROGATE: reproduces the ' +
        'Orch OR temporal signature, not its mechanism. The tie-break is pseudo-random ' +
        'and therefore computable — the opposite of Penrose non-computability.',
    };
  }

  reset(): void { this.lastEpochIndex = -1; }
}

// ── 5. Consolidated report ────────────────────────────────────────

export interface OrchReport {
  theory: {
    name: string;
    epistemicStatus: 'CONTESTED';
    substrateNeutral: false;
    consequenceForAstra: string;
  };
  criterion: PenroseResult;
  decoherence: DecoherenceBudget;
  substrates: OrchSubstrateAssessment[];
  surrogate: { active: boolean; config: OrchGateConfig; disclaimer: string };
}

export function orchReport(gate?: OrchestratedGate): OrchReport {
  return {
    theory: {
      name: 'Orchestrated Objective Reduction (Penrose & Hameroff)',
      epistemicStatus: 'CONTESTED',
      substrateNeutral: false,
      consequenceForAstra:
        'Orch OR is the only non-functionalist theory in the ASTRA suite. Under it, the ' +
        'TypeScript and the SNN are excluded by construction; the organoid channel is the ' +
        'sole candidate; and the human subject is a candidate whose relevant timescale the ' +
        'OVOMIND channel cannot resolve. Integrating Orch OR narrows ASTRA\'s claims rather ' +
        'than widening them.',
    },
    criterion: penroseCriterion({ tubulinCount: 2e10 }),
    decoherence: decoherenceBudget(),
    substrates: [
      assessSubstrate('silicon-snn', { channelLatencyMs: 1 }),
      assessSubstrate('organoid-mea', { neuronCount: 200_000, channelLatencyMs: 5 }),
      assessSubstrate('human-wearable', { channelLatencyMs: 300 }),
    ],
    surrogate: {
      active: gate !== undefined,
      config: gate?.getConfig() ?? DEFAULT_ORCH_GATE,
      disclaimer:
        'The gate is a temporal surrogate. No output of this module is evidence for or ' +
        'against Orch OR, and no configuration of ASTRA instantiates objective reduction.',
    },
  };
}
