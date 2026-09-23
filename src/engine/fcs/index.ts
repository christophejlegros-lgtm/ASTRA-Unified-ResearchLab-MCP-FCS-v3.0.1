/**
 * ASTRA × FCS — Substrate-constrained functionalism layer
 * ═══════════════════════════════════════════════════════
 * Implements, inside ASTRA, the values of:
 *   · Fonctionnalisme contraint par le substrat, document I v1.5
 *   · Complément métaphysique, document II v1.4
 *   · L'implémentation neurochimique, document IV v1.2
 *   · Synthèse illustrée S-1.5 (19·09·2026)
 * © Genève 2026 Christophe Jean Legros · Assistance Multi IA
 *
 * The layer is deliberately NOT a scoring module. It supplies:
 *   taxonomy        — 17 species–function pairs, 5 causal roles, 3 sub-criteria
 *   stratification  — Pareto dominance → a partial order in 8 strata
 *   levels          — the four-level framework mapped onto ASTRA's substrates
 *   conformance     — per-substrate audit binding live biomarkers to the taxonomy
 *   withdrawal      — withdrawal conditions and the declared revision order
 *   negativeHeuristic — the five prohibitions, enforced at runtime
 *   references      — the source documents' verified-DOI apparatus
 */

export * from './taxonomy.js';
export * from './stratification.js';
export * from './levels.js';
export * from './conformance.js';
export * from './withdrawal.js';
export * from './negative-heuristic.js';
export * from './references.js';

import { canonicalStratification } from './stratification.js';
import { PAIRS } from './taxonomy.js';
import { CORE, FIELD_HYPOTHESIS, LEVELS, LEVEL_ORDER } from './levels.js';
import { PROHIBITIONS, PROHIBITION_ORDER } from './negative-heuristic.js';
import { REVISION_ORDER, THESES } from './withdrawal.js';
import { auditAll, levelCoverage, type BiomarkerInputs } from './conformance.js';
import { DOI_NOTE, REFERENCES } from './references.js';

export const FCS_PROVENANCE = Object.freeze({
  documents: [
    'Fonctionnalisme contraint par le substrat — document I, v1.5',
    'Complément métaphysique — document II, v1.4',
    'L\'implémentation neurochimique — document IV, v1.2 (19·09·2026)',
    'Synthèse illustrée — S-1.5 (19·09·2026)',
  ],
  author: '© Genève 2026 Christophe Jean Legros · Assistance Multi IA',
  contact: 'Assistant-Multi-IA@proton.me',
});

/**
 * One consolidated view of the FCS layer, for the dashboard and for the
 * `fcs_report` MCP tool. Carries no aggregate quantity of any kind.
 */
export function fcsReport(bio: BiomarkerInputs = {}) {
  const strat = canonicalStratification();
  return {
    provenance: FCS_PROVENANCE,
    core: CORE,
    fieldHypothesis: FIELD_HYPOTHESIS,
    levels: LEVEL_ORDER.map((l) => LEVELS[l]),
    levelCoverage: levelCoverage(),
    taxonomy: {
      pairCount: PAIRS.length,
      classCount: 13,
      roleCount: 5,
      strataCount: strat.strata.length,
      rule: strat.rule,
      ordinalisation: strat.ordinalisation,
      reproducesPublished: strat.reproducesPublished,
      divergences: strat.divergences,
      strata: strat.strata.map((s) => ({ index: s.index, pairIds: s.pairIds })),
    },
    substrates: auditAll(bio),
    negativeHeuristic: PROHIBITION_ORDER.map((p) => PROHIBITIONS[p]),
    revisionOrder: REVISION_ORDER.map((id) => ({
      rank: THESES[id].revisionRank, id, nameEn: THESES[id].nameEn, nameFr: THESES[id].nameFr,
    })),
    references: { count: REFERENCES.length, doiNote: DOI_NOTE },
  };
}
