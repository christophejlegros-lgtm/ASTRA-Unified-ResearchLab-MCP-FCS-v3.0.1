# Pré-enregistrement E1 — Le simulateur d'organoïde d'ASTRA face à des organoïdes humains réels
# Preregistration E1 — ASTRA's organoid simulator against real human brain organoids

**Fixé le / Fixed on : 23 septembre 2026, avant tout accès aux données / before any access to the data.**
L'empreinte SHA-256 de ce fichier est communiquée à l'auteur avant la réception des
données ; tout écart ultérieur sera déclaré en section 8.
The SHA-256 of this file is given to the author before the data are received; any later
deviation will be declared in section 8.

© Genève 2026 Christophe Jean Legros · Assistance Multi IA

---

## 1. Question

Le simulateur `OrganoidMEA` (`src/engine/neuroplatform.ts`), décrit dans le code comme un
« modèle d'organoïde à 128 électrodes biophysiquement plausible », est-il **empiriquement
adéquat** pour les statistiques de l'activité **spontanée** d'organoïdes cérébraux humains
réels enregistrés sur MEA ?

Is the `OrganoidMEA` simulator, described in the code as a "biophysically-plausible
128-electrode organoid model", **empirically adequate** for the **spontaneous**-activity
statistics of real human brain organoids recorded on MEAs?

Hors portée : l'activité évoquée par stimulation ; les proxys de conscience ; les
hypothèses FCS de niveau I (qui exigent une préparation de laboratoire).

## 2. Données / Data

- **Source :** DANDI Archive, dandiset **001603** — *Preconfigured neuronal firing sequences
  in human brain organoids* — CC-BY-4.0 — doi:10.48324/dandi.001603/0.260923.0623 ;
  publication associée : Van der Molen et al. (2025), *Nature Neuroscience*,
  doi:10.1038/s41593-025-02111-0.
- **Fichiers retenus (les trois plus petits du sous-ensemble organoïdes humains « HO »,
  choisis sur leur seule taille, avant tout examen du contenu) :**

  | Fichier | Taille annoncée |
  |---|---|
  | `sub-HO6/sub-HO6_ses-20250924T002106.nwb` | 30,4 Mo |
  | `sub-HO7/sub-HO7_ses-20250924T002328.nwb` | 18,3 Mo |
  | `sub-HO8/sub-HO8_ses-20250924T002134.nwb` | 21,3 Mo |

- **Unités analysées :** toutes les unités de la table `units` (spikes triés) de chaque
  fichier. Un fichier sans table `units` est exclu. Si moins de deux fichiers sont
  exploitables, l'épreuve est déclarée **non réalisée**.
- **Fenêtre :** les `T = min(durée enregistrée, 600 s)` premières secondes de chaque
  enregistrement.

## 3. Modèle éprouvé / Model under test

`OrganoidMEA` avec sa configuration par défaut (`baselineRateHz = 2.0`, 128 électrodes),
activité spontanée seule (aucune stimulation), simulée pendant la même durée `T` que
l'enregistrement réel correspondant, pour **10 graines** (1 à 10). La valeur simulée
d'une statistique est la **médiane sur les 10 graines**. Chaque électrode simulée est
traitée comme un train de spikes, au même titre qu'une unité réelle.

## 4. Statistiques / Statistics

Calculées **par le même code** sur trains réels et simulés.
Train actif : taux ≥ 0,05 Hz sur la fenêtre.

| # | Statistique | Définition |
|---|---|---|
| S1 | Taux médian | médiane, sur les trains actifs, de (nombre de spikes / T), en Hz |
| S2 | Irrégularité | médiane du coefficient de variation des intervalles inter-spikes (écart-type / moyenne), sur les trains d'au moins 20 spikes |
| S3 | Bouffées de réseau | nombre de bouffées par minute. Population : somme des spikes des trains actifs en intervalles de 25 ms. Bouffée : suite maximale d'intervalles consécutifs dont le compte dépasse moyenne + 3 écarts-types (calculés sur toute la fenêtre), et dans laquelle au moins 25 % des trains actifs émettent au moins un spike |
| S4 | Part en bouffées | fraction des spikes des trains actifs située dans une bouffée de réseau |
| S5 | Synchronie | médiane du *spike time tiling coefficient* (STTC, Cutts & Eglen 2014, Δt = 20 ms) sur toutes les paires des 50 trains actifs les plus actifs (ou de tous s'ils sont moins de 50) |

## 5. Règles de décision / Decision rules

Pour chaque statistique, la valeur réelle est calculée **par organoïde** ; l'intervalle de
référence est `R = [min, max]` sur les organoïdes retenus.

| Verdict | S1–S4 | S5 |
|---|---|---|
| **compatible** | valeur simulée ∈ R | valeur simulée ∈ R |
| **marginal** | ∈ [min / 2, 2 × max] hors R | ∈ [min − 0,05, max + 0,05] hors R |
| **incompatible** | hors de la bande marginale | hors de la bande marginale |

**Verdict global :**
- **ADÉQUAT** : aucune statistique incompatible et au moins 3 compatibles ;
- **INADÉQUAT** : au moins 2 statistiques incompatibles ;
- **PARTIELLEMENT ADÉQUAT** : tous les autres cas.

Les seuils (facteur 2, ± 0,05, 25 %, 3 écarts-types, 25 ms, 20 ms) sont des conventions
**normatives** déclarées ici ; ils ne sont pas ajustables après examen des données.

## 6. Prédiction a priori de l'auditeur / Auditor's a-priori prediction

Lecture du code (`OrganoidMEA.advance`) : chaque électrode émet un processus de Poisson
homogène **indépendant**, avec une réfractarité absolue de 1,5 ms et **aucun couplage entre
électrodes** en activité spontanée. D'où, pour le modèle : S2 ≈ 1, S3 ≈ 0, S4 ≈ 0, S5 ≈ 0.

Le modèle échouera donc si, et seulement si, les organoïdes réels présentent une activité
irrégulière, en bouffées et synchrone ; il passera si leur activité spontanée est, elle
aussi, proche d'un Poisson indépendant. **C'est une prédiction risquée : les données
peuvent la démentir dans les deux sens.**

## 7. Ce qui ne peut pas être éprouvé ici / What cannot be tested here

Les proxys Φ̃, GW̃ et PAD̃ (`src/engine/acm.ts`) exigent des poids synaptiques, une
partition en couches et une énergie, qu'un enregistrement MEA ne fournit pas. Ils sont
déclarés **non opérationnalisables** sur ces données : c'est un résultat de l'épreuve, et
non un échec technique.

## 8. Écarts / Deviations

*(à compléter après l'analyse ; vide au moment du dépôt)*
