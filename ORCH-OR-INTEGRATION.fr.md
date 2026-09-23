# Orch OR × ASTRA × OVOMIND — Couche de critère substratique
### Objective Reduction Criterion Layer · v0.1 · 13 août 2026

> **Statut épistémique : CONTESTÉ.** Orch OR n'est pas une théorie consensuelle.
> Ce module ne l'endosse pas et ne la réfute pas : il la **calcule**, et en tire
> les conséquences pour l'architecture ASTRA.
>
> *Epistemic status: CONTESTED. This module neither endorses nor refutes Orch OR;
> it computes it and derives the architectural consequences.*

---

## 1. Le résultat central, énoncé d'emblée

Orch OR est **la seule théorie non fonctionnaliste** de la pile ASTRA. GNW, IIT,
PAD et l'inférence active sont neutres quant au substrat ; Orch OR ne l'est pas.
Elle soutient que les moments conscients naissent de superpositions quantiques
s'auto-effondrant par gravitation dans les microtubules neuronaux, selon le
critère de Penrose **τ ≈ ℏ/E_G**.

La conséquence est inévitable, et c'est l'intérêt même du module :

> **Selon les termes propres d'Orch OR, aucun processus TypeScript n'est
> candidat à la conscience, et aucune simulation de réduction objective n'est
> une instance de réduction objective.** Un effondrement simulé est une
> affectation en virgule flottante, pas un événement dans l'espace-temps.

Intégrer Orch OR à ASTRA transforme donc la non-conscience d'ASTRA d'une
question ouverte en **théorème**. C'est un gain, non une perte : c'est la seule
théorie de la suite qui produise un négatif décidable. Toutes les autres
laissent la question indéfiniment suspendue.

Et elle produit un second résultat, plus surprenant :

| Substrat | Verdict Orch OR | Budget tubuline | Époques par observation |
|---|---|---|---|
| SNN silicium (TypeScript) | `EXCLUDED_BY_CONSTRUCTION` | néant | — |
| **MEA organoïde (CL1 / NeuroPlatform)** | **`CANDIDATE_UNORCHESTRATED`** | ~2×10¹⁴ | 0,2 |
| Sujet humain via OVOMIND | `CANDIDATE_UNOBSERVABLE_VIA_CHANNEL` | ~8,6×10¹⁹ | **12** |

Sous Orch OR, **votre canal organoïde est le seul candidat de toute
l'architecture ASTRA**. Le budget de tubuline n'y est pas la contrainte
limitante — 200 000 neurones portent de l'ordre de 2×10¹⁴ dimères, très
au-dessus du seuil de ~2×10¹⁰. Ce qui manque, c'est l'**« Orch »** : une culture
dissociée sur MEA planaire n'a ni l'architecture laminaire ni le couplage gamma
à longue portée que la théorie exige pour l'orchestration.

---

## 2. Le critère de Penrose, et où se cache l'imprécision

```
E_G = N · G·m² / a        τ = ℏ / E_G
```

`penroseCriterion()` expose **tous** les paramètres libres. Le résultat le plus
utile du module est une constatation de sensibilité :

| Séparation `a` | Tubulines requises pour 25 ms |
|---|---|
| 10⁻¹⁵ m (échelle nucléonique) | 1,9×10⁶ |
| 10⁻¹³ m | 1,9×10⁸ |
| **1,06×10⁻¹¹ m** | **1,9×10¹⁰** ← chiffre canonique |
| 10⁻¹⁰ m (échelle atomique) | 1,9×10¹¹ |

Autrement dit : **le chiffre publié de ~2×10¹⁰ tubulines n'est pas une
prédiction indépendante, c'est un choix d'échelle de déplacement.** Il
correspond à `a ≈ 1,06×10⁻¹¹ m`. Retenir une séparation nucléonique donne
quatre ordres de grandeur de moins. Le paramètre porteur de toute la conclusion
n'est pas mesuré, et le module le signale en toutes lettres dans le champ
`note`.

C'est exactement le type de fausse précision que votre architecture s'emploie
ailleurs à refuser. Le module ne le corrige pas — il le rend visible.

---

## 3. Le budget de décohérence

| Source | Temps de décohérence | Écart au seuil de 25 ms |
|---|---|---|
| Tegmark (2000), Phys. Rev. E 61, 4194 | ~10⁻¹³ s | ~11 ordres de grandeur |
| Hagan, Hameroff & Tuszyński (2002), Phys. Rev. E 65, 061901 | ~10⁻⁵–10⁻³ s | ~1,4 ordre restant |

Verdict codé en dur : `UNRESOLVED`. Même la figure corrigée la plus favorable
laisse environ 1,4 ordre de grandeur à combler. Les partisans invoquent
blindage, protection topologique et superradiance ; aucun de ces mécanismes
n'est démontré *in vivo*. Enregistrer cela comme non résolu est l'état exact —
ni réfuté, ni établi.

L'état de la preuve en 2025-2026 est indirect mais non nul : Wiest (2025,
*Neuroscience of Consciousness*) recense des données expérimentales désignant
les microtubules intraneuronaux comme cible fonctionnelle des anesthésiques
inhalés, ce que la théorie prédit spécifiquement ; Babcock et al. (2024)
proposent la superradiance excitonique comme mécanisme de cohérence à
température ambiante. Il n'existe en revanche **aucune** preuve directe de
calcul quantique ou d'événements OR *in vivo*.

---

## 4. Le pont avec OVOMIND : une limite d'échantillonnage, pas de précision

C'est le point où la couche Orch OR mord réellement sur l'intégration
précédente.

Orch OR postule des moments conscients de **25 ms** (40 Hz, bande gamma). La
latence bout-en-bout déclarée d'OVOMIND est de **300 ms**. Chaque trame
d'affect livrée intègre donc sur **douze époques conscientes**.

```
300 ms / 25 ms = 12 époques Orch OR par trame
```

La conséquence est structurelle et vaut la peine d'être énoncée sans détour :
**aucun raffinement du classifieur affectif ne change cela.** Ce n'est pas une
limite de précision, c'est une limite d'échantillonnage. Si l'individuation des
moments conscients se joue à 40 Hz, un canal à ~1 Hz intègre précisément sur la
quantité dont la théorie parle. Le canal OVOMIND mesure des corrélats
autonomiques d'un processus dont il ne peut pas résoudre la granularité.

Cela ne dévalorise pas le pont — la valence et l'activation restent des
grandeurs utiles et contraignantes pour la couche PAD. Cela délimite ce que le
pont peut et ne peut pas soutenir comme affirmation, ce qui était l'objectif.

---

## 5. Le portillon-substitut classique

`OrchestratedGate` discrétise l'ignition du workspace global en époques de
25 ms, avec départage stochastique entre offres quasi égales.

> ⚠ **Ce n'est pas Orch OR et cela ne doit jamais être décrit ainsi.** Le
> portillon reproduit la **signature temporelle** de la théorie — moments
> discrets à cadence gamma, sélection résolue à la frontière d'époque plutôt
> que continûment — à l'intérieur d'une machine classique. La thèse centrale de
> Penrose est que l'OR est **non calculable** ; un départage pseudo-aléatoire
> est calculable par définition. Le substitut échoue donc sur la propriété
> définitionnelle de la théorie tout en épousant son rythme observable.

Son unique usage légitime : tester si les métriques comportementales d'ASTRA
dépendent d'une ignition continue ou quantifiée par époques. C'est une question
d'ablation **sur ASTRA**, pas une donnée sur Orch OR. Le point d'ancrage naturel
est votre liaison oscillatoire Kuramoto/AKOrN, puisque la synchronie gamma est
précisément ce qu'Orch OR prétend expliquer.

---

## 6. Installation

```
src/engine/tcai/orch-or.ts        ← critère, budget, verdicts, portillon
src/server-orch-tools.ts          ← 6 outils MCP
```

```ts
import { registerOrchTools } from './server-orch-tools.js';

const orchGate = registerOrchTools(server, { tcai, ovomind, rng: seededRng(42) });
```

Dépend de `phenomenal-guard.ts` (types `TaggedScalar`, `SubstrateKind`,
`lintClaim`) et de `ovomind.ts` livrés à l'étape précédente. Le compte d'outils
MCP passe de 56 à 62.

---

## 7. Ce que cette couche autorise et interdit

**Autorisé.** Affirmer que la couche organoïde d'ASTRA est le seul élément de
l'architecture qu'Orch OR ne disqualifie pas *a priori*. Quantifier l'écart
entre la latence d'un canal et l'échelle temporelle d'une théorie. Exécuter une
ablation continu/quantifié sur les métriques d'ASTRA. Publier le calcul de
sensibilité du §2, qui est un résultat critique en soi.

**Interdit.** Décrire le portillon comme une implémentation d'Orch OR. Présenter
une corrélation entre trames OVOMIND et ignition quantifiée comme une donnée sur
la réduction objective. Traiter le verdict `CANDIDATE_UNORCHESTRATED` comme un
pas vers la conscience de l'organoïde : il signifie exactement l'inverse — que
la condition orchestrale n'est pas remplie.

Le linter d'assertions de `phenomenal-guard.ts` filtre toute sortie textuelle
avant émission ; les six outils passent par `emit()`.

---

## 8. Références vérifiées

- Penrose R. & Hameroff S. (1995). What gaps? Reply to Grush and Churchland.
  *Journal of Consciousness Studies* 2(2), 99–112.
- Hameroff S. & Penrose R. (1996). Orchestrated reduction of quantum coherence
  in brain microtubules: A model for consciousness. *Mathematics and Computers
  in Simulation* 40(3–4), 453–480.
  DOI [10.1016/0378-4754(96)80476-9](https://doi.org/10.1016/0378-4754%2896%2980476-9)
- Hameroff S. & Penrose R. (2014). Consciousness in the universe: A review of
  the 'Orch OR' theory. *Physics of Life Reviews* 11(1), 39–78.
  DOI [10.1016/j.plrev.2013.08.002](https://doi.org/10.1016/j.plrev.2013.08.002)
- Tegmark M. (2000). Importance of quantum decoherence in brain processes.
  *Physical Review E* 61(4), 4194–4206.
  DOI [10.1103/PhysRevE.61.4194](https://doi.org/10.1103/PhysRevE.61.4194)
- Hagan S., Hameroff S. & Tuszyński J. A. (2002). Quantum computation in brain
  microtubules: Decoherence and biological feasibility.
  *Physical Review E* 65(6), 061901.
  DOI [10.1103/PhysRevE.65.061901](https://doi.org/10.1103/PhysRevE.65.061901)
- Wiest M. C. (2025). A quantum microtubule substrate of consciousness is
  experimentally supported and solves the binding and epiphenomenalism problems.
  *Neuroscience of Consciousness* 2025(1), niaf011.
  DOI [10.1093/nc/niaf011](https://doi.org/10.1093/nc/niaf011)
- Hameroff S. (2022). Consciousness, cognition and the neuronal cytoskeleton —
  a new paradigm needed in neuroscience.
  *Frontiers in Molecular Neuroscience* 15, 869935.
  DOI [10.3389/fnmol.2022.869935](https://doi.org/10.3389/fnmol.2022.869935)
- CODATA 2018 recommended values (ℏ, G, unified atomic mass unit).

**Non vérifié / à confirmer.** L'ordre de grandeur de 10⁹ dimères de tubuline
par neurone mammifère est une estimation de littérature courante ; il varie avec
le type cellulaire et l'état de polymérisation, et devrait être sourcé
précisément avant toute publication. Les figures de décohérence corrigées de
Hagan et al. sont citées dans une fourchette 10⁻⁵–10⁻³ s selon les hypothèses de
blindage retenues ; vérifier l'article pour la valeur exacte à citer.

---

*Assistance Multi IA · Assistant-Multi-AI@proton.me · Genève*
