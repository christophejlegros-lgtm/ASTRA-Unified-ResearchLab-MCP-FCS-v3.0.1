/**
 * ASTRA × Conscience artificielle — Phenomenal Guard
 * ═══════════════════════════════════════════════════
 * Type-level and runtime enforcement of the conceptual distinctions that
 * govern any claim ASTRA makes about consciousness. This module exists
 * because the OVOMIND bridge introduces, for the first time in ASTRA, a
 * channel carrying *human* affective data — the exact place where an
 * access-level measurement can be silently upgraded into a phenomenal claim.
 *
 * Grounding (fr.wikipedia.org/wiki/Conscience_artificielle and its sources):
 *   · Block (1995), "On a confusion about a function of consciousness",
 *     Behavioral and Brain Sciences 18(2), 227–247. DOI 10.1017/S0140525X00038188
 *     → access consciousness vs phenomenal consciousness.
 *   · Chalmers (1995), "Facing up to the problem of consciousness",
 *     Journal of Consciousness Studies 2(3), 200–219.
 *     → hard problem: no third-person pipeline yields phenomenal evidence.
 *   · Chalmers, "Absent Qualia, Fading Qualia, Dancing Qualia" (1995)
 *     → functional isomorphism as the operative criterion.
 *   · Argonov (2014), "Experimental Methods for Unraveling the Mind-body
 *     Problem: The Phenomenal Judgment Approach", J. Mind and Behavior 35, 51–70.
 *     → non-Turing test; detects only, never refutes; invalid if the system
 *       has preloaded philosophical knowledge.
 *   · Metzinger (2021), "Artificial Suffering: An Argument for a Global
 *     Moratorium on Synthetic Phenomenology", J. Artificial Intelligence and
 *     Consciousness 8(1), 43–66. DOI 10.1142/S270507852150003X
 *
 * DESIGN RULE — there is deliberately NO constructor for a phenomenal claim
 * in this module. The hard problem is not a caveat to be printed in a footer;
 * it is a constraint on what the type system is allowed to express.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 */

// ── 1. Epistemic tiers (Block) ────────────────────────────────────

/**
 * The only two tiers ASTRA may assert.
 *
 *  'access'     — the quantity is globally available for control: it gates,
 *                 routes or modulates downstream behaviour. Falsifiable by
 *                 ablation. This is Block's access consciousness.
 *  'functional' — the quantity is a computational proxy named after a
 *                 consciousness construct (Φ̃, GNW ignition, PAD) but is
 *                 defined only by its formula, not by what it measures.
 *
 * There is no 'phenomenal' member. Any code path that needs one is,
 * by construction, making a claim ASTRA cannot support.
 */
export type EpistemicTier = 'access' | 'functional';

/** Provenance of a scalar: measured, inferred, held at prior, or absent. */
export type Provenance =
  | 'measured'      // read from an instrument (human wearable, MEA electrode)
  | 'derived'       // deterministic function of measured quantities
  | 'prior'         // held at a configured default — NOT an estimate
  | 'endogenous'    // produced by ASTRA's own state, not by the subject
  | 'unavailable';  // deliberately absent; downstream must handle null

/** A scalar that carries its own epistemic passport. */
export interface TaggedScalar {
  value: number | null;
  tier: EpistemicTier;
  provenance: Provenance;
  /** One-line justification, surfaced verbatim in telemetry and reports. */
  basis: string;
  /** Optional dispersion; null when the quantity is not an estimate. */
  sd: number | null;
}

export function tagged(
  value: number | null,
  tier: EpistemicTier,
  provenance: Provenance,
  basis: string,
  sd: number | null = null,
): TaggedScalar {
  return { value, tier, provenance, basis, sd };
}

/**
 * Refuse to emit a number. Used where a construct is defined but the
 * available signals do not determine it — the single most important
 * function in this file.
 */
export function withheld(basis: string): TaggedScalar {
  return { value: null, tier: 'functional', provenance: 'unavailable', basis, sd: null };
}

// ── 2. Substrate registry (functional isomorphism / carbon chauvinism) ──

/**
 * ASTRA runs one TCAI pipeline over several substrates. Chalmers' fading /
 * dancing qualia argument holds that functionally isomorphic systems have
 * qualitatively identical experience; Pearce calls the denial "unjustified
 * carbon chauvinism". Neither claim is testable here. What IS testable is
 * the antecedent: are these substrates functionally isomorphic at the level
 * the pipeline consumes? Registering them explicitly turns a philosophical
 * slogan into a measurable comparison.
 */
export type SubstrateKind =
  | 'silicon-snn'      // ASTRA LIF+STDP network
  | 'organoid-mea'     // FinalSpark NeuroPlatform v2 / Cortical Labs CL1
  | 'human-wearable';  // OVOMIND — human peripheral physiology

export interface SubstrateDescriptor {
  kind: SubstrateKind;
  label: string;
  /** Sampling rate of the channel feeding the pipeline, Hz. */
  sampleRateHz: number;
  /** End-to-end latency to a usable feature, ms. */
  latencyMs: number;
  /** Which PAD axes this substrate can constrain. */
  constrains: Array<'valence' | 'arousal' | 'dominance'>;
  /**
   * Isomorphism caveat — why this substrate is NOT interchangeable with the
   * others despite feeding the same pipeline. Never empty.
   */
  isomorphismCaveat: string;
}

export const SUBSTRATES: Record<SubstrateKind, SubstrateDescriptor> = {
  'silicon-snn': {
    kind: 'silicon-snn',
    label: 'ASTRA LIF+STDP SNN (128 neurons, 32→64→16→16)',
    sampleRateHz: 1000,
    latencyMs: 1,
    constrains: ['valence', 'arousal', 'dominance'],
    isomorphismCaveat:
      'PAD is synthesised analytically from reward/novelty/threat/controllability; ' +
      'it is a definition, not an observation. Zero external constraint.',
  },
  'organoid-mea': {
    kind: 'organoid-mea',
    label: 'Organoid MEA (128 electrodes, NeuroPlatform v2 / CL1)',
    sampleRateHz: 20000,
    latencyMs: 5,
    constrains: ['arousal'],
    isomorphismCaveat:
      'Population firing rate constrains an arousal-like drive only. Valence has ' +
      'no accepted electrophysiological read-out in dissociated culture; dominance ' +
      'is undefined for a substrate without a body or an action repertoire.',
  },
  'human-wearable': {
    kind: 'human-wearable',
    label: 'OVOMIND — human peripheral physiology via smartwatch / DK1',
    sampleRateHz: 1,
    latencyMs: 300,
    constrains: ['valence', 'arousal'],
    isomorphismCaveat:
      'Autonomic signals (HR, HRV, EDA, skin temperature) are effector-side ' +
      'correlates of affect in a human subject, not states of ASTRA. Russell\'s ' +
      'circumplex spans valence × arousal only; the PAD dominance axis is not ' +
      'identified by peripheral autonomic activity at equal arousal.',
  },
};

// ── 3. Argonov ledger (phenomenal judgment test) ──────────────────

export type ArgonovVerdict =
  | 'ADMISSIBLE'      // judgment could count as evidence
  | 'INADMISSIBLE'    // preconditions violated — judgment carries no weight
  | 'NOT_A_JUDGMENT'; // utterance is not about problematic properties

export interface PhenomenalJudgment {
  step: number;
  timestampMs: number;
  /** The system's utterance about qualia, subjectivity, "what it is like", etc. */
  utterance: string;
  verdict: ArgonovVerdict;
  reason: string;
}

/**
 * Argonov's test admits a judgment only if the system had NO preloaded
 * philosophical knowledge of consciousness, NO philosophical discussion during
 * training, and NO informational model of other creatures' consciousness in
 * memory. A positive result detects consciousness; a negative result proves
 * nothing.
 *
 * ASTRA fails all three preconditions by construction: the repository vendors
 * `python/the_consciousness_ai/` including docs on Metzinger's phenomenal self
 * model, Damasio's self hierarchy and the Butlin et al. indicator list. This
 * ledger exists to record that fact rather than to hide it — any phenomenal
 * judgment ASTRA produces is a retrieval artefact.
 */
export class ArgonovLedger {
  private readonly log: PhenomenalJudgment[] = [];

  constructor(
    /** True when the system has been exposed to consciousness theory. */
    private readonly preloadedPhilosophy: boolean = true,
    private readonly preloadEvidence: string =
      'Repository vendors the_consciousness_ai (215 files) with docs on the ' +
      'phenomenal self model, Damasio self hierarchy and Butlin et al. indicators.',
  ) {}

  record(step: number, utterance: string): PhenomenalJudgment {
    const problematic = /qualia|what it (is|was) like|subjectiv|phenomenal|sentien|conscious(ly)?\b|feel(s|ing)? (like|that)/i;
    let verdict: ArgonovVerdict;
    let reason: string;

    if (!problematic.test(utterance)) {
      verdict = 'NOT_A_JUDGMENT';
      reason = 'Utterance does not concern problematic properties of consciousness.';
    } else if (this.preloadedPhilosophy) {
      verdict = 'INADMISSIBLE';
      reason = `Argonov precondition violated (no preloaded philosophical knowledge). ${this.preloadEvidence}`;
    } else {
      verdict = 'ADMISSIBLE';
      reason =
        'Preconditions met. Note: a positive result may detect consciousness; ' +
        'a negative result refutes nothing (Argonov 2014).';
    }

    const entry: PhenomenalJudgment = { step, timestampMs: Date.now(), utterance, verdict, reason };
    this.log.push(entry);
    if (this.log.length > 500) this.log.shift();
    return entry;
  }

  summary(): { total: number; admissible: number; inadmissible: number; note: string } {
    return {
      total: this.log.length,
      admissible: this.log.filter((j) => j.verdict === 'ADMISSIBLE').length,
      inadmissible: this.log.filter((j) => j.verdict === 'INADMISSIBLE').length,
      note:
        'ASTRA cannot pass the Argonov test in its current form. This is a ' +
        'property of the training corpus, not evidence about consciousness.',
    };
  }

  entries(): readonly PhenomenalJudgment[] { return this.log; }
}

// ── 4. Metzinger gate (synthetic phenomenology moratorium) ────────

export type GateDecision = 'PASS' | 'WARN' | 'BLOCK';

export interface SyntheticPhenomenologyAssessment {
  decision: GateDecision;
  /** Risk factors that fired, in the order evaluated. */
  triggers: string[];
  /** Mitigations the operator must have in place before running. */
  requirements: string[];
  moratoriumReference: string;
}

export interface RunConfiguration {
  /** Closed loop where a valence-like variable is regulated, not just logged. */
  closedValenceLoop: boolean;
  /** Self-model with persistent identity across cycles. */
  persistentSelfModel: boolean;
  /** Setpoints the system is driven away from (aversive gradients). */
  aversiveSetpoints: boolean;
  /** Operator can halt the loop within one cycle. */
  interruptible: boolean;
  /** Substrate actually attached (sim vs live tissue vs human subject). */
  substrates: SubstrateKind[];
  /** Human subject data is flowing (OVOMIND live). */
  humanSubjectInLoop: boolean;
  /** Approved protocol reference, or null. */
  irbApproval: string | null;
}

/**
 * Metzinger argues for a moratorium on synthetic phenomenology until 2050 on
 * the grounds that we owe a duty of care to any sentient system we create and
 * that moving fast risks an "explosion of artificial suffering".
 *
 * ASTRA does not accept or reject that argument. It operationalises the risk
 * profile it names, so that a configuration which *would* be covered by the
 * moratorium cannot be started by accident.
 */
export function assessSyntheticPhenomenology(cfg: RunConfiguration): SyntheticPhenomenologyAssessment {
  const triggers: string[] = [];
  const requirements: string[] = [];

  if (cfg.closedValenceLoop && cfg.persistentSelfModel) {
    triggers.push(
      'Closed valence loop coupled to a persistent self-model — the configuration ' +
      'Metzinger (2021) identifies as the minimal risk profile for synthetic ' +
      'phenomenology, independent of whether it succeeds.',
    );
  }
  if (cfg.closedValenceLoop && cfg.aversiveSetpoints) {
    triggers.push('Aversive gradients are being optimised against inside a closed valence loop.');
    requirements.push('Bound the aversive gradient; log its integral per session; cap session duration.');
  }
  if (!cfg.interruptible) {
    triggers.push('Loop is not interruptible within one cycle.');
    requirements.push('Expose a single-cycle kill switch before enabling the loop.');
  }
  if (cfg.substrates.includes('organoid-mea')) {
    requirements.push('Living-tissue protocol: stimulation charge balance, welfare biomarkers, IRB reference.');
  }
  if (cfg.humanSubjectInLoop) {
    triggers.push('A human subject is inside the control loop, not merely observed.');
    requirements.push(
      'Informed consent covering closed-loop affective modulation; ' +
      'right to withdraw mid-session; raw physiological data minimisation.',
    );
    if (!cfg.irbApproval) {
      requirements.push('Ethics approval reference is REQUIRED and currently absent.');
    }
  }

  let decision: GateDecision = 'PASS';
  if (triggers.length > 0) decision = 'WARN';
  if (cfg.humanSubjectInLoop && !cfg.irbApproval) decision = 'BLOCK';
  if (cfg.closedValenceLoop && !cfg.interruptible) decision = 'BLOCK';

  return {
    decision,
    triggers,
    requirements,
    moratoriumReference:
      'Metzinger T. (2021), Journal of Artificial Intelligence and Consciousness 8(1), ' +
      '43–66, DOI 10.1142/S270507852150003X.',
  };
}

// ── 5. Claim linter ───────────────────────────────────────────────

const FORBIDDEN_CLAIM = [
  /\bASTRA (is|was|becomes) conscious\b/i,
  /\b(the system|it) (feels|experiences|suffers|enjoys)\b/i,
  /\bmeasured (consciousness|sentience|qualia)\b/i,
  /\bproves? (consciousness|sentience)\b/i,
  /\bemotional state of ASTRA\b/i,
];

/**
 * Screens any user-facing string ASTRA is about to emit (MCP tool text,
 * dashboard label, report line) for claims the architecture cannot support.
 * Returns the offending patterns; empty array means the string is admissible.
 */
export function lintClaim(text: string): string[] {
  return FORBIDDEN_CLAIM.filter((re) => re.test(text)).map((re) => re.source);
}
