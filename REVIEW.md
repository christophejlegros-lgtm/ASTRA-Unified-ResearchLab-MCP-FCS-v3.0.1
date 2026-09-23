# Demande de revue externe · External review request

**ASTRA-FCS v3.1.0** · <https://github.com/christophejlegros-lgtm/ASTRA-Unified-ResearchLab-MCP-FCS-v3.1.0>
Christophe Jean Legros · Assistance Multi IA, Genève · Assistant-Multi-IA@proton.me

---

## FR — Objet

ASTRA-FCS est un serveur *Model Context Protocol* qui expose 70 outils de simulation
et d'analyse à des assistants d'IA, et qui rend exécutable le programme de recherche du
fonctionnalisme contraint par le substrat (FCS). Le code, la théorie et leur vérification
procèdent d'un même auteur, assisté d'outils d'IA ; **aucun n'a encore été examiné de
l'extérieur**. Cette demande sollicite deux relectures indépendantes, l'une en
neurosciences computationnelles, l'autre en philosophie de l'esprit.

Toutes les données biologiques produites sont simulées ; les indices liés à la
conscience sont des proxys calculés, non des mesures. La revue porte sur la
**recevabilité** de ce que l'instrument permet d'affirmer, non sur une prétention
empirique qu'il ne formule pas.

## EN — Purpose

ASTRA-FCS is a *Model Context Protocol* server exposing 70 simulation and analysis tools
to AI assistants, and making the research programme of substrate-constrained
functionalism (FCS) executable. The code, the theory and their verification come from a
single author, assisted by AI tools; **none has yet been examined externally**. This
request seeks two independent reviews, one in computational neuroscience, one in
philosophy of mind.

All biological data produced are simulated; consciousness-related indices are computed
proxies, not measurements. The review bears on the **admissibility** of what the
instrument lets one claim, not on an empirical claim it does not make.

---

## Relecture A — Neurosciences computationnelles · Review A — Computational neuroscience

Couches 1 et 2 (modèles, proxys) · Layers 1 and 2 (models, proxies)

| # | Question | Fichiers / Files |
|---|---|---|
| A1 | Le moteur LIF+STDP (128 neurones, STDP événementielle) est-il correctement implémenté et ses paramètres plausibles ? · Is the LIF+STDP engine correctly implemented and are its parameters plausible? | `src/engine/snn.ts` |
| A2 | Le cœur d'inférence active calcule-t-il bien l'énergie libre variationnelle ? La référence NumPy est-elle indépendante ? · Does the active-inference core compute variational free energy correctly? Is the NumPy reference independent? | `src/engine/tcai/active-inference.ts`, `python/second_order/` |
| A3 | Les proxys Φ̃, GW̃, PAD̃ et l'ignition GNW sont-ils décrits sans surinterprétation ? · Are the Φ̃, GW̃, PAD̃ proxies and GNW ignition described without over-interpretation? | `src/engine/acm.ts`, `src/engine/tcai/` |
| A4 | Le simulateur NeuroPlatform reproduit-il des ordres de grandeur réalistes pour un MEA d'organoïde ? · Does the NeuroPlatform simulator reproduce realistic orders of magnitude for an organoid MEA? | `src/engine/neuroplatform.ts` |
| A5 | La classification des 70 outils (lecture seule, additif, destructif) est-elle juste ? · Is the classification of the 70 tools correct? | `src/tool-annotations.ts` |

## Relecture B — Philosophie de l'esprit · Review B — Philosophy of mind

Couches 2 à 4 (proxys, cadre normatif, exclusion phénoménale) · Layers 2 to 4

| # | Question | Fichiers / Files |
|---|---|---|
| B1 | La distinction accès/phénoménal (Block 1995) est-elle correctement inscrite dans le garde-fou, et le linter distingue-t-il bien usage et mention ? · Is the access/phenomenal distinction correctly encoded, and does the linter separate use from mention? | `src/engine/tcai/phenomenal-guard.ts`, `src/engine/fcs/negative-heuristic.ts` |
| B2 | La partition noyau/ceinture et l'ordre de révision sont-ils cohérents avec une méthodologie lakatosienne ? · Are the hard-core/belt partition and revision order consistent with a Lakatosian methodology? | `src/engine/fcs/withdrawal.ts`, `FCS-INTEGRATION.*.md` |
| B3 | Le refus d'agréger des critères ordinaux (Okasha 2011) est-il fondé, et l'ordre partiel de Pareto est-il la bonne alternative ? · Is refusing ordinal aggregation well founded, and is the Pareto partial order the right alternative? | `src/engine/fcs/stratification.ts` |
| B4 | L'ordinalisation de τ, déclarée comme reconstruction, introduit-elle un degré de liberté qui affaiblit la reproduction des strates publiées ? · Does the τ ordinalisation, declared as a reconstruction, introduce a degree of freedom that weakens the reproduction of the published strata? | `src/engine/fcs/stratification.ts` (`EPISODE_WINDOW_ORDINALISATION`), `tests/fcs.test.ts` |
| B5 | Le pré-enregistrement proposé rend-il les hypothèses de niveau I réellement réfutables ? · Does the proposed preregistration make the level-I hypotheses genuinely falsifiable? | `PREREGISTRATION.md` |

---

## Modalités · Practicalities

- **Reproduire / Reproduce :** `npm ci && npm run build && npm test` (Node ≥ 20 ; Python 3 + numpy pour `npm run golden:check`). Graine fixée par défaut ; `ASTRA_SEED` pour la changer.
- **Répondre / Respond :** une *issue* GitHub par question (préfixe `[A1]`, `[B3]`…), ou un rapport à l'adresse ci-dessus. Les relectures seront publiées avec l'accord de leurs auteurs, et leurs objections citées telles quelles.
- **Conflits d'intérêts / Conflicts of interest :** à déclarer par chaque relecteur. Liens de l'auteur avec les entreprises citées (FinalSpark, OVOMIND, Koniku) et collaborations en cours : **À DÉCLARER PAR L'AUTEUR AVANT ENVOI** · The author's ties to the companies named and ongoing collaborations: **TO BE DECLARED BY THE AUTHOR BEFORE SENDING**.
- **Documents d'appui / Supporting documents :** analyse épistémologique de diffusion ; série FCS (dossier `FCS v1.5/`).
