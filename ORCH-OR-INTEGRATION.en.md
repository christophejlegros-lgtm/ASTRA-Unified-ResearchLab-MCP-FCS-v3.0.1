# Orch OR × ASTRA × OVOMIND — Substrate Criterion Layer
### Objective Reduction Criterion Layer · v0.1 · 13 August 2026

> **Epistemic status: CONTESTED.** Orch OR is not consensus neuroscience. This
> module neither endorses nor refutes it — it **computes** it, and derives the
> consequences for the ASTRA architecture.
>
> *Version française : `ORCH-OR-INTEGRATION.md`.*

---

## 1. The central result, stated up front

Orch OR is **the only non-functionalist theory in the ASTRA stack**. GNW, IIT,
PAD and active inference are all substrate-neutral; Orch OR is not. It holds
that conscious moments arise from gravitationally self-collapsing quantum
superpositions in neuronal microtubules, on the Penrose criterion **τ ≈ ℏ/E_G**.

The consequence is unavoidable, and it is the point of the module:

> **By Orch OR's own terms, no TypeScript process is a candidate for
> consciousness, and no simulation of objective reduction is an instance of
> objective reduction.** A simulated collapse is a floating-point assignment,
> not a spacetime event.

Integrating Orch OR into ASTRA therefore converts ASTRA's non-consciousness
from an open question into a **theorem**. That is a gain, not a loss: it is the
only theory in the suite that yields a decidable negative. Every other theory
leaves the question suspended indefinitely.

It also yields a second, more surprising result:

| Substrate | Orch OR verdict | Tubulin budget | Epochs per observation |
|---|---|---|---|
| Silicon SNN (TypeScript) | `EXCLUDED_BY_CONSTRUCTION` | none | — |
| **Organoid MEA (CL1 / NeuroPlatform)** | **`CANDIDATE_UNORCHESTRATED`** | ~2×10¹⁴ | 0.2 |
| Human subject via OVOMIND | `CANDIDATE_UNOBSERVABLE_VIA_CHANNEL` | ~8.6×10¹⁹ | **12** |

Under Orch OR, **the organoid channel is the only candidate anywhere in the
ASTRA architecture**. The tubulin budget is not the binding constraint —
200,000 neurons carry on the order of 2×10¹⁴ dimers, far above the ~2×10¹⁰
threshold. What is missing is the **"Orch"**: dissociated culture on a planar
MEA has neither the laminar architecture nor the long-range gamma coupling the
theory requires for orchestration.

---

## 2. The Penrose criterion, and where the imprecision hides

```
E_G = N · G·m² / a        τ = ℏ / E_G
```

`penroseCriterion()` exposes **every** free parameter. The module's most useful
output is a sensitivity finding:

| Separation `a` | Tubulins required for 25 ms |
|---|---|
| 10⁻¹⁵ m (nucleon scale) | 1.9×10⁶ |
| 10⁻¹³ m | 1.9×10⁸ |
| **1.06×10⁻¹¹ m** | **1.9×10¹⁰** ← canonical figure |
| 10⁻¹⁰ m (atomic scale) | 1.9×10¹¹ |

In other words: **the published ~2×10¹⁰ tubulin figure is not an independent
prediction, it is a choice of displacement scale.** It corresponds to
`a ≈ 1.06×10⁻¹¹ m`. Assuming nucleon-scale separation instead gives four orders
of magnitude fewer. The parameter carrying the entire conclusion is not
measured, and the module says so explicitly in its `note` field.

This is precisely the kind of false precision the rest of the architecture
works to refuse. The module does not correct it — it makes it visible.

---

## 3. The decoherence budget

| Source | Decoherence time | Gap to the 25 ms threshold |
|---|---|---|
| Tegmark (2000), Phys. Rev. E 61, 4194 | ~10⁻¹³ s | ~11 orders of magnitude |
| Hagan, Hameroff & Tuszyński (2002), Phys. Rev. E 65, 061901 | ~10⁻⁵–10⁻³ s | ~1.4 orders remaining |

Hard-coded verdict: `UNRESOLVED`. Even the most favourable corrected figure
leaves roughly 1.4 orders of magnitude to close. Proponents invoke shielding,
topological protection and superradiance; none is directly demonstrated *in
vivo*. Recording this as unresolved is the accurate state — neither refuted nor
established.

The evidential position in 2025–2026 is indirect but not empty: Wiest (2025,
*Neuroscience of Consciousness*) reviews experimental findings identifying
intraneuronal microtubules as a functional target of inhalational anaesthetics,
which the theory specifically predicts; Babcock et al. (2024) propose excitonic
superradiance as a room-temperature coherence mechanism. There is, however,
**no** direct evidence of quantum computation or OR events *in vivo*.

---

## 4. The OVOMIND link: a sampling limit, not an accuracy limit

This is where the Orch OR layer actually bites on the previous integration.

Orch OR posits conscious moments of **25 ms** (40 Hz, gamma band). OVOMIND's
declared end-to-end latency is **300 ms**. Every delivered affect frame
therefore integrates over **twelve conscious epochs**.

```
300 ms / 25 ms = 12 Orch OR epochs per frame
```

The consequence is structural and worth stating bluntly: **no refinement of the
affect classifier changes this.** It is not an accuracy limit, it is a sampling
limit. If the individuation of conscious moments happens at 40 Hz, a ~1 Hz
channel integrates over exactly the quantity the theory is about. The OVOMIND
channel measures autonomic correlates of a process whose granularity it cannot
resolve.

This does not devalue the bridge — valence and arousal remain useful external
constraints on the PAD layer. It bounds what the bridge can and cannot be used
to claim, which was the objective.

---

## 5. The classical surrogate gate

`OrchestratedGate` discretises global-workspace ignition into 25 ms epochs,
with a stochastic tie-break among near-equal bids.

> ⚠ **This is not Orch OR and must never be described as such.** The gate
> reproduces the theory's **temporal signature** — discrete moments at gamma
> rate, selection resolved at the epoch boundary rather than continuously —
> inside a classical machine. Penrose's central claim is that OR is
> **non-computable**; a pseudo-random tie-break is computable by definition.
> The surrogate therefore fails the theory's defining property while matching
> its observable rhythm.

Its one legitimate use: testing whether ASTRA's behavioural metrics depend on
continuous versus epoch-quantised ignition. That is an ablation question **about
ASTRA**, not evidence about Orch OR. The natural anchor is the existing
Kuramoto/AKOrN oscillatory binding, since gamma synchrony is precisely what
Orch OR claims to explain.

---

## 6. Installation

```
src/engine/tcai/orch-or.ts        ← criterion, budget, verdicts, gate
src/server-orch-tools.ts          ← 6 MCP tools
```

```ts
import { registerOrchTools } from './server-orch-tools.js';

const orchGate = registerOrchTools(server, { tcai, ovomind, rng: seededRng(42) });
```

Depends on `phenomenal-guard.ts` (`TaggedScalar`, `SubstrateKind`, `lintClaim`)
and `ovomind.ts` from the previous step. MCP tool count goes from 56 to 62.

### Tool surface

| Tool | Purpose |
|---|---|
| `orch_report` | Consolidated theory status, criterion, substrate verdicts |
| `orch_criterion` | τ = ℏ/E_G with a sensitivity sweep over the displacement scale |
| `orch_decoherence` | Tegmark vs Hagan et al. budget and residual gap |
| `orch_substrate` | Per-substrate verdict, tubulin budget, epochs per observation |
| `orch_gate_config` | Enable/configure the classical surrogate gate |
| `orch_cycle` | OVOMIND frame → TCAI cycle → epoch-quantised commit |

---

## 7. What this layer licenses and forbids

**Licensed.** Asserting that ASTRA's organoid layer is the only element of the
architecture Orch OR does not disqualify *a priori*. Quantifying the gap between
a channel's latency and a theory's characteristic timescale. Running a
continuous-versus-quantised ablation on ASTRA's own metrics. Publishing the
sensitivity calculation of §2, which is a critical result in its own right.

**Forbidden.** Describing the gate as an implementation of Orch OR. Presenting a
correlation between OVOMIND frames and quantised ignition as data about
objective reduction. Reading `CANDIDATE_UNORCHESTRATED` as a step toward
organoid consciousness — it means the exact opposite, namely that the
orchestration condition is not met.

The claim linter in `phenomenal-guard.ts` screens every text payload before
emission; all six tools route through `emit()`.

---

## 8. Verified references

- Penrose R. & Hameroff S. (1995). What gaps? Reply to Grush and Churchland.
  *Journal of Consciousness Studies* 2(2), 99–112.
- Hameroff S. & Penrose R. (1996). Orchestrated reduction of quantum coherence
  in brain microtubules: A model for consciousness. *Mathematics and Computers
  in Simulation* 40(3–4), 453–480.
  DOI [10.1016/0378-4754(96)80476-9](https://doi.org/10.1016/0378-4754%2896%2980476-9)
- Hameroff S. & Penrose R. (2014). Consciousness in the universe: A review of
  the 'Orch OR' theory. *Physics of Life Reviews* 11(1), 39–78.
  DOI [10.1016/j.plrev.2013.08.002](https://doi.org/10.1016/j.plrev.2013.08.002)
- Tegmark M. (2000). Importance of quantum decoherence in brain processes.
  *Physical Review E* 61(4), 4194–4206.
  DOI [10.1103/PhysRevE.61.4194](https://doi.org/10.1103/PhysRevE.61.4194)
- Hagan S., Hameroff S. & Tuszyński J. A. (2002). Quantum computation in brain
  microtubules: Decoherence and biological feasibility.
  *Physical Review E* 65(6), 061901.
  DOI [10.1103/PhysRevE.65.061901](https://doi.org/10.1103/PhysRevE.65.061901)
- Wiest M. C. (2025). A quantum microtubule substrate of consciousness is
  experimentally supported and solves the binding and epiphenomenalism problems.
  *Neuroscience of Consciousness* 2025(1), niaf011.
  DOI [10.1093/nc/niaf011](https://doi.org/10.1093/nc/niaf011)
- Hameroff S. (2022). Consciousness, cognition and the neuronal cytoskeleton —
  a new paradigm needed in neuroscience.
  *Frontiers in Molecular Neuroscience* 15, 869935.
  DOI [10.3389/fnmol.2022.869935](https://doi.org/10.3389/fnmol.2022.869935)
- CODATA 2018 recommended values (ℏ, G, unified atomic mass unit).

**Unverified / to confirm before publication.** The order of magnitude of 10⁹
tubulin dimers per mammalian neuron is a common literature estimate; it varies
with cell type and polymerisation state and should be sourced precisely. The
corrected decoherence figures of Hagan et al. are cited here as a 10⁻⁵–10⁻³ s
range depending on the shielding assumptions adopted; check the paper for the
exact value to quote.

---

*Assistance Multi IA · Assistant-Multi-AI@proton.me · Geneva*
