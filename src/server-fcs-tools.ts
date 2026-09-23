/**
 * ASTRA — MCP tool surface for the FCS layer (tools 63–70)
 * ════════════════════════════════════════════════════════
 *   fcs_report         — consolidated framework, taxonomy, substrates, heuristic
 *   fcs_taxonomy       — the 17 species–function pairs, filterable by role/stratum
 *   fcs_stratify       — recompute the Pareto partial order, τ ordinalisation exposed
 *   fcs_compare        — why two pairs are ordered, or why they are incomparable
 *   fcs_levels         — the four-level framework and its ASTRA coverage
 *   fcs_conformance    — per-substrate audit, bound to live IRB biomarkers
 *   fcs_withdrawal     — belt standing under given strand outcomes; revision order
 *   fcs_lint           — screen a string against the five prohibitions
 *
 * Every payload passes BOTH linters before it leaves: `lintClaim` (Block's
 * access/phenomenal distinction) and `lintFcs` (the FCS series' five
 * prohibitions). A payload that fails either is returned as an error rather
 * than emitted with a caveat attached.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { lintClaim } from './engine/tcai/phenomenal-guard.js';
import {
  PAIRS, ROLE_DEFINITIONS, ABLATION_DEGREES, formatTau,
  canonicalStratification, stratify, comparePairs,
  EPISODE_WINDOW_ORDINALISATION, type TauOrdinalisation,
  LEVELS, LEVEL_ORDER, CORE, FIELD_HYPOTHESIS,
  auditSubstrate, auditAll, levelCoverage, type BiomarkerInputs,
  evaluateWithdrawal, THESES, REVISION_ORDER, type StrandOutcomes,
  lintFcs, PROHIBITIONS, PROHIBITION_ORDER, mayAggregate, mayInferConstitutive,
  REFERENCES, DOI_NOTE, fcsReport,
} from './engine/fcs/index.js';
import { toolAnnotations } from './tool-annotations.js';

const SUBSTRATE_KINDS = ['silicon-snn', 'organoid-mea', 'human-wearable'] as const;
const ROLES = ['constitutive', 'generator', 'parametric', 'modulatory', 'permissive'] as const;

/** Emit a payload only if it clears both linters. */
function emit(payload: unknown) {
  const text = JSON.stringify(payload, null, 2);
  const claimViolations = lintClaim(text);
  const fcsViolations = lintFcs(text);
  if (claimViolations.length > 0 || fcsViolations.length > 0) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({
        error: 'LINT_FAILED',
        claimPatterns: claimViolations,
        fcsProhibitions: fcsViolations,
        note: 'The payload asserts something the FCS layer is not permitted to assert. Nothing was emitted.',
      }, null, 2) }],
      isError: true,
    };
  }
  return { content: [{ type: 'text' as const, text }] };
}

/** Live biomarker snapshot from the shared state store, if a reader is supplied. */
export interface FcsToolDeps {
  /** Returns the ASTRA state snapshot; used to bind IRB biomarkers to the taxonomy. */
  getState?: () => { eth?: { ca?: number; fr?: number; atp?: number; viab?: number }; mode?: string };
}

function liveBiomarkers(deps: FcsToolDeps): BiomarkerInputs {
  const s = deps.getState?.();
  if (!s?.eth) return {};
  return {
    calciumNm: s.eth.ca,
    firingRateHz: s.eth.fr,
    atpAdpRatio: s.eth.atp,
    viabilityPct: s.eth.viab,
    meaFieldActive: s.mode === 'live',
  };
}

export function registerFcsCapabilities(server: McpServer, deps: FcsToolDeps = {}): void {
  // ── 63 · fcs_report ──
  server.tool(
    'fcs_report',
    'Consolidated substrate-constrained functionalism status: the four-level framework, the core/belt ' +
    'partition, the seventeen species–function pairs in their Pareto strata, the per-substrate conformance ' +
    'audit, the five prohibitions of the negative heuristic, and the declared revision order. Carries no ' +
    'aggregate score of any kind — prohibition 4 forbids one.',
    { useLiveBiomarkers: z.boolean().optional().describe('Bind the conformance audit to the live IRB welfare channels. Default true.') },
    toolAnnotations('fcs_report'), async ({ useLiveBiomarkers }) =>
      emit(fcsReport(useLiveBiomarkers === false ? {} : liveBiomarkers(deps))),
  );

  // ── 64 · fcs_taxonomy ──
  server.tool(
    'fcs_taxonomy',
    'The thirteen molecular classes as seventeen species–function pairs: causal role, distance to the carrier ' +
    'd, time-constant range τ, ablation degree, Pareto stratum and declared epistemic status. The ordering is ' +
    'of FUNCTIONS, not of substances: one species may occupy two distant places.',
    {
      role: z.enum(ROLES).optional().describe('Filter to one causal role.'),
      stratum: z.number().int().min(1).max(8).optional().describe('Filter to one Pareto stratum.'),
      pairId: z.string().optional().describe('A single pair by its v1.1 class identifier, e.g. "2a", "10b".'),
    },
    toolAnnotations('fcs_taxonomy'), async ({ role, stratum, pairId }) => {
      const strat = canonicalStratification();
      const rows = PAIRS.filter((p) =>
        (!role || p.role === role) &&
        (!stratum || strat.byPair[p.id] === stratum) &&
        (!pairId || p.id === pairId));
      if (pairId && rows.length === 0) {
        return emit({ error: 'UNKNOWN_PAIR', pairId, known: PAIRS.map((p) => p.id) });
      }
      return emit({
        filter: { role: role ?? null, stratum: stratum ?? null, pairId: pairId ?? null },
        count: rows.length,
        pairs: rows.map((p) => ({
          id: p.id, labelFr: p.labelFr, labelEn: p.labelEn,
          role: p.role, roleDefinitionEn: ROLE_DEFINITIONS[p.role].en,
          d: p.d, tau: formatTau(p), tauLog10: p.tauLog10,
          ablationDegree: p.ablation, ablationEn: ABLATION_DEGREES[p.ablation].en,
          ablationNoteEn: p.ablationNoteEn,
          stratum: strat.byPair[p.id], publishedStratum: p.publishedStratum,
          status: p.status,
        })),
        subCriteriaEn: {
          d: 'Causal distance to the carrier, in steps mediated by a distinct entity. Mobile charge = 0; a coefficient of the carrier\'s equations = 1.',
          tau: 'Time constant — the longer of the class\'s action on the carrier and the class\'s own physiological variation. Decides whether the class can individuate an episode of ~100 ms.',
          ablation: 'Effect on level-IV signatures, in four ordered degrees. Decides only in conjunction with the other two (fat-handedness).',
        },
      });
    },
  );

  // ── 65 · fcs_stratify ──
  server.tool(
    'fcs_stratify',
    'Recompute the partial order by Pareto dominance over the three ordinal sub-criteria, and report whether ' +
    'it reproduces the eight strata published in document IV §3. The τ ordinalisation is exposed as a ' +
    'parameter: the default cuts the range\'s lower bound at 10⁻¹ s — the conscious-episode window the document ' +
    'names — then at 10⁰ s. Changing it changes the order, which is the point of declaring it.',
    {
      tauCutsLog10: z.array(z.number()).max(4).optional()
        .describe('Ascending decimal-exponent cuts on the τ range\'s lower bound. Default [-1, 0].'),
    },
    toolAnnotations('fcs_stratify'), async ({ tauCutsLog10 }) => {
      const ord: TauOrdinalisation = tauCutsLog10
        ? {
            cutsLog10: [...tauCutsLog10].sort((a, b) => a - b),
            basisFr: 'Découpage fourni par l\'appelant.',
            basisEn: 'Ordinalisation supplied by the caller.',
          }
        : EPISODE_WINDOW_ORDINALISATION;
      const result = stratify(PAIRS, ord);
      return emit({
        rule: result.rule,
        ordinalisation: result.ordinalisation,
        strataCount: result.strata.length,
        strata: result.strata.map((s) => ({
          index: s.index,
          pairs: s.pairs.map((p) => ({ id: p.id, labelEn: p.labelEn, role: p.role })),
          incomparabilityNoteEn: s.pairs.length > 1
            ? 'Pairs in one stratum are incomparable or equivalent. Document IV does not order them, and neither does this engine.'
            : null,
        })),
        reproducesPublished: result.reproducesPublished,
        divergences: result.divergences,
        aggregationNoteEn:
          'A stratum index is an ordinal label. Differences between indices are not distances, and no weighted ' +
          'combination of d, τ and ablation is admissible — prohibition 4, after Okasha (2011).',
      });
    },
  );

  // ── 66 · fcs_compare ──
  server.tool(
    'fcs_compare',
    'Compare two species–function pairs and say why they are ordered — or, just as informatively, why they ' +
    'are incomparable. Incomparability is a result of the partial order, not a gap in it.',
    { a: z.string().describe('First pair id, e.g. "1".'), b: z.string().describe('Second pair id, e.g. "2a".') },
    toolAnnotations('fcs_compare'), async ({ a, b }) => {
      try {
        return emit(comparePairs(a, b));
      } catch (err) {
        return emit({ error: 'UNKNOWN_PAIR', detail: String(err), known: PAIRS.map((p) => p.id) });
      }
    },
  );

  // ── 67 · fcs_levels ──
  server.tool(
    'fcs_levels',
    'The four-level framework — substrate, kinaesthetic proto-consciousness, hierarchical inference, access ' +
    'consciousness — with each level\'s formalism, epistemic status, complement reading, the ASTRA modules that ' +
    'implement or stand in for it, and the gap ASTRA cannot close at that level.',
    { level: z.enum(['I', 'II', 'III', 'IV']).optional().describe('One level; omit for all four.') },
    toolAnnotations('fcs_levels'), async ({ level }) => emit({
      core: CORE,
      fieldHypothesis: FIELD_HYPOTHESIS,
      corePlacementNoteEn:
        'The substrate constraint belongs to the CORE and asserts only factual realisation by a restricted ' +
        'class of transmembrane ionic dynamics. The field hypothesis belongs to the BELT and is tested at ' +
        'level I. Conflating them is the error version 1.5 of document I exists to remove.',
      levels: (level ? [level] : [...LEVEL_ORDER]).map((l) => LEVELS[l]),
      coverage: levelCoverage(),
    }),
  );

  // ── 68 · fcs_conformance ──
  server.tool(
    'fcs_conformance',
    'Audit one substrate — or all three — against the seventeen species–function pairs: which pairs it ' +
    'realises, which it only simulates, which are absent, and which ASTRA has no channel to determine. Binds ' +
    'the live IRB welfare biomarkers to the taxonomy (Ca²⁺ → class 1, ATP/ADP → class 7, firing rate → class 3 ' +
    'generator, viability → class 2b proxy). Returns a profile, never a conformance score.',
    {
      substrate: z.enum(SUBSTRATE_KINDS).optional().describe('One substrate; omit for all three.'),
      calciumNm: z.number().min(0).optional(),
      firingRateHz: z.number().min(0).optional(),
      atpAdpRatio: z.number().min(0).optional(),
      viabilityPct: z.number().min(0).max(100).optional(),
      useLiveBiomarkers: z.boolean().optional().describe('Start from the live state store, overridden by any value given above. Default true.'),
    },
    toolAnnotations('fcs_conformance'), async ({ substrate, useLiveBiomarkers, ...overrides }) => {
      const base = useLiveBiomarkers === false ? {} : liveBiomarkers(deps);
      const bio: BiomarkerInputs = { ...base };
      if (overrides.calciumNm !== undefined) bio.calciumNm = overrides.calciumNm;
      if (overrides.firingRateHz !== undefined) bio.firingRateHz = overrides.firingRateHz;
      if (overrides.atpAdpRatio !== undefined) bio.atpAdpRatio = overrides.atpAdpRatio;
      if (overrides.viabilityPct !== undefined) bio.viabilityPct = overrides.viabilityPct;
      return emit({
        biomarkers: bio,
        audits: substrate ? [auditSubstrate(substrate, bio)] : auditAll(bio),
      });
    },
  );

  // ── 69 · fcs_withdrawal ──
  server.tool(
    'fcs_withdrawal',
    'Evaluate the protective belt against experimental outcomes: which theses are withdrawn, which stand, ' +
    'which are undetermined, and what survives each withdrawal. Unset outcomes stay undetermined — they never ' +
    'collapse to a negative. Note the declared asymmetry: a FAVOURABLE human grain outcome does not corroborate ' +
    'M2, because the methodological bias favours the field; only the contrary outcome is informative.',
    {
      ephapticPropagationUnderBlockade: z.boolean().nullable().optional(),
      efficacyVariesWithVolumeFraction: z.boolean().nullable().optional(),
      bridgeCovariation: z.boolean().nullable().optional(),
      bridgeLocalIntervention: z.boolean().nullable().optional(),
      fieldBeyondFiringInHumans: z.boolean().nullable().optional(),
      boundaryBetterByResonanceOrTopology: z.boolean().nullable().optional(),
      dimensionalityFromInteroception: z.boolean().nullable().optional(),
      experimentRankedByM1: z.boolean().nullable().optional(),
    },
    toolAnnotations('fcs_withdrawal'), async (outcomes) => emit({
      report: evaluateWithdrawal(outcomes as StrandOutcomes),
      revisionOrder: REVISION_ORDER.map((id) => ({
        rank: THESES[id].revisionRank, id,
        nameEn: THESES[id].nameEn, conditionEn: THESES[id].conditionEn, survivesEn: THESES[id].survivesEn,
      })),
      m1: THESES.M1,
      declaredInAdvanceNoteEn:
        'The revision order is declared in advance and is common to documents I, II and IV. Declaring it ' +
        'beforehand is what stops a refutation from being absorbed by whichever auxiliary is cheapest to ' +
        'sacrifice after the fact.',
    }),
  );

  // ── 70 · fcs_lint ──
  server.tool(
    'fcs_lint',
    'Screen a string, or a proposed aggregation, or a proposed constitutive inference, against the five ' +
    'prohibitions of the series\' negative heuristic. Use before emitting any user-facing claim that touches ' +
    'the FCS layer.',
    {
      text: z.string().optional().describe('String to screen against prohibitions 1–5.'),
      aggregate: z.array(z.object({
        name: z.string(), unit: z.string().nullable(), values: z.array(z.number()),
      })).optional().describe('Criteria a caller proposes to combine into one number — checked against prohibition 4.'),
      constitutiveInference: z.object({
        ablationDegree: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
        interventionSpared: z.boolean().describe('True when the intervention modified the class WITHOUT removing the general conditions of operation.'),
      }).optional().describe('A proposed "ablation → constitutive role" inference — checked against prohibition 5.'),
    },
    toolAnnotations('fcs_lint'), async ({ text, aggregate, constitutiveInference }) => {
      const payload: Record<string, unknown> = {
        prohibitions: PROHIBITION_ORDER.map((p) => PROHIBITIONS[p]),
      };
      if (text !== undefined) {
        const fcs = lintFcs(text);
        const claim = lintClaim(text);
        payload.textVerdict = {
          admissible: fcs.length === 0 && claim.length === 0,
          fcsFindings: fcs,
          claimPatterns: claim,
        };
      }
      if (aggregate !== undefined) payload.aggregationVerdict = mayAggregate(aggregate);
      if (constitutiveInference !== undefined) {
        payload.constitutiveVerdict = mayInferConstitutive(
          constitutiveInference.ablationDegree, constitutiveInference.interventionSpared);
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
    },
  );

  // ── Resources ──
  server.resource('fcs-framework', 'astra://fcs/framework',
    { description: 'FCS four-level framework, core/belt partition and ASTRA coverage', mimeType: 'application/json' },
    async () => ({ contents: [{ uri: 'astra://fcs/framework', mimeType: 'application/json',
      text: JSON.stringify({ core: CORE, fieldHypothesis: FIELD_HYPOTHESIS,
        levels: LEVEL_ORDER.map((l) => LEVELS[l]), coverage: levelCoverage() }, null, 2) }] }));

  server.resource('fcs-taxonomy', 'astra://fcs/taxonomy',
    { description: '17 species–function pairs in their Pareto strata', mimeType: 'application/json' },
    async () => {
      const strat = canonicalStratification();
      return { contents: [{ uri: 'astra://fcs/taxonomy', mimeType: 'application/json',
        text: JSON.stringify({ rule: strat.rule, ordinalisation: strat.ordinalisation,
          reproducesPublished: strat.reproducesPublished,
          strata: strat.strata.map((s) => ({ index: s.index, pairs: s.pairs.map((p) => ({ id: p.id, labelEn: p.labelEn, role: p.role, d: p.d, tau: formatTau(p), ablation: p.ablation })) })) }, null, 2) }] };
    });

  server.resource('fcs-conformance', 'astra://fcs/conformance',
    { description: 'Per-substrate FCS conformance audit against live biomarkers', mimeType: 'application/json' },
    async () => ({ contents: [{ uri: 'astra://fcs/conformance', mimeType: 'application/json',
      text: JSON.stringify(auditAll(liveBiomarkers(deps)), null, 2) }] }));

  server.resource('fcs-references', 'astra://fcs/references',
    { description: 'Verified-DOI bibliography of the FCS series', mimeType: 'application/json' },
    async () => ({ contents: [{ uri: 'astra://fcs/references', mimeType: 'application/json',
      text: JSON.stringify({ note: DOI_NOTE, references: REFERENCES }, null, 2) }] }));

  // ── Prompts ──
  server.prompt('fcs-substrate-audit', 'Audit ASTRA\'s three substrates against the FCS taxonomy', {}, async () => ({
    messages: [{ role: 'user' as const, content: { type: 'text' as const,
      text: 'Run: fcs_levels → fcs_conformance (all substrates) → fcs_taxonomy role=constitutive → ' +
            'fcs_stratify. Report, per substrate, which level-I carrier requirement is met and which ' +
            'species–function pairs are realised, simulated, absent or undetermined. Do NOT produce a ' +
            'conformance score: prohibition 4 forbids aggregating the ordinal sub-criteria.' } }] }));

  server.prompt('fcs-belt-review', 'Review the protective belt against current strand outcomes', {
    outcomes: z.string().optional().describe('Known strand outcomes, in prose.') },
    async (args: { outcomes?: string }) => ({
      messages: [{ role: 'user' as const, content: { type: 'text' as const,
        text: `Run fcs_withdrawal with the outcomes known so far${args.outcomes ? `: ${args.outcomes}` : ' (leave unset ones undetermined)'}. ` +
              'Then state which thesis is next in the declared revision order, and what would survive its withdrawal. ' +
              'Remember the asymmetry on the human grain strand: only the outcome against the methodological bias is informative.' } }] }));
}
