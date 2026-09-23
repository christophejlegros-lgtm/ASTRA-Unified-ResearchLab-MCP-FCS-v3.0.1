/**
 * ASTRA × FCS — Bibliography
 * ══════════════════════════
 * Transcribed from the source documents' own apparatus. Every entry below
 * carries the (v) mark in documents I v1.5, II v1.4, IV v1.2 or synthesis
 * S-1.5: its DOI was resolved, at drafting or on 19 September 2026, against
 * the DOI Foundation Handle system or against Crossref metadata.
 *
 * ⚠ No DOI here was minted, reconstructed or inferred by ASTRA. An entry the
 * source documents do not carry does not appear. `doiVerified` records the
 * source's verification, not a check performed by this module.
 *
 * © 2026 Christophe Jean Legros — Geneva · Assistance Multi IA
 */

export interface Reference {
  key: string;
  citation: string;
  doi: string;
  /** Carries the source documents' (v) mark — DOI resolved on 19·09·2026. */
  doiVerified: true;
  /** Which strand, sub-criterion or role the FCS layer draws it for. */
  usedFor: string;
}

export const REFERENCES: readonly Reference[] = Object.freeze([
  // ── Level I · carrier, fields, ephaptic coupling ──
  {
    key: 'chiang2019',
    citation: 'Chiang, C.-C., Shivacharan, R. S., Wei, X., Gonzalez-Reyes, L. E., & Durand, D. M. (2019). Slow periodic activity in the longitudinal hippocampal slice can self-propagate non-synaptically by a mechanism consistent with ephaptic coupling. The Journal of Physiology, 597(1), 249–269.',
    doi: '10.1113/JP276904', doiVerified: true,
    usedFor: 'Level-I strand 1 — the programme\'s reference preparation: propagation persists under synaptic blockade and yields to an opposing field.',
  },
  {
    key: 'anastassiou2011',
    citation: 'Anastassiou, C. A., Perin, R., Markram, H., & Koch, C. (2011). Ephaptic coupling of cortical neurons. Nature Neuroscience, 14(2), 217–223.',
    doi: '10.1038/nn.2727', doiVerified: true,
    usedFor: 'Level I — ephaptic coupling as a measured route.',
  },
  {
    key: 'anastassiou2015',
    citation: 'Anastassiou, C. A., & Koch, C. (2015). Ephaptic coupling to endogenous electric field activity: why bother? Current Opinion in Neurobiology, 31, 95–103.',
    doi: '10.1016/j.conb.2014.09.002', doiVerified: true,
    usedFor: 'Level I — the field hypothesis stated as a live question.',
  },
  {
    key: 'buzsaki2012',
    citation: 'Buzsáki, G., Anastassiou, C. A., & Koch, C. (2012). The origin of extracellular fields and currents — EEG, ECoG, LFP and spikes. Nature Reviews Neuroscience, 13(6), 407–420.',
    doi: '10.1038/nrn3241', doiVerified: true,
    usedFor: 'The generative dependence between field and spiking observables — why the difficulty is one of conjunction, not measurement.',
  },
  {
    key: 'hodgkin1952',
    citation: 'Hodgkin, A. L., & Huxley, A. F. (1952). A quantitative description of membrane current and its application to conduction and excitation in nerve. The Journal of Physiology, 117(4), 500–544.',
    doi: '10.1113/jphysiol.1952.sp004764', doiVerified: true,
    usedFor: 'Sub-criterion d — a quantity entering the carrier\'s equations as a coefficient is at distance 1.',
  },
  {
    key: 'sykova2008',
    citation: 'Syková, E., & Nicholson, C. (2008). Diffusion in brain extracellular space. Physiological Reviews, 88(4), 1277–1340.',
    doi: '10.1152/physrev.00027.2007', doiVerified: true,
    usedFor: 'Class 4 — extracellular medium, volume fraction and resistivity as the parametric coupling gain.',
  },
  {
    key: 'traynelis1989',
    citation: 'Traynelis, S. F., & Dingledine, R. (1989). Role of extracellular space in hyperosmotic suppression of potassium-induced electrographic seizures. Journal of Neurophysiology, 61(5), 927–938.',
    doi: '10.1152/jn.1989.61.5.927', doiVerified: true,
    usedFor: 'Priority for the osmotic level-I strand.',
  },
  {
    key: 'dudek1990',
    citation: 'Dudek, F. E., Obenaus, A., & Tasker, J. G. (1990). Osmolality-induced changes in extracellular volume alter epileptiform bursts independent of chemical synapses in the rat. Neuroscience Letters, 120(2), 267–270.',
    doi: '10.1016/0304-3940(90)90056-F', doiVerified: true,
    usedFor: 'Priority for the osmotic level-I strand.',
  },
  {
    key: 'ding2016',
    citation: 'Ding, F., O\'Donnell, J., Xu, Q., Kang, N., Goldman, N., & Nedergaard, M. (2016). Changes in the composition of brain interstitial ions control the sleep-wake cycle. Science, 352(6285), 550–555.',
    doi: '10.1126/science.aad4821', doiVerified: true,
    usedFor: 'Bridge auxiliary — why covariation alone does not discriminate: ionic composition varies with state.',
  },

  // ── Level IV · signatures ──
  {
    key: 'dehaene2011',
    citation: 'Dehaene, S., & Changeux, J.-P. (2011). Experimental and theoretical approaches to conscious processing. Neuron, 70(2), 200–227.',
    doi: '10.1016/j.neuron.2011.03.018', doiVerified: true,
    usedFor: 'Sub-criterion τ — the ~100 ms episode window on level-IV signatures.',
  },
  {
    key: 'koch2016',
    citation: 'Koch, C., Massimini, M., Boly, M., & Tononi, G. (2016). Neural correlates of consciousness: progress and problems. Nature Reviews Neuroscience, 17(5), 307–321.',
    doi: '10.1038/nrn.2016.22', doiVerified: true,
    usedFor: 'Sub-criterion τ — the episode window; level-IV signatures.',
  },
  {
    key: 'casali2013',
    citation: 'Casali, A. G., Gosseries, O., Rosanova, M., Boly, M., Sarasso, S., Casali, K. R., Casarotto, S., Bruno, M.-A., Laureys, S., Tononi, G., & Massimini, M. (2013). A theoretically based index of consciousness independent of sensory processing and behavior. Science Translational Medicine, 5(198), 198ra105.',
    doi: '10.1126/scitranslmed.3006294', doiVerified: true,
    usedFor: 'Level IV — the perturbational complexity index as the polynomial observable ASTRA does not instrument.',
  },
  {
    key: 'aru2012',
    citation: 'Aru, J., Bachmann, T., Singer, W., & Melloni, L. (2012). Distilling the neural correlates of consciousness. Neuroscience & Biobehavioral Reviews, 36(2), 737–746.',
    doi: '10.1016/j.neubiorev.2011.12.003', doiVerified: true,
    usedFor: 'The coarse tripartition prerequisites / substrate / consequences, refined into the five causal roles.',
  },
  {
    key: 'degraaf2012',
    citation: 'de Graaf, T. A., Hsieh, P.-J., & Sack, A. T. (2012). The "correlates" in neural correlates of consciousness. Neuroscience & Biobehavioral Reviews, 36(1), 191–197.',
    doi: '10.1016/j.neubiorev.2011.05.012', doiVerified: true,
    usedFor: 'Same tripartition; the distinction the five roles refine.',
  },

  // ── The ordering criterion and its philosophy ──
  {
    key: 'lewontin1974',
    citation: 'Lewontin, R. C. (1974/2006). The analysis of variance and the analysis of causes. Reprint, International Journal of Epidemiology, 35(3), 520–525.',
    doi: '10.1093/ije/dyl062', doiVerified: true,
    usedFor: '§1 — the share of variance "due to" a factor depends on the population and range considered, not on the factor alone.',
  },
  {
    key: 'waters2007',
    citation: 'Waters, C. K. (2007). Causes that make a difference. The Journal of Philosophy, 104(11), 551–579.',
    doi: '10.5840/jphil2007104111', doiVerified: true,
    usedFor: '§1 — singling out "the" cause presupposes a contrast and a reference set of interventions.',
  },
  {
    key: 'woodward2010',
    citation: 'Woodward, J. (2010). Causation in biology: Stability, specificity, and the choice of levels of explanation. Biology & Philosophy, 25(3), 287–318.',
    doi: '10.1007/s10539-010-9200-z', doiVerified: true,
    usedFor: '§1 — a hierarchy that does not declare its question presupposes one.',
  },
  {
    key: 'okasha2011',
    citation: 'Okasha, S. (2011). Theory choice and social choice: Kuhn versus Arrow. Mind, 120(477), 83–115.',
    doi: '10.1093/mind/fzr010', doiVerified: true,
    usedFor: 'Prohibition 4 — Arrow\'s theorem applied to theory choice; why Pareto dominance is the only admissible rule.',
  },
  {
    key: 'craver2007',
    citation: 'Craver, C. F. (2007). Explaining the brain: Mechanisms and the mosaic unity of neuroscience. Oxford University Press.',
    doi: '10.1093/acprof:oso/9780199299317.001.0001', doiVerified: true,
    usedFor: 'Prohibition 5 — fat-handedness; interventionist tests do not cleanly separate constitution from causation.',
  },
  {
    key: 'baumgartner2016',
    citation: 'Baumgartner, M., & Gebharter, A. (2016). Constitutive relevance, mutual manipulability, and fat-handedness. The British Journal for the Philosophy of Science, 67(3), 731–756.',
    doi: '10.1093/bjps/axv003', doiVerified: true,
    usedFor: 'Prohibition 5 — the limit of the ablation criterion.',
  },
  {
    key: 'kleiner2021',
    citation: 'Kleiner, J., & Hoel, E. (2021). Falsification and consciousness. Neuroscience of Consciousness, 2021(1), niab001.',
    doi: '10.1093/nc/niab001', doiVerified: true,
    usedFor: 'Why a declared bridge auxiliary is required before any level-I result can touch level-IV signatures.',
  },
  {
    key: 'fink2021',
    citation: 'Fink, S. B., Kob, L., & Lyre, H. (2021). A structural constraint on neural correlates of consciousness. Philosophy and the Mind Sciences, 2, 7.',
    doi: '10.33735/phimisci.2021.79', doiVerified: true,
    usedFor: 'M2 — the structural constraint the grain hypothesis states.',
  },
  {
    key: 'kriegeskorte2008',
    citation: 'Kriegeskorte, N., Mur, M., & Bandettini, P. (2008). Representational similarity analysis – connecting the branches of systems neuroscience. Frontiers in Systems Neuroscience, 2, 4.',
    doi: '10.3389/neuro.06.004.2008', doiVerified: true,
    usedFor: 'M2 — the phenomenal similarity matrix against which variance is partitioned.',
  },
  {
    key: 'bishop2006',
    citation: 'Bishop, R. C., & Atmanspacher, H. (2006). Contextual emergence in the description of properties. Foundations of Physics, 36(12), 1753–1777.',
    doi: '10.1007/s10701-006-9082-8', doiVerified: true,
    usedFor: 'The core\'s weak-emergence clause.',
  },

  // ── Neurochemical classes ──
  {
    key: 'sommer1991',
    citation: 'Sommer, B., Köhler, M., Sprengel, R., & Seeburg, P. H. (1991). RNA editing in brain controls a determinant of ion flow in glutamate-gated channels. Cell, 67(1), 11–19.',
    doi: '10.1016/0092-8674(91)90568-J', doiVerified: true,
    usedFor: 'Class 8 — Q/R editing of the GluA2 transcript fixes a conductance parameter without being fast.',
  },
  {
    key: 'traynelis2010',
    citation: 'Traynelis, S. F., Wollmuth, L. P., McBain, C. J., Menniti, F. S., Vance, K. M., Ogden, K. K., Hansen, K. B., Yuan, H., Myers, S. J., & Dingledine, R. (2010). Glutamate receptor ion channels: structure, regulation, and function. Pharmacological Reviews, 62(3), 405–496.',
    doi: '10.1124/pr.109.002451', doiVerified: true,
    usedFor: 'Class 2a / class 3 — ionotropic receptors as valve, transmitter amino acids as generator.',
  },
  {
    key: 'connors2004',
    citation: 'Connors, B. W., & Long, M. A. (2004). Electrical synapses in the mammalian brain. Annual Review of Neuroscience, 27(1), 393–418.',
    doi: '10.1146/annurev.neuro.26.041002.131128', doiVerified: true,
    usedFor: 'Class 2a — connexins.',
  },
  {
    key: 'chesler2003',
    citation: 'Chesler, M. (2003). Regulation and modulation of pH in the brain. Physiological Reviews, 83(4), 1183–1221.',
    doi: '10.1152/physrev.00010.2003', doiVerified: true,
    usedFor: 'Class 10a — protons as fast local modulator.',
  },
  {
    key: 'paoletti2009',
    citation: 'Paoletti, P., Vergnano, A. M., Barbour, B., & Casado, M. (2009). Zinc at glutamatergic synapses. Neuroscience, 158(1), 126–136.',
    doi: '10.1016/j.neuroscience.2008.01.061', doiVerified: true,
    usedFor: 'Class 12a — synaptic zinc as fast modulator, distinct from 12b as cofactor.',
  },
  {
    key: 'garthwaite2008',
    citation: 'Garthwaite, J. (2008). Concepts of neural nitric oxide-mediated transmission. European Journal of Neuroscience, 27(11), 2783–2802.',
    doi: '10.1111/j.1460-9568.2008.06285.x', doiVerified: true,
    usedFor: 'Class 10b — nitric oxide as diffuse modulator; the confound it introduces.',
  },
  {
    key: 'marder2012',
    citation: 'Marder, E. (2012). Neuromodulation of neuronal circuits: back to the future. Neuron, 76(1), 1–11.',
    doi: '10.1016/j.neuron.2012.09.010', doiVerified: true,
    usedFor: 'Class 6 — neuromodulators set network gain through receptors and second messengers.',
  },
  {
    key: 'marder2006',
    citation: 'Marder, E., & Goaillard, J.-M. (2006). Variability, compensation and homeostasis in neuron and network function. Nature Reviews Neuroscience, 7(7), 563–574.',
    doi: '10.1038/nrn1949', doiVerified: true,
    usedFor: 'Why a functional profile tolerates parametric variation — the core\'s multiple realisability in practice.',
  },
  {
    key: 'franks2008',
    citation: 'Franks, N. P. (2008). General anaesthesia: from molecular targets to neuronal pathways of sleep and arousal. Nature Reviews Neuroscience, 9(5), 370–386.',
    doi: '10.1038/nrn2372', doiVerified: true,
    usedFor: '§1 — anaesthetics enhancing GABA-A conductance are both clinically central and theoretically discriminating.',
  },
  {
    key: 'attwell2001',
    citation: 'Attwell, D., & Laughlin, S. B. (2001). An energy budget for signaling in the grey matter of the brain. Journal of Cerebral Blood Flow & Metabolism, 21(10), 1133–1145.',
    doi: '10.1097/00004647-200110000-00001', doiVerified: true,
    usedFor: 'Classes 2b and 7 — the pump\'s share of the energy budget; the permissive role.',
  },
  {
    key: 'howarth2012',
    citation: 'Howarth, C., Gleeson, P., & Attwell, D. (2012). Updated energy budgets for neural computation in the neocortex and cerebellum. Journal of Cerebral Blood Flow & Metabolism, 32(7), 1222–1232.',
    doi: '10.1038/jcbfm.2012.35', doiVerified: true,
    usedFor: 'Class 7 — energy metabolites.',
  },
  {
    key: 'magistretti2015',
    citation: 'Magistretti, P. J., & Allaman, I. (2015). A cellular perspective on brain energy metabolism and functional imaging. Neuron, 86(4), 883–901.',
    doi: '10.1016/j.neuron.2015.03.035', doiVerified: true,
    usedFor: 'Class 7 — energy metabolites.',
  },
  {
    key: 'pajevic2014',
    citation: 'Pajevic, S., Basser, P. J., & Fields, R. D. (2014). Role of myelin plasticity in oscillations and synchrony of neuronal activity. Neuroscience, 276, 135–147.',
    doi: '10.1016/j.neuroscience.2013.11.007', doiVerified: true,
    usedFor: 'Class 11 — lipids and myelin as the parametric capacitance term.',
  },
  {
    key: 'joels2009',
    citation: 'Joëls, M., & Baram, T. Z. (2009). The neuro-symphony of stress. Nature Reviews Neuroscience, 10(6), 459–466.',
    doi: '10.1038/nrn2632', doiVerified: true,
    usedFor: 'Classes 9a / 9b — the genomic and non-genomic hormone functions separated as distinct pairs.',
  },
  {
    key: 'saper2010',
    citation: 'Saper, C. B., Fuller, P. M., Pedersen, N. P., Lu, J., & Scammell, T. E. (2010). Sleep state switching. Neuron, 68(6), 1023–1042.',
    doi: '10.1016/j.neuron.2010.11.032', doiVerified: true,
    usedFor: 'Bridge auxiliary — the sleep–wake cycle as the covariation window.',
  },
  {
    key: 'xie2013',
    citation: 'Xie, L., Kang, H., Xu, Q., Chen, M. J., Liao, Y., Thiyagarajan, M., O\'Donnell, J., Christensen, D. J., Nicholson, C., Iliff, J. J., Takano, T., Deane, R., & Nedergaard, M. (2013). Sleep drives metabolite clearance from the adult brain. Science, 342(6156), 373–377.',
    doi: '10.1126/science.1241224', doiVerified: true,
    usedFor: 'Bridge auxiliary — volume fraction varies across the sleep–wake cycle.',
  },
  {
    key: 'miao2024',
    citation: 'Miao, A., Luo, T., Hsieh, B., Edge, C. J., Gridley, M., Wong, R. T. C., Constandinou, T. G., Wisden, W., & Franks, N. P. (2024). Brain clearance is reduced during sleep and anesthesia. Nature Neuroscience, 27(6), 1046–1050.',
    doi: '10.1038/s41593-024-01638-y', doiVerified: true,
    usedFor: 'Bridge auxiliary — the contested counterpart to Xie et al.; why the strand is revised before the field hypothesis.',
  },
  {
    key: 'fornasiero2018',
    citation: 'Fornasiero, E. F., Mandad, S., Wildhagen, H., Alevra, M., Rammner, B., Keihani, S., … Rizzoli, S. O. (2018). Precisely measured protein lifetimes in the mouse brain reveal differences across tissues and subcellular fractions. Nature Communications, 9, 4230.',
    doi: '10.1038/s41467-018-06519-0', doiVerified: true,
    usedFor: 'Class 8 — the τ range of the gene → transcript → protein route.',
  },
  {
    key: 'holt2013',
    citation: 'Holt, C. E., & Schuman, E. M. (2013). The central dogma decentralized: New perspectives on RNA function and local translation in neurons. Neuron, 80(3), 648–657.',
    doi: '10.1016/j.neuron.2013.10.036', doiVerified: true,
    usedFor: 'Class 8 — local translation shortens the lower bound of the τ range.',
  },
  {
    key: 'davis1984',
    citation: 'Davis, H. P., & Squire, L. R. (1984). Protein synthesis and memory: A review. Psychological Bulletin, 96(3), 518–559.',
    doi: '10.1037/0033-2909.96.3.518', doiVerified: true,
    usedFor: 'Class 8 — no effect within the episode window; slow drift.',
  },
  {
    key: 'rosenmund1996',
    citation: 'Rosenmund, C., & Stevens, C. F. (1996). Definition of the readily releasable pool of vesicles at hippocampal synapses. Neuron, 16(6), 1197–1207.',
    doi: '10.1016/S0896-6273(00)80146-4', doiVerified: true,
    usedFor: 'Class 3 — the generator\'s fast τ bound.',
  },
  {
    key: 'friston2010',
    citation: 'Friston, K. (2010). The free-energy principle: a unified brain theory? Nature Reviews Neuroscience, 11(2), 127–138.',
    doi: '10.1038/nrn2787', doiVerified: true,
    usedFor: 'Level III — predictive coding; the family of approximations a theory must declare.',
  },
]);

export const REFERENCE_BY_KEY: ReadonlyMap<string, Reference> =
  new Map(REFERENCES.map((r) => [r.key, r]));

export const DOI_NOTE = Object.freeze({
  fr: 'Chaque entrée porte la mention (v) des documents sources : DOI résolu, lors de la rédaction ou le ' +
      '19 septembre 2026, contre le système Handle de la DOI Foundation ou contre les métadonnées Crossref. ' +
      'ASTRA n\'a ni forgé ni reconstruit de DOI.',
  en: 'Every entry carries the source documents\' (v) mark: DOI resolved, at drafting or on 19 September 2026, ' +
      'against the DOI Foundation Handle system or against Crossref metadata. ASTRA minted and reconstructed no DOI.',
});
