#!/usr/bin/env python3
"""
E1 — one-command replay of the whole confrontation.

  python3 empirical/run_e1.py path/to/sub-HO6_*.nwb path/to/sub-HO7_*.nwb path/to/sub-HO8_*.nwb

For each real file: determine its analysis window T (PREREG §2), export the
simulator for that T and seeds 1–10 (PREREG §3), then compute S1–S5 and the
verdicts (PREREG §4–5). Results: empirical/results/E1.json

Requires: Node ≥ 20 (npx tsx), Python 3 with numpy and h5py.
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import confront as C  # noqa: E402


def main(paths):
    os.makedirs(os.path.join(HERE, "results"), exist_ok=True)
    sims = []
    for p in paths:
        rec = C.load_nwb_units(p)
        out = os.path.join(HERE, "results", os.path.basename(p) + ".sim.json")
        env = dict(os.environ, TSX_TSCONFIG_PATH="tsconfig.test.json")
        subprocess.run(["npx", "tsx", "empirical/sim_export.ts", repr(rec.window_s), out, "1-10"],
                       cwd=ROOT, check=True, env=env, shell=(os.name == "nt"))
        sims.append(out)
    rep = C.run(paths, sims, os.path.join(HERE, "results", "E1"))
    print("\nGlobal verdict:", rep["global_verdict"])
    for k, v in rep.get("verdicts", {}).items():
        lo, hi = rep["real_range"][k]
        print(f"  {k:<20} sim={rep['sim_value'][k]:.4g}   real=[{lo:.4g}, {hi:.4g}]   → {v}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1:])
