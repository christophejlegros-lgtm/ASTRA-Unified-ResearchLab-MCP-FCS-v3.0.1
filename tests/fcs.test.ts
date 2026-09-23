/**
 * ASTRA × FCS — test suite
 * ════════════════════════
 * The central test is `reproduces the eight published strata`: the engine
 * computes the partial order from the three sub-criteria by Pareto peeling and
 * must land on exactly the stratification printed in document IV §3. If a
 * transcription error creeps into the table, or the τ ordinalisation is
 * changed, that test fails — which is the only way to know.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  PAIRS, PAIR_BY_ID, pairsByRole, formatTau, ROLE_DEFINITIONS, ABLATION_DEGREES,
} from '../src/engine/fcs/taxonomy.js';
import {
  stratify, canonicalStratification, dominates, comparePairs, tauRank,
  EPISODE_WINDOW_ORDINALISATION,
} from '../src/engine/fcs/stratification.js';
import { LEVELS, LEVEL_ORDER, CORE, FIELD_HYPOTHESIS, levelProfile } from '../src/engine/fcs/levels.js';
import { auditSubstrate, auditAll, levelCoverage } from '../src/engine/fcs/conformance.js';
import { evaluateWithdrawal, THESES, REVISION_ORDER } from '../src/engine/fcs/withdrawal.js';
import {
  lintFcs, mayAggregate, mayInferConstitutive, refuseAggregate,
  PROHIBITIONS, PROHIBITION_ORDER,
} from '../src/engine/fcs/negative-heuristic.js';
import { REFERENCES } from '../src/engine/fcs/references.js';
import { fcsReport } from '../src/engine/fcs/index.js';

// ── Taxonomy ──────────────────────────────────────────────────────

describe('FCS taxonomy — document IV v1.2', () => {
  test('carries seventeen species–function pairs', () => {
    assert.equal(PAIRS.length, 17);
  });

  test('covers thirteen molecular classes', () => {
    const classes = new Set(PAIRS.map((p) => p.id.replace(/[ab]$/, '')));
    assert.equal(classes.size, 13);
  });

  test('uses all five causal roles', () => {
    const roles = new Set(PAIRS.map((p) => p.role));
    assert.equal(roles.size, 5);
    for (const r of roles) assert.ok(ROLE_DEFINITIONS[r], `missing definition for ${r}`);
  });

  test('pair ids are unique and resolvable', () => {
    assert.equal(PAIR_BY_ID.size, PAIRS.length);
    for (const p of PAIRS) assert.equal(PAIR_BY_ID.get(p.id)?.id, p.id);
  });

  test('every τ range is well-ordered and every d is in [0,4]', () => {
    for (const p of PAIRS) {
      assert.ok(p.tauLog10[0] <= p.tauLog10[1], `${p.id}: τ range inverted`);
      assert.ok(p.d >= 0 && p.d <= 4, `${p.id}: d out of range`);
      assert.ok(ABLATION_DEGREES[p.ablation], `${p.id}: unknown ablation degree`);
    }
  });

  test('only the mobile charge sits at distance 0', () => {
    const atZero = PAIRS.filter((p) => p.d === 0);
    assert.deepEqual(atZero.map((p) => p.id), ['1']);
  });

  test('the two constitutive pairs are the charge and the valve', () => {
    assert.deepEqual(pairsByRole('constitutive').map((p) => p.id), ['1', '2a']);
  });

  test('the four permissive pairs are 2b, 7, 12b, 13', () => {
    assert.deepEqual(pairsByRole('permissive').map((p) => p.id).sort(), ['12b', '13', '2b', '7']);
  });

  test('function, not substance: class 2 and class 9 each split into two roles', () => {
    assert.notEqual(PAIR_BY_ID.get('2a')!.role, PAIR_BY_ID.get('2b')!.role);
    assert.notEqual(PAIR_BY_ID.get('9a')!.tauLog10[0], PAIR_BY_ID.get('9b')!.tauLog10[0]);
    assert.notEqual(PAIR_BY_ID.get('12a')!.role, PAIR_BY_ID.get('12b')!.role);
  });

  test('τ formatting renders superscript exponents', () => {
    assert.equal(formatTau(PAIR_BY_ID.get('1')!), '10⁻⁴–10⁻² s');
    assert.equal(formatTau(PAIR_BY_ID.get('11')!), '10⁵–10⁶ s');
  });
});

// ── Stratification: the load-bearing test ─────────────────────────

describe('FCS stratification — Pareto dominance, document IV §2', () => {
  test('reproduces the eight published strata exactly', () => {
    const result = canonicalStratification();
    assert.equal(result.divergences.length, 0,
      `computed strata diverge from document IV §3: ${JSON.stringify(result.divergences)}`);
    assert.ok(result.reproducesPublished);
    assert.equal(result.strata.length, 8);
  });

  test('stratum 1 is the ion alone; stratum 2 the valve alone', () => {
    const { strata } = canonicalStratification();
    assert.deepEqual(strata[0].pairIds, ['1']);
    assert.deepEqual(strata[1].pairIds, ['2a']);
  });

  test('stratum 8 holds the two distant permissive cofactor pairs', () => {
    const { strata } = canonicalStratification();
    assert.deepEqual(strata[7].pairIds.sort(), ['12b', '13']);
  });

  test('every pair lands in exactly one stratum', () => {
    const { strata, byPair } = canonicalStratification();
    assert.equal(Object.keys(byPair).length, PAIRS.length);
    assert.equal(strata.reduce((n, s) => n + s.pairIds.length, 0), PAIRS.length);
  });

  test('dominance is irreflexive and asymmetric', () => {
    for (const a of PAIRS) {
      assert.equal(dominates(a, a).dominates, false, `${a.id} dominates itself`);
      for (const b of PAIRS) {
        if (a.id === b.id) continue;
        assert.ok(!(dominates(a, b).dominates && dominates(b, a).dominates),
          `${a.id} and ${b.id} dominate each other`);
      }
    }
  });

  test('no pair is dominated by another in its own stratum', () => {
    for (const s of canonicalStratification().strata) {
      for (const a of s.pairs) {
        for (const b of s.pairs) {
          if (a.id === b.id) continue;
          assert.equal(dominates(b, a).dominates, false,
            `${b.id} dominates ${a.id} inside stratum ${s.index}`);
        }
      }
    }
  });

  test('the τ ordinalisation is what it declares: three ranks, cut at the episode window', () => {
    assert.deepEqual([...EPISODE_WINDOW_ORDINALISATION.cutsLog10], [-1, 0]);
    // Ions act inside the episode window; myelin cannot individuate one.
    assert.equal(tauRank(PAIR_BY_ID.get('1')!), 0);
    assert.equal(tauRank(PAIR_BY_ID.get('9b')!), 1);
    assert.equal(tauRank(PAIR_BY_ID.get('11')!), 2);
  });

  test('a different τ ordinalisation gives a different order — the choice is load-bearing', () => {
    const altered = stratify(PAIRS, {
      cutsLog10: [2], basisFr: 'test', basisEn: 'test',
    });
    assert.equal(altered.reproducesPublished, false);
  });

  test('comparison reports incomparability rather than inventing an order', () => {
    // 2b (permissive, d=1, slow, non-selective) vs 3 (generator, d=2, fast, abolition):
    // each leads on a different sub-criterion.
    const r = comparePairs('2b', '3');
    assert.equal(r.relation, 'incomparable');
    assert.match(r.noteEn, /prohibition 4/);
  });

  test('12b and 13 are equivalent on all three sub-criteria', () => {
    assert.equal(comparePairs('12b', '13').relation, 'equivalent');
  });

  test('unknown pair id throws rather than defaulting', () => {
    assert.throws(() => comparePairs('99', '1'), /Unknown pair id/);
  });
});

// ── Levels ────────────────────────────────────────────────────────

describe('FCS four-level framework', () => {
  test('four levels, each with a non-empty ASTRA gap', () => {
    assert.equal(LEVEL_ORDER.length, 4);
    for (const l of LEVEL_ORDER) {
      assert.ok(LEVELS[l].astraGapEn.length > 0);
      assert.ok(LEVELS[l].astraGapFr.length > 0);
      assert.ok(LEVELS[l].status.length > 0);
    }
  });

  test('the field hypothesis is belt, not core', () => {
    assert.equal(FIELD_HYPOTHESIS.placement, 'belt');
    assert.ok(!CORE.some((c) => c.id === 'field-hypothesis'));
    assert.ok(CORE.some((c) => c.id === 'substrate-constraint-weak'));
  });

  test('only the organoid realises level I', () => {
    assert.deepEqual(LEVELS.I.realisedBy, ['organoid-mea']);
    assert.ok(!levelProfile('silicon-snn').realises.includes('I'));
  });

  test('silicon simulates levels III and IV without realising level I', () => {
    const p = levelProfile('silicon-snn');
    assert.ok(p.realises.includes('II'));
    assert.ok(p.absent.includes('I'));
    assert.equal(p.realises.includes('I'), false);
  });

  test('level coverage names a substrate for every level', () => {
    for (const c of levelCoverage()) {
      assert.ok(c.realisedBy.length + c.simulatedBy.length > 0, `level ${c.level} uncovered`);
    }
  });
});

// ── Conformance ───────────────────────────────────────────────────

describe('FCS substrate conformance audit', () => {
  test('silicon realises no constitutive pair', () => {
    const a = auditSubstrate('silicon-snn');
    assert.equal(a.carrier.carrierPresent, false);
    assert.equal(a.pairs.filter((p) => p.role === 'constitutive' && p.verdict === 'realised').length, 0);
    assert.ok(a.notesEn.some((n) => /No constitutive pair is realised/.test(n)));
  });

  test('silicon has no field to observe', () => {
    assert.equal(auditSubstrate('silicon-snn').carrier.fieldObserved.value, null);
  });

  test('the organoid realises both constitutive pairs and carries the carrier', () => {
    const a = auditSubstrate('organoid-mea', { meaFieldActive: true });
    assert.equal(a.carrier.carrierPresent, true);
    assert.equal(a.carrier.fieldObserved.value, 1);
    const constitutive = a.pairs.filter((p) => p.role === 'constitutive');
    assert.ok(constitutive.every((p) => p.verdict === 'realised'));
  });

  test('live biomarkers bind to the taxonomy by class', () => {
    const a = auditSubstrate('organoid-mea', {
      calciumNm: 65, atpAdpRatio: 3.5, firingRateHz: 28, viabilityPct: 95,
    });
    const byId = new Map(a.pairs.map((p) => [p.pairId, p]));
    assert.equal(byId.get('1')!.reading.value, 65);          // Ca²⁺ → class 1
    assert.equal(byId.get('7')!.reading.value, 3.5);         // ATP/ADP → class 7
    assert.equal(byId.get('3')!.reading.value, 28);          // firing rate → class 3
    assert.equal(byId.get('2b')!.reading.value, 95);         // viability → class 2b
    assert.equal(byId.get('1')!.reading.provenance, 'measured');
    assert.equal(byId.get('2b')!.reading.provenance, 'derived'); // proxy, not assay
  });

  test('a missing biomarker withholds rather than defaulting', () => {
    const a = auditSubstrate('organoid-mea', { calciumNm: 65 });
    const atp = a.pairs.find((p) => p.pairId === '7')!;
    assert.equal(atp.reading.value, null);
    assert.equal(atp.reading.provenance, 'unavailable');
  });

  test('every human-wearable verdict is undetermined, by design', () => {
    const a = auditSubstrate('human-wearable', { calciumNm: 65, atpAdpRatio: 3.5 });
    assert.ok(a.pairs.every((p) => p.verdict === 'undetermined'));
    assert.equal(a.tally.undetermined, 17);
  });

  test('no audit carries an aggregate score', () => {
    for (const a of auditAll({ calciumNm: 65, atpAdpRatio: 3.5, firingRateHz: 28, viabilityPct: 95 })) {
      assert.equal(a.aggregateRefusal.value, null);
      assert.match(a.aggregateRefusal.basis, /prohibition 4/);
      assert.ok(!('score' in a));
      assert.ok(!('conformanceIndex' in a));
    }
  });

  test('tallies sum to the seventeen pairs on every substrate', () => {
    for (const a of auditAll()) {
      const total = Object.values(a.tally).reduce((x, y) => x + y, 0);
      assert.equal(total, 17, `${a.substrate}: tally sums to ${total}`);
    }
  });
});

// ── Negative heuristic ────────────────────────────────────────────

describe('FCS negative heuristic — five prohibitions, enforced', () => {
  test('all five prohibitions are defined with a rationale', () => {
    assert.equal(PROHIBITION_ORDER.length, 5);
    for (const p of PROHIBITION_ORDER) {
      assert.ok(PROHIBITIONS[p].fr.length > 0);
      assert.ok(PROHIBITIONS[p].en.length > 0);
      assert.ok(PROHIBITIONS[p].rationaleEn.length > 0);
    }
  });

  test('P4 refuses ordinal criteria lacking a common scale', () => {
    const v = mayAggregate([
      { name: 'd', unit: null, values: [0, 1, 2] },
      { name: 'ablation', unit: null, values: [1, 2, 4] },
    ]);
    assert.equal(v.admissible, false);
    assert.equal(v.prohibition, 'P4');
  });

  test('P4 admits commensurable quantities', () => {
    const v = mayAggregate([
      { name: 'rate-a', unit: 'Hz', values: [10, 20] },
      { name: 'rate-b', unit: 'Hz', values: [15, 25] },
    ]);
    assert.equal(v.admissible, true);
    assert.equal(v.prohibition, null);
  });

  test('P4 treats a single criterion as no aggregation', () => {
    assert.equal(mayAggregate([{ name: 'd', unit: null, values: [1] }]).admissible, true);
  });

  test('refuseAggregate returns a withheld scalar carrying its reason', () => {
    const s = refuseAggregate([
      { name: 'stratum', unit: null, values: [1, 2] },
      { name: 'τ rank', unit: null, values: [0, 2] },
    ]);
    assert.equal(s.value, null);
    assert.equal(s.provenance, 'unavailable');
    assert.match(s.basis, /prohibition 4/);
  });

  test('P5 blocks a constitutive inference from non-selective failure', () => {
    const v = mayInferConstitutive(4, true);
    assert.equal(v.admissible, false);
    assert.equal(v.prohibition, 'P5');
  });

  test('P5 blocks a fat-handed intervention whatever the ablation degree', () => {
    assert.equal(mayInferConstitutive(1, false).admissible, false);
    assert.equal(mayInferConstitutive(2, false).admissible, false);
  });

  test('P5 admits a selective intervention on a non-permissive effect, with the conjunction clause', () => {
    const v = mayInferConstitutive(1, true);
    assert.equal(v.admissible, true);
    assert.match(v.reasonEn, /IN CONJUNCTION/);
  });

  test('P1 catches a quantified degree of proto-consciousness, in both languages', () => {
    assert.ok(lintFcs('the degree of consciousness reached 0.82').some((f) => f.prohibition === 'P1'));
    assert.ok(lintFcs('le degré de proto-conscience atteint 0,82').some((f) => f.prohibition === 'P1'));
  });

  test('P2 catches identifying an observable with phenomenality', () => {
    assert.ok(lintFcs('ignition is the phenomenal character of the state').some((f) => f.prohibition === 'P2'));
  });

  test('accented tokens are caught despite JavaScript\'s ASCII \\b', () => {
    // "phénoménalité." ends in an accented letter: a trailing \b would never fire.
    assert.ok(lintFcs("L'ignition mesure la phénoménalité.").some((f) => f.prohibition === 'P2'));
    assert.ok(lintFcs('Le degré de conscience est de 0,82.').some((f) => f.prohibition === 'P1'));
    assert.ok(lintFcs('Le score agrégé vaut 0,61.').some((f) => f.prohibition === 'P4'));
  });

  test('a French sentence crossing two prohibitions reports both', () => {
    const f = lintFcs("Le degré de conscience atteint 0,82, ce qui prouve que l'ignition mesure la phénoménalité.");
    assert.ok(f.some((x) => x.prohibition === 'P1'), 'P1 missed');
    assert.ok(f.some((x) => x.prohibition === 'P2'), 'P2 missed');
  });

  test('P4 catches an aggregate score named in prose', () => {
    assert.ok(lintFcs('the overall FCS score is 0.61').some((f) => f.prohibition === 'P4'));
  });

  test('ordinary FCS prose passes the linter', () => {
    assert.deepEqual(lintFcs(
      'Stratum 3 gathers four pairs that no remaining pair dominates. The carrier is the transmembrane ' +
      'ionic current and the field it generates.'), []);
  });

  test('the whole consolidated report passes its own linters', () => {
    const text = JSON.stringify(fcsReport({ calciumNm: 65, atpAdpRatio: 3.5, firingRateHz: 28, viabilityPct: 95 }));
    assert.deepEqual(lintFcs(text), []);
  });

  test('use/mention: stating a prohibition is exempt, making the move is not', () => {
    assert.deepEqual(lintFcs('No quantifying a degree of proto-consciousness.'), []);
    assert.deepEqual(lintFcs('Interdiction de quantifier un degré de proto-conscience.'), []);
    assert.ok(lintFcs('The measured degree of consciousness was 0.82.').length > 0);
  });

  test('use/mention: a bibliographic title is exempt', () => {
    assert.deepEqual(lintFcs(
      'Casali, A. G., et al. (2013). A theoretically based index of consciousness independent of ' +
      'sensory processing and behavior. Science Translational Medicine, 5(198), 198ra105.'), []);
  });

  test('the exemption does not neuter the linter inside a mixed payload', () => {
    const mixed = JSON.stringify({
      prohibitions: [PROHIBITIONS.P1.en, PROHIBITIONS.P1.fr],
      finding: 'ASTRA reached a degree of consciousness of 0.82 this cycle.',
    });
    const findings = lintFcs(mixed);
    assert.ok(findings.some((f) => f.prohibition === 'P1'),
      'an assertive claim must still fire even beside a stated prohibition');
    assert.match(findings[0].segment, /0\.82/);
  });
});

// ── Withdrawal ────────────────────────────────────────────────────

describe('FCS withdrawal conditions and revision order', () => {
  test('unset outcomes stay undetermined and never collapse to negative', () => {
    const r = evaluateWithdrawal({});
    const belt = r.evaluations.filter((e) => e.thesis !== 'inference-and-measurement' && e.thesis !== 'M1');
    assert.ok(belt.every((e) => e.standing === 'undetermined'),
      `unexpected standings: ${JSON.stringify(belt.map((e) => [e.thesis, e.standing]))}`);
  });

  test('a negative level-I strand withdraws the field hypothesis and M2 with it', () => {
    const r = evaluateWithdrawal({ ephapticPropagationUnderBlockade: false });
    const field = r.evaluations.find((e) => e.thesis === 'field-hypothesis')!;
    const m2 = r.evaluations.find((e) => e.thesis === 'M2')!;
    assert.equal(field.standing, 'withdrawn');
    assert.equal(m2.standing, 'withdrawn');
    assert.match(m2.reasonEn, /presupposition/);
    assert.match(field.survivesEn, /substrate constraint/);
  });

  test('a negative osmotic strand also withdraws the field hypothesis', () => {
    assert.equal(
      evaluateWithdrawal({ efficacyVariesWithVolumeFraction: false })
        .evaluations.find((e) => e.thesis === 'field-hypothesis')!.standing,
      'withdrawn');
  });

  test('the declared asymmetry holds: a favourable human outcome does not corroborate M2', () => {
    const r = evaluateWithdrawal({ fieldBeyondFiringInHumans: true });
    const m2 = r.evaluations.find((e) => e.thesis === 'M2')!;
    assert.equal(m2.standing, 'undetermined');
    assert.match(m2.reasonEn, /bias/);
  });

  test('the outcome against the bias does withdraw M2', () => {
    assert.equal(
      evaluateWithdrawal({ fieldBeyondFiringInHumans: false })
        .evaluations.find((e) => e.thesis === 'M2')!.standing,
      'withdrawn');
  });

  test('covariation alone leaves the bridge undetermined; the local intervention decides', () => {
    assert.equal(
      evaluateWithdrawal({ bridgeCovariation: true, bridgeLocalIntervention: null })
        .evaluations.find((e) => e.thesis === 'bridge-auxiliary')!.standing,
      'undetermined');
    assert.equal(
      evaluateWithdrawal({ bridgeLocalIntervention: true })
        .evaluations.find((e) => e.thesis === 'bridge-auxiliary')!.standing,
      'standing');
  });

  test('interoceptive dimensionality effects withdraw the kinaesthetic thesis, framework surviving', () => {
    const k = evaluateWithdrawal({ dimensionalityFromInteroception: true })
      .evaluations.find((e) => e.thesis === 'kinaesthetic')!;
    assert.equal(k.standing, 'withdrawn');
    assert.match(k.survivesEn, /interoceptive/);
  });

  test('M1 carries a dated clause and is withdrawn once it elapses unmet', () => {
    assert.equal(THESES.M1.deadline, '2027-09-30');
    const after = evaluateWithdrawal({}, new Date('2027-10-01T00:00:00Z'));
    assert.equal(after.evaluations.find((e) => e.thesis === 'M1')!.standing, 'withdrawn');
    assert.ok(after.m1DaysRemaining < 0);
  });

  test('an experiment ranked by M1 keeps it standing past its deadline', () => {
    assert.equal(
      evaluateWithdrawal({ experimentRankedByM1: true }, new Date('2027-10-01T00:00:00Z'))
        .evaluations.find((e) => e.thesis === 'M1')!.standing,
      'standing');
  });

  test('the revision order is declared, ordered and complete', () => {
    assert.equal(REVISION_ORDER.length, 6);
    const ranks = REVISION_ORDER.map((id) => THESES[id].revisionRank);
    assert.deepEqual(ranks, [1, 2, 3, 4, 5, 6]);
    assert.equal(THESES['field-hypothesis'].revisionRank, 6, 'the field hypothesis is revised last');
  });

  test('the core carries no withdrawal condition', () => {
    const r = evaluateWithdrawal({});
    assert.match(r.coreNoteEn, /no withdrawal condition/);
    assert.ok(!r.evaluations.some((e) => (CORE as ReadonlyArray<{ id: string }>).some((c) => c.id === e.thesis)));
  });

  test('next-to-revise skips withdrawn theses', () => {
    const r = evaluateWithdrawal({ ephapticPropagationUnderBlockade: false });
    assert.match(r.nextToReviseEn, /rank \d/);
  });
});

// ── References ────────────────────────────────────────────────────

describe('FCS bibliography', () => {
  test('every reference carries a DOI verified by the source documents', () => {
    assert.ok(REFERENCES.length >= 30);
    for (const r of REFERENCES) {
      assert.equal(r.doiVerified, true, `${r.key}: unverified`);
      assert.match(r.doi, /^10\.\d{4,9}\//, `${r.key}: malformed DOI "${r.doi}"`);
      assert.ok(r.usedFor.length > 0, `${r.key}: no stated use`);
    }
  });

  test('reference keys are unique', () => {
    assert.equal(new Set(REFERENCES.map((r) => r.key)).size, REFERENCES.length);
  });

  test('the strands' + ' load-bearing citations are present', () => {
    const keys = new Set(REFERENCES.map((r) => r.key));
    for (const k of ['chiang2019', 'traynelis1989', 'dudek1990', 'ding2016', 'okasha2011', 'craver2007', 'casali2013']) {
      assert.ok(keys.has(k), `missing ${k}`);
    }
  });
});

// ── Consolidated report ───────────────────────────────────────────

describe('FCS consolidated report', () => {
  test('reports the taxonomy shape and the reproduction verdict', () => {
    const r = fcsReport();
    assert.equal(r.taxonomy.pairCount, 17);
    assert.equal(r.taxonomy.classCount, 13);
    assert.equal(r.taxonomy.roleCount, 5);
    assert.equal(r.taxonomy.strataCount, 8);
    assert.equal(r.taxonomy.reproducesPublished, true);
    assert.equal(r.negativeHeuristic.length, 5);
    assert.equal(r.levels.length, 4);
    assert.equal(r.substrates.length, 3);
  });

  test('carries the provenance of the source documents', () => {
    const r = fcsReport();
    assert.equal(r.provenance.documents.length, 4);
    assert.match(r.provenance.author, /Christophe Jean Legros/);
  });
});
