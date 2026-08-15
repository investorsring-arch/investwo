/**
 * ════════════════════════════════════════════════════════════════════
 *  FISCAL ENGINE v2 — Douane.ia · CGI 2026
 *  Single Source of Truth : taux, échéances, circulaires, calculs
 *
 *  Architecture "Engine-First" :
 *  Ce fichier est la SEULE référence pour toutes les données fiscales.
 *  Les pages UI (CGI Search, Simulateur, Calendrier…) importent
 *  window.FiscalEngine et n'ont aucune donnée fiscale propre.
 *
 *  ── CORRECTIONS v2 ────────────────────────────────────────────────
 *  [C1] IS ≤300K → 20% en 2026 (fin convergence Art. 247-XXXVII-A)
 *  [C2] TVA 7% retiré : Art. 100 ABROGÉ dans CGI 2026
 *  [C3] IR tranche finale : 37% ✓ (Art. 73-I)
 *  [C4] dividendes2026 : 10% (taux cible atteint — 4ème palier)
 *  [C5] RAS loyers : 5% (Art. 73-II-A) — VEILLE_DATA v1 corrigé
 *  [C6] ECHEANCES ref : Art. 125 quinquies (autoliquidation)
 *  [C7] CSS : seuil entrée 1M MAD / seuil taux max 40M MAD (distincts)
 *  [C8] ECHEANCES id:19 : dividendes 2026 à 10% (taux cible)
 *  [C9] CIRC_DB (24 mesures NC 733–737) intégré — retiré de l'HTML
 * ════════════════════════════════════════════════════════════════════
 */

;(function(global) {
  'use strict';

  /* ─────────────────────────────────────────────────────────────────
   *  1. RÉFÉRENTIEL DES TAUX — CGI 2026 (UNIQUE SOURCE)
   * ───────────────────────────────────────────────────────────────── */

  const TAUX = {

    /* ── Impôt sur les Sociétés ── Art. 19-I + Art. 247-XXXVII-A */
    IS: {
      // Taux définitifs 2026 — convergence 4 ans (2023-2026) achevée
      tranches: [
        { max: 300000,    taux: 0.20, label: '≤ 300 000 MAD' },   // [C1] 20% (était 10% avant 2023)
        { max: 1000000,   taux: 0.20, label: '300 001 – 1 000 000 MAD' },
        { max: 100000000, taux: 0.20, label: '1 000 001 – 100 000 000 MAD' },
        { max: Infinity,  taux: 0.35, label: '≥ 100 000 000 MAD' },
      ],
      etablissementCredit: 0.40,    // Art. 19-I-C : banques, BAM, CDG, assurances
      cotisationMinimale: {
        taux:                  0.0025,  // 0,25% du CA — Art. 144-I-D
        tauxPetrolier:         0.0015,  // 0,15% — pétrole, gaz, eau — Art. 144-I-D
        tauxProfessionLiberal: 0.04,    // 4% — Art. 89-I-12°
        plancher:              3000,    // DH minimum IS — Art. 144-I-D
        plancherIR:            1500,    // DH minimum IR — Art. 144-I-D
        exoneration3ans:       true,    // 3 premiers exercices exonérés — Art. 144-I-C
      },
      acomptes: {
        nombre:        4,
        quotePart:     0.25,           // 25% × IS exercice référence — Art. 170-I
        calendrier:    ['31 mars', '30 juin', '30 septembre', '31 décembre'],
      },
      css: {
        seuilEntree:   1000000,        // [C7] 1M MAD — Art. 267 : seuil d'assujettissement
        seuilTauxMax:  40000000,       // [C7] 40M MAD — Art. 269 : seuil taux max (5%)
        tauxParPalier: [
          { min: 1000000,  max: 5000000,   taux: 0.015 },
          { min: 5000000,  max: 10000000,  taux: 0.025 },
          { min: 10000000, max: 40000000,  taux: 0.035 },
          { min: 40000000, max: Infinity,  taux: 0.050 },
        ],
        echeance2028: true,            // Prorogée LF 2026 jusqu'en 2028
      },
      ref: 'Art. 19-I, 144, 170, 247-XXXVII-A, 267-273 CGI 2026',
    },

    /* ── TVA — Art. 99 CGI 2026 — Architecture 2 taux finalisée ── */
    TVA: {
      normal:   0.20,   // Art. 99-A : taux normal (large spectre)
      reduit:   0.10,   // Art. 99-B : hôtellerie, restauration, huiles alimentaires,
                        //             banques, photovoltaïque, chauffe-eau solaires,
                        //             gaz butane, opérations Mourabaha/Ijara, valeurs mob.
      // [C2] Taux 7% ABROGÉ (Art. 100 abrogé CGI 2026)
      // [C2] Taux 14% ABROGÉ (Art. 100 abrogé CGI 2026)
      peche:    0.07,   // Taux RAS spécifique pêche maritime (armateur/adjudicataire)
      exoneres: 0.00,   // Art. 91-92 : farine, sucre, eau, électricité, médicaments (exon. totale)
      tauxDisplayUI: [
        { taux: '20%', label: 'Taux normal — Art. 99-A' },
        { taux: '10%', label: 'Taux réduit — Art. 99-B' },
        { taux: '0%',  label: 'Exonérations — Art. 91-92' },
      ],
      ref: 'Art. 99, 91, 92 CGI 2026 — Art. 100 ABROGÉ',
    },

    /* ── IR — Barème progressif 2026 — Art. 73-I ── */
    IR: {
      tranches: [
        { max: 40000,    taux: 0.00, label: '≤ 40 000 MAD/an' },   // Seuil relevé LF 2025
        { max: 60000,    taux: 0.10, label: '40 001 – 60 000 MAD' },
        { max: 80000,    taux: 0.20, label: '60 001 – 80 000 MAD' },
        { max: 100000,   taux: 0.30, label: '80 001 – 100 000 MAD' },
        { max: 180000,   taux: 0.34, label: '100 001 – 180 000 MAD' },
        { max: Infinity, taux: 0.37, label: '> 180 000 MAD' },      // [C3] 37% (Art. 73-I)
      ],
      seuilExoneration: 40000,          // Relevé LF n°60-24 (LF 2025)
      reductionChargeFamille: 600,      // DH/pers. — Art. 74-I (LF 2025 : relevé de 360 à 600)
      plafondChargeFamille: 3600,       // DH max (6 personnes × 600)
      tauxFoncierInf120k: 0.10,         // Art. 73-II-B-5° : rev. fonciers < 120 000 MAD
      tauxFoncierSup120k: 0.15,         // Art. 73-II-C-4° : rev. fonciers ≥ 120 000 MAD
      tauxFoncierLibSurf: 0.20,         // LF 2025 : option taux libératoire revenus fonciers
      tauxActionsCotees: 0.15,          // Art. 73-II-C-1°a
      tauxDividendes: 0.10,             // Art. 73-II-B-7°
      tauxProduitsBrutsNonResidents: 0.10,
      tauxLocationPP: 0.05,             // [C5] Art. 73-II-A (5%, non 15%)
      ref: 'Art. 73 CGI 2026 — modifié LF n°60-24 (2025) et LF n°50-25 (2026)',
    },

    /* ── Retenues à la source ── */
    RAS: {
      salaires:             null,   // Barème IR progressif
      dividendes2026:       0.10,   // [C4] 10% — taux CIBLE atteint (4ème palier 2023-2026)
      dividendes2027plus:   0.10,   // Maintenu définitivement
      honoraires:           0.10,   // Art. 73-II-B-2°
      loyersProfessionnels: 0.05,   // [C5] Art. 19-IV-A + Art. 73-II-A — 5% (RAS par entités ≥200M CA)
      nonResidents:         0.10,   // Art. 15 CGI
      loyers_PP:            0.05,   // Art. 73-II-A : RAS 5% loyers PP régime RNR/RNS
      ref: 'Art. 152–160 CGI · LF 2025–2026',
    },

    /* ── Pénalités — Art. 208 CGI 2026 ── */
    PENALITES: {
      retardPaiement: {
        penaliteBase:        0.10,    // IS/IR/Enreg : 10%
        penaliteBaseCourte:  0.05,    // Retard ≤ 30j : 5%
        penaliteBaseTVA:     0.20,    // TVA / retenues à la source : 20%
        majorationInitiale:  0.05,    // + 5% premier mois (Art. 208-I)
        majorationMensuelle: 0.005,   // + 0,5%/mois supplémentaire (Art. 208-I)
        minimumEnreg:        100,     // 100 MAD minimum — droits d'enregistrement
      },
      defautDeclaration: {
        premiereInfraction:     0.15,
        recidive:               0.25,
        taxationOffice:         1.00,
        insuffisance:           0.15,
        manoeuvresFrauduleuses: 1.00,
      },
      acomptes: {
        toleranceSansPenalite: 0.10,  // 10% tolérance
        penaliteInsuffisance:  0.10,
      },
      ref: 'Art. 184–210 CGI 2026',
    },

    /* ── Droits d'enregistrement ── Art. 133 CGI 2026 ── */
    DE: {
      taux: [
        { taux: '6%',   label: 'Fonds de commerce, clientèle' },
        { taux: '5%',   label: 'Mutations immeubles bâtis' },
        { taux: '3%',   label: 'Constitutions/augmentations capital' },
        { taux: '1.5%', label: 'Adjudications, partage indivision' },
        { taux: '1%',   label: 'Cessions fonds commerce' },
      ],
      ref: 'Art. 133 CGI 2026',
    },

    /* ── Cotisations sociales CNSS ── indicatif ── */
    CNSS: {
      patronalePS:   0.1148,
      salarialePS:   0.0448,
      plafondMensuel: 6000,
      ref: 'Loi 65-00 CNSS',
    },
  };


  /* ─────────────────────────────────────────────────────────────────
   *  2. RÉFÉRENTIEL DES ÉCHÉANCES — données corrigées
   * ───────────────────────────────────────────────────────────────── */

  const ECHEANCES_DATA = [
    {
      id: 1, code: 'IS-ANN',
      name: 'IS annuel — déclaration + solde',
      cat: 'IS', freq: 'Annuel', impact: 3,
      profiles: ['pme','transit','invest'],
      due: { month: 2, day: 31 },
      desc: 'Déclaration du résultat fiscal et paiement du solde IS dans les 3 mois suivant la clôture. Exercice civil → 31 mars. Téléprocédure SIMPL-IS obligatoire. Taux 2026 : 20% (≤100M MAD) ou 35% (≥100M MAD).',
      ref: 'Art. 20 CGI',
      penCode: 'retardPaiement + defautDeclaration',
    },
    {
      id: 2, code: 'RAS-ANN',
      name: 'RAS annuelles — déclarations',
      cat: 'IR', freq: 'Annuel', impact: 3,
      profiles: ['pme','transit','invest'],
      due: { month: 2, day: 2 },
      desc: 'Déclarations annuelles retenues à la source (salaires, dividendes, honoraires) au titre de l\'année N-1. SIMPL-IR obligatoire.',
      ref: 'Art. 152 CGI',
      penCode: 'defautDeclaration',
    },
    {
      id: 3, code: 'IR-ANN',
      name: 'IR annuel global — personnes physiques',
      cat: 'IR', freq: 'Annuel', impact: 2,
      profiles: ['pme','ae'],
      due: { month: 3, day: 1 },
      desc: 'Déclaration annuelle IR (revenus professionnels, fonciers, capitaux mobiliers). SIMPL-IR. Seuil exonération 2026 : 40 000 MAD (relevé LF 2025). Taux max : 37%.',
      ref: 'Art. 82 CGI',
      penCode: 'retardPaiement + defautDeclaration',
    },
    {
      id: 4, code: 'DELAIS-PAI',
      name: 'Délais de paiement — Loi 69-21',
      cat: 'TVA', freq: 'Annuel', impact: 2,
      profiles: ['pme','transit','invest'],
      due: { month: 3, day: 1 },
      desc: 'Déclaration factures impayées hors délais légaux pour CA entre 2 M et 50 M MAD. Plateforme SIMPL-Délais (tax.gov.ma).',
      ref: 'Loi 69-21',
      penCode: 'defautDeclaration',
    },
    {
      id: 5, code: 'TVA-M04',
      name: 'TVA mensuelle — avril',
      cat: 'TVA', freq: 'Mensuel', impact: 3,
      profiles: ['pme','transit','invest'],
      due: { month: 4, day: 31 },
      desc: 'Télédéclaration + télépaiement TVA du mois d\'avril avant le 31 mai. Régime mensuel — SIMPL-TVA. Taux 2026 : 20% (normal) et 10% (réduit). Taux 14% et 7% ABROGÉS.',
      ref: 'Art. 110 CGI',
      penCode: 'retardPaiement',
    },
    {
      id: 6, code: 'RAS-SAL-04',
      name: 'IR RAS — salaires et honoraires avril',
      cat: 'IR', freq: 'Mensuel', impact: 2,
      profiles: ['pme','transit','invest'],
      due: { month: 4, day: 31 },
      desc: 'Versement RAS IR sur salaires, rentes viagères, honoraires et dividendes versés en avril. SIMPL-IR.',
      ref: 'Art. 174 CGI',
      penCode: 'retardPaiement',
    },
    {
      id: 7, code: 'TVA-AUTOLIQ',
      name: 'Autoliquidation TVA — achats hors champ',
      cat: 'TVA', freq: 'Mensuel', impact: 1,
      profiles: ['pme','invest'],
      due: { month: 4, day: 31 },
      desc: 'Déclaration TVA autoliquidée sur achats auprès de fournisseurs hors champ ou exonérés sans droit à déduction. Régime optionnel LF 2024.',
      ref: 'Art. 125 quinquies CGI',  // [C6] corrigé (était Art. 88 CGI — territorialité)
      penCode: 'retardPaiement',
    },
    {
      id: 8, code: 'RAS-NR',
      name: 'RAS — prestataires non-résidents',
      cat: 'IR', freq: 'Mensuel', impact: 2,
      profiles: ['invest','transit'],
      due: { month: 4, day: 31 },
      desc: 'Retenue à la source sur rémunérations versées à des personnes physiques ou morales non-résidentes (Art. 15 CGI). Taux : 10% honoraires, 10% non-résidents.',
      ref: 'Art. 160 CGI',
      penCode: 'retardPaiement',
    },
    {
      id: 9, code: 'TVA-NUM',
      name: 'TVA services numériques — non-résidents',
      cat: 'TVA', freq: 'Mensuel', impact: 1,
      profiles: ['pme','invest'],
      due: { month: 4, day: 31 },
      desc: 'TVA sur services dématérialisés fournis à distance par des non-résidents sans établissement au Maroc. Déclaration mensuelle plateforme DGI.',
      ref: 'Art. 115 bis CGI',  // [C6] corrigé (était Art. 88-2 inexistant)
      penCode: 'retardPaiement',
    },
    {
      id: 10, code: 'IS-AP2',
      name: 'Acompte IS — 2ème versement',
      cat: 'IS', freq: 'Trimestriel', impact: 3,
      profiles: ['pme','transit','invest'],
      due: { month: 5, day: 30 },
      desc: '2ème acompte IS (25% IS exercice de référence). Calculé sur taux 2026 définitifs (20% ou 35%). Télépaiement SIMPL-IS.',
      ref: 'Art. 170-I CGI',
      penCode: 'acomptes',
    },
    {
      id: 11, code: 'TVA-M05',
      name: 'TVA mensuelle — mai',
      cat: 'TVA', freq: 'Mensuel', impact: 2,
      profiles: ['pme','transit','invest'],
      due: { month: 5, day: 30 },
      desc: 'Télédéclaration TVA du mois de mai avant fin juin. SIMPL-TVA.',
      ref: 'Art. 110 CGI',
      penCode: 'retardPaiement',
    },
    {
      id: 12, code: 'TVA-T2',
      name: 'TVA trimestrielle — T2',
      cat: 'TVA', freq: 'Trimestriel', impact: 3,
      profiles: ['pme','ae'],
      due: { month: 6, day: 31 },
      desc: 'Déclaration et paiement TVA du 2ème trimestre avant fin juillet. Régime trimestriel.',
      ref: 'Art. 110 CGI',
      penCode: 'retardPaiement',
    },
    {
      id: 13, code: 'IS-AP3',
      name: 'Acompte IS — 3ème versement',
      cat: 'IS', freq: 'Trimestriel', impact: 3,
      profiles: ['pme','transit','invest'],
      due: { month: 8, day: 30 },
      desc: '3ème acompte IS. Dispense possible si déclaration déposée 15 jours avant échéance et acomptes ≥ IS estimé.',
      ref: 'Art. 170-I CGI',
      penCode: 'acomptes',
    },
    {
      id: 14, code: 'TP',
      name: 'Taxe professionnelle 2026',
      cat: 'TP', freq: 'Annuel', impact: 1,
      profiles: ['pme','transit','ae'],
      due: { month: 9, day: 31 },
      desc: 'Paiement après émission du rôle. Exonération totale 5 premières années pour nouvelles entreprises. Taxation sur la valeur locative.',
      ref: 'Loi 47-06',
      penCode: 'defautDeclaration',
    },
    {
      id: 15, code: 'TSC',
      name: 'Taxe services communaux (TSC)',
      cat: 'TP', freq: 'Annuel', impact: 1,
      profiles: ['pme','transit'],
      due: { month: 9, day: 31 },
      desc: 'TSC calculée sur valeur locative des locaux professionnels. Émise concomitamment à la taxe professionnelle.',
      ref: 'Loi 47-06',
      penCode: 'defautDeclaration',
    },
    {
      id: 16, code: 'IS-AP4',
      name: 'Acompte IS — 4ème versement',
      cat: 'IS', freq: 'Trimestriel', impact: 3,
      profiles: ['pme','transit','invest'],
      due: { month: 11, day: 31 },
      desc: 'Dernier acompte IS de l\'exercice. Majoration de 10% si écart IS réel / acomptes versés > 10%.',
      ref: 'Art. 170-I CGI',
      penCode: 'acomptes',
    },
    {
      id: 17, code: 'CSS',
      name: 'CSS — bénéfices ≥ 1M MAD',
      cat: 'CSS', freq: 'Annuel', impact: 2,
      profiles: ['pme','invest'],
      due: { month: 2, day: 31 },
      desc: 'Contribution Sociale de Solidarité. Seuil d\'entrée : 1M MAD (Art. 267). Taux max 5% (≥40M MAD). Prorogée jusqu\'en 2028 (LF 2026). Non déductible de l\'IS.',
      ref: 'Art. 267-273 CGI',
      penCode: 'retardPaiement',
    },
    {
      id: 18, code: 'PRIX-TRANSFERT',
      name: 'Déclaration prix de transfert',
      cat: 'IS', freq: 'Annuel', impact: 2,
      profiles: ['invest'],
      due: { month: 2, day: 31 },
      desc: 'Documentation et déclaration des prix de transfert (Art. 214-III). Concomitant à la déclaration de résultat. Amende 500 000 MAD pour défaut (Art. 199 bis).',
      ref: 'Art. 154 ter et 214-III CGI',
      penCode: 'defautDeclaration',
    },
    {
      id: 19, code: 'RAS-DIV',
      name: 'RAS dividendes distribués',
      cat: 'IR', freq: 'Ponctuel', impact: 2,
      profiles: ['pme','invest'],
      due: null,
      desc: 'RAS sur dividendes : 10% en 2026 (taux cible définitif — 4ème et dernier palier 2023-2026). Applicable dès le paiement des dividendes.',  // [C8] corrigé
      ref: 'Art. 158 CGI · Art. 19 LF 2026',
      penCode: 'retardPaiement',
    },
  ];


  /* ─────────────────────────────────────────────────────────────────
   *  3. VEILLE LÉGALE — corrigée
   * ───────────────────────────────────────────────────────────────── */

  const VEILLE_DATA = [
    {
      id: 'v1', statut: 'nouveau',
      titre: 'LF 2026 · Finalisation IS/TVA/IR — taux définitifs',
      texte: 'IS : taux 20% (≤100M MAD) et 35% (≥100M MAD) désormais permanents. TVA : architecture 20%/10% finalisée — taux 7% et 14% abrogés. RAS loyers professionnels : 5% (Art. 73-II-A), par entités ≥200M MAD CA, État et organismes publics.',  // [C5] corrigé
      source: 'NC n°737 · LF n°50-25', date: 'Fév. 2026',
    },
    {
      id: 'v2', statut: 'nouveau',
      titre: 'CSS reconduite jusqu\'en 2028 · Seuil entrée 1M MAD',
      texte: 'La contribution sociale de solidarité (Art. 267-273) est prolongée jusqu\'en 2028 (LF 2026). Rappel : seuil d\'assujettissement = 1M MAD de bénéfice net. Taux maximal 5% à partir de 40M MAD. Non déductible de l\'IS.',
      source: 'Art. 267-273 CGI · NC n°737', date: 'En vigueur 2026',
    },
    {
      id: 'v3', statut: 'actif',
      titre: 'RAS dividendes 2026 : 10% — taux cible atteint',
      texte: 'La retenue à la source sur dividendes atteint son taux cible de 10% en 2026, après 4 paliers progressifs : 13,75% (2023) → 12,50% (2024) → 11,25% (2025) → 10% (2026). Taux définitif à compter de 2026.',  // [C4]
      source: 'Art. 158 CGI · LF n°50-25', date: 'En vigueur 2026',
    },
    {
      id: 'v4', statut: 'actif',
      titre: 'Auto-liquidation TVA hors champ — Art. 125 quinquies',
      texte: 'Régime d\'auto-liquidation TVA pour achats auprès de fournisseurs hors champ ou exonérés sans droit à déduction. En vigueur depuis juillet 2024. Précisions LF 2026 sur le périmètre (Art. 125 quinquies CGI).',
      source: 'Art. 125 quinquies CGI · LF 2024–2026', date: 'Juil. 2024',  // [C6]
    },
    {
      id: 'v5', statut: 'info',
      titre: 'Loi 69-21 · Délais de paiement B2B',
      texte: 'Obligation de déclarer les factures impayées au-delà des délais légaux. Applicable aux entreprises CA ≥ 2M MAD. Plateforme SIMPL-Délais (tax.gov.ma).',
      source: 'Loi 69-21', date: '2025–2026',
    },
    {
      id: 'v6', statut: 'nouveau',
      titre: 'Exonération retraites CIMR secteur privé (LF 2026)',
      texte: 'Les pensions versées par la CIMR aux retraités du secteur privé dans le cadre de contrats d\'assurance retraite complémentaire de groupe sont désormais exonérées de l\'IR (Art. 57-27° CGI modifié LF 2026).',
      source: 'Art. 57-27° CGI · NC n°737', date: 'En vigueur 2026',
    },
    {
      id: 'v7', statut: 'info',
      titre: 'Dématérialisation totale — SIMPL obligatoire (adresse email libre)',
      texte: 'LF 2026 supprime l\'obligation d\'une adresse électronique chez un prestataire certifié. Tous les contribuables fournissent leur email de choix à la DGI via SIMPL (formulaire ADC450). Toutes les notifications DGI sont désormais électroniques.',
      source: 'Art. 145, 155 CGI · NC n°737', date: 'En vigueur 2026',
    },
  ];


  /* ─────────────────────────────────────────────────────────────────
   *  4. CIRCULAIRES DB — NC 733 / 735 / 736 / 737
   *     [C9] Déplacé de cgi_search.html → source unique ici
   * ───────────────────────────────────────────────────────────────── */

  const CIRC_DB = {
    circulaires: [
      { id: 'NC733', num: 733, annee: '2023', lf: 'LF 2023', lfNum: 'n°50-22', lf_dahir: 'Dahir n°1-22-120 du 14 décembre 2022', date: '23 février 2023', impotPhare: 'IS', pages: 84 },
      { id: 'NC735', num: 735, annee: '2024', lf: 'LF 2024', lfNum: 'n°55-23', lf_dahir: 'Dahir n°1-23-91 du 14 décembre 2023', date: '9 février 2024', impotPhare: 'TVA', pages: 62 },
      { id: 'NC736', num: 736, annee: '2025', lf: 'LF 2025', lfNum: 'n°60-24', lf_dahir: 'Dahir n°1-24-65 du 13 décembre 2024', date: '7 mars 2025', impotPhare: 'IR', pages: 91 },
      { id: 'NC737', num: 737, annee: '2026', lf: 'LF 2026', lfNum: 'n°50-25', lf_dahir: 'Dahir n°1-25-67 du 10 décembre 2025', date: '27 février 2026', impotPhare: 'Multi', pages: 74 },
    ],
    mesures: [
      // ── NC 733 · LF 2023 · IS ─────────────────────────────────
      {
        id: 'NC733-IS-01', nc: 'NC733', annee: '2023', theme: 'IS', criticite: 'HIGH',
        titre: 'Réforme globale des taux IS — convergence progressive 2023-2026',
        articles: ['Art. 19 CGI', 'Art. 247-XXXVII-A'],
        impact: ['PME', 'GE', 'Investisseurs'],
        entreeVigueur: '1er janvier 2023',
        taux: { avant: 'Multiple : 10%/20%/26%/31%/37%', apres: '2026 : 20% (≤100M) · 35% (≥100M) · Définitifs' },
        resume: 'Lancement sur 4 ans (2023-2026) de la convergence IS vers deux taux cibles : 20% PME et 35% grandes entreprises (BN ≥100M MAD). Cotisation minimale réduite simultanément.',
        detail: `Trajectoire des taux IS par palier annuel :

→ PME (≤300 000 MAD) :
  2023 : 12,5% · 2024 : 15% · 2025 : 17,5% · 2026 : 20% (définitif)

→ Bénéfice 300K–1M MAD : 20% sur toute la période

→ Bénéfice 1M–100M MAD : convergence progressive vers 20%

→ Grande entreprise (≥100M MAD) :
  2023 : 23,75% · 2024 : 27,5% · 2025 : 31,25% · 2026 : 35% (définitif)

Cotisation minimale : taux réduits simultanément (plancher 3 000 MAD IS / 1 500 MAD IR).
Acomptes provisionnels : calculés aux taux de l'exercice courant (Art. 247 transitoire).`,
        ref: 'NC n°733, Art. 19 + Art. 247-XXXVII-A CGI — LF 2023 (n°50-22) — tax.gov.ma',
      },
      {
        id: 'NC733-IS-02', nc: 'NC733', annee: '2023', theme: 'IS', criticite: 'HIGH',
        titre: 'Réduction progressive RAS dividendes (15%→10% sur 4 ans)',
        articles: ['Art. 4 CGI', 'Art. 13 CGI', 'Art. 158 CGI'],
        impact: ['Investisseurs', 'GE'],
        entreeVigueur: '1er janvier 2023',
        taux: { avant: 'RAS dividendes : 15%', apres: '2023:13,75% · 2024:12,5% · 2025:11,25% · 2026:10% (cible)' },
        resume: 'Réduction sur 4 ans de la RAS sur dividendes de 15% à 10% (taux cible atteint en 2026). Les distributions antérieures à 2023 restent soumises à 15%.',
        detail: `Trajectoire RAS dividendes : 13,75% (2023) → 12,50% (2024) → 11,25% (2025) → 10,00% (2026, définitif).

Important : produits distribués à partir de bénéfices d'exercices antérieurs au 1er janvier 2023 → taux 15% maintenu.

Objectif : améliorer l'attractivité des investissements en fonds propres et aligner sur les meilleures pratiques OCDE.`,
        ref: 'NC n°733, Art. 4 et 13 CGI — LF 2023 (n°50-22) — tax.gov.ma',
      },
      {
        id: 'NC733-IS-03', nc: 'NC733', annee: '2023', theme: 'IS', criticite: 'MEDIUM',
        titre: 'CFC — Exonération quinquennale recalibrée + provisions pour investissement',
        articles: ['Art. 6 CGI', 'Art. 247 CGI'],
        impact: ['Investisseurs', 'GE'],
        entreeVigueur: '1er janvier 2023',
        taux: { avant: 'Taux CFC : 8,75%', apres: 'Trajectoire vers 20% en 2026 + provisions déductibles' },
        resume: 'Exonération quinquennale CFC computée à partir de la date de création (non d\'obtention du statut). Mesure compensatoire : possibilité de constituer des provisions pour investissement déductibles.',
        detail: `1. EXONÉRATION QUINQUENNALE : désormais calculée à partir de la date de création de la société CFC.

2. PROVISIONS POUR INVESTISSEMENT : ouverture aux sociétés CFC de constituer des provisions pour investissement déductibles du résultat fiscal, compensant la hausse progressive du taux pendant la période transitoire.

3. EXCLUSION DES ENTREPRISES FINANCIÈRES DES ZAI : établissements de crédit, assurances et intermédiaires d'assurances installés dans les ZAI exclus des avantages fiscaux ZAI dès 2023.`,
        ref: 'NC n°733, Art. 6 et 247 CGI — LF 2023 (n°50-22) — tax.gov.ma',
      },
      {
        id: 'NC733-IR-01', nc: 'NC733', annee: '2023', theme: 'IR', criticite: 'HIGH',
        titre: 'Révision mode d\'imposition IR — retour au barème progressif global',
        articles: ['Art. 25 CGI', 'Art. 73 CGI', 'Art. 86 CGI'],
        impact: ['Salariés', 'PME'],
        entreeVigueur: '1er janvier 2023',
        taux: { avant: 'Taux libératoires spécifiques par catégorie', apres: 'Imposition globale au barème progressif IR' },
        resume: 'Réinstauration du principe d\'imposition du revenu annuel global des personnes physiques via le barème progressif, réintégrant certaines catégories de revenus qui bénéficiaient de taux libératoires.',
        detail: `La LF 2023 réintroduit le principe fondamental d'imposition au barème progressif (Art. 73), en cohérence avec la loi-cadre n°69-19.

Mesures : révision du régime d'imposition des profits fonciers, alignement des professions libérales, renforcement de la relation de confiance avec l'administration.

Base pour les réformes IR amplifiées par les LF 2024, 2025 et 2026.`,
        ref: 'NC n°733, Art. 25, 73, 86 CGI — LF 2023 (n°50-22) — tax.gov.ma',
      },
      {
        id: 'NC733-TVA-01', nc: 'NC733', annee: '2023', theme: 'TVA', criticite: 'MEDIUM',
        titre: 'TVA neutralité — alignement professions libérales + matériel agricole',
        articles: ['Art. 99 CGI', 'Art. 92 CGI'],
        impact: ['PME', 'Importateurs'],
        entreeVigueur: '1er janvier 2023',
        taux: { avant: 'Professions libérales : taux réduit', apres: 'Professions libérales : taux normal 20%' },
        resume: 'Consécration de la neutralité TVA par alignement des professions libérales au taux normal (20%) et instauration de formalités pour l\'exonération du matériel agricole.',
        detail: `Deux mesures TVA dans NC 733 :

1. PROFESSIONS LIBÉRALES : passage au taux normal 20% — alignement sur les Assises fiscales 2019.

2. MATÉRIEL AGRICOLE : formalités réglementaires précises pour bénéficier de l'exonération TVA — lutte contre les usages détournés.

Première étape de la réforme TVA qui sera approfondie par NC 735 (LF 2024).`,
        ref: 'NC n°733, Art. 99 et 92 CGI — LF 2023 (n°50-22) — tax.gov.ma',
      },
      {
        id: 'NC733-COM-01', nc: 'NC733', annee: '2023', theme: 'Commun', criticite: 'MEDIUM',
        titre: 'Mesures communes — rationalisation incitations fiscales + CSS',
        articles: ['Art. 267-273 CGI', 'Art. 247 CGI'],
        impact: ['PME', 'GE', 'Investisseurs'],
        entreeVigueur: '1er janvier 2023',
        taux: { avant: 'Incitations sectorielles dispersées', apres: 'Rationalisation conforme normes OCDE/BEPS' },
        resume: 'Rationalisation des incitations fiscales en conformité avec les normes OCDE (BEPS), instauration de la contribution sociale de solidarité (CSS) et premières mesures d\'intégration du secteur informel.',
        detail: `RATIONALISATION : suppression/révision des régimes préférentiels non conformes BEPS.

CSS INSTITUÉE : contribution sociale de solidarité sur bénéfices ≥1M MAD (Art. 267-273). Taux 1,5% à 5%. Applicable 2022-2028 (prorogée LF 2026). Non déductible de l'IS.

INTÉGRATION INFORMEL : premières mesures incitatives pour opérateurs informels.`,
        ref: 'NC n°733, Art. 247 + 267-273 CGI — LF 2023 (n°50-22) — tax.gov.ma',
      },
      // ── NC 735 · LF 2024 · TVA ────────────────────────────────
      {
        id: 'NC735-TVA-01', nc: 'NC735', annee: '2024', theme: 'TVA', criticite: 'HIGH',
        titre: 'Grande réforme TVA — rationalisation vers 2 taux sur 3 ans (2024-2026)',
        articles: ['Art. 99 CGI', 'Art. 100 CGI abrogé', 'Art. 247 CGI'],
        impact: ['PME', 'GE', 'Importateurs'],
        entreeVigueur: '1er janvier 2024',
        taux: { avant: 'Taux multiples : 7%/10%/14%/20%', apres: 'Convergence : 20% normal · 10% réduit (2026 définitif)' },
        resume: 'Réforme structurelle TVA sur 3 ans : rationalisation des 4 taux vers 2 taux (20% normal, 10% réduit). Objectif : neutralité économique, équité fiscale, simplification pour les entreprises.',
        detail: `Architecture TVA 2026 (résultat final) :
• 20% : taux normal
• 10% : taux réduit (hôtellerie, restauration, huiles, banques, EnR…)
• 0% : exonérations produits de base (farine, sucre, eau, médicaments…)
• Taux 7% et 14% : ABROGÉS (Art. 100 abrogé)

La réforme est progressive (2024-2026) pour garantir visibilité et stabilité pour les opérateurs.`,
        ref: 'NC n°735, Art. 99-100 CGI — LF 2024 (n°55-23) — tax.gov.ma',
      },
      {
        id: 'NC735-TVA-02', nc: 'NC735', annee: '2024', theme: 'TVA', criticite: 'HIGH',
        titre: 'Exonération totale produits pharmaceutiques avec droit à déduction',
        articles: ['Art. 92-I-19° CGI', 'Art. 123-37° CGI', 'Art. 103 CGI'],
        impact: ['Importateurs', 'PME'],
        entreeVigueur: '1er janvier 2024',
        taux: { avant: 'Produits pharmaceutiques : TVA réduite', apres: 'Exonération totale avec droit à déduction (0% effectif)' },
        resume: 'Tous les produits pharmaceutiques exonérés de TVA avec déduction, à l\'intérieur et à l\'importation. Crédit TVA résultant ouvre droit au remboursement (Art. 103-1°).',
        detail: `CHAMP : tous les produits pharmaceutiques, sans restriction — Art. 92-I-19° (intérieur) et Art. 123-37° (importation).

MÉCANISME : exonération "avec droit à déduction" → les industriels déduisent la TVA sur leurs achats et obtiennent le remboursement du crédit résiduel.

IMPACT : élimination de la TVA incorporée en amont, réduction du coût final pour le consommateur. Cohérent avec la réforme AMO/protection sociale.`,
        ref: 'NC n°735, Art. 92-I-19° et 123-37° CGI — LF 2024 (n°55-23) — tax.gov.ma',
      },
      {
        id: 'NC735-TVA-03', nc: 'NC735', annee: '2024', theme: 'TVA', criticite: 'HIGH',
        titre: 'Retenue à la source TVA — prestations de services (applicable juillet 2024)',
        articles: ['Art. 117 CGI'],
        impact: ['GE', 'PME'],
        entreeVigueur: '1er juillet 2024',
        taux: { avant: 'Pas de RAS TVA sur services', apres: 'RAS TVA par grandes entreprises (CA ≥200M MAD) et organismes publics' },
        resume: 'Instauration d\'une RAS TVA sur les prestations de services pour les grandes entreprises (CA≥200M MAD), l\'État et les établissements publics. Remboursement accéléré TVA pour prestataires soumis à RAS.',
        detail: `PRINCIPE : collecteurs = entreprises CA HT ≥200M MAD + État + CT + EP + établissements de crédit.

FONCTIONNEMENT : le donneur d'ordre retient la TVA et la reverse directement au Trésor. Le prestataire reçoit le net HT et peut déduire la TVA sur ses propres achats.

GÉNÉRALISATION LF 2026 : périmètre étendu, délai remboursement réduit à 30 jours pour prestataires systématiquement soumis à la RAS.`,
        ref: 'NC n°735, Art. 117 CGI — LF 2024 (n°55-23) — Circulaire DGI mars 2024',
      },
      {
        id: 'NC735-TVA-04', nc: 'NC735', annee: '2024', theme: 'TVA', criticite: 'MEDIUM',
        titre: 'Réduction TVA énergie renouvelable — stratégie nationale bas carbone',
        articles: ['Art. 99 CGI', 'Art. 121 CGI'],
        impact: ['Investisseurs', 'GE', 'PME'],
        entreeVigueur: '1er janvier 2024',
        taux: { avant: 'Énergie électrique : 14%', apres: '2024: 12% · 2025: 10% (EnR) — cible 10% atteinte' },
        resume: 'Réduction progressive TVA sur énergie électrique produite par EnR (éolien, solaire, hydraulique) de 14% à 10% en deux ans, accompagnant la stratégie nationale de transition énergétique.',
        detail: `Trajectoire : 14% (avant 2024) → 12% (2024) → 10% (2025, cible atteinte).

Énergie conventionnelle : taux 14% maintenu pendant la transition.

Eau usage non-domestique : alignement progressif du taux TVA (harmonisation entre catégories de consommateurs).

Cadre : Maroc vise 52% d'électricité EnR d'ici 2030. La mesure s'inscrit dans les engagements COP.`,
        ref: 'NC n°735, Art. 99 et 121 CGI — LF 2024 (n°55-23) — tax.gov.ma',
      },
      {
        id: 'NC735-IS-01', nc: 'NC735', annee: '2024', theme: 'IS', criticite: 'MEDIUM',
        titre: 'IS 2024 — 2ème palier transitoire (PME→15% ; GE→27,5%)',
        articles: ['Art. 19 CGI'],
        impact: ['PME', 'GE'],
        entreeVigueur: '1er janvier 2024',
        taux: { avant: 'IS PME 12,5% · IS GE 23,75%', apres: 'IS PME 15% · IS GE (>100M) 27,5%' },
        resume: 'Deuxième palier de la trajectoire IS 2023-2026. PME : 15%. Grandes entreprises (BN ≥100M MAD) : 27,5%. RAS dividendes : 12,5%.',
        detail: `Taux IS 2024 : PME (≤300K) : 15% · Intermédiaire (300K-100M) : 20% · GE (≥100M) : 27,5%.

RAS dividendes 2024 : 12,50%.

La NC 735 se focalise sur les mesures TVA de la LF 2024. L'IS 2024 applique simplement le 2ème palier de la trajectoire définie par la NC 733.`,
        ref: 'NC n°735, Art. 19 CGI — LF 2024 (n°55-23) — tax.gov.ma',
      },
      {
        id: 'NC735-COM-01', nc: 'NC735', annee: '2024', theme: 'Fraude', criticite: 'MEDIUM',
        titre: 'Régularisation volontaire — contribution libératoire revenus non déclarés',
        articles: ['Art. 247 CGI'],
        impact: ['PME', 'GE'],
        entreeVigueur: '1er janvier 2024',
        taux: { avant: 'Contrôle ordinaire', apres: 'Régularisation volontaire sans pénalité (délai 2024)' },
        resume: 'Mesure de régularisation volontaire des revenus ou profits imposables non déclarés, avec versement d\'un montant forfaitaire libératoire sans pénalité. Protège des contrôles ultérieurs sur les exercices couverts.',
        detail: `CONDITIONS : couverture des revenus non déclarés antérieurs à 2024. Paiement avant délai fixé. Régularisation définitive et protectrice.

Communiqué DGI octobre 2024 : rappel de la mesure et de ses modalités pratiques.

Inscription dans la démarche globale d'élargissement de l'assiette fiscale et d'intégration du secteur informel dans l'économie structurée.`,
        ref: 'NC n°735, Art. 247 CGI — LF 2024 (n°55-23) — tax.gov.ma',
      },
      // ── NC 736 · LF 2025 · IR ────────────────────────────────
      {
        id: 'NC736-IR-01', nc: 'NC736', annee: '2025', theme: 'IR', criticite: 'HIGH',
        titre: 'Réforme barème IR 2025 — seuil exonération relevé à 40 000 MAD',
        articles: ['Art. 73-I CGI', 'Art. 74 CGI'],
        impact: ['Salariés', 'Retraités'],
        entreeVigueur: '1er janvier 2025',
        taux: { avant: 'Seuil exonération : 30 000 MAD/an', apres: 'Seuil exonération : 40 000 MAD/an + barème révisé complet' },
        resume: 'Révision du barème IR : relèvement de la tranche exonérée de 30 000 à 40 000 MAD/an. Réduction charge de famille portée de 360 à 600 DH/personne (plafond 3 600 DH). Issu du dialogue social avril 2024.',
        detail: `Barème IR 2025 (Art. 73-I) :
• ≤40 000 MAD : 0% (exonéré)
• 40 001–60 000 MAD : 10%
• 60 001–80 000 MAD : 20%
• 80 001–100 000 MAD : 30%
• 100 001–180 000 MAD : 34%
• >180 000 MAD : 37%

Réduction charge de famille (Art. 74) : 600 DH/pers (max 3 600 DH).

Plafond déduction véhicules transport : 300 000 → 400 000 MAD (Art. 10 CGI).`,
        ref: 'NC n°736, Art. 73-I et 74 CGI — LF 2025 (n°60-24) — tax.gov.ma',
      },
      {
        id: 'NC736-IR-02', nc: 'NC736', annee: '2025', theme: 'IR', criticite: 'HIGH',
        titre: 'Exonération retraite de base + option taux libératoire 20% revenus fonciers',
        articles: ['Art. 57 CGI', 'Art. 60 CGI', 'Art. 64 CGI', 'Art. 73 CGI', 'Art. 86 CGI'],
        impact: ['Retraités', 'Investisseurs'],
        entreeVigueur: '1er janvier 2025',
        taux: { avant: 'Retraite de base imposée au barème IR', apres: 'Retraite de base : exonération totale · Rev. fonciers : option 20% libératoire' },
        resume: 'Exonération totale des retraités pour leur pension de retraite de base. Option taux libératoire 20% sur revenus fonciers (avec dispense de déclaration annuelle). Seuil RAS loyers relevé à 40 000 MAD.',
        detail: `1. EXONÉRATION RETRAITE DE BASE : pensions servies par les régimes obligatoires (CIMR base, CMR, RCAR, CNSS) exonérées totalement.

2. OPTION TAUX LIBÉRATOIRE REVENUS FONCIERS (Art. 73-II-F-12°) : option pour 20% sur montant brut → dispense déclaration annuelle revenu global (Art. 86-5°).

3. SEUIL RAS LOYERS : relevé de 30 000 à 40 000 MAD (harmonisation barème).

4. PROLONGATION À 2030 : mesure transitoire réinvestissement cessions actifs immobilisés (Art. 247-XXXV).`,
        ref: 'NC n°736, Art. 57, 60, 64, 73, 86 CGI — LF 2025 (n°60-24) — tax.gov.ma',
      },
      {
        id: 'NC736-IS-01', nc: 'NC736', annee: '2025', theme: 'IS', criticite: 'MEDIUM',
        titre: 'IS 2025 — 3ème palier (PME→17,5% ; GE→31,25%)',
        articles: ['Art. 19 CGI'],
        impact: ['PME', 'GE'],
        entreeVigueur: '1er janvier 2025',
        taux: { avant: 'IS PME 15% · IS GE 27,5%', apres: 'IS PME 17,5% · IS GE (>100M) 31,25%' },
        resume: '3ème palier IS. PME : 17,5%. Grandes entreprises (BN ≥100M MAD) : 31,25%. RAS dividendes : 11,25%. Avant-dernière étape avant les taux définitifs 2026.',
        detail: `Taux IS 2025 :
• ≤300 000 MAD : 17,5%
• 300K–100M MAD : 20%
• ≥100M MAD : 31,25%

RAS dividendes 2025 : 11,25%.

Déclaration RF 2025 souscrite avant le 1er avril 2026 → calculée avec les taux 2025. Acomptes provisionnels 2025 calculés sur les taux de l'exercice 2025.`,
        ref: 'NC n°736, Art. 19 CGI — LF 2025 (n°60-24) — tax.gov.ma',
      },
      {
        id: 'NC736-COM-01', nc: 'NC736', annee: '2025', theme: 'Fraude', criticite: 'MEDIUM',
        titre: 'Lutte anti-fraude renforcée — RAS élargie + intégration secteur informel',
        articles: ['Art. 157 CGI', 'Art. 216 CGI', 'Art. 40 CGI', 'Art. 42 bis CGI'],
        impact: ['PME', 'GE'],
        entreeVigueur: '1er janvier 2025',
        taux: { avant: 'Contrôle fiscal ordinaire', apres: 'RAS élargie + ICE renforcé + TSAV délai porté à 60 jours' },
        resume: 'Renforcement dispositifs lutte fraude : élargissement RAS sur honoraires, contrôle renforcé des factures fictives (Art. 146), simplification CPU et auto-entrepreneur, TSAV délai 60 jours.',
        detail: `LUTTE FRAUDE : extension RAS honoraires aux grandes entreprises, renforcement contrôle factures fictives (Art. 146), sanctions ICE renforcées.

INTÉGRATION INFORMEL : incitations régime CPU (Art. 40) et auto-entrepreneur (Art. 42 bis), allègement pénalités première régularisation.

TSAV : délai paiement 30 → 60 jours (date récépissé NARSA).

JEUX DE HASARD : contribution solidarité 2% sur bénéfice net des établissements de jeux.`,
        ref: 'NC n°736, Art. 157, 216 CGI — LF 2025 (n°60-24) — tax.gov.ma',
      },
      // ── NC 737 · LF 2026 · Consolidation ─────────────────────
      {
        id: 'NC737-IS-01', nc: 'NC737', annee: '2026', theme: 'IS', criticite: 'HIGH',
        titre: 'IS 2026 — Finalisation : taux 20% et 35% définitifs et permanents',
        articles: ['Art. 19 CGI'],
        impact: ['PME', 'GE', 'Investisseurs'],
        entreeVigueur: '1er janvier 2026',
        taux: { avant: 'IS PME 17,5% · IS GE 31,25%', apres: '20% (≤100M) · 35% (≥100M) · DÉFINITIFS · 40% établissements crédit' },
        resume: 'Achèvement de la réforme IS 2023-2026 : taux cibles atteints et pérennisés. RAS dividendes : 10% définitif. Exemptions : CFC et ZAI taxés à 20% quel que soit le BN.',
        detail: `Architecture IS 2026 DÉFINITIVE :
• ≤300 000 MAD : 20% (fin convergence depuis 10% en 2022)
• 300K–1M MAD : 20%
• 1M–100M MAD : 20%
• ≥100M MAD : 35%
• Établissements de crédit & assurances : 40%

CFC et ZAI : 20% indépendamment du bénéfice net (exclusion du 35%).

RAS dividendes : 10% DÉFINITIF (4ème et dernier palier).`,
        ref: 'NC n°737, Art. 19 CGI — LF 2026 (n°50-25) — tax.gov.ma',
      },
      {
        id: 'NC737-IS-02', nc: 'NC737', annee: '2026', theme: 'IS', criticite: 'MEDIUM',
        titre: 'Secteur maritime — exonération permanente RAS affrètement international',
        articles: ['Art. 15 CGI', 'Art. 19 CGI'],
        impact: ['Investisseurs', 'GE'],
        entreeVigueur: '1er janvier 2026',
        taux: { avant: 'RAS 10% sur loyers navires versés à non-résidents', apres: 'Exonération permanente (0%) — navires transport maritime international' },
        resume: 'Exonération définitive de la RAS de 10% sur droits de location, surestaries et services connexes pour navires affectés au transport maritime international. Renforce la compétitivité des opérateurs marocains.',
        detail: `Champ : loyers de navires, surestaries, services connexes liés à l'affrètement (navires en provenance ou à destination de l'étranger).

Objectif : compétitivité des armateurs et opérateurs marocains face à la concurrence internationale. Cohérent avec l'ambition hub logistique régional (Tanger Med).

Application : sommes versées à compter du 1er janvier 2026.`,
        ref: 'NC n°737, Art. 15 et 19 CGI — LF 2026 (n°50-25) — tax.gov.ma',
      },
      {
        id: 'NC737-IS-03', nc: 'NC737', annee: '2026', theme: 'IS', criticite: 'MEDIUM',
        titre: 'Microcrédit — transformation en SA : taux transitoire IS de droit commun (5 ans)',
        articles: ['Art. 19 CGI', 'Art. 161 quater CGI'],
        impact: ['Investisseurs', 'PME'],
        entreeVigueur: '1er janvier 2026',
        taux: { avant: 'SA microcrédit : IS 40% (taux établissements de crédit)', apres: 'Taux droit commun 20% ou 35% pendant 5 exercices consécutifs' },
        resume: 'SA issues de la transformation d\'associations de microcrédit (loi n°50-20) bénéficient pendant 5 exercices du taux IS de droit commun (20%/35%), au lieu du taux établissements de crédit (40%).',
        detail: `Cadre : loi n°50-20 relative à la microfinance (transformation associations → SA).

Avantage : 5 exercices consécutifs au taux droit commun (20% si BN <100M ; 35% si ≥100M) au lieu de 40%.

Objectif : faciliter la transformation du secteur et soutenir l'inclusion financière des PME et TPE.`,
        ref: 'NC n°737, Art. 19 et 161 quater CGI — LF 2026 (n°50-25) — tax.gov.ma',
      },
      {
        id: 'NC737-TVA-01', nc: 'NC737', annee: '2026', theme: 'TVA', criticite: 'HIGH',
        titre: 'TVA 2026 — Architecture 20%/10% définitive et permanente',
        articles: ['Art. 99 CGI'],
        impact: ['PME', 'GE', 'Importateurs'],
        entreeVigueur: '1er janvier 2026',
        taux: { avant: 'Taux en transition (7%/10%/12%/14%/20%)', apres: 'DÉFINITIFS : 20% normal · 10% réduit · 0% exonérations' },
        resume: 'Finalisation de la réforme TVA 2024-2026 : architecture simplifiée à 2 taux permanents (20% et 10%). Taux 7% et 14% définitivement abrogés (Art. 100 abrogé). Auto-liquidation précisée.',
        detail: `Architecture TVA 2026 DÉFINITIVE :
• 20% : taux normal (large spectre)
• 10% : taux réduit (hôtellerie, restauration, huiles, banques, EnR…)
• 0% : exonérations produits base (farine, lait, eau domestique, médicaments…)

Taux 7% et 14% ABROGÉS définitivement.

AUTO-LIQUIDATION (Art. 125 quinquies) : précisions sur obligations clients assujettis achetant hors champ.

MICROFINANCE : exonération TVA sans droit à déduction prorogée 2026-2030.`,
        ref: 'NC n°737, Art. 99 CGI — LF 2026 (n°50-25) — tax.gov.ma',
      },
      {
        id: 'NC737-TVA-02', nc: 'NC737', annee: '2026', theme: 'TVA', criticite: 'HIGH',
        titre: 'RAS TVA — généralisation et remboursement accéléré 30 jours',
        articles: ['Art. 117 CGI'],
        impact: ['GE', 'PME'],
        entreeVigueur: '1er janvier 2026',
        taux: { avant: 'RAS TVA depuis juillet 2024 (grandes entreprises)', apres: 'Généralisation + remboursement accéléré 30j pour prestataires en excédent RAS' },
        resume: 'Consolidation et extension du mécanisme RAS TVA. Délai de remboursement TVA pour prestataires soumis à RAS réduit à 30 jours. Nouvelles catégories de collecteurs. Obligations documentaires précisées.',
        detail: `Extension périmètre : nouvelles catégories de donneurs d'ordre soumis à la RAS TVA.

Remboursement accéléré : 30 jours (vs 3 mois procédure ordinaire) pour prestataires systématiquement soumis à la RAS.

Attestation RAS obligatoire à joindre à la déclaration TVA.

Déclaration : toutes les opérations de RAS TVA via SIMPL-TVA.

La DGI estime que ce mécanisme sécurise 30-40% des recettes TVA qui pouvaient être perdues.`,
        ref: 'NC n°737, Art. 117 CGI — LF 2026 (n°50-25) — tax.gov.ma',
      },
      {
        id: 'NC737-IR-01', nc: 'NC737', annee: '2026', theme: 'IR', criticite: 'HIGH',
        titre: 'IR 2026 — Exonération retraites complémentaires CIMR secteur privé',
        articles: ['Art. 57-27° CGI', 'Art. 73 CGI', 'Art. 79-VII CGI'],
        impact: ['Salariés', 'Retraités'],
        entreeVigueur: '1er janvier 2026',
        taux: { avant: 'CIMR complémentaire : exonération partielle', apres: 'Pensions CIMR retraite complémentaire de groupe : exonération IR totale' },
        resume: 'Exonération des pensions et rentes viagères versées par la CIMR aux retraités du secteur privé dans le cadre de contrats d\'assurance retraite complémentaire de groupe. Déduction cotisations actifs : jusqu\'à 50% salaire net imposable.',
        detail: `Art. 57-27° modifié : exonération pensions CIMR pour contrats d'assurance retraite complémentaire de groupe souscrit dans cadre employeur/salarié.

DÉDUCTION EN ACTIVITÉ :
• Revenus salariaux : jusqu'à 50% du salaire net imposable
• Autres catégories : jusqu'à 10% du revenu professionnel

OBLIGATION CFC (Art. 79-VII nouveau) : les sociétés CFC annexent à leur déclaration DTS un état selon modèle DGI listant les salariés concernés.

BARÈME IR 2026 : identique à 2025 (réforme achevée — pas de modification).`,
        ref: 'NC n°737, Art. 57-27°, 73, 79-VII CGI — LF 2026 (n°50-25) — tax.gov.ma',
      },
      {
        id: 'NC737-COM-01', nc: 'NC737', annee: '2026', theme: 'Fraude', criticite: 'HIGH',
        titre: 'Intégration secteur informel — SIMPL obligatoire + email libre',
        articles: ['Art. 145 CGI', 'Art. 155 CGI', 'Art. 267-303 CGI'],
        impact: ['PME', 'GE'],
        entreeVigueur: '1er janvier 2026',
        taux: { avant: 'Mécanismes partiels', apres: 'SIMPL email libre + CSS prorogée 2028 + jeux de hasard 2%' },
        resume: 'Axe n°1 LF 2026 : intégration informel et lutte fraude. Adresse email libre (fin prestataire certifié), CSS prorogée 2028, contribution 2% jeux de hasard, dématérialisation totale des notifications DGI.',
        detail: `1. EMAIL LIBRE : suppression obligation prestataire certifié — email de choix communiqué via SIMPL (formulaire ADC450).

2. CSS PROROGÉE 2028 : contribution sociale de solidarité (Art. 267-273) reconduite. Seuil 1M MAD. Taux 1,5% à 5%.

3. JEUX DE HASARD : contribution solidarité 2% sur bénéfice net (Art. 298-303, nouveau Titre VIII Livre III).

4. DÉMATÉRIALISATION TOTALE : toutes les notifications DGI exclusivement électroniques via SIMPL. Abandon définitif du papier pour les contribuables soumis à la télédéclaration.`,
        ref: 'NC n°737, Art. 145, 155, 267-303 CGI — LF 2026 (n°50-25) — tax.gov.ma',
      },
      {
        id: 'NC737-COM-02', nc: 'NC737', annee: '2026', theme: 'Commun', criticite: 'MEDIUM',
        titre: 'Amélioration environnement des affaires — harmonisation fiscale + numérique',
        articles: ['Art. 6 CGI', 'Art. 19 CGI', 'Art. 115 bis CGI', 'Art. 133 CGI'],
        impact: ['GE', 'Investisseurs', 'PME'],
        entreeVigueur: '1er janvier 2026',
        taux: { avant: 'Régimes épars', apres: 'Harmonisation OCDE + adaptation numérique + simplification' },
        resume: 'Axe n°2 LF 2026 : amélioration compétitivité. Harmonisation OCDE/BEPS, adaptation aux modèles numériques (streaming, cloud, fintech), RAS immobilier non-résidents, simplification droits d\'enregistrement.',
        detail: `HARMONISATION INTERNATIONALE : alignement CGI sur BEPS et normes OCDE.

IMMEUBLES NON-RÉSIDENTS : sociétés non-résidentes sans ES au Maroc → retenue à la source sur plus-values immobilières (au lieu de déclaration annuelle).

NUMÉRIQUE (Art. 115 bis) : obligations TVA renforcées pour fournisseurs services dématérialisés non-résidents (streaming, cloud, applications).

DROITS ENREGISTREMENT : harmonisation taux (Art. 133-I-B-7° abrogé LF 2026).

COHÉSION SOCIALE : exonérations logements sociaux maintenus, avantages ZAI confirmés, associations utilité publique.`,
        ref: 'NC n°737, Art. 6, 19, 115 bis, 133 CGI — LF 2026 (n°50-25) — tax.gov.ma',
      },
    ],
  };


  /* ─────────────────────────────────────────────────────────────────
   *  5. FONCTIONS DE CALCUL FISCAL
   * ───────────────────────────────────────────────────────────────── */

  /** Calcule l'IS selon le barème 2026 — Art. 19-I CGI */
  function calculerIS(beneficeFiscal) {
    if (beneficeFiscal <= 0) return { isCalcule: 0, tauxEffectif: 0, trancheApplicable: 0, cotisationMinimale: TAUX.IS.cotisationMinimale.plancher };
    let is = 0;
    let prev = 0;
    let trancheApplicable = TAUX.IS.tranches[TAUX.IS.tranches.length - 1].taux;
    for (const t of TAUX.IS.tranches) {
      if (beneficeFiscal <= t.max) {
        is += (beneficeFiscal - prev) * t.taux;
        trancheApplicable = t.taux;
        break;
      }
      is += (t.max - prev) * t.taux;
      prev = t.max;
    }
    return {
      isCalcule:          Math.round(is),
      tauxEffectif:       parseFloat(((is / beneficeFiscal) * 100).toFixed(2)),
      trancheApplicable:  trancheApplicable * 100,
      cotisationMinimale: TAUX.IS.cotisationMinimale.plancher,
    };
  }

  /** Calcule l'IR selon le barème progressif 2026 — Art. 73-I CGI */
  function calculerIR(revenuImposable) {
    if (revenuImposable <= TAUX.IR.seuilExoneration) return { irCalcule: 0, tauxEffectif: 0 };
    let ir = 0;
    let prev = 0;
    for (const t of TAUX.IR.tranches) {
      if (revenuImposable <= t.max) {
        ir += (revenuImposable - prev) * t.taux;
        break;
      }
      ir += (t.max - prev) * t.taux;
      prev = t.max;
    }
    return {
      irCalcule:    Math.round(ir),
      tauxEffectif: parseFloat(((ir / revenuImposable) * 100).toFixed(2)),
    };
  }

  /** Calcule les 4 acomptes IS — Art. 170-I CGI */
  function calculerAcomptesIS(isExerciceRef) {
    const parAcompte = Math.round(isExerciceRef * TAUX.IS.acomptes.quotePart);
    return {
      parAcompte,
      totalAcomptes: parAcompte * TAUX.IS.acomptes.nombre,
      calendrier:    TAUX.IS.acomptes.calendrier,
    };
  }

  /** Vérifie si la dispense d'acompte est possible */
  function peutSeDispenserAcompte(acomptesVersés, isEstime) {
    return acomptesVersés >= isEstime;
  }

  /** Calcule la RAS sur dividendes — Art. 158 CGI */
  function calculerRASDividendes(dividendes, annee) {
    const taux = annee >= 2026 ? TAUX.RAS.dividendes2026 : TAUX.RAS.dividendes2026;
    const rasMontant = Math.round(dividendes * taux);
    return {
      rasMontant,
      tauxApplique: taux * 100,
      netPercu:     Math.round(dividendes - rasMontant),
    };
  }

  /** Calcule la cotisation minimale IS — Art. 144-I-D CGI */
  function calculerCotisationMinimale(ca) {
    const cm = TAUX.IS.cotisationMinimale;
    return { cotisationMinimale: Math.max(Math.round(ca * cm.taux), cm.plancher) };
  }

  /** Calcule la CSS — Art. 267-269 CGI */
  function calculerCSS(beneficeNet) {
    if (beneficeNet < TAUX.IS.css.seuilEntree) return { css: 0, taux: 0 };
    let css = 0;
    for (const p of TAUX.IS.css.tauxParPalier) {
      if (beneficeNet <= p.max) {
        css = Math.round(beneficeNet * p.taux);
        return { css, tauxApplique: p.taux * 100 };
      }
    }
    const last = TAUX.IS.css.tauxParPalier[TAUX.IS.css.tauxParPalier.length - 1];
    return { css: Math.round(beneficeNet * last.taux), tauxApplique: last.taux * 100 };
  }

  /** Calcule la pénalité de retard — Art. 208-I CGI */
  function calculerPenaliteRetard(montant, moisRetard, typeImpot) {
    const p = TAUX.PENALITES.retardPaiement;
    typeImpot = typeImpot || 'normal';
    let tauxBase;
    if (typeImpot === 'court')  tauxBase = p.penaliteBaseCourte;
    else if (typeImpot === 'tva') tauxBase = p.penaliteBaseTVA;
    else tauxBase = p.penaliteBase;

    const penaliteBase        = Math.round(montant * tauxBase);
    const majorationInitiale  = Math.round(montant * p.majorationInitiale);
    const moisSupp            = Math.max(0, moisRetard - 1);
    const majorationsMensuelles = Math.round(montant * p.majorationMensuelle * moisSupp);
    let totalPenalite         = penaliteBase + majorationInitiale + majorationsMensuelles;
    if (typeImpot === 'enreg' && totalPenalite < p.minimumEnreg) totalPenalite = p.minimumEnreg;

    return {
      montantBase:           Math.round(montant),
      tauxBaseApplique:      tauxBase * 100,
      penaliteBase,
      majorationInitiale,
      majorationsMensuelles,
      moisSupplementaires:   moisSupp,
      totalPenalite:         Math.round(totalPenalite),
      totalDu:               Math.round(montant + totalPenalite),
      surCoutPct:            parseFloat(((totalPenalite / montant) * 100).toFixed(2)),
    };
  }

  /** Calcule la pénalité de défaut de déclaration — Art. 186-196 CGI */
  function calculerPenaliteDefaut(montant, typeDefaut) {
    const def = TAUX.PENALITES.defautDeclaration;
    const map = { premier: def.premiereInfraction, recidive: def.recidive, office: def.taxationOffice, insuffisance: def.insuffisance, fraude: def.manoeuvresFrauduleuses };
    const taux = map[typeDefaut] || def.premiereInfraction;
    const penalite = Math.round(montant * taux);
    return {
      montantBase: Math.round(montant),
      tauxApplique: taux,
      penalite,
      totalDu:     Math.round(montant + penalite),
      surCoutPct:  parseFloat((taux * 100).toFixed(1)),
    };
  }


  /* ─────────────────────────────────────────────────────────────────
   *  6. LOGIQUE ÉCHÉANCES & ALERTES
   * ───────────────────────────────────────────────────────────────── */

  function resoudreDateEcheance(spec, annee) {
    if (!spec) return null;
    if (spec.day === 31) return new Date(annee, spec.month + 1, 0);
    return new Date(annee, spec.month, spec.day);
  }

  function joursRestants(dateEcheance, today) {
    if (!dateEcheance) return null;
    return Math.round((dateEcheance - today) / 86400000);
  }

  function niveauUrgence(j) {
    if (j === null) return 'permanent';
    if (j < 0)     return 'passe';
    if (j <= 14)   return 'critique';
    if (j <= 30)   return 'eleve';
    return 'normal';
  }

  function labelPenalite(penCode) {
    const p = TAUX.PENALITES;
    const MAP = {
      'retardPaiement': `+${p.retardPaiement.majorationInitiale * 100}% dès J+1 · +${p.retardPaiement.majorationMensuelle * 100}%/mois`,
      'defautDeclaration': `+${p.defautDeclaration.premiereInfraction * 100}% défaut · +${p.defautDeclaration.recidive * 100}% récidive`,
      'acomptes': `+${p.acomptes.penaliteInsuffisance * 100}% si écart > ${p.acomptes.toleranceSansPenalite * 100}%`,
      'retardPaiement + defautDeclaration': '+5% J+1 · +0,5%/mois · +15% défaut déclaration',
    };
    return MAP[penCode] || 'Voir Art. 208 CGI';
  }

  function hydaterEcheances(annee, today) {
    return ECHEANCES_DATA.map(function(e) {
      const due    = resoudreDateEcheance(e.due, annee);
      const j      = joursRestants(due, today);
      const urgence = niveauUrgence(j);
      return Object.assign({}, e, { dueDate: due, joursRestants: j, urgence, penaliteLabel: labelPenalite(e.penCode), annee });
    });
  }

  function filtrerParProfil(echeances, profil) {
    if (profil === 'all') return echeances;
    return echeances.filter(e => e.profiles.includes(profil));
  }

  function calculerKPIs(echeances, traitees) {
    const actives = echeances.filter(e => !traitees.has(e.id));
    return {
      urgentes: actives.filter(e => e.urgence === 'critique').length,
      proches:  actives.filter(e => e.urgence === 'eleve').length,
      actives:  actives.length,
      traitees: traitees.size,
    };
  }

  function angleRadar(j, horizon) {
    horizon = horizon || 90;
    if (j === null || j < 0) return 360;
    return Math.min(360, Math.max(0, (1 - j / horizon) * 360));
  }

  /** Retourne les taux formatés pour affichage UI */
  function getTauxUI() {
    const T = TAUX;
    return {
      IS: {
        description: 'Impôt sur les Sociétés — Barème progressif 2026 (Art. 19)',
        tranches: T.IS.tranches.map(t => ({ tranche: t.label, taux: (t.taux * 100) + '%' })),
        tauxSpeciaux: [
          { categorie: 'Exportateurs (5 premières années)', taux: '0% (exonération)' },
          { categorie: 'Exportateurs (années 6-10)', taux: '17,5%' },
          { categorie: 'Zones franches / ZAI', taux: '0% puis 8,75%' },
          { categorie: 'Agricole', taux: '17,5%' },
          { categorie: 'Établissements de crédit', taux: '40%' },
          { categorie: 'CFC / ZAI (toute taille)', taux: '20%' },
        ],
      },
      IR: {
        description: 'Impôt sur le Revenu — Barème progressif 2026 (Art. 73)',
        tranches: T.IR.tranches.map(t => ({ tranche: t.label, taux: (t.taux * 100) + '%' })),
      },
      TVA: {
        taux_normal: (T.TVA.normal * 100) + '%',
        taux_reduits: [
          { taux: (T.TVA.reduit * 100) + '%', produits: 'Hôtellerie, restauration, huiles alimentaires, banques, photovoltaïque' },
          { taux: '0%', produits: 'Médicaments, farine, sucre, eau domestique, électricité (exonérations Art. 91-92)' },
        ],
      },
      DE: { taux: T.DE.taux },
      RAS: {
        dividendes2026:  (T.RAS.dividendes2026 * 100) + '%',
        loyers:          (T.RAS.loyersProfessionnels * 100) + '%',
        honoraires:      (T.RAS.honoraires * 100) + '%',
        nonResidents:    (T.RAS.nonResidents * 100) + '%',
      },
    };
  }


  /* ─────────────────────────────────────────────────────────────────
   *  7. API PUBLIQUE
   * ───────────────────────────────────────────────────────────────── */

  global.FiscalEngine = {
    version: '2.0.0',
    cgi:     'CGI 2026 — LF n°50-25',

    /* Données */
    TAUX,
    ECHEANCES_DATA,
    VEILLE_DATA,
    CIRC_DB,

    /* Calculs */
    calculerIS,
    calculerIR,
    calculerAcomptesIS,
    peutSeDispenserAcompte,
    calculerRASDividendes,
    calculerCotisationMinimale,
    calculerCSS,
    calculerPenaliteRetard,
    calculerPenaliteDefaut,

    /* Alertes */
    hydaterEcheances,
    filtrerParProfil,
    joursRestants,
    niveauUrgence,
    angleRadar,
    calculerKPIs,
    labelPenalite,
    resoudreDateEcheance,

    /* UI helpers */
    getTauxUI,
  };

})(window || globalThis);
