#!/usr/bin/env python3
"""
E1 — Confrontation of ASTRA's OrganoidMEA simulator with real organoid recordings.

Implements, and only implements, empirical/PREREG-DANDI-001603.md:
the same functions compute S1–S5 on real and simulated spike trains, then the
preregistered decision rules produce per-statistic and global verdicts.

Usage:
  python3 empirical/confront.py --real a.nwb b.nwb c.nwb --sim sim_a.json sim_b.json sim_c.json \
                                --out empirical/results/E1

Each --sim file must be the export of `empirical/sim_export.ts` for the window
length T of the real file at the same position.

© 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Sequence

import numpy as np

# ── Preregistered constants (§4, §5) — not to be tuned after seeing the data ──
WINDOW_MAX_S = 600.0
ACTIVE_MIN_HZ = 0.05
CV_MIN_SPIKES = 20
BIN_S = 0.025
BURST_SD = 3.0
BURST_MIN_FRACTION_TRAINS = 0.25
STTC_DT_S = 0.020
STTC_TOP_N = 50
MARGIN_FACTOR = 2.0
STTC_MARGIN_ABS = 0.05

STAT_KEYS = ["S1_rate_hz", "S2_isi_cv", "S3_bursts_per_min", "S4_frac_in_bursts", "S5_sttc"]


# ════════════════════════════════════════════════════════════════════════
# Loading
# ════════════════════════════════════════════════════════════════════════

@dataclass
class Recording:
    label: str
    trains: List[np.ndarray]      # spike times in seconds, relative to window start
    window_s: float               # analysed window length T
    source_duration_s: float      # full duration used to derive T
    duration_source: str          # how the duration was determined
    n_units_total: int


def load_nwb_units(path: str, label: Optional[str] = None) -> Recording:
    """Read the NWB `units` table (spike_times + spike_times_index) with h5py."""
    import h5py

    with h5py.File(path, "r") as f:
        if "units" not in f or "spike_times" not in f["units"]:
            raise ValueError(f"{path}: no units/spike_times table")
        st = np.asarray(f["units/spike_times"][()], dtype=float)
        idx = np.asarray(f["units/spike_times_index"][()], dtype=np.int64)
        starts = np.concatenate([[0], idx[:-1]])
        trains = [np.sort(st[a:b]) for a, b in zip(starts, idx)]

        # Duration: obs_intervals if present, else first→last spike across units.
        duration, source, t0 = None, None, None
        if "obs_intervals" in f["units"]:
            oi = np.asarray(f["units/obs_intervals"][()], dtype=float)
            if oi.size:
                t0, t1 = float(np.min(oi[:, 0])), float(np.max(oi[:, 1]))
                duration, source = t1 - t0, "units/obs_intervals"
        if duration is None:
            nonempty = [t for t in trains if t.size]
            t0 = float(min(t[0] for t in nonempty))
            t1 = float(max(t[-1] for t in nonempty))
            duration, source = t1 - t0, "first→last spike (no obs_intervals)"

    T = min(duration, WINDOW_MAX_S)
    windowed = [t[(t >= t0) & (t < t0 + T)] - t0 for t in trains]
    return Recording(label or os.path.basename(path), windowed, T, duration, source, len(trains))


def load_sim(path: str) -> List[Recording]:
    with open(path) as fh:
        d = json.load(fh)
    T = float(d["durationSec"])
    return [
        Recording(f"sim seed {r['seed']}", [np.asarray(t, dtype=float) for t in r["trains"]], T, T, "simulated", len(r["trains"]))
        for r in d["runs"]
    ]


# ════════════════════════════════════════════════════════════════════════
# Statistics (§4) — identical code for real and simulated trains
# ════════════════════════════════════════════════════════════════════════

def active_trains(trains: Sequence[np.ndarray], T: float) -> List[np.ndarray]:
    return [t for t in trains if t.size / T >= ACTIVE_MIN_HZ]


def s1_rate(act: Sequence[np.ndarray], T: float) -> float:
    return float(np.median([t.size / T for t in act])) if act else float("nan")


def s2_isi_cv(act: Sequence[np.ndarray]) -> float:
    cvs = []
    for t in act:
        if t.size >= CV_MIN_SPIKES:
            isi = np.diff(t)
            m = isi.mean()
            if m > 0:
                cvs.append(isi.std() / m)
    return float(np.median(cvs)) if cvs else float("nan")


def network_bursts(act: Sequence[np.ndarray], T: float):
    """Return (list of (start_bin, end_bin_exclusive), bin edges)."""
    nb = int(np.floor(T / BIN_S))
    if nb < 2 or not act:
        return [], nb
    edges = np.arange(nb + 1) * BIN_S
    pop = np.zeros(nb)
    per_train_bins = []
    for t in act:
        c, _ = np.histogram(t, bins=edges)
        pop += c
        per_train_bins.append(c > 0)
    per_train_bins = np.array(per_train_bins)          # trains × bins (bool)
    thr = pop.mean() + BURST_SD * pop.std()
    above = pop > thr
    bursts = []
    i = 0
    while i < nb:
        if above[i]:
            j = i
            while j < nb and above[j]:
                j += 1
            frac = per_train_bins[:, i:j].any(axis=1).mean()
            if frac >= BURST_MIN_FRACTION_TRAINS:
                bursts.append((i, j))
            i = j
        else:
            i += 1
    return bursts, nb


def s3_s4_bursts(act: Sequence[np.ndarray], T: float):
    bursts, _ = network_bursts(act, T)
    rate = len(bursts) / (T / 60.0)
    total = sum(t.size for t in act)
    if total == 0:
        return rate, float("nan")
    inside = 0
    for t in act:
        for a, b in bursts:
            lo, hi = a * BIN_S, b * BIN_S
            inside += int(np.count_nonzero((t >= lo) & (t < hi)))
    return float(rate), float(inside / total)


def _tiled_fraction(t: np.ndarray, T: float, dt: float) -> float:
    """Fraction of [0, T] within ±dt of any spike of t (merged intervals)."""
    if t.size == 0:
        return 0.0
    lo = np.clip(t - dt, 0, T)
    hi = np.clip(t + dt, 0, T)
    covered, cur_lo, cur_hi = 0.0, lo[0], hi[0]
    for a, b in zip(lo[1:], hi[1:]):
        if a <= cur_hi:
            cur_hi = max(cur_hi, b)
        else:
            covered += cur_hi - cur_lo
            cur_lo, cur_hi = a, b
    covered += cur_hi - cur_lo
    return covered / T


def _prop_within(a: np.ndarray, b: np.ndarray, dt: float) -> float:
    """Fraction of spikes of a lying within ±dt of some spike of b."""
    if a.size == 0 or b.size == 0:
        return 0.0
    pos = np.searchsorted(b, a)
    left = np.abs(a - b[np.clip(pos - 1, 0, b.size - 1)])
    right = np.abs(b[np.clip(pos, 0, b.size - 1)] - a)
    return float(np.mean(np.minimum(left, right) <= dt))


def sttc(a: np.ndarray, b: np.ndarray, T: float, dt: float = STTC_DT_S) -> float:
    """Spike time tiling coefficient (Cutts & Eglen, 2014)."""
    if a.size == 0 or b.size == 0:
        return float("nan")
    TA, TB = _tiled_fraction(a, T, dt), _tiled_fraction(b, T, dt)
    PA, PB = _prop_within(a, b, dt), _prop_within(b, a, dt)
    t1 = (PA - TB) / (1 - PA * TB) if PA * TB != 1 else 1.0
    t2 = (PB - TA) / (1 - PB * TA) if PB * TA != 1 else 1.0
    return 0.5 * (t1 + t2)


def s5_sttc(act: Sequence[np.ndarray], T: float) -> float:
    top = sorted(act, key=lambda t: t.size, reverse=True)[:STTC_TOP_N]
    vals = [sttc(top[i], top[j], T) for i in range(len(top)) for j in range(i + 1, len(top))]
    vals = [v for v in vals if np.isfinite(v)]
    return float(np.median(vals)) if vals else float("nan")


def statistics(rec: Recording) -> Dict[str, float]:
    act = active_trains(rec.trains, rec.window_s)
    s3, s4 = s3_s4_bursts(act, rec.window_s)
    return {
        "n_trains": len(rec.trains),
        "n_active": len(act),
        "S1_rate_hz": s1_rate(act, rec.window_s),
        "S2_isi_cv": s2_isi_cv(act),
        "S3_bursts_per_min": s3,
        "S4_frac_in_bursts": s4,
        "S5_sttc": s5_sttc(act, rec.window_s),
    }


# ════════════════════════════════════════════════════════════════════════
# Decision rules (§5)
# ════════════════════════════════════════════════════════════════════════

def verdict_for(key: str, sim: float, real_vals: Sequence[float]) -> str:
    real = [v for v in real_vals if np.isfinite(v)]
    if not real or not np.isfinite(sim):
        return "undetermined"
    lo, hi = min(real), max(real)
    if lo <= sim <= hi:
        return "compatible"
    if key == "S5_sttc":
        band = (lo - STTC_MARGIN_ABS, hi + STTC_MARGIN_ABS)
    else:
        band = (lo / MARGIN_FACTOR, hi * MARGIN_FACTOR)
    return "marginal" if band[0] <= sim <= band[1] else "incompatible"


def global_verdict(verdicts: Dict[str, str]) -> str:
    v = list(verdicts.values())
    n_inc, n_comp = v.count("incompatible"), v.count("compatible")
    if n_inc >= 2:
        return "INADEQUATE"
    if n_inc == 0 and n_comp >= 3:
        return "ADEQUATE"
    return "PARTIALLY ADEQUATE"


# ════════════════════════════════════════════════════════════════════════
# Driver
# ════════════════════════════════════════════════════════════════════════

def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def run(real_paths: Sequence[str], sim_paths: Sequence[str], out_prefix: str) -> dict:
    assert len(real_paths) == len(sim_paths), "one --sim export per --real file"
    real_rows, sim_rows, excluded = [], [], []
    for rp, sp in zip(real_paths, sim_paths):
        try:
            rec = load_nwb_units(rp)
        except Exception as exc:  # §2: a file without a units table is excluded
            excluded.append({"file": os.path.basename(rp), "reason": str(exc)})
            continue
        sims = load_sim(sp)
        if abs(sims[0].window_s - rec.window_s) > 1e-6:
            raise ValueError(f"{sp}: sim duration {sims[0].window_s} ≠ real window {rec.window_s}")
        rs = statistics(rec)
        sim_stats = [statistics(s) for s in sims]
        sim_median = {k: float(np.nanmedian([s[k] for s in sim_stats])) for k in STAT_KEYS}
        real_rows.append({
            "file": os.path.basename(rp), "sha256": sha256(rp),
            "window_s": rec.window_s, "duration_s": rec.source_duration_s,
            "duration_source": rec.duration_source, "n_units_total": rec.n_units_total, **rs,
        })
        sim_rows.append({"matched_to": os.path.basename(rp), "seeds": [s.label for s in sims],
                         "per_seed": sim_stats, "median": sim_median})

    report: dict = {"preregistration": "empirical/PREREG-DANDI-001603.md",
                    "constants": {k: v for k, v in globals().items() if k.isupper() and isinstance(v, (int, float))},
                    "real": real_rows, "simulated": sim_rows, "excluded": excluded}

    if len(real_rows) < 2:
        report["global_verdict"] = "NOT PERFORMED (fewer than two usable recordings)"
    else:
        sim_overall = {k: float(np.nanmedian([r["median"][k] for r in sim_rows])) for k in STAT_KEYS}
        verdicts = {k: verdict_for(k, sim_overall[k], [r[k] for r in real_rows]) for k in STAT_KEYS}
        report["sim_value"] = sim_overall
        report["real_range"] = {k: [float(np.nanmin([r[k] for r in real_rows])), float(np.nanmax([r[k] for r in real_rows]))] for k in STAT_KEYS}
        report["verdicts"] = verdicts
        report["global_verdict"] = global_verdict(verdicts)

    os.makedirs(os.path.dirname(out_prefix) or ".", exist_ok=True)
    with open(out_prefix + ".json", "w") as fh:
        json.dump(report, fh, indent=2, default=float)
    return report


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--real", nargs="+", required=True)
    ap.add_argument("--sim", nargs="+", required=True)
    ap.add_argument("--out", default="empirical/results/E1")
    a = ap.parse_args()
    rep = run(a.real, a.sim, a.out)
    print(json.dumps({k: rep.get(k) for k in ("real_range", "sim_value", "verdicts", "global_verdict")}, indent=2))


if __name__ == "__main__":
    main()
