/**
 * ASTRA World Model — MCP Server Integration
 * ============================================
 *
 * Registers World Model tools, resources, and prompts into the ASTRA MCP server.
 * This file extends the existing server.ts with 6 new tools, 2 resources, and 1 prompt.
 *
 * Integration pattern: call registerWorldModelCapabilities(server, state) from server.ts
 * after the existing 12 tools are registered.
 *
 * © 2026 Christophe Jean Legros — Geneva
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  WorldModelEngine,
  type SNNObservation,
  type SpikeAction,
  type WorldModelConfig,

} from './engine/world-model.js';

// ─── Zod Schemas for Tool Inputs ────────────────────────────────────────────

const SpikeActionSchema = z.object({
  targetNeurons: z.array(z.number().int().min(0)).describe('Target neuron indices'),
  strengths: z.array(z.number()).describe('Injection strengths [mV]'),
  duration: z.number().int().min(1).default(1).describe('Duration in timesteps'),
});

const GoalStateSchema = z.object({
  firingRateTarget: z.array(z.number().min(0)).optional().describe('Target firing rates per layer [Hz]'),
  acmTarget: z.number().min(0).max(1).optional().describe('Target ACM composite score'),
  description: z.string().optional().describe('Natural-language description of goal state'),
});

// ─── State Bridge ───────────────────────────────────────────────────────────

/**
 * Bridge between ASTRA's reactive state store and the World Model observation format.
 * Call this to extract an SNNObservation from the current ASTRA state.
 */
export function extractObservation(state: any): SNNObservation {
  const snn = state.snn ?? {};
  const platforms = state.platforms ?? {};
  const neuronCount = snn.neuronCount ?? 128;

  // Extract membrane potentials (or default resting state)
  const membranes = new Float64Array(neuronCount);
  if (snn.neurons) {
    for (let i = 0; i < Math.min(neuronCount, snn.neurons.length); i++) {
      membranes[i] = snn.neurons[i]?.voltage ?? -70;
    }
  } else {
    membranes.fill(-70); // Resting potential
  }

  // Extract firing rates per layer
  const layerSizes = snn.layerSizes ?? [32, 64, 16, 16];
  const firingRates = new Float64Array(layerSizes.length);
  if (snn.layerMetrics) {
    for (let l = 0; l < layerSizes.length; l++) {
      firingRates[l] = snn.layerMetrics[l]?.firingRate ?? 0;
    }
  }

  // Extract weight statistics [mean, std, sparsity] per layer
  const weightStats = new Float64Array(layerSizes.length * 3);
  if (snn.weightStats) {
    for (let l = 0; l < layerSizes.length; l++) {
      const ws = snn.weightStats[l] ?? {};
      weightStats[l * 3] = ws.mean ?? 0.5;
      weightStats[l * 3 + 1] = ws.std ?? 0.1;
      weightStats[l * 3 + 2] = ws.sparsity ?? 0.7;
    }
  }

  // Bio-coupling factors
  const bioCoupling = new Float64Array(4);
  const platformNames = ['finalspark', 'corticalLabs', 'koniku', 'loihi2'];
  platformNames.forEach((name, i) => {
    bioCoupling[i] = platforms[name]?.coupling ?? 0;
  });

  return {
    membranePotentials: membranes,
    firingRates,
    weightStats,
    bioCoupling,
    timestep: snn.timestep ?? 0,
  };
}

/**
 * Construct a synthetic goal observation from target parameters.
 */
function buildGoalObservation(
  currentObs: SNNObservation,
  goal: { firingRateTarget?: number[]; acmTarget?: number },
): SNNObservation {
  const goalObs: SNNObservation = {
    membranePotentials: new Float64Array(currentObs.membranePotentials),
    firingRates: new Float64Array(currentObs.firingRates),
    weightStats: new Float64Array(currentObs.weightStats),
    bioCoupling: new Float64Array(currentObs.bioCoupling),
    timestep: currentObs.timestep + 1,
  };

  if (goal.firingRateTarget) {
    for (let i = 0; i < Math.min(goalObs.firingRates.length, goal.firingRateTarget.length); i++) {
      goalObs.firingRates[i] = goal.firingRateTarget[i];
    }
  }

  if (goal.acmTarget !== undefined) {
    // Translate ACM target to approximate firing rates
    // Higher ACM → more coordinated, moderate firing rates (~25-35 Hz)
    const targetRate = 15 + goal.acmTarget * 25;
    goalObs.firingRates.fill(targetRate);
    // Adjust membrane potentials toward threshold
    const targetV = -70 + goal.acmTarget * 15; // Closer to -55mV threshold
    goalObs.membranePotentials.fill(targetV);
  }

  return goalObs;
}

// ─── Registration Function ──────────────────────────────────────────────────

/**
 * Register all World Model MCP capabilities on an existing ASTRA server.
 *
 * Usage in server.ts:
 *   import { registerWorldModelCapabilities } from './server-wm-tools.js';
 *   registerWorldModelCapabilities(server, astraState);
 */
export function registerWorldModelCapabilities(
  server: McpServer,
  getState: () => any,
  wmConfig: Partial<WorldModelConfig> = {},
): WorldModelEngine {

  const wm = new WorldModelEngine(wmConfig);

  // ─── Tool 1: wm_encode ────────────────────────────────────────────────

  server.tool(
    'wm_encode',
    'Encode SNN State to Latent Space',
    {},
    async () => {
      const state = getState();
      const obs = extractObservation(state);
      const embedding = wm.encode(obs);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            tool: 'wm_encode',
            title: 'World Model — Latent Encoding',
            embedding: {
              z: Array.from(embedding.z).map(v => Math.round(v * 1e4) / 1e4),
              dimensionality: embedding.z.length,
              timestep: embedding.timestep,
              confidence: Math.round(embedding.confidence * 1e4) / 1e4,
              norm: Math.round(Math.sqrt(embedding.z.reduce((s, v) => s + v * v, 0)) * 1e4) / 1e4,
            },
            latentSpaceHealth: {
              variance: Math.round(wm.getMetrics().latentVariance * 1e4) / 1e4,
              drift: Math.round(wm.getMetrics().latentDrift * 1e4) / 1e4,
              historySize: wm.getEmbeddingHistory().length,
              collapseRisk: wm.getMetrics().latentVariance < 0.01
                ? 'HIGH — variance near zero, SIGReg may need tuning'
                : wm.getMetrics().latentVariance < 0.1
                  ? 'MODERATE — monitor closely'
                  : 'LOW — latent space well-distributed',
            },
            methodology: 'JEPA encoder (Maes et al. 2026): 2-layer MLP with LayerNorm + GELU, ' +
              'mapping structured SNN state vectors to compact latent embeddings. ' +
              'Unlike LeWM\'s ViT for pixels, uses MLP for pre-structured neuromorphic data.',
          }, null, 2),
        }],
      };
    },
  );

  // ─── Tool 2: wm_predict ───────────────────────────────────────────────

  server.tool(
    'wm_predict',
    'Predict Next SNN State in Latent Space',
    {
      action: SpikeActionSchema.describe('Spike injection action to condition prediction on'),
      steps: z.number().int().min(1).max(50).default(1).describe('Number of prediction steps (rollout)'),
    },
    async ({ action, steps }) => {
      const state = getState();
      const obs = extractObservation(state);
      const embedding = wm.encode(obs);
      let z = embedding.z;

      const spikeAction: SpikeAction = {
        targetNeurons: action.targetNeurons,
        strengths: action.strengths,
        duration: action.duration ?? 1,
      };

      const trajectory: { step: number; z: number[]; norm: number }[] = [];

      for (let s = 0; s < steps; s++) {
        const pred = wm.predict(z, spikeAction);
        z = pred.zHat;
        trajectory.push({
          step: s + 1,
          z: Array.from(z).slice(0, 8).map(v => Math.round(v * 1e3) / 1e3),
          norm: Math.round(Math.sqrt(z.reduce((s, v) => s + v * v, 0)) * 1e4) / 1e4,
        });
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            tool: 'wm_predict',
            title: 'World Model — Latent Prediction Rollout',
            action: {
              targets: spikeAction.targetNeurons.length,
              meanStrength: spikeAction.strengths.reduce((a, b) => a + b, 0) / (spikeAction.strengths.length || 1),
              duration: spikeAction.duration,
            },
            rollout: {
              steps,
              trajectory: trajectory,
              finalDistFromCurrent: Math.round(
                Math.sqrt(trajectory.length > 0
                  ? vecMSEFromArrays(Array.from(embedding.z), Array.from(z))
                  : 0
                ) * 1e4) / 1e4,
            },
            methodology: 'JEPA predictor (Maes et al. 2026): MLP with AdaLN-zero–inspired ' +
              'action modulation. Predicts ẑ_{t+1} = pred(z_t, embed(a_t)) in latent space.',
          }, null, 2),
        }],
      };
    },
  );

  // ─── Tool 3: wm_plan ─────────────────────────────────────────────────

  server.tool(
    'wm_plan',
    'CEM Planning for Optimal Spike Injection',
    {
      goal: GoalStateSchema.describe('Target state to plan towards'),
      horizon: z.number().int().min(1).max(20).default(8).describe('Planning horizon (steps)'),
    },
    async ({ goal, horizon }) => {
      const state = getState();
      const currentObs = extractObservation(state);
      const goalObs = buildGoalObservation(currentObs, goal);

      // Temporarily adjust planning horizon
      const originalHorizon = wm.config.planningHorizon;
      (wm.config as any).planningHorizon = horizon;
      const result = wm.planToGoal(currentObs, goalObs);
      (wm.config as any).planningHorizon = originalHorizon;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            tool: 'wm_plan',
            title: 'World Model — CEM Latent Planning',
            goal: {
              firingRateTarget: goal.firingRateTarget ?? null,
              acmTarget: goal.acmTarget ?? null,
              description: goal.description ?? 'Custom goal state',
            },
            plan: {
              horizon,
              converged: result.converged,
              iterations: result.iterations,
              goalDistance: Math.round(result.goalDistance * 1e6) / 1e6,
              actionSequence: result.actions.map((a, i) => ({
                step: i + 1,
                targets: a.targetNeurons,
                strength: a.strengths[0] ?? 0,
                duration: a.duration,
              })),
              trajectoryNorms: result.trajectory.map(z =>
                Math.round(Math.sqrt(z.reduce((s, v) => s + v * v, 0)) * 1e4) / 1e4
              ),
            },
            metrics: {
              plansExecuted: wm.getMetrics().plansExecuted,
              successRate: Math.round(wm.getMetrics().planningSuccessRate * 1e4) / 1e4,
            },
            methodology: 'Cross-Entropy Method in latent space (LeWM planning paradigm). ' +
              'Samples candidate action sequences, rolls out through predictor, selects elites, ' +
              'refits Gaussian. Adapted from pixel-based to neuromorphic goal-directed planning.',
          }, null, 2),
        }],
      };
    },
  );

  // ─── Tool 4: wm_surprise ──────────────────────────────────────────────

  server.tool(
    'wm_surprise',
    'Violation-of-Expectation Detection',
    {
      action: SpikeActionSchema.describe('Action that was applied'),
    },
    async ({ action }) => {
      // We need two consecutive observations. Use last embedding + current state.
      const state = getState();
      const currentObs = extractObservation(state);

      const spikeAction: SpikeAction = {
        targetNeurons: action.targetNeurons,
        strengths: action.strengths,
        duration: action.duration ?? 1,
      };

      // If we have a previous embedding, compute surprise
      const lastEmb = wm.getLastEmbedding();
      let surprise = 0;
      let assessment = 'UNAVAILABLE';

      if (lastEmb) {
        // Create a synthetic "previous" observation from the stored embedding context
        const prevObs: SNNObservation = {
          ...currentObs,
          timestep: currentObs.timestep - 1,
        };
        surprise = wm.computeSurprise(prevObs, spikeAction, currentObs);

        if (surprise < 0.5) assessment = 'EXPECTED — transition consistent with learned dynamics';
        else if (surprise < 1.5) assessment = 'MILD_SURPRISE — slight deviation from prediction';
        else if (surprise < 3.0) assessment = 'SURPRISING — significant prediction error, possible novel dynamics';
        else assessment = 'VIOLATION — highly implausible transition, investigate causation';
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            tool: 'wm_surprise',
            title: 'World Model — Surprise Detection',
            surprise: {
              score: Math.round(surprise * 1e4) / 1e4,
              assessment,
              threshold: { expected: 0.5, mild: 1.5, surprising: 3.0 },
            },
            context: {
              hasHistory: lastEmb !== null,
              timestep: currentObs.timestep,
              action: { targets: spikeAction.targetNeurons.length },
            },
            methodology: 'Violation-of-expectation paradigm (LeWM §4.3): measures ' +
              'prediction error magnitude relative to observed state transition. ' +
              'Detects neurodynamically implausible events in SNN evolution.',
          }, null, 2),
        }],
      };
    },
  );

  // ─── Tool 5: wm_train_step ───────────────────────────────────────────

  server.tool(
    'wm_train_step',
    'Online World Model Training Step',
    {
      action: SpikeActionSchema.describe('Action applied between observations'),
    },
    async ({ action }) => {
      const state = getState();
      const currentObs = extractObservation(state);

      // Create a slightly perturbed "previous" for training (in production,
      // this would use actual stored previous state from the simulation loop)
      const prevObs: SNNObservation = {
        ...currentObs,
        timestep: currentObs.timestep - 1,
        firingRates: new Float64Array(currentObs.firingRates.map(r => r * (0.9 + Math.random() * 0.2))),
      };

      const spikeAction: SpikeAction = {
        targetNeurons: action.targetNeurons,
        strengths: action.strengths,
        duration: action.duration ?? 1,
      };

      const result = wm.trainStep(prevObs, spikeAction, currentObs);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            tool: 'wm_train_step',
            title: 'World Model — Training Step',
            losses: {
              prediction: Math.round(result.predLoss * 1e6) / 1e6,
              sigreg: Math.round(result.sigregLoss * 1e6) / 1e6,
              total: Math.round(result.totalLoss * 1e6) / 1e6,
              formula: 'L = L_pred + λ·SIGReg(Z)',
              lambda: wm.config.sigregLambda,
            },
            surprise: Math.round(result.surprise * 1e4) / 1e4,
            trainingMetrics: {
              steps: wm.getMetrics().trainingSteps,
              avgPredLoss: Math.round(wm.getMetrics().avgPredictionLoss * 1e6) / 1e6,
              avgSigreg: Math.round(wm.getMetrics().avgSigregLoss * 1e6) / 1e6,
              latentVariance: Math.round(wm.getMetrics().latentVariance * 1e4) / 1e4,
            },
            methodology: 'End-to-end JEPA training (Maes et al. 2026) with only two loss terms: ' +
              'L_pred (latent MSE) + λ·SIGReg (Gaussian regularizer). Single hyperparameter λ.',
          }, null, 2),
        }],
      };
    },
  );

  // ─── Tool 6: wm_status ───────────────────────────────────────────────

  server.tool(
    'wm_status',
    'World Model Status & Metrics',
    {},
    async () => {
      const metrics = wm.getMetrics();
      const snapshot = wm.getSnapshot();

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            tool: 'wm_status',
            title: 'World Model — JEPA Status Report',
            architecture: {
              type: 'JEPA (Joint-Embedding Predictive Architecture)',
              reference: 'LeWorldModel (Maes, Le Lidec, Scieur, LeCun, Balestriero 2026)',
              encoder: `MLP ${snapshot.config.observationDim} → ${snapshot.config.hiddenDim} → ${snapshot.config.latentDim}`,
              predictor: `MLP ${snapshot.config.latentDim} + action(${snapshot.config.actionDim}) → ${snapshot.config.latentDim}`,
              regularizer: `SIGReg(knots=${snapshot.config.sigregKnots}, proj=${snapshot.config.sigregProjections})`,
              planner: `CEM(pop=${snapshot.config.cemPopulation}, elite=${snapshot.config.cemEliteFraction}, horizon=${snapshot.config.planningHorizon})`,
            },
            training: {
              steps: metrics.trainingSteps,
              avgPredictionLoss: Math.round(metrics.avgPredictionLoss * 1e6) / 1e6,
              avgSigregLoss: Math.round(metrics.avgSigregLoss * 1e6) / 1e6,
              avgTotalLoss: Math.round(metrics.avgTotalLoss * 1e6) / 1e6,
              learningRate: snapshot.config.learningRate,
            },
            latentSpace: {
              dimensionality: snapshot.config.latentDim,
              variance: Math.round(metrics.latentVariance * 1e4) / 1e4,
              drift: Math.round(metrics.latentDrift * 1e4) / 1e4,
              historySize: snapshot.historySize,
              collapseStatus: metrics.latentVariance < 0.01 ? 'COLLAPSED' :
                metrics.latentVariance < 0.1 ? 'AT_RISK' : 'HEALTHY',
            },
            planning: {
              plansExecuted: metrics.plansExecuted,
              successRate: Math.round(metrics.planningSuccessRate * 1e4) / 1e4,
            },
            surprise: {
              avgSurprise: Math.round(metrics.avgSurprise * 1e4) / 1e4,
              predictionCount: snapshot.predictionCount,
            },
            lastUpdated: new Date(metrics.lastUpdated).toISOString(),
          }, null, 2),
        }],
      };
    },
  );

  // ─── Resource 1: astra://wm/latent ────────────────────────────────────

  server.resource(
    'wm-latent',
    'astra://wm/latent',
    { description: 'Current latent space state and embedding history', mimeType: 'application/json' },
    async () => {
      const embedding = wm.getLastEmbedding();
      const history = wm.getEmbeddingHistory();

      return {
        contents: [{
          uri: 'astra://wm/latent',
          mimeType: 'application/json',
          text: JSON.stringify({
            currentEmbedding: embedding ? {
              z: Array.from(embedding.z).map(v => Math.round(v * 1e4) / 1e4),
              timestep: embedding.timestep,
              confidence: embedding.confidence,
            } : null,
            history: {
              size: history.length,
              maxSize: wm.config.historySize,
              // Summary statistics of embedding distribution
              dimensionStats: (() => {
                if (history.length < 2) return null;
                const dim = wm.config.latentDim;
                const means = new Float64Array(dim);
                const stds = new Float64Array(dim);
                for (const h of history) for (let d = 0; d < dim; d++) means[d] += h[d];
                for (let d = 0; d < dim; d++) means[d] /= history.length;
                for (const h of history) for (let d = 0; d < dim; d++) stds[d] += (h[d] - means[d]) ** 2;
                for (let d = 0; d < dim; d++) stds[d] = Math.sqrt(stds[d] / history.length);
                return {
                  meanNorm: Math.round(Math.sqrt(means.reduce((s, v) => s + v * v, 0)) * 1e4) / 1e4,
                  avgStd: Math.round(stds.reduce((s, v) => s + v, 0) / dim * 1e4) / 1e4,
                };
              })(),
            },
            methodology: 'JEPA latent space (dim=' + wm.config.latentDim +
              ') with SIGReg anti-collapse regularizer',
          }, null, 2),
        }],
      };
    },
  );

  // ─── Resource 2: astra://wm/predictions ───────────────────────────────

  server.resource(
    'wm-predictions',
    'astra://wm/predictions',
    { description: 'World Model prediction history and accuracy', mimeType: 'application/json' },
    async () => {
      const predictions = wm.getPredictionHistory();
      const metrics = wm.getMetrics();

      return {
        contents: [{
          uri: 'astra://wm/predictions',
          mimeType: 'application/json',
          text: JSON.stringify({
            predictions: predictions.slice(-20).map(p => ({
              fromTimestep: p.fromTimestep,
              predictionLoss: Math.round(p.predictionLoss * 1e6) / 1e6,
              surprise: Math.round(p.surprise * 1e4) / 1e4,
              actionTargets: p.action.targetNeurons.length,
            })),
            aggregates: {
              totalPredictions: predictions.length,
              avgPredictionLoss: Math.round(metrics.avgPredictionLoss * 1e6) / 1e6,
              avgSurprise: Math.round(metrics.avgSurprise * 1e4) / 1e4,
            },
          }, null, 2),
        }],
      };
    },
  );

  // ─── Prompt: wm-experiment ────────────────────────────────────────────

  server.prompt(
    'wm-experiment',
    'World Model experiment: encode → predict → compare → plan',
    {
      targetFiringRate: z.string().optional().describe('Target firing rate in Hz for the goal state (default: 30)'),
    },
    async (args) => {
      const targetRate = parseFloat(args.targetFiringRate ?? '30');
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Run a complete World Model experiment with the following workflow:`,
                ``,
                `1. **Encode** the current SNN state using \`wm_encode\``,
                `2. **Predict** the next state using \`wm_predict\` with a small spike injection`,
                `   (e.g., neurons [10, 11, 12], strength 15mV, duration 3)`,
                `3. **Train** one step using \`wm_train_step\` with the same action`,
                `4. **Plan** towards a goal state with firing rate ${targetRate} Hz`,
                `   using \`wm_plan\` with goal { firingRateTarget: [${targetRate}] }`,
                `5. **Detect surprise** using \`wm_surprise\` with the injection action`,
                `6. **Report** the full status using \`wm_status\``,
                ``,
                `Analyze the results: Is the latent space healthy (variance > 0.1)?`,
                `Did planning converge? What does the surprise score indicate?`,
                `Compare the JEPA prediction quality with the ACM proxy metrics.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );

  return wm;
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function vecMSEFromArrays(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += (a[i] - b[i]) ** 2;
  return s / n;
}
