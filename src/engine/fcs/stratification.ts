/**
 * ASTRA × FCS — Pareto stratification of the neurochemical taxonomy
 * ═════════════════════════════════════════════════════════════════
 * Document IV §2, "La règle d'agrégation : dominance, et ordre partiel".
 *
 * THE RULE
 * A total order over ordinal criteria lacking a common scale IS an aggregation,
 * and document II (§1.4, after Okasha 2011 on Arrow's impossibility theorem
 * applied to theory choice) holds such aggregation formally problematic; the
 * series' negative heuristic forbids it (prohibition 4). The rule adopted is
 * therefore the only one satisfying unanimity without a dictatorship of
 * criterion: Pareto dominance.
 *
 *   A dominates B  ⟺  A is at least as close to the carrier as B on all three
 *                     sub-criteria, and strictly closer on at least one.
 *
 * The result is a PARTIAL order presented in strata: stratum 1 gathers the
 * pairs no other dominates; stratum k, those no remaining pair dominates once
 * the previous strata are removed. Two pairs in the same stratum are
 * incomparable or equivalent; document IV does not order them, and neither
 * does this module.
 *
 * ⚠ NO SCORE IS PRODUCED. A stratum index is an ordinal label. Subtracting
 * two stratum indices, averaging them, or treating them as a distance is
 * exactly the aggregation prohibition 4 forbids. See ./negative-heuristic.ts,
 * which lints for it at runtime.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 */

import { PAIRS, type SpeciesFunctionPair } from './taxonomy.js';

// ── 1. Ordinalisation of the time constant ────────────────────────

/**
 * Document IV publishes τ as a RANGE of decimal exponents per pair, and states
 * what the criterion is for: τ "decides whether a class can individuate a
 * conscious episode, of the order of a hundred milliseconds on level-IV
 * signatures (Dehaene & Changeux 2011; Koch et al. 2016)".
 *
 * Pareto dominance needs an ordinal comparison, so the range must be reduced to
 * a rank. The reduction used here is DECLARED, not read off the document:
 *
 *   rank 0 — the range reaches down to or below 10⁻¹ s (100 ms):
 *            the class can act within the window of an episode.
 *   rank 1 — the range starts above 10⁻¹ s but at or below 10⁰ s:
 *            the class straddles the window.
 *   rank 2 — the range starts above 10⁰ s:
 *            the class cannot individuate an episode; it sets the carrier's form.
 *
 * The reduction takes the range's LOWER bound, because the question is whether
 * the class CAN act inside the episode window, not whether it always does.
 *
 * EPISTEMIC STATUS OF THIS CHOICE — normative, and verifiable.
 * It is not a free parameter fitted to the answer: the first cut is the episode
 * window the document itself names, and the reduction reproduces all eight
 * published strata exactly (tests/fcs.test.ts). Should a revision of document IV
 * publish a different τ ordinalisation, only the cuts below change; the
 * dominance engine is unaffected.
 */
export interface TauOrdinalisation {
  /** Decimal-exponent cuts applied to the range's lower bound, ascending. */
  cutsLog10: readonly number[];
  basisFr: string;
  basisEn: string;
}

export const EPISODE_WINDOW_ORDINALISATION: TauOrdinalisation = Object.freeze({
  cutsLog10: Object.freeze([-1, 0]),
  basisFr:
    'Borne inférieure de la plage, découpée à 10⁻¹ s — la fenêtre de l\'épisode conscient nommée ' +
    'par le document IV — puis à 10⁰ s. Reconstruction déclarée : elle reproduit exactement les ' +
    'huit strates publiées, elle n\'est pas énoncée numériquement par la source.',
  basisEn:
    'Lower bound of the range, cut at 10⁻¹ s — the conscious-episode window named by document IV — ' +
    'then at 10⁰ s. Declared reconstruction: it reproduces all eight published strata exactly; it is ' +
    'not stated numerically by the source.',
});

/** Ordinal rank of a pair's τ under a given reduction. Lower = closer to the carrier. */
export function tauRank(
  pair: SpeciesFunctionPair,
  ord: TauOrdinalisation = EPISODE_WINDOW_ORDINALISATION,
): number {
  const lower = pair.tauLog10[0];
  let rank = 0;
  for (const cut of ord.cutsLog10) if (lower > cut) rank++;
  return rank;
}

// ── 2. Pareto dominance ───────────────────────────────────────────

export interface DominanceVerdict {
  dominates: boolean;
  /** Per-criterion comparison, for inspection. -1 = a closer, 0 = equal, 1 = b closer. */
  byCriterion: { d: -1 | 0 | 1; tau: -1 | 0 | 1; ablation: -1 | 0 | 1 };
}

const cmp = (x: number, y: number): -1 | 0 | 1 => (x < y ? -1 : x > y ? 1 : 0);

/**
 * Does `a` Pareto-dominate `b`? At least as close on all three sub-criteria,
 * strictly closer on at least one.
 */
export function dominates(
  a: SpeciesFunctionPair,
  b: SpeciesFunctionPair,
  ord: TauOrdinalisation = EPISODE_WINDOW_ORDINALISATION,
): DominanceVerdict {
  const byCriterion = {
    d: cmp(a.d, b.d),
    tau: cmp(tauRank(a, ord), tauRank(b, ord)),
    ablation: cmp(a.ablation, b.ablation),
  };
  const all = [byCriterion.d, byCriterion.tau, byCriterion.ablation];
  const atLeastAsClose = all.every((c) => c <= 0);
  const strictlyCloser = all.some((c) => c < 0);
  return { dominates: atLeastAsClose && strictlyCloser, byCriterion };
}

// ── 3. Stratification by iterative peeling ────────────────────────

export interface Stratum {
  /** Ordinal label. NOT a magnitude: no arithmetic may be performed on it. */
  index: number;
  pairIds: string[];
  pairs: SpeciesFunctionPair[];
}

export interface StratificationResult {
  strata: Stratum[];
  /** Stratum index by pair id. */
  byPair: Record<string, number>;
  ordinalisation: TauOrdinalisation;
  /** True when every computed stratum equals the one published in document IV §3. */
  reproducesPublished: boolean;
  divergences: Array<{ pairId: string; published: number; computed: number }>;
  rule: { fr: string; en: string };
}

/**
 * Peel the partial order: stratum k is the set of pairs no remaining pair
 * dominates, once strata 1…k−1 have been removed.
 */
export function stratify(
  pairs: readonly SpeciesFunctionPair[] = PAIRS,
  ord: TauOrdinalisation = EPISODE_WINDOW_ORDINALISATION,
): StratificationResult {
  let remaining = [...pairs];
  const strata: Stratum[] = [];
  const byPair: Record<string, number> = {};
  let index = 1;

  while (remaining.length > 0) {
    const layer = remaining.filter(
      (a) => !remaining.some((b) => b.id !== a.id && dominates(b, a, ord).dominates),
    );
    // Guard against a cycle — impossible for a strict partial order, but a
    // malformed external table could produce one, and an infinite loop inside
    // an MCP tool is worse than an exception.
    if (layer.length === 0) {
      throw new Error(
        'FCS stratification: no non-dominated pair among the remainder. ' +
        'The dominance relation is not a strict partial order — check the table.',
      );
    }
    const ids = new Set(layer.map((p) => p.id));
    strata.push({ index, pairIds: layer.map((p) => p.id), pairs: layer });
    for (const p of layer) byPair[p.id] = index;
    remaining = remaining.filter((p) => !ids.has(p.id));
    index++;
  }

  const divergences = pairs
    .filter((p) => byPair[p.id] !== p.publishedStratum)
    .map((p) => ({ pairId: p.id, published: p.publishedStratum, computed: byPair[p.id] }));

  return {
    strata,
    byPair,
    ordinalisation: ord,
    reproducesPublished: divergences.length === 0,
    divergences,
    rule: {
      fr: 'Dominance au sens de Pareto sur trois sous-critères ordinaux — distance causale au porteur, ' +
          'constante de temps, effet d\'ablation. Ordre partiel, sans agrégation numérique.',
      en: 'Pareto dominance on three ordinal sub-criteria — causal distance to the carrier, time constant, ' +
          'ablation effect. A partial order, with no numerical aggregation.',
    },
  };
}

/** Memoised default stratification — the engine's canonical partial order. */
let _cached: StratificationResult | null = null;
export function canonicalStratification(): StratificationResult {
  if (_cached === null) _cached = stratify();
  return _cached;
}

// ── 4. Pairwise explanation ───────────────────────────────────────

export interface ComparisonReport {
  a: string;
  b: string;
  relation: 'a-dominates-b' | 'b-dominates-a' | 'incomparable' | 'equivalent';
  detail: { d: [number, number]; tauRank: [number, number]; ablation: [number, number] };
  noteFr: string;
  noteEn: string;
}

/**
 * Compare two pairs and say why they are ordered — or why they are not.
 * Incomparability is a RESULT, not a failure: a partial order has it by design,
 * and reporting it is the whole point of refusing a total order.
 */
export function comparePairs(
  aId: string,
  bId: string,
  ord: TauOrdinalisation = EPISODE_WINDOW_ORDINALISATION,
): ComparisonReport {
  const a = PAIRS.find((p) => p.id === aId);
  const b = PAIRS.find((p) => p.id === bId);
  if (!a || !b) throw new Error(`Unknown pair id: ${!a ? aId : bId}`);

  const ab = dominates(a, b, ord).dominates;
  const ba = dominates(b, a, ord).dominates;
  const same = a.d === b.d && tauRank(a, ord) === tauRank(b, ord) && a.ablation === b.ablation;

  const relation: ComparisonReport['relation'] =
    ab ? 'a-dominates-b' : ba ? 'b-dominates-a' : same ? 'equivalent' : 'incomparable';

  const notes: Record<ComparisonReport['relation'], { fr: string; en: string }> = {
    'a-dominates-b': {
      fr: `${aId} domine ${bId} : au moins aussi proche du porteur sur les trois sous-critères, strictement plus proche sur l'un d'eux.`,
      en: `${aId} dominates ${bId}: at least as close to the carrier on all three sub-criteria, strictly closer on one.`,
    },
    'b-dominates-a': {
      fr: `${bId} domine ${aId} : au moins aussi proche du porteur sur les trois sous-critères, strictement plus proche sur l'un d'eux.`,
      en: `${bId} dominates ${aId}: at least as close to the carrier on all three sub-criteria, strictly closer on one.`,
    },
    equivalent: {
      fr: `${aId} et ${bId} portent les mêmes valeurs ordinales sur les trois sous-critères. Le document ne les ordonne pas.`,
      en: `${aId} and ${bId} carry the same ordinal values on all three sub-criteria. The document does not order them.`,
    },
    incomparable: {
      fr: `${aId} et ${bId} sont incomparables : chacun devance l'autre sur au moins un sous-critère. ` +
          `Les départager exigerait une agrégation sur des critères ordinaux dépourvus d'échelle commune — interdiction 4.`,
      en: `${aId} and ${bId} are incomparable: each leads the other on at least one sub-criterion. ` +
          `Separating them would require aggregating ordinal criteria lacking a common scale — prohibition 4.`,
    },
  };

  return {
    a: aId,
    b: bId,
    relation,
    detail: {
      d: [a.d, b.d],
      tauRank: [tauRank(a, ord), tauRank(b, ord)],
      ablation: [a.ablation, b.ablation],
    },
    noteFr: notes[relation].fr,
    noteEn: notes[relation].en,
  };
}
