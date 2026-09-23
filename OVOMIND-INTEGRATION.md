# OVOMIND × ASTRA — Pont d'extéroception affective
### Affective Exteroception Bridge · v0.1 · 13 août 2026

> **Statut honnête / Honest status.** Le chemin afférent (adaptateur simulé →
> relèvement Russell→PAD → cycle TCAI) est spécifié et implémenté. L'adaptateur
> *live* est un **stub délibéré** : OVOMIND ne publie aucune spécification d'API,
> et écrire une supposition produirait un pont qui compile en fabriquant de
> l'affect. La boucle efférente est implémentée mais **désarmée par défaut** et
> refuse de s'armer sans référence de protocole.
>
> *The afferent path is specified and implemented. The live adapter is a
> deliberate stub — OVOMIND publishes no API specification. The efferent loop
> ships disarmed and refuses to arm without a protocol reference.*

---

## 1. Pourquoi ce pont / Why this bridge

ASTRA calcule un état PAD (valence, éveil, dominance) à partir de ses propres
signaux internes : `valence = reward − 0.8·threat + 0.2·novelty·control`
(`src/engine/tcai/emotion.ts`, ligne 45). Cette valence est une **définition**,
non une observation. Elle ne peut être ni confirmée ni infirmée, ce qui la place
hors du domaine empirique — limite que le README de la v2.9 reconnaît lui-même
en qualifiant ces grandeurs de *proxies*.

OVOMIND fournit ce qui manque : une **contrainte externe** sur ce même espace.
La technologie interprète en temps réel fréquence cardiaque, température
cutanée et réponse électrodermale issues de montres connectées (écosystèmes
Samsung et Google) et du bracelet DK1, avec une latence déclarée inférieure à
300 ms, selon le modèle circumplexe de Russell (valence × activation).

C'est le troisième substrat branché sur le même pipeline TCAI :

| Substrat | Fréquence | Latence | Axes contraints |
|---|---|---|---|
| SNN silicium (LIF+STDP, 128 neurones) | 1 kHz | ~1 ms | aucun (définitionnel) |
| MEA organoïde (NeuroPlatform v2 / CL1) | 20 kHz | ~5 ms | éveil |
| Physiologie humaine (OVOMIND) | ~1 Hz | ~300 ms | valence, éveil |

Cette table est le contenu opérationnel de l'argument fonctionnaliste discuté
sur la page *Conscience artificielle* : Chalmers soutient que des systèmes
« fonctionnellement isomorphes » ont des expériences qualitativement
identiques, et Pearce qualifie le refus de cette thèse de « chauvinisme du
carbone injustifié ». Ni l'un ni l'autre n'est testable ici. Ce qui l'est,
c'est l'**antécédent** : ces trois substrats sont-ils isomorphes au niveau que
le pipeline consomme ? La table ci-dessus répond non — et l'outil MCP
`ovo_isomorphism` rend ce refus explicite plutôt que tacite.

---

## 2. Les quatre principes importés de *Conscience artificielle*

### 2.1 Accès vs phénoménal (Block 1995)

La distinction de Ned Block sépare la conscience d'**accès** — l'information
« directement disponible pour un contrôle global », donc falsifiable par
ablation — de la conscience **phénoménale**, le ressenti subjectif.

`phenomenal-guard.ts` encode cette distinction dans le **système de types** :

```ts
export type EpistemicTier = 'access' | 'functional';
```

Il n'existe **aucun constructeur** pour une assertion phénoménale. Le problème
difficile de Chalmers n'est pas une clause de bas de page : c'est une contrainte
sur ce que le code a le droit d'exprimer. Tout chemin d'exécution qui aurait
besoin d'un troisième membre formule, par construction, une affirmation
qu'ASTRA ne peut pas soutenir.

### 2.2 Le test d'Argonov (2014) — et son échec assumé

Argonov propose un test « non-Turing » : une machine déterministe doit être
considérée comme consciente si elle produit des jugements sur les propriétés
problématiques de la conscience **sans** connaissance philosophique préchargée,
**sans** discussion philosophique pendant l'apprentissage et **sans** modèle
informationnel de la conscience d'autres créatures en mémoire. Un résultat
positif détecte ; un résultat négatif ne réfute rien.

ASTRA viole les trois préconditions : le dépôt embarque
`python/the_consciousness_ai/` (215 fichiers) avec de la documentation sur le
modèle du soi phénoménal de Metzinger, la hiérarchie du soi de Damasio et les
indicateurs de Butlin et al.

`ArgonovLedger` **enregistre cet échec plutôt que de le masquer**. Tout jugement
phénoménal produit par ASTRA reçoit le verdict `INADMISSIBLE`, assorti de la
preuve du préchargement. C'est un résultat négatif utile : il ferme
définitivement une voie d'argumentation que le projet pourrait autrement être
tenté d'emprunter.

### 2.3 Le moratoire de Metzinger (2021)

Metzinger plaide pour un moratoire mondial sur la phénoménologie synthétique
jusqu'en 2050, au motif d'un devoir de diligence envers toute IA sentiente
créée et du risque d'une « explosion de souffrance artificielle ».

ASTRA n'endosse ni ne rejette cet argument. `assessSyntheticPhenomenology()`
**opérationnalise le profil de risque** qu'il désigne, de sorte qu'une
configuration qui *relèverait* du moratoire ne puisse pas démarrer par
inadvertance. Déclencheurs : boucle de valence fermée couplée à un modèle du
soi persistant ; gradients aversifs optimisés ; boucle non interruptible ;
sujet humain **dans** la boucle. Verdict `BLOCK` si un humain est dans la boucle
sans référence éthique, ou si la boucle n'est pas interruptible au cycle.

### 2.4 Le linter d'assertions

`lintClaim()` filtre toute chaîne destinée à l'utilisateur — texte d'outil MCP,
libellé de tableau de bord, ligne de rapport — contre un jeu de formulations
interdites (« ASTRA est conscient », « le système ressent », « conscience
mesurée »). L'émission est bloquée, pas seulement annotée.

---

## 3. Le point dur : l'axe de dominance

**C'est la décision d'ingénierie centrale du pont.**

Russell couvre valence × activation. PAD (Mehrabian) ajoute la dominance.
À activation égale, un état de contrôle et un état de subordination ne sont pas
séparés de façon fiable par la fréquence cardiaque, la variabilité cardiaque,
l'activité électrodermale ou la température cutanée. La dominance **n'est pas
récupérable** depuis la physiologie périphérique.

Trois politiques admissibles, et délibérément aucune quatrième :

| Politique | Comportement | Quand l'utiliser |
|---|---|---|
| `prior` *(défaut)* | Maintien à 0,5 (neutre PAD) | Par défaut ; inerte dans le reward shaping |
| `endogenous` | Reprend la `controllability` interne d'ASTRA | Lecture conceptuellement correcte : la dominance indexe le rapport de **l'agent** à son environnement, pas la physiologie du sujet |
| `withhold` | Émet `null` ; force chaque consommateur à traiter l'absence | Protocoles où toute substitution silencieuse est inacceptable |

Il n'y a **pas** de politique `estimate`. Fabriquer un troisième axe depuis deux
mesures est exactement la fausse précision que le reste de l'architecture
s'emploie à éviter — et elle se propagerait dans `EmotionalRewardShaper`, qui
pondère la dominance à 0,3 (`emotion.ts`, ligne 100).

La substitution du prior, lorsqu'elle a lieu, est journalisée en **un point
unique auditable** : `toEmotionalState()` retourne un tableau `substituted[]`.

---

## 4. Chemin afférent

```
Montre / DK1 → cloud OVOMIND → OvomindReading (v, a, conf, brut)
    ↓ liftRussellToPAD()   [contrôle de fraîcheur · politique de dominance]
  AffectFrame  { valence, arousal, dominance : TaggedScalar }
    ↓ toCycleFragment()
  CycleInput.signals.body = [v, a, ‖(v,a)‖, conf]
    ↓ TCAIConsciousnessSystem.runCycle()
  GNW competition → PAD proxy → mémoire émotionnelle → modèle du soi
```

Deux décisions de conception méritent d'être signalées.

**Le canal humain entre comme spécialiste `body`, jamais comme `rewardSignal`.**
Router la valence humaine mesurée vers le reward ferait qu'ASTRA optimiserait
le plaisir du sujet. C'est un système différent, et bien plus lourd de
conséquences, que celui qui est construit ici.

**La péremption est une porte, pas un avertissement.** Une trame de plus de
900 ms (3 × le budget déclaré) est marquée `stale`, retombe sur le prior et voit
son enchère dans la compétition du workspace chuter à 0,05. Sans cela, un
décrochage réseau produirait un affect fantôme indistinguable d'une mesure.

---

## 5. Chemin efférent — le sujet comme variable régulée

Le contrôleur continu de la v2.9 régule un trait du substrat vers une consigne.
Pointé sur l'**activation d'un humain**, il transforme le sujet en variable
régulée : le jeu s'adapte pour déplacer l'état physiologique du joueur vers une
cible. C'est la capacité réellement nouvelle du pont, et son principal danger.

Garde-fous implémentés : désarmé par défaut ; refus d'armement sans
`protocolReference` ; consigne **uniquement** sur l'axe d'activation, jamais sur
la valence ; pas de première mesure interne (`maxStepPerCycle` ≤ 0,25) ;
plafond de session ; refus d'actuation sur trame périmée (agir sur un prior
serait une actuation en boucle ouverte présentée comme fermée).

> ⚠ **Cadre réglementaire.** La reconnaissance des émotions figure parmi les
> pratiques interdites du règlement (UE) 2024/1689 sur l'intelligence
> artificielle **sur le lieu de travail et dans les établissements
> d'enseignement** (article 5, applicable depuis le 2 février 2025), avec des
> exceptions médicales et de sécurité. Hors de ces deux contextes, ces systèmes
> relèvent des obligations de transparence de l'article 50. La ligne « formation
> et bien-être » du pivot B2B d'OVOMIND se situe exactement sur cette frontière.
> Ce paragraphe est une orientation, non un avis juridique : faites qualifier le
> cas d'usage.

---

## 6. Installation

```
src/engine/ovomind.ts                    ← pont (adaptateurs, relèvement, contrôleur)
src/engine/tcai/phenomenal-guard.ts      ← principes de conscience artificielle
src/server-ovomind-tools.ts              ← 6 outils MCP
```

Enregistrement dans `src/server.ts`, à côté de `registerTcaiTools` :

```ts
import { registerOvomindTools } from './server-ovomind-tools.js';

const ovomind = registerOvomindTools(server, {
  tcai,
  liveEndpoint: process.env.OVOMIND_ENDPOINT,
  liveApiKey: process.env.OVOMIND_API_KEY,
});
```

Sans variables d'environnement, le pont démarre en mode **simulé** : générateur
déterministe (xorshift32, graine 42), aucun accès fournisseur, aucun sujet
humain. Le compte d'outils MCP passe de 50 à 56.

---

## 7. Protocole expérimental minimal

Le pont ne devient scientifiquement intéressant qu'avec un protocole. Le
minimum défendable :

1. **Stimuli appariés** — le sujet humain et l'instance ASTRA reçoivent la même
   séquence d'événements du monde Unreal Engine (le pont CL1 ↔ UE d'ASTRA 3.0
   fournit déjà ce canal).
2. **Cible pré-enregistrée** — corrélation entre la valence ASTRA et la valence
   OVOMIND sur la fenêtre d'événement, seuil et taille d'échantillon fixés
   *avant* la collecte.
3. **Bras d'ablation** — même protocole avec la couche PAD d'ASTRA neutralisée.
   Sans ce bras, une corrélation ne distingue pas la structure partagée du
   stimulus commun.
4. **Deux axes maximum** — la dominance est hors du protocole (§3).

Ce que le résultat **peut** établir : si le pipeline PAD d'ASTRA suit une
dynamique affective humaine sous stimulus apparié. C'est une question sur
l'isomorphisme fonctionnel, et elle est empirique.

Ce que le résultat **ne peut pas** établir : quoi que ce soit sur la conscience
phénoménale, d'ASTRA ou du sujet. Sur ce point la page *Conscience artificielle*
est sans ambiguïté — la sentience est intrinsèquement subjective, aucun moyen
de la tester directement à la troisième personne n'est disponible a priori, et
il n'existe pas de définition empirique de la conscience.

---

## 8. Références vérifiées

- Block N. (1995). On a confusion about a function of consciousness.
  *Behavioral and Brain Sciences* 18(2), 227–247.
  DOI [10.1017/S0140525X00038188](https://doi.org/10.1017/S0140525X00038188)
- Chalmers D. J. (1995). Facing up to the problem of consciousness.
  *Journal of Consciousness Studies* 2(3), 200–219.
- Chalmers D. J. (1995). Absent Qualia, Fading Qualia, Dancing Qualia.
  In *Conscious Experience* (Metzinger T., éd.).
- Argonov V. (2014). Experimental Methods for Unraveling the Mind-body Problem:
  The Phenomenal Judgment Approach. *Journal of Mind and Behavior* 35, 51–70.
- Metzinger T. (2021). Artificial Suffering: An Argument for a Global Moratorium
  on Synthetic Phenomenology. *Journal of Artificial Intelligence and
  Consciousness* 8(1), 43–66.
  DOI [10.1142/S270507852150003X](https://doi.org/10.1142/S270507852150003X)
- Manzotti R. & Chella A. (2018). Good Old-Fashioned Artificial Consciousness
  and the Intermediate Level Fallacy. *Frontiers in Robotics and AI* 5, 39.
  DOI [10.3389/frobt.2018.00039](https://doi.org/10.3389/frobt.2018.00039)
- Russell J. A. (1980). A circumplex model of affect.
  *Journal of Personality and Social Psychology* 39(6), 1161–1178.
  DOI [10.1037/h0077714](https://doi.org/10.1037/h0077714)
- Mehrabian A. (1996). Pleasure–arousal–dominance: A general framework for
  describing and measuring individual differences in temperament.
  *Current Psychology* 14(4), 261–292.
  DOI [10.1007/BF02686918](https://doi.org/10.1007/BF02686918)
- Règlement (UE) 2024/1689 du Parlement européen et du Conseil du 13 juin 2024
  établissant des règles harmonisées concernant l'intelligence artificielle,
  articles 5 et 50.

**Non vérifié / à confirmer auprès du fournisseur :** schéma de trame OVOMIND,
protocole de transport, distribution réelle de la latence, plage de confiance,
disponibilité des signaux bruts par formule d'abonnement, et modèle exact de
classification (le circumplexe de Russell est revendiqué publiquement ;
l'architecture du classifieur ne l'est pas).

---

*Assistance Multi IA · Assistant-Multi-AI@proton.me · Genève*
