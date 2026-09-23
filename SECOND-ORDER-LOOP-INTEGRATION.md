# SECOND-ORDER LOOP INTEGRATION — ASTRA v2.9

**The self-evidencing layer: a system that observes and corrects its own predictive capacity.**

© 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
Upstream Python: © [tlcdv/the_consciousness_ai](https://github.com/tlcdv/the_consciousness_ai) · © [infer-actively/pymdp](https://github.com/infer-actively/pymdp)

---

## 1. Motivation

In the hybrid cybernetic pattern (Legros 2026, §3.2), the architecture is a **double loop**:

- **First-order (control) loop** — `perception → prediction → arbitration → ethics → action → substrate`. This regulates the substrate state toward targets. ASTRA v2.2 implements it fully.
- **Second-order (learning) loop** — the system *observes its own predictive capacity and corrects it*, satisfying the self-referential closure of von Foerster's second-order cybernetics and Friston's self-evidencing.

v2.2 already produced the **signal** of the second-order loop — the world-model surprise `‖ẑₜ₊₁ − zₜ₊₁‖` — but had **no update organ**: no layer regulating the model from that surprise, no epistemic-value (exploration) term, and no self-monitoring of learning. **v2.9 adds that organ.**

## 2. What was added

A native TypeScript module `src/engine/tcai/second-order.ts`, wired into the existing ACM cycle (`acm-bridge.ts`, step 8), exposing the second-order loop as part of **17 TCAI tools** (50 total), **1 resource** (11 total) and **1 prompt** (8 total).

| Sub-module | Upstream Python source | Role in the loop |
|---|---|---|
| `MetaLearningModule` | `self_representation_core.py → MetaLearningModule` | Learning velocity = `1 − var(RPE)_recent / var(RPE)_overall`; novelty spike when ratio > 2 |
| `CapabilityModel` | `self_representation_core.py → DirectExperienceLearner` | EMA action → expected-valence map ("what I can do") |
| `RNDCuriosity` | `core/rnd_curiosity.py` | Intrinsic reward = predictor/target error on the GNW broadcast = **EFE epistemic value** proxy (§4.1) |
| `MetaconsciousnessEvaluator` | `evaluation/metaconsciousness_evaluation.py` | Weighted composite over calibration, learning awareness, self-continuity, error monitoring |
| `DevelopmentTracker` | `evaluation/development_tracking.py` | Longitudinal stage (`nascent → reactive → integrative → reflective`) from composite-proxy trajectory |
| `SecondOrderLoop` | orchestrator | Combines the above into one self-evidencing pass per cycle |

## 3. Formal grounding

The native loop approximates the expected-free-energy (EFE) decomposition `G(π)` of §4.3:

```
G(π) =  −E[log p(o|C)]   +   KL[q(s|π) ‖ p(s)]     +   parameter information gain
        └ pragmatic ┘        └ epistemic (explore) ┘     └ learning drive (2nd order) ┘
```

- **pragmatic value** → shaped reward (`reward.totalReward`) feeding the capability model and RPE stream;
- **epistemic value** → `RNDCuriosity.intrinsicReward` (high on novel broadcasts, decaying as the predictor learns);
- **parameter information gain** → the learning-velocity signal (RPE-variance contraction), the explicit second-order self-monitoring.

## 4. Two integration tiers

### Étage A — production, native TypeScript (this release)

`src/engine/tcai/active-inference.ts` is an **exact discrete active-inference agent** computing the real variational free energy `F = E_q[−log p(o|s)] + KL[q(s)‖p(s)] = −log p(o)`, the expected free energy `G(π) = −pragmatic − epistemic`, and an online **Dirichlet update of the generative model (A, B)** — the genuine self-evidencing organ (the model rewrites itself from data, not telemetry). It is pure arithmetic (no autodiff), strict-mode clean, deterministic, and unit-tested for exactness (free energy falls as the model learns; EFE decomposition; adversarial halting). This is the quantity the halting criterion thresholds on, and it runs inside every `tcai_cycle`.

### Étage B — verified NumPy reference

`python/second_order/active_inference_loop.py` is a dependency-light NumPy implementation of the *same* mathematics, executed and numerically cross-checked against the TS core. The canonical `infer-actively/pymdp` inspired it, but the distributed pymdp is now the JAX rewrite whose batched/functional API drifts across releases; to keep the reference stable and executable it is implemented directly in NumPy (Da Costa et al. 2020). An optional pymdp adapter can be layered on a pinned version.

## 5. New MCP tools

| Tool | Input | Returns |
|---|---|---|
| `tcai_second_order` | — | full snapshot (meta-learning, curiosity, capability, meta-consciousness, development) |
| `tcai_meta_learning` | `rpe?` ∈ [−1,1] | learning velocity, RPE-variance ratio, novelty spike |
| `tcai_capability_model` | `action?` | expected valence for an action, or sorted capability table |
| `tcai_curiosity` | `embedding?` | intrinsic reward, raw/running error (defaults to current broadcast) |
| `tcai_metaconsciousness` | — | meta-representation composite ∈ [0,1] + components |
| `tcai_development` | — | developmental stage, level, stability, peak |

New resource: `astra://tcai/second-order`. New prompt: `tcai-second-order-loop`.

## 6. Worked example

```
tcai_reset
tcai_cycle  { cycles: 15, novelty: 0.8 }          # novel regime
tcai_meta_learning                                 # velocity ≈ 0, possibly noveltySpike
tcai_curiosity                                     # high intrinsic reward
tcai_cycle  { cycles: 15, rewardSignal: 0.7, novelty: 0.1 }   # familiar, rewarded
tcai_meta_learning                                 # velocity > 0 (converging)
tcai_curiosity                                     # intrinsic reward decayed
tcai_metaconsciousness                             # composite rises with calibration
tcai_development                                   # stage advances if stable
```

Expected dynamics: as the regime becomes familiar and rewarded, **learning velocity rises** (RPE variance contracts) and **curiosity falls** (predictor learns the broadcast) — the empirical signature of a functioning self-evidencing loop, exactly the epistemic→pragmatic shift of §4.3.

## 6.bis Halting criterion — stopping when the result is satisfactory (v2.9)

The recursive double loop terminates itself once the result is satisfactory. **v2.9 replaces the v2.4 heuristic criterion** (which thresholded RPE-variance, RND curiosity and proxy stability — all correlates of *input stationarity*, so a constant input falsely declared satisfaction) with a principled, two-pronged test built on the native active-inference core:

| Criterion | Default | Meaning |
|---|---|---|
| `|ΔF| ≤ epsFreeEnergy` | 0.02 nats | the **real** variational free energy F has settled — the model is no longer changing |
| `taskQuality ≥ minTaskQuality` | 0.6 | realized pragmatic value (externally grounded reward) is genuinely high — **not just stable** |
| `epistemic ≤ maxEpistemic` | 0.1 | expected information gain is exhausted |
| sustained for `patience` cycles | 3 | guards against a single lucky cycle |

Halting requires the loop to be **both settled AND good**. This dissociates stationarity from quality: a mediocre fixed point (F settled but low reward) is correctly **refused**. Thresholds are in meaningful units (nats; fraction of maximal preference), not arbitrary constants.

**Verified dissociation** (50-cycle cap, identical input, only the external reward differs):

```
GOOD     (reward +0.95): stoppedAt=6  | ΔF=0.07 taskQuality=1.00 satisfied=true
MEDIOCRE (reward −0.90): stoppedAt=-1 | ΔF=0.005 (F settled) taskQuality=0.00 satisfied=FALSE
```

The mediocre fixed point settles in free energy yet is never declared satisfactory — exactly the v2.4 failure mode now fixed.

**Usage.** `tcai_cycle` takes `stopWhenSatisfied: true` plus optional overrides (`epsFreeEnergy`, `minTaskQuality`, `maxEpistemic`, `satisfactionPatience`); it returns `stoppedEarly`, `stoppedAtCycle`, and the full `convergence` + `activeInference` state. `tcai_convergence` inspects/sets the criterion; `tcai_active_inference` exposes the real F, G(π) decomposition, pragmatic/epistemic values and model entropy.

## 6.ter v2.9 — substrate grounding, closed loop, equivalence, calibration

Four corrections from the v2.5 critique are materialised:

1. **Substrate grounding.** The active-inference observation is now a discretised *substrate* feature (`0.4·ignition + 0.3·syncR + 0.3·Φ̃`), not the reward. F is therefore the surprise of ASTRA's own dynamics. Task quality is a **separate, independent** external-reward channel (EMA), so quality and settledness are no longer the same signal re-bucketed.

2. **Closed actuation loop.** The AIF action (now 3 controls: decrease / hold / increase) drives an internal substrate `drive ∈[0,1]` that shifts the next cycle's observation — `action_t → drive → obs_{t+1}` — and is exported as a per-layer spike-injection `current[]` for the real SNN. Verified causal: open-loop freezes the drive at 0.5, closed-loop moves it and changes the observation distribution. Directed ε-greedy exploration (15%) lets the transition model B discover each control's effect. *Honest limitation:* in the self-contained simulation the substrate features are near-flat (observation often stays in bucket 0), so the loop is causal but cannot demonstrate substrate *optimisation* without the real SNN's ignition dynamics.

3. **TS↔NumPy equivalence in CI.** `tests/aif-equivalence.test.ts` asserts the TypeScript core reproduces the NumPy reference within 1e-9 on a fixed sequence (golden fixture `tests/fixtures/aif_golden.json`, regenerated by `npm run golden`, checked drift-free in CI by `npm run golden:check`). The earlier "numerically equivalent" claim is now an enforced test, not an assertion.

4. **Calibrated thresholds.** Convergence now uses a **scale-free** test `|ΔF| ≤ max(epsFreeEnergy, relFreeEnergy·F)` (default `relFreeEnergy=0.03`), removing dependence on a guessed absolute nats value. `tcai_calibrate` measures the ΔF scale over a warm-up window and sets `epsFreeEnergy` to a fraction of the median (measured median ΔF≈0.033 ⇒ eps≈0.017), replacing the v2.5 default 0.02.

New tool: `tcai_calibrate`. Updated: `tcai_convergence`/`tcai_cycle` gain `relFreeEnergy`; `tcai_cycle` gains `closedLoop`; `tcai_active_inference` surfaces `substrateObs`, `substrateDrive`, actuation.

## 6.quater v2.9 — real SNN closing, credit fix, robust golden:check

1. **Closed on a real LIF SNN.** The actuation no longer drives a flat scalar: the previous cycle's AIF action injects sustained current into a real spiking network (`SNNEngine`), whose firing rate (which responds monotonically to injection, ~59→102 Hz, verified) becomes the grounded observation via **adaptive range normalisation** (handling SNN drift/non-stationarity). The substrate now carries genuine, action-responsive spike signal — the contingency the v2.6 flat toy lacked.

2. **Temporal credit-assignment fix.** The transition `q(s_{t-1})→q(s_t)` is now credited to the action that *caused* it (`B[s_t, s_{t-1}, u_{t-1}]`), not the action just selected — a correctness bug present identically in the TS core and NumPy reference. Both were fixed and the golden regenerated; equivalence (1e-9) holds. With this fix plus annealed exploration, the closed-loop controller **learns to raise the substrate above the open-loop baseline** (aggregate over runs; verified test).

3. **`golden:check` robust outside git.** It no longer shells out to `git diff` (which fails from a tarball/zip); `gen_golden.py --check` regenerates in-memory and compares to the on-disk fixture, exiting non-zero on drift — works anywhere.

**Honest limitation.** The discrete 3-action controller raises the substrate above baseline *in aggregate*, but the margin is modest and run-to-run noisy (the LIF substrate is stochastic and mildly non-stationary); it is not a tuned optimal controller, and the actuation `current[]` is exported but not yet fed to the server's shared production SNN. The closed loop should be treated as functional-but-experimental.

## 6.quinquies v2.9 — continuous controller + production-SNN wiring

1. **Continuous active-inference controller.** The discrete 3-action drive policy (margin ~+0.18 in v2.7) is replaced by a `ContinuousActuationController`: it learns an online forward model of the substrate response `feature ≈ clamp(w0 + w1·drive)` (LMS) and selects the continuous drive d* ∈ [0,1] minimising expected free energy `G(d) = −pragmatic(d) − β·exp(−t/τ)·epistemic(d)`, where pragmatic(d) is the predicted feature (prefer high coherence) and epistemic(d) an annealed novelty term. Because the learned slope w1>0, it drives toward the preferred high-coherence region. The discrete `ActiveInferenceCore` is retained (exploration off) solely for the variational free energy F that gates halting, and for the golden/equivalence test.

2. **Production-SNN wiring.** `TCAIConsciousnessSystem.connectProductionSnn(snn)` lets the actuation drive the shared production network (the same `SNNEngine` the server's `snn_step` and `getStateForWM` use). Each cycle injects sustained current proportional to the drive into the production SNN, genuinely closing the loop on the deployed substrate (verified test: the production SNN's firing rate moves from its untouched baseline).

**Measured margin (12 runs, last-50 steady-state, identical input).**
```
closed obs ≈ 2.00 (drive → 1.00)   open obs ≈ 1.00   Δ ≈ +1.00   wins 12/12
```
≈ 5.5× the discrete controller's +0.18, robust across all runs.

**Honest limitation.** The forward model is linear-in-drive (adequate for the monotone firing response, but not a general controller); the substrate feature remains a synthetic SNN-firing proxy, so this demonstrates *control of a real spiking substrate*, not validated wetware actuation. The §6 calibration gap is unchanged.

## 6.sexies v2.9 — non-degenerate regulation, real production loop, explicit roles

Addresses the three v2.8 critiques:

1. **Non-degenerate objective (setpoint regulation).** The v2.8 controller maximised a monotone preference over a monotone map ⇒ trivial boundary optimum (drive→1). v2.9 makes the controller a **homeostatic regulator**: it minimises `G(d) = −pragmatic(d) − β·exp(−t/τ)·epistemic(d) + λ·d²` with `pragmatic(d) = −((featurê(d) − setpoint)/width)²` peaked at a configurable **setpoint** plus a drive cost λ. The optimum is now **interior** — verified: default setpoint 0.3 settles at drive ≈0.44 (not the boundary), and the realised feature **tracks** the setpoint (setpoint 0.2 ⇒ drive ≈0.23; 0.45 ⇒ ≈0.76). This is genuine regulation where the EFE terms balance, not ramp-to-max.

2. **Real production loop (read + write, flagged).** `setProductionLoop(true)` routes the closed loop THROUGH the shared production SNN: the actuation injects current (write) AND the loop's observation is read from that same network's firing rate (read) — the loop genuinely closes on the deployed substrate (verified: production SNN driven to ~81 Hz and regulated). It is **off by default**, so the cycle never contends with the server's `snn_step`; the v2.8 write-only fire-and-forget injection is removed.

3. **Explicit division of labour.** The discrete `ActiveInferenceCore` is documented and surfaced as PERCEPTION (it supplies the variational free energy F that gates halting, and the TS↔NumPy golden); the `ContinuousActuationController` is CONTROL (it supplies the actuation). Both observe the same substrate feature; the controller's forward-model surprise is exposed as `controllerModelError` and its target as `controllerSetpoint`.

New `tcai_cycle` params: `setpoint`, `productionLoop`. Telemetry adds `controllerSetpoint`, `predictedFeature`, `controllerModelError`.

**Honest limitation.** The forward model is still linear-in-drive; the substrate feature is a synthetic SNN-firing proxy (driving a LIF network faster is not validated "coherence"); and the §6 calibration gap is unchanged. This demonstrates principled regulation of a real spiking substrate, not validated wetware control.

## 7. Epistemological caveat

Consistent with §6 of the paper: `MetaLearningModule` and `MetaconsciousnessEvaluator` produce indicators of **regularity-of-learning** and **meta-representation capacity**, not of meta-consciousness. Every tool returns the standard `PROXY_DISCLAIMER`. These are research heuristics, not measurements of subjective experience.

## 8. Tests

`tests/second-order.test.ts` — 28 tests (active-inference exactness, adversarial halting, meta-learning convergence/novelty, capability EMA, curiosity familiarity decay + determinism, meta-consciousness monotonicity, development staging, full-cycle integration, reset). Full suite: **229/229 passing**, 0 TypeScript errors (strict, Node16 ESM).
