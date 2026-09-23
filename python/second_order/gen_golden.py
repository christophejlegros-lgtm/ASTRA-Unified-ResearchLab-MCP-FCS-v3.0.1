"""Generate the TS↔NumPy equivalence golden fixture from the verified NumPy
active-inference core. Run in CI; the TS test asserts the TypeScript core
reproduces these numbers within 1e-9.

Usage:
  python3 gen_golden.py           # (re)write the fixture
  python3 gen_golden.py --check   # verify the on-disk fixture matches (no git
                                  # needed; exits 1 on drift) — used by CI and
                                  # works from a tarball/zip, unlike `git diff`.

© 2026 Christophe Jean Legros — Geneva
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from active_inference_loop import ActiveInferenceCore

NUM_OBS, NUM_STATES, NUM_CTRL, GAMMA, LR = 5, 5, 2, 4.0, 1.0
C = [0.0, 0.5, 1.0, 1.5, 2.0]
SEQ = [4, 4, 2, 0, 3, 3, 1, 4, 2, 4, 4, 0]  # fixed observation sequence


def build() -> dict:
    ag = ActiveInferenceCore(NUM_OBS, NUM_STATES, NUM_CTRL, GAMMA, LR)
    steps = []
    for o in SEQ:
        r = ag.step(o, C)
        steps.append({
            "obs": o,
            "freeEnergy": round(r["freeEnergy"], 10),
            "expectedFreeEnergy": [round(g, 10) for g in r["expectedFreeEnergy"]],
            "pragmatic": round(r["pragmatic"], 10),
            "epistemic": round(r["epistemic"], 10),
            "action": r["action"],
        })
    return {"config": {"numObs": NUM_OBS, "numStates": NUM_STATES,
                       "numControls": NUM_CTRL, "gamma": GAMMA, "lr": LR},
            "C": C, "sequence": SEQ, "steps": steps}


OUT = os.path.normpath(os.path.join(
    os.path.dirname(__file__), "..", "..", "tests", "fixtures", "aif_golden.json"))


def main() -> int:
    golden = build()
    text = json.dumps(golden, indent=2)
    if "--check" in sys.argv:
        # git-independent drift check: compare to the on-disk fixture.
        if not os.path.exists(OUT):
            print("golden missing:", OUT); return 1
        on_disk = open(OUT).read()
        if on_disk.strip() != text.strip():
            print("DRIFT: regenerated golden differs from", OUT); return 1
        print("golden OK (TS↔NumPy reference current):", OUT); return 0
    with open(OUT, "w") as f:
        f.write(text)
    print("wrote", OUT, "with", len(golden["steps"]), "steps")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
