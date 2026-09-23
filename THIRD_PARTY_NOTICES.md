# Third-party notices

The MIT licence in [`LICENSE`](LICENSE) covers the original work in this
repository. It does **not** extend to the components below.

## 1. `python/the_consciousness_ai/` — vendored, non-commercial

| | |
|---|---|
| Upstream | [tlcdv/the_consciousness_ai](https://github.com/tlcdv/the_consciousness_ai) |
| Copyright | © 2024–2026 tlcdv |
| Licence | *The Consciousness AI — Non-Commercial Open Source License* — full text in [`python/the_consciousness_ai/LICENSE.md`](python/the_consciousness_ai/LICENSE.md) |
| Terms in short | non-commercial use only; attribution to tlcdv required and must not be removed; no sublicensing; the licence must accompany every copy |
| Changes made here | third-party article copies removed and replaced by [`BIBLIOGRAPHY.md`](python/the_consciousness_ai/BIBLIOGRAPHY.md) (23 September 2026); nothing else modified |

## 2. `src/engine/tcai/` — TypeScript port of parts of the above

The following files port algorithms of `the_consciousness_ai` to TypeScript;
each carries an upstream attribution in its header:

`acm-bridge.ts` · `emotion.ts` · `emotional-memory.ts` · `global-workspace.ts` ·
`metrics.ts` · `oscillatory-binding.ts` · `second-order.ts` · `self-model.ts` · `types.ts`

The remaining files of the folder are original work under MIT:
`active-inference.ts` · `orch-or.ts` · `phenomenal-guard.ts`.

**Status.** Whether a port of this kind is a *derivative work* within the
meaning of the upstream licence has not been legally assessed. Pending that
assessment, the maintainer treats the nine ported files **conservatively**, as
subject to the upstream non-commercial terms: any commercial use of them — or of
a build that includes them — requires the prior written permission of tlcdv.
This notice is a statement of the maintainer's position, not legal advice.

## 3. Third-party publications

This repository does not redistribute third-party articles. Publications are
cited by DOI or arXiv identifier (see `src/engine/fcs/references.ts` and
`python/the_consciousness_ai/BIBLIOGRAPHY.md`). Copies committed before
23 September 2026 remain in the Git history.

## 4. npm dependencies

Runtime and development dependencies are installed from the npm registry under
their own licences, recorded in `package-lock.json`; none is redistributed in
this repository.
