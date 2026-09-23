# ASTRA World Model — JEPA Integration Guide

## Overview

The ASTRA World Model implements a **Joint-Embedding Predictive Architecture (JEPA)** adapted from [LeWorldModel](https://le-wm.github.io/) (Maes, Le Lidec, Scieur, LeCun, Balestriero 2026) for neuromorphic SNN dynamics prediction and planning.

Where LeWM operates on raw pixel observations from robotic environments, ASTRA-WM operates on **structured SNN state vectors** (membrane potentials, firing rates, synaptic weight statistics, bio-platform coupling factors), predicting neurodynamic state transitions conditioned on spike injection actions.

```
                            ┌─────────────────────────────────────────┐
                            │          ASTRA World Model (JEPA)       │
                            │                                         │
  SNN State s_t ──────────► │  Encoder: z_t = enc(s_t)                │
                            │     │                                   │
  Spike Action a_t ───────► │  Predictor: ẑ_{t+1} = pred(z_t, a_t)   │
                            │     │                                   │
                            │  SIGReg: λ · Reg(Z) → anti-collapse     │
                            │     │                                   │
  Goal State s_goal ──────► │  CEM Planner: argmin_a d(ẑ_H, z_goal)  │
                            │     │                                   │
                            │  Surprise: ‖ẑ_{t+1} - z_{t+1}‖        │
                            └──────────────┬──────────────────────────┘
                                           │
                    ┌──────────────────────┼───────────────────────────┐
                    ▼                      ▼                          ▼
              6 MCP Tools          2 MCP Resources             1 MCP Prompt
             wm_encode             astra://wm/latent          wm-experiment
             wm_predict            astra://wm/predictions
             wm_plan
             wm_surprise
             wm_train_step
             wm_status
```

---

## Architecture

### Adaptation from LeWM

| LeWM (Pixels)                      | ASTRA-WM (Neuromorphic)                              |
|-------------------------------------|-------------------------------------------------------|
| ViT encoder (pixel patches → CLS)  | 2-layer MLP encoder (SNN state vector → latent z)     |
| 192-dim latent CLS token            | 64-dim latent embedding                               |
| Transformer predictor + AdaLN-zero  | MLP predictor + additive action modulation            |
| Pixel observations (images)         | SNN state: V_m, firing rates, weight stats, bio-coupling |
| Robot actions (joint torques)       | Spike injection actions (targets, strengths, duration) |
| SIGReg regularizer (λ=1 HP)        | SIGReg regularizer (λ=0.1, adapted scale)             |
| CEM planning (48× faster than DINO-WM) | CEM planning for optimal spike injection strategy |
| Violation-of-expectation (physics)  | Violation-of-expectation (neurodynamics)              |

### Key Components

**SNNStateEncoder** (`src/engine/world-model.ts`)
Maps the SNN observation vector (148-dim: 128 membrane potentials + 4×3 weight stats + 4 bio-coupling) to a compact 64-dimensional latent embedding via a 2-layer MLP with LayerNorm and GELU activation.

**LatentPredictor** (`src/engine/world-model.ts`)
Predicts next-state latent embeddings conditioned on spike injection actions. Uses additive modulation inspired by LeWM's AdaLN-zero mechanism: the action embedding shifts the hidden representation before projection.

**SIGReg** (`src/engine/world-model.ts`)
Sketch Isotropic Gaussian Regularizer — the single-hyperparameter (λ) anti-collapse mechanism from LeJEPA/LeWM. Tests whether random 1D projections of the embedding batch match a standard Gaussian characteristic function via the Epps-Pulley statistic. This replaces the complex 6-hyperparameter losses used by prior JEPA methods.

**CEMPlanner** (`src/engine/world-model.ts`)
Cross-Entropy Method planner operating entirely in latent space. Samples candidate action sequences, rolls them out through the predictor, selects elites closest to the goal embedding, and refits the sampling distribution. Produces an optimal spike injection sequence to drive the SNN toward a target state.

**Surprise Detector** (`src/engine/world-model.ts`)
Implements the violation-of-expectation paradigm from LeWM §4.3. Computes normalized prediction error to detect neurodynamically implausible SNN state transitions — useful for anomaly detection, bio-platform fault monitoring, and consciousness-proxy validation.

### Training Objective

The complete ASTRA-WM training objective is:

```
L_ASTRA-WM = L_pred + λ · SIGReg(Z)
```

Where:
- `L_pred = MSE(ẑ_{t+1}, z_{t+1})` — latent prediction loss
- `SIGReg(Z)` — Gaussian regularizer on the embedding batch
- `λ = 0.1` — single tunable hyperparameter (LeWM default is also a single λ)

This reduces hyperparameter tuning from 6 (in prior JEPA methods) to **1**.

---

## MCP Tools (6 new → 18 total)

| Tool | Title | Annotations | Description |
|---|---|---|---|
| `wm_encode` | Encode SNN State | 📖 read-only | Encode current SNN state into latent space |
| `wm_predict` | Predict Next State | 📖 read-only | Multi-step latent rollout conditioned on action |
| `wm_plan` | CEM Latent Planning | ✏️ mutating | Plan optimal spike injection sequence to goal |
| `wm_surprise` | Surprise Detection | 📖 read-only | Violation-of-expectation score for transitions |
| `wm_train_step` | Online Training | ✏️ mutating | One SGD step with prediction + SIGReg loss |
| `wm_status` | WM Status Report | 📖 read-only | Architecture, training metrics, latent health |

## MCP Resources (2 new → 7 total)

| URI | Description |
|---|---|
| `astra://wm/latent` | Current latent embedding and distribution statistics |
| `astra://wm/predictions` | Prediction history, accuracy, and surprise scores |

## MCP Prompts (1 new → 4 total)

| Prompt | Description |
|---|---|
| `wm-experiment` | Full workflow: encode → predict → train → plan → surprise → status |

---

## Integration with Existing ASTRA Modules

### ACM Enhancement

The World Model latent space provides a richer substrate for consciousness proxy computation:

- **Φ̃ (Integration Proxy):** Latent variance serves as an additional integration metric — collapsed latent space (variance → 0) indicates loss of information integration.
- **GW̃ (Broadcast Proxy):** Prediction accuracy across layers indicates how well information is globally broadcast in the network dynamics model.
- **PAD̃ (Arousal Proxy):** Surprise scores from the world model correlate with arousal — unexpected transitions suggest heightened neural "arousal."

### Ethics Monitor Enhancement

- **Anomaly Detection:** The surprise detector provides early warning of abnormal SNN dynamics that may indicate bio-platform welfare issues (in `live` mode).
- **Proactive Safety:** CEM planning can identify action sequences that would drive the SNN into stress/distress biomarker ranges, enabling preemptive intervention.

### SNN Engine Synergy

- The World Model trains on actual SNN state transitions, building an increasingly accurate dynamics model.
- Planning results can be fed back as suggested spike injections for the SNN engine.
- The encoder provides a dimensionality-reduced representation useful for monitoring and visualization.

---

## Usage

### Server Integration

In `src/server.ts`, after existing tool registration:

```typescript
import { registerWorldModelCapabilities } from './server-wm-tools.js';

// After existing 12 tools are registered:
const worldModel = registerWorldModelCapabilities(server, () => astraState);
```

### Testing

```bash
# World Model tests only
node --import tsx --test tests/world-model.test.ts

# Full suite (existing + WM)
npm test
```

### Example: Claude Desktop Interaction

```
User: Run the wm-experiment prompt

Claude: [Executes workflow]
1. Encoded SNN state → 64-dim latent (confidence: 0.87)
2. Predicted 3-step rollout with spike injection [10,11,12] @ 15mV
3. Training step: L_pred=0.0234, SIGReg=0.0089, L_total=0.0243
4. CEM plan converged in 6 iterations (goal distance: 0.032)
5. Surprise score: 0.42 (EXPECTED — consistent with learned dynamics)
6. Latent space: HEALTHY (variance=0.89, no collapse risk)
```

---

## Configuration

All World Model parameters are configurable via `WorldModelConfig`:

| Parameter | Default | Description |
|---|---|---|
| `observationDim` | 148 | SNN state vector dimensionality |
| `latentDim` | 64 | Latent embedding dimensionality |
| `hiddenDim` | 128 | MLP hidden width |
| `actionDim` | 16 | Action embedding size |
| `sigregLambda` | 0.1 | SIGReg regularization strength (λ) |
| `sigregProjections` | 256 | Number of random projections |
| `sigregKnots` | 17 | CF evaluation points |
| `cemPopulation` | 64 | CEM candidate count |
| `cemEliteFraction` | 0.2 | Top fraction selected as elites |
| `cemMaxIter` | 10 | Maximum CEM iterations |
| `cemThreshold` | 0.05 | Convergence threshold |
| `planningHorizon` | 8 | Steps to plan ahead |
| `learningRate` | 0.001 | Online SGD learning rate |
| `historySize` | 128 | Embedding buffer for SIGReg batch |

---

## References

- Maes, Le Lidec, Scieur, LeCun, Balestriero (2026) "LeWorldModel: Stable End-to-End JEPA from Pixels" — [arXiv](https://arxiv.org/pdf/2603.19312v1)
- Maes et al. (2025) "LeJEPA" — [arXiv:2511.08544](https://arxiv.org/abs/2511.08544)
- LeCun (2022) "A Path Towards Autonomous Machine Intelligence" — [paper](https://openreview.net/pdf?id=BZ5a1r-kVsf)

---

© 2026 Christophe Jean Legros — Geneva · **Assistance Multi IA**
