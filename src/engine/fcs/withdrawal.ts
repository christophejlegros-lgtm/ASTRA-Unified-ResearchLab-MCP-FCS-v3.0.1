/**
 * ASTRA × FCS — Withdrawal conditions and the declared revision order
 * ═══════════════════════════════════════════════════════════════════
 * Synthesis S-1.5, "Ce qui ferait céder chaque thèse" / documents I v1.5, II v1.4.
 *
 * "Une condition d'abandon sans terme serait une clause de style." — an
 * abandonment condition with no deadline is a stylistic clause. The programme
 * therefore states, for each belt thesis, the condition under which it is
 * withdrawn and what survives the withdrawal.
 *
 * The CORE carries no withdrawal condition: its revision would be the
 * abandonment of the programme, not a move within it. That asymmetry is the
 * point, and this module preserves it by refusing to evaluate core claims.
 *
 * The REVISION ORDER is declared in advance, common to documents I, II and IV:
 *
 *   inference procedure & measurement auxiliaries → bridge auxiliary
 *   → grain hypothesis (M2) → individuation criterion (M3)
 *   → kinaesthetic thesis → field hypothesis
 *
 * Declaring it in advance is what stops a refutation from being absorbed by
 * whichever auxiliary is cheapest to sacrifice after the fact.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 */

export type ThesisId =
  | 'inference-and-measurement'
  | 'bridge-auxiliary'
  | 'M2'
  | 'M3'
  | 'kinaesthetic'
  | 'field-hypothesis'
  | 'M1';

export interface Thesis {
  id: ThesisId;
  nameFr: string;
  nameEn: string;
  placement: 'belt' | 'complement';
  /** Position in the declared revision order; M1 sits outside it (dated clause). */
  revisionRank: number | null;
  conditionFr: string;
  conditionEn: string;
  survivesFr: string;
  survivesEn: string;
  /** ISO date for a thesis carrying a dated clause, else null. */
  deadline: string | null;
}

export const THESES: Record<ThesisId, Thesis> = {
  'inference-and-measurement': {
    id: 'inference-and-measurement',
    nameFr: 'Procédure d\'inférence et auxiliaires de mesure',
    nameEn: 'Inference procedure and measurement auxiliaries',
    placement: 'belt',
    revisionRank: 1,
    conditionFr:
      'Premier poste révisé devant toute anomalie : la famille d\'approximations déclarée, les auxiliaires de ' +
      'mesure et les valeurs ordinales attribuées aux sous-critères (document IV §5).',
    conditionEn:
      'First item revised in the face of any anomaly: the declared family of approximations, the measurement ' +
      'auxiliaries, and the ordinal values assigned to the sub-criteria (document IV §5).',
    survivesFr: 'L\'ensemble du programme et de sa ceinture.',
    survivesEn: 'The whole programme and its belt.',
    deadline: null,
  },
  'bridge-auxiliary': {
    id: 'bridge-auxiliary',
    nameFr: 'Auxiliaire de pont',
    nameEn: 'Bridge auxiliary',
    placement: 'belt',
    revisionRank: 2,
    conditionFr:
      'Ni covariation au cours du cycle veille-sommeil, ni effet de l\'intervention locale sur les marqueurs de ' +
      'niveau IV, à composition ionique mesurée.',
    conditionEn:
      'Neither covariation across the sleep–wake cycle nor effect of the local intervention on level-IV markers, ' +
      'with ionic composition measured.',
    survivesFr: 'L\'hypothèse du champ, restreinte au niveau I.',
    survivesEn: 'The field hypothesis, restricted to level I.',
    deadline: null,
  },
  M2: {
    id: 'M2',
    nameFr: 'M2 · hypothèse de grain (structure reflétée)',
    nameEn: 'M2 · grain hypothesis (reflected structure)',
    placement: 'belt',
    revisionRank: 3,
    conditionFr:
      'Hypothèse du champ réfutée ; ou, chez l\'humain, aucune part de structure phénoménale expliquée par le ' +
      'champ au-delà de la décharge — issue contraire au biais méthodologique, seule informative.',
    conditionEn:
      'Field hypothesis refuted; or, in humans, no share of phenomenal structure explained by the field beyond ' +
      'firing — an outcome against the methodological bias, the only informative one.',
    survivesFr: 'M1 et M3 ; l\'hypothèse du champ si seule la seconde condition est remplie ; la contrainte de substrat dans tous les cas.',
    survivesEn: 'M1 and M3; the field hypothesis if only the second condition holds; the substrate constraint in every case.',
    deadline: null,
  },
  M3: {
    id: 'M3',
    nameFr: 'M3 · individuation par clôture',
    nameEn: 'M3 · individuation by closure',
    placement: 'belt',
    revisionRank: 4,
    conditionFr:
      'Déplacements de frontière mieux prédits par une synchronie imposée (résonance partagée) ou par la ' +
      'topologie du champ que par la clôture.',
    conditionEn:
      'Boundary shifts better predicted by imposed synchrony (shared resonance) or by field topology than by closure.',
    survivesFr: 'Un monisme russellien structural sans critère d\'individuation ; le problème de la frontière est rouvert.',
    survivesEn: 'A structural Russellian monism without an individuation criterion; the boundary problem is reopened.',
    deadline: null,
  },
  kinaesthetic: {
    id: 'kinaesthetic',
    nameFr: 'Thèse kinesthésique',
    nameEn: 'Kinaesthetic thesis',
    placement: 'belt',
    revisionRank: 5,
    conditionFr:
      'Effets de dimensionnalité obtenus par manipulation de la congruence intéroceptive, non sensorimotrice.',
    conditionEn:
      'Dimensionality effects obtained by manipulating interoceptive, not sensorimotor, congruence.',
    survivesFr: 'Le cadre, avec un niveau II redéfini comme intéroceptif.',
    survivesEn: 'The framework, with level II redefined as interoceptive.',
    deadline: null,
  },
  'field-hypothesis': {
    id: 'field-hypothesis',
    nameFr: 'Hypothèse du champ',
    nameEn: 'Field hypothesis',
    placement: 'belt',
    revisionRank: 6,
    conditionFr:
      'Volets de niveau I négatifs : pas de propagation par le champ sous blocage synaptique, ou efficacité ' +
      'indépendante de la fraction volumique, à potassium et volume cellulaire contrôlés.',
    conditionEn:
      'Negative level-I strands: no field-mediated propagation under synaptic blockade, or efficacy independent ' +
      'of volume fraction, with potassium and cell volume controlled.',
    survivesFr:
      'La contrainte de substrat ; le programme cherche quelle autre voie de la classe ionique réalise le profil. ' +
      'M2 tombe avec son présupposé.',
    survivesEn:
      'The substrate constraint; the programme looks for which other route of the ionic class realises the ' +
      'profile. M2 falls with its presupposition.',
    deadline: null,
  },
  M1: {
    id: 'M1',
    nameFr: 'M1 · nature intrinsèque (bases catégoriques)',
    nameEn: 'M1 · intrinsic nature (categorical bases)',
    placement: 'complement',
    revisionRank: null,
    conditionFr:
      'Aucune expérience exhibée au 30 septembre 2027 dont le rang dépende de M1 ; ou complément modificateur ' +
      'corroboré, qui la rendrait superflue.',
    conditionEn:
      'No experiment exhibited by 30 September 2027 whose ranking depends on M1; or a corroborated modifying ' +
      'complement, which would make it superfluous.',
    survivesFr: 'M2 et M3 ; programme et heuristique inchangés.',
    survivesEn: 'M2 and M3; programme and heuristic unchanged.',
    deadline: '2027-09-30',
  },
};

export const REVISION_ORDER: readonly ThesisId[] = Object.freeze([
  'inference-and-measurement', 'bridge-auxiliary', 'M2', 'M3', 'kinaesthetic', 'field-hypothesis',
]);

// ── Evaluation ────────────────────────────────────────────────────

/**
 * Experimental outcomes, as the strands are stated. `null` = not yet run,
 * which is the honest default and never collapses to `false`.
 */
export interface StrandOutcomes {
  /** Chiang et al. 2019 replication: propagation persists under synaptic blockade. */
  ephapticPropagationUnderBlockade?: boolean | null;
  /** Osmotic strand: propagation efficacy varies with volume fraction, K⁺ and cell volume controlled. */
  efficacyVariesWithVolumeFraction?: boolean | null;
  /** Bridge: coupling covaries with volume fraction and level-IV signatures across sleep–wake. */
  bridgeCovariation?: boolean | null;
  /** Bridge: local intervention on volume fraction shifts local level-IV markers. */
  bridgeLocalIntervention?: boolean | null;
  /** Human strands: field explains phenomenal structure beyond firing (against the bias). */
  fieldBeyondFiringInHumans?: boolean | null;
  /** Boundary shifts better predicted by imposed synchrony or field topology than by closure. */
  boundaryBetterByResonanceOrTopology?: boolean | null;
  /** Dimensionality effects obtained by interoceptive, not sensorimotor, congruence. */
  dimensionalityFromInteroception?: boolean | null;
  /** An experiment has been exhibited whose ranking depends on M1. */
  experimentRankedByM1?: boolean | null;
}

export type ThesisStanding = 'withdrawn' | 'standing' | 'undetermined';

export interface ThesisEvaluation {
  thesis: ThesisId;
  nameEn: string;
  standing: ThesisStanding;
  /** The specific outcome(s) that decided it, or what is still missing. */
  reasonEn: string;
  survivesEn: string;
  revisionRank: number | null;
}

export interface WithdrawalReport {
  evaluations: ThesisEvaluation[];
  /** Next thesis to revise, per the declared order, among those still standing. */
  nextToReviseEn: string;
  coreNoteEn: string;
  /** Days remaining on M1's dated clause, negative once elapsed. */
  m1DaysRemaining: number;
}

const undet = (what: string) => `Undetermined — ${what} has not been run or returned.`;

/**
 * Evaluate the belt against a set of strand outcomes.
 *
 * Note the asymmetry the documents insist on: a favourable human outcome does
 * NOT corroborate M2, because the methodological bias favours the field. Only
 * the outcome against the bias is informative. The evaluator reproduces that:
 * `fieldBeyondFiringInHumans === true` leaves M2 `undetermined`, not `standing`.
 */
export function evaluateWithdrawal(
  outcomes: StrandOutcomes = {},
  now: Date = new Date(),
): WithdrawalReport {
  const evaluations: ThesisEvaluation[] = [];
  const push = (id: ThesisId, standing: ThesisStanding, reasonEn: string) =>
    evaluations.push({
      thesis: id, nameEn: THESES[id].nameEn, standing, reasonEn,
      survivesEn: THESES[id].survivesEn, revisionRank: THESES[id].revisionRank,
    });

  // Field hypothesis — level-I strands.
  const blockade = outcomes.ephapticPropagationUnderBlockade;
  const osmotic = outcomes.efficacyVariesWithVolumeFraction;
  let fieldWithdrawn = false;
  if (blockade === false || osmotic === false) {
    fieldWithdrawn = true;
    push('field-hypothesis', 'withdrawn',
      blockade === false
        ? 'No field-mediated propagation under synaptic blockade — the first level-I strand is negative.'
        : 'Propagation efficacy independent of volume fraction, with K⁺ and cell volume controlled — the osmotic strand is negative.');
  } else if (blockade === true && osmotic === true) {
    push('field-hypothesis', 'standing', 'Both level-I strands positive. The hypothesis stands; it is not thereby established as the only route.');
  } else {
    push('field-hypothesis', 'undetermined', undet('at least one level-I strand'));
  }

  // Bridge auxiliary.
  const cov = outcomes.bridgeCovariation;
  const loc = outcomes.bridgeLocalIntervention;
  if (cov === false && loc === false) {
    push('bridge-auxiliary', 'withdrawn', 'Neither covariation across the sleep–wake cycle nor an effect of the local intervention, with ionic composition measured.');
  } else if (loc === true) {
    push('bridge-auxiliary', 'standing', 'The local intervention shifted level-IV markers — the value of the strand is carried by the intervention, which breaks the neuromodulatory common cause. Covariation alone would not discriminate.');
  } else if (cov === true && loc === null) {
    push('bridge-auxiliary', 'undetermined', 'Covariation observed but the local intervention has not been run. Covariation alone does not discriminate: ionic composition varies with state (Ding et al. 2016) and a neuromodulatory common cause may act upstream.');
  } else {
    push('bridge-auxiliary', 'undetermined', undet('the bridge strand'));
  }

  // M2 — presupposes the field hypothesis; asymmetric evidence.
  const human = outcomes.fieldBeyondFiringInHumans;
  if (fieldWithdrawn) {
    push('M2', 'withdrawn', 'The field hypothesis is refuted, and M2 falls with its presupposition.');
  } else if (human === false) {
    push('M2', 'withdrawn', 'In humans, no share of phenomenal structure is explained by the field beyond firing — the outcome against the methodological bias, which is the informative one.');
  } else if (human === true) {
    push('M2', 'undetermined', 'The favourable human outcome does not discriminate: the methodological bias favours the field. Only the contrary outcome is informative.');
  } else {
    push('M2', 'undetermined', undet('the human grain strand'));
  }

  // M3.
  const boundary = outcomes.boundaryBetterByResonanceOrTopology;
  if (boundary === true) {
    push('M3', 'withdrawn', 'Boundary shifts better predicted by imposed synchrony or field topology than by closure.');
  } else if (boundary === false) {
    push('M3', 'standing', 'Closure outperformed the declared rivals on boundary shifts.');
  } else {
    push('M3', 'undetermined', undet('the boundary-shift comparison'));
  }

  // Kinaesthetic thesis.
  const intero = outcomes.dimensionalityFromInteroception;
  if (intero === true) {
    push('kinaesthetic', 'withdrawn', 'Dimensionality effects obtained by manipulating interoceptive, not sensorimotor, congruence. The declared rival wins and level II is redefined as interoceptive.');
  } else if (intero === false) {
    push('kinaesthetic', 'standing', 'Dimensionality effects did not follow interoceptive congruence.');
  } else {
    push('kinaesthetic', 'undetermined', undet('the interoceptive-congruence manipulation'));
  }

  // M1 — dated clause.
  const deadline = new Date(THESES.M1.deadline as string);
  const m1DaysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000);
  if (outcomes.experimentRankedByM1 === true) {
    push('M1', 'standing', 'An experiment has been exhibited whose ranking depends on M1: it acquires a regulating role.');
  } else if (m1DaysRemaining <= 0) {
    push('M1', 'withdrawn', `Dated clause elapsed on ${THESES.M1.deadline} with no experiment exhibited whose ranking depends on M1. Held definitively to be a reading with no regulating role.`);
  } else {
    push('M1', 'undetermined', `Dated clause runs to ${THESES.M1.deadline}; ${m1DaysRemaining} days remain. Marginal allocation value currently nil — kept as a reading, not as a regulating hypothesis.`);
  }

  // Measurement auxiliaries are revised first, always.
  push('inference-and-measurement', 'standing',
    'First in the revision order: revised before any belt thesis when an anomaly appears. Its standing is procedural, not empirical.');

  const nextStanding = REVISION_ORDER.find(
    (id) => evaluations.find((e) => e.thesis === id)?.standing !== 'withdrawn',
  );

  return {
    evaluations: evaluations.sort((a, b) => (a.revisionRank ?? 99) - (b.revisionRank ?? 99)),
    nextToReviseEn: nextStanding
      ? `${THESES[nextStanding].nameEn} — rank ${THESES[nextStanding].revisionRank} in the declared revision order.`
      : 'Every belt thesis is withdrawn; what remains is the core, whose revision would be the abandonment of the programme.',
    coreNoteEn:
      'The core — individuation by a functional profile, substrate constraint in the weak sense, weak emergence, ' +
      'polynomial admissibility — carries no withdrawal condition. Its revision would be the abandonment of the ' +
      'programme, not a move within it.',
    m1DaysRemaining,
  };
}
