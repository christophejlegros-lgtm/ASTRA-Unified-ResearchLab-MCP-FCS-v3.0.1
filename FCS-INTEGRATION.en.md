# FCS layer — substrate-constrained functionalism

**ASTRA v3.1.0 · `fcs_*` tools (8) · `astra://fcs/*` resources (4) · prompts (2)**

Implements, inside ASTRA, the values of the series:

| Document | Title | Version |
|---|---|---|
| I | Substrate-constrained functionalism | v1.5 |
| II | Metaphysical complement | v1.4 |
| IV | The neurochemical implementation | v1.2 · 19·09·2026 |
| S | Illustrated synthesis | S-1.5 · 19·09·2026 |

© Geneva 2026 Christophe Jean Legros · Assistance Multi IA

---

## 1. What the layer is not

It produces **no score**. That is an architectural constraint, not stylistic
restraint: the series' negative heuristic forbids, in fourth place, aggregate
scores over ordinal criteria lacking a common scale (document II §1.4, after
Okasha 2011 — Arrow's theorem applied to theory choice).

One aggregation rule is therefore admissible: **Pareto dominance**, which yields
a *partial* order. Two incomparable pairs stay incomparable. `mayAggregate()`
refuses, at runtime, any combination of ordinal criteria, and
`refuseAggregate()` returns a withheld scalar carrying its reason rather than a
number.

This discipline extends `tcai/phenomenal-guard.ts`, which already encodes
Block's access/phenomenal distinction in the type system: there is no
constructor for a phenomenal claim, and there is likewise no constructor for a
conformance score.

---

## 2. The four-level framework and ASTRA's coverage

| Level | Content | Status | Realised by | ASTRA module |
|---|---|---|---|---|
| **I** Substrate | transmembrane ionic currents, endogenous fields, ephaptic coupling | Established (existence) · Modelled (field hypothesis) | organoid MEA | `engine/neuroplatform.ts` |
| **II** Kinaesthetic proto-consciousness | efference–reafference loop, minimal self | Modelled · Contested | silicon SNN, MEA | `tcai/self-model.ts`, `second-order.ts` |
| **III** Hierarchical inference | predictive coding, top-down priors | Modelled | silicon SNN | `world-model.ts`, `tcai/active-inference.ts` |
| **IV** Access consciousness | ignition, global broadcast | Established (signatures) · Contested (sufficiency) | silicon SNN | `tcai/global-workspace.ts` |

**Core** — individuation by a functional profile; substrate constraint in the
*weak* sense (in living systems the profile is realised **as a matter of fact**
by a restricted class of transmembrane ionic dynamics); weak emergence;
polynomial admissibility.

**Belt** — the **field hypothesis**: the endogenous field is a causally
efficacious coupling route and not a measurement epiphenomenon. Since document I
v1.5 the substrate constraint (core) and the field hypothesis (belt) are
distinguished; conflating them is the error that version exists to remove.

### What the layer establishes about ASTRA

The silicon LIF+STDP network **realises no constitutive pair**. The LIF equation
names a membrane potential and a conductance, but nothing crosses a membrane:
the variables are the model's, not the substrate's. Under the substrate
constraint the level-I carrier is absent there, whatever the level-III and
level-IV profile shows — which remains compatible with the multiple
realisability *in principle* that the core asserts.

Level III is the one place where ASTRA **meets** the core's admissibility
condition rather than approximating it: the family of approximations is declared
— joint-embedding encoder, SIGReg regularisation, bounded-horizon CEM planning.

---

## 3. The neurochemical taxonomy

Thirteen molecular classes, **seventeen species–function pairs**, five causal
roles, three ordinal sub-criteria, **eight strata**.

The ordering is of **functions**, not of substances: glutamate is a generator in
class 3 and a metabolite in class 13; calcium is a charge carrier in class 1 and,
as a second messenger, belongs to signalling cascades rather than to the carrier.

### The three sub-criteria

| Sub-criterion | Definition | Encoded |
|---|---|---|
| **d** | causal distance to the carrier, in steps mediated by a distinct entity; mobile charge = 0; a coefficient of the carrier's equations = 1 | `pair.d` |
| **τ** | the longer of two durations — action on the carrier, own physiological variation; decides whether the class can individuate an episode (~100 ms) | `pair.tauLog10` |
| **ablation** | effect on level-IV signatures, in four ordered degrees | `pair.ablation` |

### The ordinalisation of τ — a declared reconstruction

Document IV publishes τ as a **range** and states what the criterion decides,
without giving its numerical cuts. The reduction used in
`EPISODE_WINDOW_ORDINALISATION` is therefore declared, not read off:

```
rank 0 — the range reaches 10⁻¹ s or below: the class acts within the episode window
rank 1 — the range starts above 10⁻¹ s, up to 10⁰ s: it straddles the window
rank 2 — the range starts above 10⁰ s: it cannot individuate an episode
```

It is not fitted to the answer: the first cut is the episode window the document
itself names, and the reduction **reproduces all eight published strata exactly**
(document IV §3). `tests/fcs.test.ts` checks this on every run — if a
transcription error creeps into the table, or the ordinalisation changes, the
test fails.

```ts
const result = canonicalStratification();
result.reproducesPublished; // true
result.divergences;         // []
result.strata.length;       // 8
```

### The eight strata

| Stratum | Pairs | Reading |
|---|---|---|
| S1 | 1 | the ion as mobile charge |
| S2 | 2a | channels, ionotropic receptors, connexins |
| S3 | 2b · 3 · 4 · 11 | four pairs, mutually incomparable |
| S4 | 5 · 6 · 10a · 12a | four incomparable pairs |
| S5 | 9b · 10b | two incomparable pairs |
| S6 | 7 · 8 | two incomparable pairs |
| S7 | 9a | hormones, genomic route |
| S8 | 12b · 13 | equivalent on all three sub-criteria |

Incomparability is a **result**, not a gap: `fcs_compare` reports it explicitly,
with the reason — separating them would require the aggregation prohibition 4
refuses.

---

## 4. The conformance audit

`fcs_conformance` answers, for each of the three substrates, a question the
substrate constraint makes well-posed: **which pairs does this substrate realise,
and through which channel does ASTRA observe it?**

Four verdicts: `realised` · `simulated` · `absent` · `undetermined`.

### The IRB biomarkers already are observations of classes

This is where the layer stops being a table and becomes an integration:

| ASTRA channel | Pair | Role | Provenance |
|---|---|---|---|
| `eth.ca` — extracellular Ca²⁺, nM | **1** — ions | constitutive | measured |
| `eth.fr` — firing rate, Hz | **3** — transmitter amino acids | generator | derived |
| `eth.atp` — ATP/ADP ratio | **7** — energy metabolites | permissive | measured |
| `eth.viab` — viability, % | **2b** — Na⁺/K⁺-ATPase | permissive | derived (proxy) |

A drifting biomarker thereby becomes the statement "this pair has left its
operating range", not merely an ethics flag. A silent channel does **not return
zero**: the pair goes to `withheld()`. An absent measurement is not a null
measurement.

### The human substrate

Every verdict is `undetermined` **by design**. The subject realises the full
taxonomy; the 1 Hz autonomic channel determines none of it, and recording that
is the audit's result, not its failure.

---

## 5. The withdrawal conditions

`fcs_withdrawal` evaluates the belt against strand outcomes. An unset outcome
stays `undetermined` and **never collapses to a negative**.

**Declared revision order**, common to documents I, II and IV:

```
1 inference procedure and measurement auxiliaries
2 bridge auxiliary
3 grain hypothesis (M2)
4 individuation criterion (M3)
5 kinaesthetic thesis
6 field hypothesis
```

Declaring it in advance is what stops a refutation from being absorbed by
whichever auxiliary is cheapest to sacrifice after the fact.

### The bias asymmetry

The human strand's methodological bias favours the field. The evaluator
reproduces it: `fieldBeyondFiringInHumans: true` leaves M2 **undetermined**,
because the favourable outcome does not discriminate. Only `false` — the outcome
against the bias — withdraws M2.

Likewise, covariation alone does not settle the bridge auxiliary: ionic
composition varies with state (Ding et al., 2016) and a neuromodulatory common
cause may act upstream. It is the local intervention that carries the strand's
value.

### The core

It does not appear in the evaluation. Its revision would be the abandonment of
the programme, not a move within it — and `evaluateWithdrawal()` refuses to rate
it.

---

## 6. The negative heuristic, enforced

| # | Prohibition | Enforcement |
|---|---|---|
| P1 | quantifying a degree of proto-consciousness or experience | `lintFcs()` |
| P2 | identifying a measure with phenomenality | `lintFcs()` |
| P3 | inferring a mechanism from a fitting success | `lintFcs()` |
| P4 | aggregate scores over ordinal criteria lacking a common scale | `mayAggregate()` · `refuseAggregate()` |
| P5 | inferring a constitutive role from a permissive ablation effect | `mayInferConstitutive()` |

Every payload the layer emits passes **two** linters — `lintClaim` (Block's
distinction) and `lintFcs` (the five prohibitions). A payload failing either is
returned as an error, not emitted with a caveat in a footer.

**Use and mention.** The linter works by field unit then by sentence, and exempts
units that *mention* a prohibition or that are bibliographic — "No quantifying a
degree of proto-consciousness" states the move in order to forbid it, and Casali
et al. (2013) is titled *A theoretically based index of consciousness* whether or
not the phrase is welcome. A linter that fires on itself ends up switched off,
hence enforcing nothing.

> **Implementation note.** Without the `u` flag, JavaScript's `\b` is ASCII-only:
> in "phénoménalité.", the final "é" and the "." are both non-word characters, so
> there is no boundary between them and a trailing `\b` never fires. The French
> rules end with the `EOW` lookahead instead.

---

## 7. MCP surface

| Tool | Purpose |
|---|---|
| `fcs_report` | consolidated view: framework, core/belt, strata, substrates, prohibitions, revision order |
| `fcs_taxonomy` | the 17 pairs, filterable by role, stratum or identifier |
| `fcs_stratify` | recompute the partial order; the τ cuts are exposed as a parameter |
| `fcs_compare` | why two pairs are ordered — or why they are incomparable |
| `fcs_levels` | the four levels, their status, the ASTRA modules and the gap left open |
| `fcs_conformance` | per-substrate audit, bound to the live IRB biomarkers |
| `fcs_withdrawal` | belt standing under given strand outcomes; revision order |
| `fcs_lint` | screen a string, a proposed aggregation, or a constitutive inference |

**Resources** — `astra://fcs/framework` · `astra://fcs/taxonomy` ·
`astra://fcs/conformance` · `astra://fcs/references`

**Prompts** — `fcs-substrate-audit` · `fcs-belt-review`

---

## 8. Console

`dashboard/ASTRA-FCS-Dashboard.html` — a self-contained bilingual FR/EN page,
working offline on the embedded table and attaching to the HTTP transport
(`http://localhost:9003/mcp`) when one is available.

The console **recomputes the partial order in the browser** from the three
sub-criteria and reports whether it reproduces the eight published strata: it
demonstrates the rule instead of displaying a frozen result. Seven sections —
framework, strata (Hasse diagram, covering relation), class map (τ ranges on a
logarithmic axis, episode window marked), conformance, withdrawal (strand
console), negative heuristic (live linter), sources.

---

## 9. Tests

```bash
npm run test:fcs     # 69 FCS-layer tests
npm test             # full suite — 310 tests
```

The load-bearing test is `reproduces the eight published strata exactly`. It
recomputes the order by dominance and compares it to the strata of document IV
§3. That is the only way to know a transcription is right.

---

## 10. Apparatus

Every entry in `engine/fcs/references.ts` carries the source documents' **(v)**
mark: DOI resolved, at drafting or on 19 September 2026, against the DOI
Foundation Handle system or against Crossref metadata. ASTRA minted and
reconstructed no DOI; an entry the source documents do not carry does not appear
in the file.

Principal supports: Chiang et al. (2019) · Traynelis & Dingledine (1989) ·
Dudek et al. (1990) · Ding et al. (2016) · Dehaene & Changeux (2011) ·
Koch et al. (2016) · Casali et al. (2013) · Okasha (2011) · Craver (2007) ·
Baumgartner & Gebharter (2016) · Aru et al. (2012) · de Graaf et al. (2012).
