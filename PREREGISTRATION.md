# Pré-enregistrement — prédictions de niveau substrat du FCS
# Preregistration — substrate-level predictions of FCS

**Statut / Status : BROUILLON NON DÉPOSÉ / UNFILED DRAFT** — à compléter par l'auteur puis à
déposer (OSF Registries ou équivalent horodaté) **avant** toute session sur tissu vivant.
To be completed by the author, then filed (OSF Registries or an equivalent time-stamped
registry) **before** any session on living tissue.

© Genève 2026 Christophe Jean Legros · Assistance Multi IA

---

## 0. Pourquoi ce document / Why this document

ASTRA ne traite aujourd'hui que des données simulées. Le jour où une donnée vivante le
traversera, elle ne vaudra comme épreuve que si la prédiction a été fixée avant elle.
Ce document fixe ce qui peut l'être à partir de la série FCS (document I v1.5, §4.3 ;
document IV v1.2, §4 ; document II v1.4, §6.2) et **marque explicitement comme
« À FIXER » tout paramètre que ces documents ne donnent pas**. Aucune valeur numérique
n'y est inventée.

ASTRA handles only simulated data today. When living data first passes through it, that
data will count as a test only if the prediction was fixed beforehand. This document
fixes what the FCS series allows, and **explicitly marks as "TO BE SET" every parameter
those documents do not supply**. No numerical value is invented here.

Chaque hypothèse est reliée au champ correspondant de l'évaluateur
`fcs_withdrawal` (`src/engine/fcs/withdrawal.ts`), de sorte que l'issue observée s'y
saisit telle quelle.

## 1. Portée / Scope

| | |
|---|---|
| Niveau visé | **I — substrat** (hypothèse du champ, ceinture) ; **IV** seulement via l'auxiliaire de pont (H3) |
| Hors portée | la contrainte de substrat (noyau) — non révisable dans le programme ; toute revendication phénoménale |
| Préparation de référence | tranche longitudinale d'hippocampe, paradigme de Chiang et al. (2019), doi:10.1113/JP276904 |
| Texte de référence des protocoles | document IV v1.2, §4 (dispositif osmotique, confondants, contrôles) |

## 2. Hypothèses / Hypotheses

### H1 — Autonomie causale de la propagation par le champ (dispositif 1)

- **FR.** Sous blocage synaptique complet, une activité périodique lente se propage à
  travers une coupure complète de la tranche, et cette propagation est abolie par un
  champ d'opposition.
- **EN.** Under complete synaptic blockade, slow periodic activity propagates across a
  complete cut of the slice, and this propagation is abolished by an opposing field.
- **Ce que H1 établit / What H1 establishes :** l'autonomie causale du champ comme voie
  de propagation (niveau I). **Ce qu'elle n'établit pas :** l'indépendance des
  observables de champ et de décharge, ni aucune signature de conscience.
- **Champ ASTRA :** `ephapticPropagationUnderBlockade`.

### H2 — Variation avec le rapport courant/champ (dispositif 2, osmotique)

- **FR.** Sous blocage synaptique, sur la même préparation, l'efficacité de la
  propagation varie avec la fraction volumique de l'espace extracellulaire dans le sens
  prédit par la résistivité : sa **réduction la facilite**, son **expansion l'entrave**,
  à potassium extracellulaire et volume cellulaire contrôlés.
- **EN.** Under synaptic blockade, on the same preparation, propagation efficacy varies
  with the extracellular volume fraction in the direction predicted by resistivity: its
  **reduction facilitates**, its **expansion hinders**, with extracellular potassium and
  cell volume controlled.
- **Confondants déclarés (document IV §4) :** libération vésiculaire sous hypertonicité ;
  variation des concentrations extracellulaires ; régulation du volume cellulaire — dont
  deux mesurables sans être supprimables. Leur mesure fait partie du protocole.
- **Champ ASTRA :** `efficacyVariesWithVolumeFraction`.

### H3 — Auxiliaire de pont (niveau I → niveau IV)

- **FR.** Chez l'animal non anesthésié, les variations physiologiques du couplage par le
  champ covarient avec les signatures de niveau IV au cours du cycle veille-sommeil
  (H3a), et une **intervention locale** sur son gain, à composition ionique mesurée,
  déplace les marqueurs locaux de ces signatures (H3b).
- **EN.** In the non-anaesthetised animal, physiological variations of field coupling
  covary with level-IV signatures across the sleep–wake cycle (H3a), and a **local
  intervention** on its gain, with ionic composition measured, shifts the local markers
  of those signatures (H3b).
- **Règle d'interprétation pré-enregistrée :** la covariation seule (H3a) **ne tranche
  pas** — la composition ionique varie avec l'état de vigilance (Ding et al., 2016,
  doi:10.1126/science.aad4821) et une cause commune neuromodulatrice peut agir en amont.
  Seule H3b porte la valeur du volet.
- **Champs ASTRA :** `bridgeCovariation` (H3a), `bridgeLocalIntervention` (H3b).

## 3. Ordre de révision déclaré / Declared revision order

En cas d'issue défavorable, la révision suit l'ordre commun aux documents I, II et IV,
fixé **avant** les données :

```
1 procédure d'inférence et auxiliaires de mesure
2 auxiliaire de pont
3 hypothèse de grain (M2)
4 critère d'individuation (M3)
5 thèse kinesthésique
6 hypothèse du champ
```

Conséquence opérationnelle : un échec de H3 révise d'abord l'auxiliaire de pont, pas
l'hypothèse du champ ; un échec de H1 ou de H2, **après contrôle des auxiliaires de
mesure (rang 1)**, porte sur l'hypothèse du champ. Une issue non réglée reste
« indéterminée » et n'est jamais comptée comme négative.

## 4. Paramètres à fixer par l'auteur / Parameters to be set by the author

Les documents sources ne fixent pas ces valeurs ; elles **doivent** l'être avant dépôt.

| Paramètre | H1 | H2 | H3 |
|---|---|---|---|
| Espèce, âge, préparation exacte | À FIXER | À FIXER | À FIXER |
| Agents et concentrations du blocage synaptique ; critère de complétude | À FIXER | À FIXER | — |
| Observable primaire et sa définition opératoire (p. ex. vitesse, probabilité de franchissement) | À FIXER | À FIXER | À FIXER |
| Niveaux de fraction volumique et méthode de mesure | — | À FIXER | À FIXER |
| Signatures de niveau IV retenues et leur mesure | — | — | À FIXER |
| Taille d'échantillon et sa justification (analyse de puissance) | À FIXER | À FIXER | À FIXER |
| Test statistique, seuil de décision, correction pour comparaisons multiples | À FIXER | À FIXER | À FIXER |
| Critères d'exclusion (tranches, animaux, enregistrements) | À FIXER | À FIXER | À FIXER |
| Règle d'arrêt | À FIXER | À FIXER | À FIXER |
| Critère d'issue « réglée » vs « indéterminée » | À FIXER | À FIXER | À FIXER |

## 5. Engagements / Commitments

1. Déposer ce document, complété, sur un registre horodaté avant la première session.
2. Publier toutes les issues, favorables, défavorables ou indéterminées.
3. Saisir chaque issue dans `fcs_withdrawal` telle quelle et publier le rapport produit.
4. Signaler tout écart au protocole déposé, avec sa justification.
5. Toute expérimentation animale ou sur tissu humain relève d'une approbation éthique
   institutionnelle réelle ; le moniteur « IRB » d'ASTRA, qui opère sur des biomarqueurs
   synthétiques, n'en tient pas lieu.

## Références

- Chiang, C.-C., Shivacharan, R. S., Wei, X., Gonzalez-Reyes, L. E., & Durand, D. M. (2019). *J. Physiol.*, 597(1), 249–269. doi:10.1113/JP276904
- Ding, F., O'Donnell, J., Xu, Q., Kang, N., Goldman, N., & Nedergaard, M. (2016). *Science*, 352(6285), 550–555. doi:10.1126/science.aad4821
- Kleiner, J., & Hoel, E. (2021). Falsification and consciousness. *Neurosci. Conscious.*, niab001. doi:10.1093/nc/niab001
- Série FCS : document I v1.5, document II v1.4, document IV v1.2, synthèse S-1.5 (19 septembre 2026), dossier `FCS v1.5/` de ce dépôt.
