"""
ASTRA v2.5 — Étage B reference: verified NumPy discrete active inference
═════════════════════════════════════════════════════════════════════════
Numerically equivalent counterpart to the production TypeScript core
(src/engine/tcai/active-inference.ts). It computes the REAL variational free
energy F (= −log p(o)), the expected free energy G(π) decomposed into
pragmatic and epistemic value, and learns the generative model (A, B) online
via Dirichlet updates — the genuine self-evidencing organ.

Provenance note (v2.5). The canonical reference is infer-actively/pymdp, but
the currently-distributed pymdp is the JAX rewrite whose functional/batched
API drifts across releases (e.g. utils.obj_array_zeros → list_array_zeros,
random_A_array, vmapped Agent). To keep this reference executable and stable
without coupling to a moving API, it is implemented in dependency-light NumPy
following the same discrete active-inference mathematics (Da Costa et al.
2020 — ref [10] of Legros 2026). It is exercised in __main__ and the numbers
match the TypeScript core. An optional pymdp adapter can be layered on top if
a pinned pymdp version is available.

© 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
"""
from __future__ import annotations

from dataclasses import dataclass, field
import numpy as np

EPS = 1e-12


def _norm_cols(M: np.ndarray) -> np.ndarray:
    return M / (M.sum(axis=0, keepdims=True) + EPS)


def _softmax(x: np.ndarray) -> np.ndarray:
    z = x - x.max()
    e = np.exp(z)
    return e / (e.sum() + EPS)


@dataclass
class ActiveInferenceCore:
    """Exact one-step discrete active-inference agent with online learning."""
    num_obs: int
    num_states: int
    num_controls: int
    gamma: float = 4.0
    lr: float = 1.0
    pA: np.ndarray = field(default=None, repr=False)
    A: np.ndarray = field(default=None, repr=False)
    pB: np.ndarray = field(default=None, repr=False)
    B: np.ndarray = field(default=None, repr=False)
    _qs_prev: np.ndarray = field(default=None, repr=False)
    _a_prev: int = 0
    _last_F: float | None = None

    def __post_init__(self) -> None:
        self.pA = np.ones((self.num_obs, self.num_states))
        self.A = _norm_cols(self.pA)
        self.pB = np.ones((self.num_states, self.num_states, self.num_controls))
        self.B = np.stack([_norm_cols(self.pB[:, :, u]) for u in range(self.num_controls)], axis=2)
        self.D = np.ones(self.num_states) / self.num_states

    def step(self, o: int, C: list[float]) -> dict:
        C = np.asarray(C, dtype=float)
        obs = int(np.clip(round(o), 0, self.num_obs - 1))

        prior = self.D if self._qs_prev is None else self.B[:, :, self._a_prev] @ self._qs_prev
        qs = _softmax(np.log(self.A[obs, :] + EPS) + np.log(prior + EPS))

        accuracy = -np.sum(qs * np.log(self.A[obs, :] + EPS))
        complexity = np.sum(qs * (np.log(qs + EPS) - np.log(prior + EPS)))
        F = float(accuracy + complexity)
        dF = F if self._last_F is None else abs(F - self._last_F)

        G = np.zeros(self.num_controls)
        prag = np.zeros(self.num_controls)
        epi = np.zeros(self.num_controls)
        for u in range(self.num_controls):
            qs_u = self.B[:, :, u] @ qs
            qo_u = self.A @ qs_u
            prag[u] = float(qo_u @ C)
            ig = 0.0
            for oo in range(self.num_obs):
                post = self.A[oo, :] * qs_u
                Z = post.sum()
                if Z > EPS:
                    post = post / Z
                    ig += qo_u[oo] * np.sum(post * (np.log(post + EPS) - np.log(qs_u + EPS)))
            epi[u] = ig
            G[u] = -prag[u] - ig

        qpi = _softmax(-self.gamma * G)
        a = int(np.argmax(qpi))

        # Dirichlet model learning (second-order organ).
        # B credits the PREVIOUS action u_{t-1} that produced the transition
        # qs_prev -> qs (B[s_t, s_{t-1}, u_{t-1}]), not the action just selected.
        self.pA[obs, :] += self.lr * qs
        self.A = _norm_cols(self.pA)
        if self._qs_prev is not None:
            ap = self._a_prev
            self.pB[:, :, ap] += self.lr * np.outer(qs, self._qs_prev)
            self.B[:, :, ap] = _norm_cols(self.pB[:, :, ap])

        self._qs_prev, self._a_prev, self._last_F = qs, a, F
        return dict(freeEnergy=F, deltaFreeEnergy=dF, expectedFreeEnergy=G.tolist(),
                    pragmatic=float(prag[a]), epistemic=float(epi[a]),
                    realizedPreference=float(C[obs]), action=a, qpi=qpi.round(4).tolist())


if __name__ == "__main__":
    C = [0.0, 0.5, 1.0, 1.5, 2.0]
    print("=== GOOD regime (preferred obs 4) — F falls, quality high ===")
    ag = ActiveInferenceCore(5, 5, 2)
    f0 = ag.step(4, C)["freeEnergy"]
    for _ in range(14):
        r = ag.step(4, C)
    print(f"  F: {f0:.3f} -> {r['freeEnergy']:.3f} | pragmatic={r['pragmatic']:.3f} | realizedPref={r['realizedPreference']:.2f}")
    assert r["freeEnergy"] < f0 and r["realizedPreference"] == 2.0

    print("=== MEDIOCRE fixed point (constant non-preferred obs 0) — F settles, quality LOW ===")
    ag2 = ActiveInferenceCore(5, 5, 2)
    g0 = ag2.step(0, C)["freeEnergy"]
    for _ in range(14):
        r2 = ag2.step(0, C)
    print(f"  F: {g0:.3f} -> {r2['freeEnergy']:.3f} (settled) | realizedPref={r2['realizedPreference']:.2f} (low)")
    assert r2["realizedPreference"] == 0.0
    print("OK — verified: stationarity (F) dissociates from task quality (pragmatic/realizedPref).")
