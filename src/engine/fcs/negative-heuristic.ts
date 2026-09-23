/**
 * ASTRA × FCS — The series' negative heuristic, enforced at runtime
 * ═════════════════════════════════════════════════════════════════
 * Five prohibitions, reproduced identically in documents I (table 3),
 * II (table 3) and IV, and in synthesis S-1.5.
 *
 * A negative heuristic is not a disclaimer. It says which moves the research
 * programme refuses to make, and a programme that states one and then makes the
 * move anyway has simply not stated it. This module turns the five prohibitions
 * into functions that REFUSE, so that a violation is a caught error rather than
 * a line in a report nobody reads.
 *
 * It composes with `tcai/phenomenal-guard.ts`: that module enforces Block's
 * access/phenomenal distinction and the Metzinger moratorium profile; this one
 * enforces the FCS series' own five. `lintFcs` is designed to be called
 * alongside `lintClaim`, not instead of it.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 */

import { withheld, type TaggedScalar } from '../tcai/phenomenal-guard.js';

// ── 1. The five prohibitions ──────────────────────────────────────

export type ProhibitionId = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export interface Prohibition {
  id: ProhibitionId;
  fr: string;
  en: string;
  /** Why it exists — the failure mode it forecloses. */
  rationaleFr: string;
  rationaleEn: string;
}

export const PROHIBITIONS: Record<ProhibitionId, Prohibition> = {
  P1: {
    id: 'P1',
    fr: 'Interdiction de quantifier un degré de proto-conscience ou d\'expérience.',
    en: 'No quantifying a degree of proto-consciousness or of experience.',
    rationaleFr:
      'Un degré suppose une échelle, et aucune échelle de l\'expérience n\'est disponible. Le critère ' +
      'd\'individuation (M3) livre une frontière, non une magnitude.',
    rationaleEn:
      'A degree presupposes a scale, and no scale of experience is available. The individuation criterion (M3) ' +
      'delivers a boundary, not a magnitude.',
  },
  P2: {
    id: 'P2',
    fr: 'Interdiction d\'identifier une mesure à la phénoménalité.',
    en: 'No identifying a measure with phenomenality.',
    rationaleFr:
      'Une observable de niveau IV est une signature d\'accès. L\'identifier au caractère phénoménal franchit ' +
      'la distinction de Block sans argument.',
    rationaleEn:
      'A level-IV observable is an access signature. Identifying it with phenomenal character crosses Block\'s ' +
      'distinction without an argument.',
  },
  P3: {
    id: 'P3',
    fr: 'Interdiction d\'inférer un mécanisme d\'un succès d\'ajustement.',
    en: 'No inferring a mechanism from a fitting success.',
    rationaleFr:
      'Un modèle qui ajuste les données ne montre pas que le système calcule ce que le modèle calcule. ' +
      'L\'exigence de recevabilité polynomiale est la contrepartie positive de cette interdiction.',
    rationaleEn:
      'A model that fits the data does not show that the system computes what the model computes. The ' +
      'polynomial admissibility requirement is this prohibition\'s positive counterpart.',
  },
  P4: {
    id: 'P4',
    fr: 'Interdiction des scores agrégés sur des critères ordinaux dépourvus d\'échelle commune.',
    en: 'No aggregate scores over ordinal criteria lacking a common scale.',
    rationaleFr:
      'Document II §1.4, d\'après Okasha (2011) : le théorème d\'Arrow s\'applique au choix de théorie. ' +
      'Une agrégation sans échelle commune introduit une dictature de critère non déclarée. La seule règle ' +
      'admissible est la dominance de Pareto, qui produit un ordre partiel.',
    rationaleEn:
      'Document II §1.4, after Okasha (2011): Arrow\'s theorem applies to theory choice. Aggregation without a ' +
      'common scale introduces an undeclared dictatorship of criterion. The only admissible rule is Pareto ' +
      'dominance, which yields a partial order.',
  },
  P5: {
    id: 'P5',
    fr: 'Interdiction d\'inférer un rôle constitutif d\'un effet d\'ablation permissif.',
    en: 'No inferring a constitutive role from a permissive ablation effect.',
    rationaleFr:
      'Qu\'une classe soit nécessaire au maintien de la conscience n\'établit jamais qu\'elle en soit ' +
      'constitutive ; seule une intervention qui modifie la classe sans supprimer les conditions générales ' +
      'de fonctionnement peut trancher.',
    rationaleEn:
      'That a class is necessary to the maintenance of consciousness never establishes that it is constitutive ' +
      'of it; only an intervention that modifies the class without removing the general conditions of operation ' +
      'can decide.',
  },
};

export const PROHIBITION_ORDER: readonly ProhibitionId[] = Object.freeze(['P1', 'P2', 'P3', 'P4', 'P5']);

// ── 2. P4 — the aggregation refusal ───────────────────────────────

export interface OrdinalCriterion {
  name: string;
  /** Ordinal values, one per item. */
  values: number[];
  /**
   * The unit this criterion is measured in. Two criteria share a scale only if
   * they share a unit. `null` means "rank", which is never shared.
   */
  unit: string | null;
}

export interface AggregationVerdict {
  admissible: boolean;
  prohibition: ProhibitionId | null;
  reasonFr: string;
  reasonEn: string;
}

/**
 * Decide whether a set of criteria may be combined into a single number.
 *
 * Admissible only when every criterion carries the SAME non-null unit — in which
 * case the combination is an arithmetic operation on commensurable quantities,
 * not an aggregation of ordinal ranks. Anything else is refused under P4.
 *
 * This is the function that makes prohibition 4 operative rather than decorative:
 * call it before any weighted sum whose inputs include a rank, a stratum index,
 * a role, or an ablation degree.
 */
export function mayAggregate(criteria: readonly OrdinalCriterion[]): AggregationVerdict {
  if (criteria.length <= 1) {
    return {
      admissible: true, prohibition: null,
      reasonFr: 'Un seul critère : aucune agrégation n\'a lieu.',
      reasonEn: 'A single criterion: no aggregation takes place.',
    };
  }
  const units = new Set(criteria.map((c) => c.unit));
  const hasRank = units.has(null);
  if (!hasRank && units.size === 1) {
    return {
      admissible: true, prohibition: null,
      reasonFr: `Tous les critères portent la même unité (${[...units][0]}) : l'opération est arithmétique, non agrégative.`,
      reasonEn: `All criteria carry the same unit (${[...units][0]}): the operation is arithmetic, not aggregative.`,
    };
  }
  const names = criteria.map((c) => c.name).join(', ');
  return {
    admissible: false, prohibition: 'P4',
    reasonFr:
      `Agrégation refusée sur [${names}] : critères ordinaux dépourvus d'échelle commune (interdiction 4). ` +
      'Règle admissible : dominance de Pareto, ordre partiel en strates.',
    reasonEn:
      `Aggregation refused over [${names}]: ordinal criteria lacking a common scale (prohibition 4). ` +
      'Admissible rule: Pareto dominance, a partial order in strata.',
  };
}

/**
 * The aggregation P4 forbids, as a function that returns a withheld scalar
 * instead of a number. Use it where an aggregate WOULD have been computed, so
 * that the refusal travels downstream with its justification attached.
 */
export function refuseAggregate(criteria: readonly OrdinalCriterion[]): TaggedScalar {
  const verdict = mayAggregate(criteria);
  return withheld(
    verdict.admissible
      ? 'Aggregation admissible but deliberately not computed here; use the commensurable path.'
      : verdict.reasonEn,
  );
}

// ── 3. P5 — the permissive/constitutive firewall ──────────────────

export interface RoleInferenceVerdict {
  admissible: boolean;
  prohibition: ProhibitionId | null;
  reasonFr: string;
  reasonEn: string;
}

/**
 * Guard the inference "ablating X abolished consciousness, therefore X is
 * constitutive". Under P5 that inference is blocked when the ablation was of a
 * permissive factor, and blocked when the intervention removed the general
 * conditions of operation — which is what a permissive ablation does by
 * definition.
 *
 * @param observedAblationDegree the four-degree ordinal from the taxonomy
 * @param interventionSpared true when the intervention modified the class WITHOUT
 *        removing the general conditions of operation — the only case that decides
 */
export function mayInferConstitutive(
  observedAblationDegree: 1 | 2 | 3 | 4,
  interventionSpared: boolean,
): RoleInferenceVerdict {
  if (observedAblationDegree === 4) {
    return {
      admissible: false, prohibition: 'P5',
      reasonFr:
        'Défaillance non sélective : l\'effet est celui d\'un facteur permissif. Toutes les théories le ' +
        'prédisent, il n\'en départage aucune (interdiction 5).',
      reasonEn:
        'Non-selective failure: the effect is that of a permissive factor. Every theory predicts it, so it ' +
        'separates none (prohibition 5).',
    };
  }
  if (!interventionSpared) {
    return {
      admissible: false, prohibition: 'P5',
      reasonFr:
        'L\'intervention a supprimé les conditions générales de fonctionnement : elle est « à main lourde » ' +
        '(Craver 2007 ; Baumgartner & Gebharter 2016) et ne sépare pas la constitution de la causalité.',
      reasonEn:
        'The intervention removed the general conditions of operation: it is fat-handed (Craver 2007; ' +
        'Baumgartner & Gebharter 2016) and does not separate constitution from causation.',
    };
  }
  return {
    admissible: true, prohibition: null,
    reasonFr:
      'Intervention sélective sur un effet non permissif : l\'inférence est recevable EN CONJONCTION avec les ' +
      'deux autres sous-critères. L\'attribution de rôle reste révisable.',
    reasonEn:
      'Selective intervention on a non-permissive effect: the inference is admissible IN CONJUNCTION with the ' +
      'two other sub-criteria. The role assignment remains revisable.',
  };
}

// ── 4. P1 / P2 — the text linter ──────────────────────────────────

interface LintRule { prohibition: ProhibitionId; pattern: RegExp; hintEn: string }

/**
 * Right word-boundary for a token that may end in an accented letter.
 *
 * JavaScript's `\b` is ASCII-only without the `u` flag: in "phénoménalité.",
 * the final "é" is a non-word character and the "." after it is too, so there
 * is NO boundary between them and a trailing `\b` never matches. Every French
 * rule below therefore ends with this lookahead instead of `\b`.
 */
const EOW = '(?![A-Za-zÀ-ÖØ-öø-ÿ])';

/**
 * Patterns matched against any user-facing string the FCS layer is about to
 * emit. Deliberately narrow: a linter that fires on ordinary prose gets
 * switched off, and a switched-off linter enforces nothing.
 */
const FCS_LINT_RULES: readonly LintRule[] = Object.freeze([
  {
    prohibition: 'P1',
    pattern: /\b(degree|level|amount|quantity|score|index) of (proto-?)?(consciousness|experience|sentience|awareness)\b/i,
    hintEn: 'P1 — a degree of proto-consciousness or experience is not quantifiable. Report the boundary, not a magnitude.',
  },
  {
    prohibition: 'P1',
    pattern: new RegExp(`\\b(degré|niveau|quantité|score|indice) de (proto-?)?(conscience|expérience)${EOW}`, 'i'),
    hintEn: 'P1 — un degré de proto-conscience ou d\'expérience n\'est pas quantifiable.',
  },
  {
    prohibition: 'P2',
    pattern: /\b(measures?|quantifies|captures) (the )?phenomenal(ity| character| experience)?\b/i,
    hintEn: 'P2 — a measure is an access signature; it is not phenomenality.',
  },
  {
    prohibition: 'P2',
    pattern: new RegExp(`\\b(mesure|mesurent|quantifie|quantifient|capture|capturent|saisit)\\s+(la\\s+)?(phénoménalité|qualia|expérience vécue)${EOW}`, 'i'),
    hintEn: 'P2 — une mesure est une signature d\'accès ; elle n\'est pas la phénoménalité.',
  },
  {
    prohibition: 'P2',
    pattern: /\b(Φ̃?|phi|ignition|PCI|broadcast)\s*(=|is|équivaut à|est)\s*(the |la |le )?(phenomenal|qualia|experience|phénoménal)/i,
    hintEn: 'P2 — identifying an observable with phenomenal character crosses Block\'s distinction without an argument.',
  },
  {
    prohibition: 'P3',
    pattern: /\b(fit|fits|fitted|ajustement)\b[^.]{0,60}\b(therefore|hence|donc|prouve|proves)\b[^.]{0,60}\bmechanism|mécanisme\b/i,
    hintEn: 'P3 — a fitting success does not establish the mechanism.',
  },
  {
    prohibition: 'P4',
    pattern: /\b(aggregate|composite|weighted|global|overall)\s+(FCS|stratum|strata|role|ablation|ordinal)\s*(score|index|rank)\b/i,
    hintEn: 'P4 — no aggregate score over ordinal criteria lacking a common scale.',
  },
  {
    prohibition: 'P4',
    pattern: new RegExp(`\\b(score|indice)\\s+(agrégé|global|composite|de conformité)${EOW}`, 'i'),
    hintEn: 'P4 — aucun score agrégé sur des critères ordinaux dépourvus d\'échelle commune.',
  },
  {
    prohibition: 'P5',
    pattern: /\bpermissive\b[^.]{0,80}\btherefore\b[^.]{0,40}\bconstitutive\b/i,
    hintEn: 'P5 — a permissive ablation effect never establishes a constitutive role.',
  },
]);

/**
 * USE / MENTION.
 *
 * A prohibition and a bibliographic title are not claims. "No quantifying a
 * degree of consciousness" MENTIONS the forbidden move in order to forbid it,
 * and Casali et al. (2013) is titled "A theoretically based index of
 * consciousness" whether or not ASTRA approves of the phrase. A linter that
 * fires on either is broken, and a broken linter gets switched off — at which
 * point it enforces nothing at all.
 *
 * A segment matching one of these is therefore exempt. The exemptions are
 * narrow on purpose: an assertion does not become a mention by containing the
 * word "not" somewhere else in the payload, which is why screening runs per
 * segment rather than over the whole string.
 */
const EXEMPTIONS: readonly RegExp[] = Object.freeze([
  // The move is being forbidden, refused or reported as inadmissible.
  /\b(no|not|never|nor)\s+(quantif|identif|infer|aggregat|comput|produc|deriv)/i,
  /\b(interdiction|interdit|proscri|refus|forbid|forbidden|prohibit)/i,
  /\bis not (quantifiable|admissible|available|a claim)\b/i,
  /\bn['’]est pas (quantifiable|recevable|disponible)\b/i,
  /\bprohibition [1-5]\b/i,
  /\binterdiction [1-5]\b/i,
  // A bibliographic entry: a DOI, or an author–year citation.
  /\b10\.\d{4,9}\//,
  /\(\d{4}(?:\/\d{4})?[a-z]?\)/,
  /\bet al\.,?\s*\d{4}\b/,
]);

/**
 * Screening happens in two tiers.
 *
 * A UNIT is one field value — a line, or one string between JSON boundaries.
 * Exemption is decided at unit level, because a citation's marker and its title
 * belong to the same field: splitting "Casali et al. (2013). A theoretically
 * based index of consciousness…" into sentences would strand the title away
 * from the year that identifies it as a citation.
 *
 * A SENTENCE inside a unit is what the rules actually match, so that a finding
 * reports the offending clause rather than a whole paragraph. The unit's
 * exemption covers all its sentences; it does not leak to the next unit, which
 * is what keeps a stated prohibition from excusing an assertion beside it.
 */
function units(text: string): string[] {
  return text
    .split(/\r?\n|",\s*"|"\s*,\s*$|"\s*:\s*"/m)
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
}

function sentencesOf(unit: string): string[] {
  const parts = unit
    .split(/(?<=[.;!?])\s+(?=[A-ZÀ-Þ“"'(\d])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : [unit];
}

export interface FcsLintFinding {
  prohibition: ProhibitionId;
  pattern: string;
  hintEn: string;
  prohibitionFr: string;
  prohibitionEn: string;
  /** The segment that triggered the finding, truncated for reporting. */
  segment: string;
}

/**
 * Screen a string against the five prohibitions, segment by segment, skipping
 * segments that mention a prohibition rather than making the move, and segments
 * that are bibliographic. Empty array means admissible.
 *
 * Compose with `lintClaim` from `tcai/phenomenal-guard.ts`: that one enforces
 * Block's access/phenomenal distinction, this one the FCS series' own five.
 */
export function lintFcs(text: string): FcsLintFinding[] {
  const findings: FcsLintFinding[] = [];
  const seen = new Set<string>();

  for (const unit of units(text)) {
    if (EXEMPTIONS.some((e) => e.test(unit))) continue;
    for (const segment of sentencesOf(unit)) {
      for (const rule of FCS_LINT_RULES) {
        if (!rule.pattern.test(segment)) continue;
        const key = `${rule.prohibition}::${rule.pattern.source}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({
          prohibition: rule.prohibition,
          pattern: rule.pattern.source,
          hintEn: rule.hintEn,
          prohibitionFr: PROHIBITIONS[rule.prohibition].fr,
          prohibitionEn: PROHIBITIONS[rule.prohibition].en,
          segment: segment.length > 200 ? `${segment.slice(0, 200)}…` : segment,
        });
      }
    }
  }
  return findings;
}
