/**
 * ASTRA × FCS — Neurochemical taxonomy (document IV, v1.2)
 * ═════════════════════════════════════════════════════════
 * Thirteen molecular classes, seventeen species–function pairs, five causal
 * roles, three declared ordinal sub-criteria. Faithful transcription of
 * « L'implémentation neurochimique du fonctionnalisme contraint par le
 * substrat », Assistance Multi IA · Genève · IV · v1.2 · 19·09·2026.
 *
 * ⚠ WHAT THIS FILE IS NOT
 * The table below carries NO aggregate score and none may be derived from it.
 * The three sub-criteria are ordinal and lack a common scale; the series'
 * negative heuristic forbids aggregating them (prohibition 4, after Okasha
 * 2011 on Arrow's theorem applied to theory choice). The only admissible
 * combination rule is Pareto dominance — see ./stratification.ts.
 *
 * THE ORDER IS OF FUNCTIONS, NOT OF SUBSTANCES
 * A single chemical species may occupy two distant places depending on the
 * function considered: glutamate is a generator of synaptic currents (class 3)
 * and a nitrogen-cycle metabolite (class 13); calcium is a charge carrier
 * (class 1) and an intracellular second messenger (not a carrier function).
 * Class numbers are v1.1 identifiers kept for cross-reference stability; they
 * no longer denote a position.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 */

// ── 1. The five causal roles ──────────────────────────────────────

/**
 * Roles are defined by the position of the quantity relative to the carrier's
 * equations, not by the word used for it. The "gain" set by extracellular
 * resistivity is a coefficient of the field equation (parametric); the "gain"
 * set by neuromodulators runs through receptors and second messengers
 * (modulatory). Same word, different role.
 */
export type CausalRole =
  | 'constitutive'   // mobile charge or the valve that sets its dynamics
  | 'generator'      // commands a major source of the carrier
  | 'parametric'     // sets a slowly-varying coefficient of the carrier's equations
  | 'modulatory'     // acts through another role; sets gain, threshold, phase, precision
  | 'permissive';    // maintenance condition; removal → non-selective failure

export interface RoleDefinition {
  role: CausalRole;
  fr: string;
  en: string;
  /** What its removal does to the carrier. */
  onRemovalFr: string;
  onRemovalEn: string;
}

export const ROLE_DEFINITIONS: Record<CausalRole, RoleDefinition> = {
  constitutive: {
    role: 'constitutive',
    fr: 'La classe est la charge mobile ou la vanne qui en fixe la dynamique dans la fenêtre d\'un épisode.',
    en: 'The class is the mobile charge or the valve that sets its dynamics within the window of an episode.',
    onRemovalFr: 'Son retrait supprime le porteur ; son remplacement par une classe fonctionnellement équivalente le conserve.',
    onRemovalEn: 'Its removal abolishes the carrier; its replacement by a functionally equivalent class preserves it.',
  },
  generator: {
    role: 'generator',
    fr: 'La classe commande une source majeure du porteur en conditions physiologiques, sans être requise pour son existence.',
    en: 'The class commands a major source of the carrier under physiological conditions, without being required for its existence.',
    onRemovalFr: 'Son retrait supprime la composante dominante du champ mesuré et les signatures de niveau IV ; le porteur persiste sous une forme réduite.',
    onRemovalEn: 'Its removal abolishes the dominant component of the measured field and level-IV signatures; the carrier persists in a reduced form.',
  },
  parametric: {
    role: 'parametric',
    fr: 'La classe fixe un coefficient des équations du porteur — résistivité, force électromotrice, capacité — et varie lentement.',
    en: 'The class sets a coefficient of the carrier\'s equations — resistivity, electromotive force, capacitance — and varies slowly.',
    onRemovalFr: 'Son retrait partiel déplace le porteur sans le supprimer ; elle en fixe la forme et n\'individue pas d\'épisode.',
    onRemovalEn: 'Its partial removal shifts the carrier without abolishing it; it sets the carrier\'s form and individuates no episode.',
  },
  modulatory: {
    role: 'modulatory',
    fr: 'La classe agit sur le porteur par l\'intermédiaire d\'au moins un autre rôle — récepteur, second messager, expression — et fixe le gain, le seuil, la phase ou la précision d\'une dynamique de réseau qui persiste sans elle.',
    en: 'The class acts on the carrier through at least one other role — receptor, second messenger, expression — and sets the gain, threshold, phase or precision of a network dynamics that persists without it.',
    onRemovalFr: 'La dynamique de réseau persiste sans elle.',
    onRemovalEn: 'The network dynamics persists without it.',
  },
  permissive: {
    role: 'permissive',
    fr: 'La classe est une condition de maintien de l\'ensemble.',
    en: 'The class is a maintenance condition of the whole.',
    onRemovalFr: 'Son retrait conduit à une défaillance non sélective. Saillance clinique maximale, pouvoir discriminant théorique faible pour l\'issue d\'abolition — non nul pour l\'ordre de défaillance sous privation graduée.',
    onRemovalEn: 'Its removal leads to non-selective failure. Maximal clinical salience, low theoretical discriminating power for the abolition outcome — not low for the order of failure under graded deprivation.',
  },
};

// ── 2. The third sub-criterion: ablation effect, four ordered degrees ──

/**
 * Degree 1 is closest to the carrier, degree 4 furthest. The degrees are
 * ORDINAL LABELS, not a scale: the distance between 1 and 2 is not commensurable
 * with the distance between 3 and 4, and no arithmetic may be performed on them.
 *
 * LIMIT OF THE CRITERION (contested · normative)
 * Interventionist tests do not cleanly separate constitution from causation:
 * intervening on a constituent necessarily alters the whole of which it is part
 * — the intervention is fat-handed by construction (Craver 2007; Baumgartner &
 * Gebharter 2016). The ablation effect decides only in conjunction with the two
 * other sub-criteria, and role assignments remain revisable.
 */
export type AblationDegree = 1 | 2 | 3 | 4;

export const ABLATION_DEGREES: Record<AblationDegree, { fr: string; en: string }> = {
  1: { fr: 'suppression par action directe', en: 'abolition by direct action' },
  2: { fr: 'déformation', en: 'deformation' },
  3: { fr: 'dérive lente ou absence d\'effet dans la fenêtre', en: 'slow drift or no effect within the window' },
  4: { fr: 'défaillance non sélective', en: 'non-selective failure' },
};

// ── 3. The species–function pair ──────────────────────────────────

export interface SpeciesFunctionPair {
  /** v1.1 class identifier, kept for cross-reference stability. Not a position. */
  id: string;
  labelFr: string;
  labelEn: string;
  role: CausalRole;
  /**
   * Sub-criterion 1 — causal distance to the carrier, counted in steps, a step
   * being a causal relation mediated by a distinct entity (ligand → receptor,
   * receptor → second messenger, gene → transcript, transcript → protein).
   * The mobile charge is at distance 0. A quantity entering directly as a
   * coefficient or variable in the carrier's equations — Hodgkin–Huxley
   * conductance, volume-conductor resistivity, Nernst electromotive force,
   * membrane capacitance — is at distance 1.
   */
  d: 0 | 1 | 2 | 3 | 4;
  /**
   * Sub-criterion 2 — time constant, decimal exponents of the published range
   * in seconds. τ is the LONGER of two durations: that of the class's action on
   * the carrier, and that of the class's own physiological variation. This is
   * what decides whether a class can individuate a conscious episode, of the
   * order of a hundred milliseconds on level-IV signatures (Dehaene & Changeux
   * 2011; Koch et al. 2016).
   */
  tauLog10: readonly [number, number];
  /** Sub-criterion 3 — ablation effect on level-IV signatures. */
  ablation: AblationDegree;
  ablationNoteFr: string;
  ablationNoteEn: string;
  /** Epistemic status as declared in the source table. */
  status: string;
  /** Stratum as PUBLISHED in document IV §3 — used only to verify the engine. */
  publishedStratum: number;
}

/**
 * The seventeen species–function pairs, transcribed from document IV §3.
 *
 * Every value here is a DECLARED JUDGEMENT, revisable with the measurement
 * auxiliaries of §5. The stratification depends on them, and they are given
 * individually so that each can be contested in isolation.
 */
export const PAIRS: readonly SpeciesFunctionPair[] = Object.freeze([
  {
    id: '1', labelFr: 'Ions', labelEn: 'Ions',
    role: 'constitutive', d: 0, tauLog10: [-4, -2], ablation: 1,
    ablationNoteFr: 'suppression du porteur', ablationNoteEn: 'carrier abolished',
    status: 'Établi / Established', publishedStratum: 1,
  },
  {
    id: '2a',
    labelFr: 'Canaux, récepteurs ionotropes, connexines',
    labelEn: 'Channels, ionotropic receptors, connexins',
    role: 'constitutive', d: 1, tauLog10: [-4, -3], ablation: 1,
    ablationNoteFr: 'suppression ou déformation profonde', ablationNoteEn: 'abolition or deep deformation',
    status: 'Établi / Established', publishedStratum: 2,
  },
  {
    id: '2b', labelFr: 'Na⁺/K⁺-ATPase', labelEn: 'Na⁺/K⁺-ATPase',
    role: 'permissive', d: 1, tauLog10: [0, 2], ablation: 4,
    ablationNoteFr: 'défaillance non sélective', ablationNoteEn: 'non-selective failure',
    status: 'Établi / Established', publishedStratum: 3,
  },
  {
    id: '3',
    labelFr: 'Acides aminés transmetteurs (glutamate, GABA, glycine)',
    labelEn: 'Transmitter amino acids (glutamate, GABA, glycine)',
    role: 'generator', d: 2, tauLog10: [-3, -1], ablation: 1,
    ablationNoteFr: 'signatures IV supprimées, porteur réduit', ablationNoteEn: 'IV signatures abolished, carrier reduced',
    status: 'Établi / Normatif (rôle) · Established / Normative (role)', publishedStratum: 3,
  },
  {
    id: '4', labelFr: 'Milieu extracellulaire', labelEn: 'Extracellular medium',
    role: 'parametric', d: 1, tauLog10: [1, 4], ablation: 2,
    ablationNoteFr: 'déformation (gain de couplage)', ablationNoteEn: 'deformation (coupling gain)',
    status: 'Établi / Modélisé / Contesté · Established / Modelled / Contested', publishedStratum: 3,
  },
  {
    id: '11', labelFr: 'Lipides et myéline', labelEn: 'Lipids and myelin',
    role: 'parametric', d: 1, tauLog10: [5, 6], ablation: 2,
    ablationNoteFr: 'déformation sans suppression', ablationNoteEn: 'deformation without abolition',
    status: 'Modélisé / Normatif (rôle) · Modelled / Normative (role)', publishedStratum: 3,
  },
  {
    id: '5', labelFr: 'Sels minéraux', labelEn: 'Mineral salts',
    role: 'parametric', d: 1, tauLog10: [2, 5], ablation: 3,
    ablationNoteFr: 'dérive, puis défaillance', ablationNoteEn: 'drift, then failure',
    status: 'Établi / Established', publishedStratum: 4,
  },
  {
    id: '6', labelFr: 'Neuromodulateurs', labelEn: 'Neuromodulators',
    role: 'modulatory', d: 3, tauLog10: [-1, 2], ablation: 1,
    ablationNoteFr: 'ignition supprimée, porteur conservé', ablationNoteEn: 'ignition abolished, carrier kept',
    status: 'Établi / Contesté · Established / Contested', publishedStratum: 4,
  },
  {
    id: '10a', labelFr: 'Protons (pH)', labelEn: 'Protons (pH)',
    role: 'modulatory', d: 2, tauLog10: [-1, 0], ablation: 2,
    ablationNoteFr: 'déformation locale', ablationNoteEn: 'local deformation',
    status: 'Établi / Established', publishedStratum: 4,
  },
  {
    id: '12a', labelFr: 'Zinc synaptique', labelEn: 'Synaptic zinc',
    role: 'modulatory', d: 2, tauLog10: [-2, 0], ablation: 2,
    ablationNoteFr: 'déformation locale', ablationNoteEn: 'local deformation',
    status: 'Établi / Established', publishedStratum: 4,
  },
  {
    id: '9b', labelFr: 'Neurostéroïdes (non génomique)', labelEn: 'Neurosteroids (non-genomic)',
    role: 'modulatory', d: 2, tauLog10: [0, 1], ablation: 2,
    ablationNoteFr: 'déformation', ablationNoteEn: 'deformation',
    status: 'Établi / Modélisé · Established / Modelled', publishedStratum: 5,
  },
  {
    id: '10b', labelFr: 'Monoxyde d\'azote', labelEn: 'Nitric oxide',
    role: 'modulatory', d: 4, tauLog10: [-1, 1], ablation: 2,
    ablationNoteFr: 'déformation ; confondant', ablationNoteEn: 'deformation; confound',
    status: 'Établi / Established', publishedStratum: 5,
  },
  {
    id: '7', labelFr: 'Métabolites énergétiques', labelEn: 'Energy metabolites',
    role: 'permissive', d: 3, tauLog10: [0, 2], ablation: 4,
    ablationNoteFr: 'défaillance non sélective', ablationNoteEn: 'non-selective failure',
    status: 'Établi / Established', publishedStratum: 6,
  },
  {
    id: '8', labelFr: 'Acides nucléiques (ADN, ARN)', labelEn: 'Nucleic acids (DNA, RNA)',
    role: 'modulatory', d: 3, tauLog10: [2, 6], ablation: 3,
    ablationNoteFr: 'aucun effet dans la fenêtre ; dérive lente', ablationNoteEn: 'no effect within window; slow drift',
    status: 'Établi / Normatif · Established / Normative', publishedStratum: 6,
  },
  {
    id: '9a', labelFr: 'Hormones (génomique)', labelEn: 'Hormones (genomic)',
    role: 'modulatory', d: 4, tauLog10: [3, 4], ablation: 3,
    ablationNoteFr: 'dérive de la ligne de base', ablationNoteEn: 'baseline drift',
    status: 'Établi / Established', publishedStratum: 7,
  },
  {
    id: '12b', labelFr: 'Fe, Cu, Se, Mn (cofacteurs)', labelEn: 'Fe, Cu, Se, Mn (cofactors)',
    role: 'permissive', d: 4, tauLog10: [3, 6], ablation: 4,
    ablationNoteFr: 'défaillance non sélective', ablationNoteEn: 'non-selective failure',
    status: 'Établi / Established', publishedStratum: 8,
  },
  {
    id: '13', labelFr: 'Cofacteurs et vitamines', labelEn: 'Cofactors and vitamins',
    role: 'permissive', d: 4, tauLog10: [3, 6], ablation: 4,
    ablationNoteFr: 'défaillance non sélective', ablationNoteEn: 'non-selective failure',
    status: 'Établi / Established', publishedStratum: 8,
  },
] as const);

/** Lookup by v1.1 class identifier. */
export const PAIR_BY_ID: ReadonlyMap<string, SpeciesFunctionPair> =
  new Map(PAIRS.map((p) => [p.id, p]));

/** Pairs grouped by causal role, in table order. */
export function pairsByRole(role: CausalRole): SpeciesFunctionPair[] {
  return PAIRS.filter((p) => p.role === role);
}

/** Human-readable τ range, e.g. "10⁻⁴–10⁻² s". */
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export function formatTau(pair: SpeciesFunctionPair): string {
  const sup = (n: number) => {
    const s = Math.abs(n).toString().split('').map((c) => SUP[Number(c)]).join('');
    return (n < 0 ? '⁻' : '') + s;
  };
  const [lo, hi] = pair.tauLog10;
  return `10${sup(lo)}–10${sup(hi)} s`;
}
