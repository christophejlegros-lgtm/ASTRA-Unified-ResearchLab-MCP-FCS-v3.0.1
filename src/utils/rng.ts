/**
 * ASTRA — Global seeded pseudo-random generator
 * ══════════════════════════════════════════════
 * Single source of randomness for every stochastic component that previously
 * drew from `Math.random` (SNN connectivity and noise, sensory encoders,
 * world model, ethics drift, background simulation loop).
 *
 * Seed: `ASTRA_SEED` (unsigned 32-bit integer). When unset or invalid the
 * default seed below is used, so two runs started the same way produce the
 * same random streams. The active seed is reported by `get_system_status`,
 * `export_snapshot`, both `/health` endpoints and the startup log.
 *
 * Scope of the guarantee: the *random streams* are reproducible. Components
 * driven by wall-clock time (the background tick loop, timestamps) still
 * interleave differently from run to run; for bit-level replay, keep the
 * simulation loop stopped and drive it through `snn_step`.
 *
 * Algorithm: mulberry32 (32-bit state, period 2^32) — adequate for simulation
 * noise, not for cryptography.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 */

export const DEFAULT_SEED = 20260923;

function parseSeed(raw: string | undefined): { seed: number; source: 'env' | 'default' } {
  if (raw !== undefined && /^\d+$/.test(raw.trim())) {
    const n = Number(raw.trim());
    if (Number.isSafeInteger(n) && n <= 0xffffffff) return { seed: n >>> 0, source: 'env' };
  }
  return { seed: DEFAULT_SEED, source: 'default' };
}

const initial = parseSeed(process.env.ASTRA_SEED);
let seed = initial.seed;
let seedSource: 'env' | 'default' | 'reseed' = initial.source;
let state = seed;

/** Uniform float in [0, 1), drop-in replacement for Math.random(). */
export function random(): number {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** The seed the current stream started from, and where it came from. */
export function seedInfo(): { seed: number; source: 'env' | 'default' | 'reseed'; algorithm: 'mulberry32' } {
  return { seed, source: seedSource, algorithm: 'mulberry32' };
}

/** Restart the global stream from `newSeed` (tests, replay). */
export function reseed(newSeed: number): void {
  seed = newSeed >>> 0;
  seedSource = 'reseed';
  state = seed;
}
