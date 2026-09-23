# ASTRA v2.2 × the_consciousness_ai — Integration Guide
## Guide d'intégration · 2026

**ASTRA Unified ResearchLab MCP** now integrates **[tlcdv/the_consciousness_ai](https://github.com/tlcdv/the_consciousness_ai)** (ACM — Artificial Consciousness Module) at two levels:

1. **Native TypeScript port** of the core ACM algorithms, running live inside the MCP server (`src/engine/tcai/`), fed by the ASTRA SNN/sensor/world-model state.
2. **Full vendored Python codebase** (215 files, ~38 600 lines) under `python/the_consciousness_ai/`, for reference, research reproduction and PyTorch-based experiments.

> ⚠ **Disclaimer.** All metrics (Φ̃-RIIU, GNW ignition, Effective Information, qualia vectors) are computational **proxies** inspired by GNW/IIT/PAD frameworks. They are research heuristics, **not measurements of consciousness**. This mirrors and extends the disclaimer policy of the existing `acm.ts` module.

---

## 1. Python → TypeScript mapping

| Upstream Python (vendored) | TypeScript port | Algorithmic content preserved |
|---|---|---|
| `models/core/global_workspace.py` | `src/engine/tcai/global-workspace.ts` | GNW competition · sigmoid ignition · recurrent reverberation (α) · winner-take-all & attention-weighted (softmax) broadcast · unity metrics |
| `models/core/oscillatory_binding.py` | `src/engine/tcai/oscillatory-binding.ts` | Kuramoto layer (AKOrN, ICLR 2025) · order parameter R · pairwise coherence · coherence-gated bids (`bind_bids`) |
| `models/core/qualia_mapper.py` | `src/engine/tcai/global-workspace.ts` (`PhenomenologicalMapper`) | [Intensity, Valence, Complexity] mapping (norm · goal-cosine · spectral entropy) |
| `models/core/consciousness_gating.py` | folded into `global-workspace.ts` | Sigmoid gate · threshold modulation · episode reset |
| `models/emotion/emotional_processing.py` | `src/engine/tcai/emotion.ts` (`EmotionalProcessor`) | PAD appraisal (reward/novelty/threat/controllability) with EMA inertia |
| `models/emotion/reward_shaping.py` | `src/engine/tcai/emotion.ts` (`EmotionalRewardShaper`) | R = R_base + λₑ·R_emo + λₘ·R_mem · stability damping · `RewardMetrics` history |
| `models/emotion/affective_modulator.py` | `global-workspace.ts` (affective hook) | Arousal sharpens bids; negative valence lowers ignition threshold (alarm bias) |
| `models/memory/emotional_memory_core.py` | `src/engine/tcai/emotional-memory.ts` | Attention-gated `store` · blended `retrieve` (cosine + PAD congruence + salience) · `retrieve_batch_for_rl` (salience-weighted sampling) |
| `models/memory/emotional_indexing.py` | `emotional-memory.ts` (salience) | Salience = f(\|valence\|, arousal, attention) |
| `models/memory/optimized_store.py` | `emotional-memory.ts` (eviction) | Capacity bound · lowest-salience-first eviction |
| `models/memory/attention_schema.py` | `src/engine/tcai/self-model.ts` (`AttentionSchema`) | Graziano AST: focus target, intensity, stability trace |
| `models/self_model/self_representation_core.py` | `src/engine/tcai/self-model.ts` | Interoception (energy/stress/effort) · epistemic model (uncertainty, learning progress) · temporal continuity · confidence calibration · performance EMA |
| `models/evaluation/gnw_metrics.py` | `src/engine/tcai/metrics.ts` (`GNWMetrics`) | Ignition events/rate · broadcast availability · reuse events |
| `models/evaluation/effective_information.py` | `metrics.ts` (`computeEffectiveInformation`) | TPM from discretized trajectories · EI = H(⟨row⟩) − ⟨H(row)⟩ (Hoel) |
| `models/evaluation/phi_riiu.py` | `metrics.ts` (`RIIUPhi`) | Sliding latent buffer · Φ̃ = covariance integration ratio (analytical surrogate for the learned low-rank `AutoPhiSurrogate`) |
| `models/core/consciousness_core.py` (orchestration) | `src/engine/tcai/acm-bridge.ts` (`TCAIConsciousnessSystem`) | Full loop: specialists → binding → ignition → broadcast → qualia → emotion → reward → memory → self → metrics |

**Substitutions (no GPU/PyTorch in the Node runtime):** LLaMA 3.3-based emotion fine-tuning → analytical PAD appraisal; learned Φ surrogate → covariance integration ratio; tensor payload fusion → vector softmax fusion. The original implementations remain fully available in `python/the_consciousness_ai/` (use `requirements.txt` there).

## 2. New MCP surface (v2.2.0 — 32 tools · 9 resources · 6 prompts)

| Tool | Description |
|---|---|
| `tcai_cycle` | Full ACM cycle (1–50×) fed from live SNN layer firing rates; accepts reward/novelty/threat/WM-surprise inputs |
| `tcai_workspace_state` | GNW state: ignition, focus, qualia, sync R, unity metrics |
| `tcai_emotion_appraise` | PAD appraisal of raw signals with inertia |
| `tcai_memory_store` / `tcai_memory_retrieve` | Emotional memory write/read |
| `tcai_self_model` | Self-representation + attention schema |
| `tcai_metrics` | GNW · EI · Φ̃-RIIU composite report |
| `tcai_reset` | Reset all TCAI subsystems |

Resource `astra://tcai/state` · Prompt `tcai-consciousness-cycle` (guided experiment).

## 3. Architecture coupling with ASTRA

```
SNN LIF+STDP layers ──firing rates──► specialists (vision/audio/memory/body/semantic)
World Model (LeWM) ──surprise──────► novelty / predictionError appraisal
                                     │
                              AKOrN Kuramoto binding (sync R)
                                     │
                              GNW sigmoid ignition ──► broadcast (softmax fusion)
                                     │                        │
                              qualia [I,V,C]          Φ̃-RIIU buffer · EI trajectory
                                     │
        PAD appraisal ──► reward shaping ──► emotional memory (attention-gated)
                                     │
                              self-model update (interoception · epistemics · continuity)
                                     │
                         existing ACM proxies (acm.ts) — complementary composite
```

## 4. Validation

- `npm run build` — 0 TypeScript errors (strict, Node16 ESM)
- `npm test` — **166/166 passing** (144 legacy + 22 TCAI)
- `npm run test:tcai` — TCAI suite only (binding, GNW, memory, emotion, self-model, metrics, full cycle)

---
© 2026 Christophe Jean Legros — Genève · Assistance Multi IA · Assistant-Multi-AI@proton.me
Upstream ACM: © tlcdv/the_consciousness_ai (vendored under `python/`, see its repository for license terms).
