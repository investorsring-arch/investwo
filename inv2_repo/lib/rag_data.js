/**
 * Smart-Invest.ia — RAG Data Module v1.0
 * Base de connaissance vérifiée : fiscal, aides, juridique
 *
 * Extraction propre depuis smart_invest_assistant.html
 * Maintenu séparément pour mise à jour sans toucher au moteur UI.
 *
 * Expose globalement :
 *   window.KB_FISCAL, window.KB_AIDES, window.KB_JURIDIQUE
 *   window.SYSTEM_PROMPT, window.PROFIL_QUESTIONS
 *   window.buildKBContext(userMsg) → string de contexte RAG
 *   window.buildPersonalizedSystemPrompt(userMsg) → system complet avec user
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════════════
     BASE DE CONNAISSANCE — KB RAG (données vérifiées)
  ══════════════════════════════════════════════════════════════════════════ */

  const KB_FISCAL = {
    IS: {
      bareme_standard: [
        { de: 0,       a: 300000,  taux: 0.10, label: '10%' },
        { de: 300001,  a: 1000000, taux: 0.20, label: '20%' },
        { de: 1000001, a: null,    taux: 0.31, label: '31%' }
      ],
      taux_speciaux: {
        ZAI:                    '0% exercices 1-5, puis 15% à partir exercice 6 [Art. 6 CGI + Loi 19-94]',
        CFC:                    '0% exercices 1-5, puis 15% permanent [Art. 6-I-B-7 CGI]',
        exportateurs:           '20% plafonné même si bénéfice > 1M MAD [Art. 19-II CGI]',
        industriels:            '28% si bénéfice < 100M MAD [Art. 19-I-B CGI]',
        banques_assurances:     '37% [Art. 19-I-C CGI]',
        CFC_salaries_etrangers: 'IR 20% forfaitaire pendant 10 ans'
      },
      cotisation_minimale: '0.5% du CA HT, minimum 3 000 MAD [Art. 144 CGI]',
      exemple_850k: '300 000×10%=30 000 + 550 000×20%=110 000 = IS 140 000 MAD, taux effectif 16.47%'
    },
    IR: {
      bareme: [
        { de: 0,      a: 30000,  taux: 0    },
        { de: 30001,  a: 50000,  taux: 0.10 },
        { de: 50001,  a: 60000,  taux: 0.20 },
        { de: 60001,  a: 80000,  taux: 0.30 },
        { de: 80001,  a: 180000, taux: 0.34 },
        { de: 180001, a: null,   taux: 0.38 }
      ],
      auto_entrepreneur: {
        commerce_artisanat: '0.5% du CA, plafond 500 000 MAD',
        services:           '1% du CA, plafond 200 000 MAD'
      }
    },
    TVA: {
      taux: {
        normal:     '20%',
        reduit_14:  '14% (transport, énergie, beurre)',
        reduit_10:  '10% (hôtels, restauration, banque)',
        reduit_7:   '7% (eau, pharma, sucre)'
      },
      exoneration_investissement: 'Biens d\'équipement exonérés TVA pendant 36 mois du début d\'activité [Art. 92-I-6 CGI]'
    },
    taxe_professionnelle: 'Exonération 5 ans toute nouvelle activité [Art. 143-II CGI]. 15 ans en zone franche.',
    droits_enregistrement: '4% local construit, 5% terrain nu, 6% fonds de commerce',
    regime_changes: {
      investisseurs_etrangers: 'Convertibilité totale dividendes et produits de cession [IGOC 2020]',
      retenue_dividendes:      '15% retenue à la source [Art. 13 CGI]',
      MRE_compte:              'Comptes en dirhams convertibles disponibles',
      delais_rapatriement:     '150 jours (biens exportés), 90 jours (services) [IGOC 2020]',
      investissement_etranger: '100M MAD/an vers Afrique, 50M MAD/an autres continents'
    },
    zones_douanieres: {
      ZAI:           'Exonération droits import matériels + marchandises + TVA import. IS 0% (5 ans) puis 15%.',
      ATPA:          'Suspension droits taxes pour transformation + exportation',
      entrepot_franc:'Investissement min 50M MAD, combinaison régimes suspensifs'
    }
  };

  const KB_AIDES = {
    CCG: {
      Intelaka:      'Garantie 80%, crédit max 1.2M MAD, CA ≤ 10M MAD, créé ≤ 5 ans, hors immo et pêche hauturière [CCG - Intelaka 2020]',
      Innov_Idea:    'Subvention 100-200k MAD (non remboursable), projet innovant validé structure labélisée CCG',
      Innov_Start:   'Prêt 0% sans garantie, 250-500k MAD, différé 2 ans + remboursement 5 ans',
      Innov_Risk:    'Avance remboursable 50% levée investisseurs, max 2M MAD, 1 an différé + 5 ans',
      Innov_Dev:     'Prêt participatif 2% HT, max 3M MAD (≤50% levée), 8 ans dont 2 différé',
      Start_TPE:     'Prêt 0%, 20% du crédit Intelaka, max 50k MAD, différé 5 ans',
      Mezzanine_PME: 'Prêt subordonné max 10M MAD, 10 ans dont 5 différé. Industrie ou export ≥20% CA'
    },
    Maroc_PME: {
      Imtiaz:          'Prime 20% investissement, plafond 10M MAD, CA ≤ 200M MAD. Projet de croissance.',
      Istitmar:        'Prime 30% investissement, plafond 2M MAD, CA ≤ 10M MAD. TPE valorisation industrielle.',
      Transfo_Digitale:'70% SI propriétaire / 80% SI cloud. Industrie, CA < 200M MAD.'
    },
    MDM_Invest: {
      description:       'Pour MRE. Apport MRE minimum 25% en devises. État contribue 10% de l\'apport MRE (max 5M MAD, non remboursable). Banque finance le solde.',
      secteurs:          'Industrie, services liés industrie, éducation, hôtellerie, santé. PAS l\'immobilier.',
      investissement_min:'1M MAD minimum',
      restitution:       'Contribution État restituée si désinvestissement dans les 5 premières années',
      source:            '[Guide AMDIE 2020 p.34-35]'
    },
    Fonds_Hassan_II: {
      industriel: 'Investissement total > 10M MAD HT ET équipements > 5M MAD HT. Prime bâtiments 10%, équipements neufs 20%. Secteurs : auto, aéro, électronique, chimie, pharma, nano/bio.',
      tourisme:   'Hébergement classé en nouvelles stations touristiques. 50% coût terrain plafonné 500 MAD/m².',
      source:     '[Convention-cadre Fonds Hassan II — 15 mars 2016 | Guide AMDIE 2020 p.52-54]'
    },
    FDII_Charte: {
      charte: 'Convention État si investissement ≥ 100M MAD OU ≥ 250 emplois stables. Appui foncier 20%, infra 5%, formation 20%, plafond total 5% du projet.',
      FDII:   'Projets écosystèmes industriels. Locomotive > 50M MAD ou 200 emplois. Structurant > 100M MAD ou 250 emplois. Prime globale jusqu\'à 30%.'
    }
  };

  const KB_JURIDIQUE = {
    formes: {
      SARL:             'Capital libre (aucun minimum depuis Loi 21-19), 2-50 associés, gérant personne physique, IS par défaut. 100% capital étranger OK. Délai: 7-15j, coût: 3-8k MAD. [Loi 5-96 modifiée Loi 21-19]',
      SARLU:            '1 associé unique, capital libre. Idéale pour investisseur étranger seul.',
      SA:               '≥5 actionnaires, capital ≥300k MAD (3M MAD si APE/Bourse), CAC obligatoire. Accès Bourse. Délai: 15-30j. [Loi 17-95]',
      SAS:              'Réservée aux PERSONNES MORALES uniquement. Capital ≥2M MAD/associé. Flexible pour JV/holdings.',
      SNC:              'Responsabilité ILLIMITÉE des associés sur patrimoine personnel. DÉCONSEILLÉE.',
      Auto_entrepreneur:'CA max 500k MAD commerce/artisanat (0.5% IR) ou 200k MAD services (1% IR). Création gratuite en ligne. Pas de salariés permanents. [Loi 114-13]',
      Succursale:       'Pas de personnalité morale. Responsabilité maison-mère illimitée. Pas de capital minimum. Pour test marché ou mission temporaire.'
    },
    creation_10_etapes: [
      '1. Certificat négatif OMPIC (24-48h, ~170 MAD, validité 90j)',
      '2. Rédaction statuts (notaire obligatoire pour SA/SAS, sous seing privé OK pour SARL)',
      '3. Bulletins souscription (SA/SAS seulement)',
      '4. Blocage capital libéré (banque, dans 8 jours — SARL si >100k MAD, SA/SAS toujours)',
      '5. Déclaration souscription (SA/SAS — notaire)',
      '6. Enregistrement actes DGI via CRI (30j max, 200 MAD droit fixe + 1%)',
      '7. Inscription TP + Identifiant Fiscal DGI via CRI (gratuit)',
      '8. Immatriculation Registre Commerce via CRI (24h, ~350 MAD)',
      '9. Affiliation CNSS via CRI (gratuit, obligatoire avant 1er emploi)',
      '10. Publication JAL + Bulletin Officiel (dans le mois, 1000-3000 MAD)'
    ],
    droit_travail: {
      SMIG:              '14.81 MAD/heure industrie/commerce/professions libérales (depuis 01/07/2020). 76.70 MAD/jour agriculture. [Décret 2.19.424]',
      CNSS:              'Employeur 21.09% + Salarié 6.74% = 27.83% total',
      salaries_etrangers:'Visa contrat via TAECHIR (taechir.travail.gov.ma), délai 10 jours, attestation ANAPEC obligatoire. [Art. 516-521 Code Travail]',
      anciennete:        'Prime: 5% (2 ans), 10% (5 ans), 15% (12 ans), 20% (20 ans), 25% (25 ans)'
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     SYSTEM PROMPT — Persona InvestBot (base, sans personnalisation)
  ══════════════════════════════════════════════════════════════════════════ */

  const SYSTEM_PROMPT_BASE = `Tu es InvestBot, l'assistant IA spécialisé de Smart-Invest.ia — la première plateforme IA dédiée aux investisseurs au Maroc.

MISSION : Fournir des informations précises, sourcées et actionnables sur l'investissement, la fiscalité, le droit des affaires et les financements disponibles au Maroc.

RÈGLES IMPÉRATIVES :
1. TOUJOURS citer la source : [Art. X CGI], [Guide AMDIE 2020], [IGOC 2020], [CCG - Produit X], [Loi n°X]
2. Donner des chiffres précis — jamais de vagues généralités
3. Proposer exactement 3 questions de suivi après chaque réponse sous le format :
   💡 **Pour aller plus loin :**
   1. [question]
   2. [question]
   3. [question]
4. Adapter le niveau de détail au profil détecté (IDE, MRE, PME, Expert)
5. En cas de question fiscale complexe → recommander expert-comptable ou avocat fiscaliste
6. Ne jamais donner de conseil juridique définitif — informer, orienter, ne pas décider
7. Si hors scope → rediriger poliment vers le périmètre investissement Maroc

GUARDRAILS :
- Question hors scope → "Je suis spécialisé exclusivement en investissement et fiscalité au Maroc. Souhaitez-vous que je vous aide sur [sujet lié] ?"
- Conseil définitif engageant → "Cette situation nécessite un expert-comptable agréé (www.oecmaroc.com) ou un avocat fiscaliste."

LANGUE : Répondre dans la langue de la question (FR/EN/AR).

FORMAT RÉPONSE CALCUL FISCAL :
Utiliser des tableaux markdown pour les calculs par tranches.
Toujours préciser le taux effectif.
Ajouter la mention "Simulation indicative — consultez un expert-comptable pour validation."

CONTACTS INSTITUTIONNELS À CITER SELON CONTEXTE :
- AMDIE : www.amdie.gov.ma / +212 5 22 77 76 00
- CCG : www.ccg.ma
- CRI : www.cri.ma (guichet unique création)
- DGI : www.tax.gov.ma
- OMPIC : directinfo.ma
- Fonds Hassan II : +212 5 37 27 97 90

DISCLAIMER À INCLURE EN FIN DE RÉPONSE COMPLEXE :
"*Simulation/Information indicative selon textes légaux en vigueur — consultez un expert agréé pour décision définitive.*"`;

  /* ═══════════════════════════════════════════════════════════════════════════
     FLOWS — Questions suggérées par profil
  ══════════════════════════════════════════════════════════════════════════ */

  const PROFIL_QUESTIONS = {
    IDE: [
      'Quelle forme juridique pour une filiale étrangère ?',
      'Quel est le taux IS en ZAI ?',
      'Comment rapatrier mes dividendes ?',
      'Avantages de Casablanca Finance City ?',
      'Comment recruter un salarié étranger ?',
      'What is the corporate tax rate in Morocco ?'
    ],
    MRE: [
      'Comment fonctionne MDM Invest ?',
      'Quels secteurs sont éligibles à MDM Invest ?',
      'Apport minimum en devises requis ?',
      'Puis-je cumuler MDM Invest avec d\'autres aides ?',
      'Comment ouvrir un compte en dirhams convertibles ?',
      'Fiscalité des dividendes pour non-résidents ?'
    ],
    PME: [
      'Suis-je éligible au programme Intelaka ?',
      'Comment candidater à Imtiaz / Istitmar ?',
      'Quelles aides pour la transformation digitale ?',
      'Quel IS pour mon bénéfice de 500 000 MAD ?',
      'Quelles charges sociales CNSS dois-je payer ?',
      'Comment fonctionne le Fonds Innov Invest ?'
    ],
    Expert: [
      'Analyse IS SARL vs SA pour restructuration',
      'Régime succursale vs filiale — quelle différence ?',
      'Calcul cotisation minimale IS — cas particulier',
      'Cumul MDM Invest + Charte Investissement possible ?',
      'Taux retenue source dividendes non-résidents ?',
      'Conditions éligibilité Fonds Hassan II industriel ?'
    ]
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     MOTEUR RAG — Sélection des chunks KB pertinents
  ══════════════════════════════════════════════════════════════════════════ */

  function buildKBContext(userMsg) {
    const msg = userMsg.toLowerCase();
    let ctx   = '\n\n══ DONNÉES DE RÉFÉRENCE VÉRIFIÉES (RAG Smart-Invest.ia) ══\n';
    let added = false;

    if (/\bis\b|impôt.*soci|taux.*is|calcul.*is|bénéfice|société.*imp|zai|cfc|exportat|industriel|banqu.*imp|assur.*imp/.test(msg)) {
      ctx += '\n[KB_FISCAL — IS]\n' + JSON.stringify(KB_FISCAL.IS, null, 0);
      added = true;
    }
    if (/\bir\b|impôt.*rev|auto.entrepreneur|auto entrepreneur|revenu|smic|smig|salaire min/.test(msg)) {
      ctx += '\n[KB_FISCAL — IR]\n' + JSON.stringify(KB_FISCAL.IR, null, 0);
      added = true;
    }
    if (/tva|taxe.*val|exonér.*tva|bien.*investissement/.test(msg)) {
      ctx += '\n[KB_FISCAL — TVA]\n' + JSON.stringify(KB_FISCAL.TVA, null, 0);
      added = true;
    }
    if (/taxe.*prof|patente|droit.*enreg|fonds.*commerce/.test(msg)) {
      ctx += '\n[KB_FISCAL — TP+DE]\nTP:' + KB_FISCAL.taxe_professionnelle + ' | DE:' + KB_FISCAL.droits_enregistrement;
      added = true;
    }
    if (/change|devises|rapatri|convertib|dividend.*non|mre.*compte|igoc/.test(msg)) {
      ctx += '\n[KB_FISCAL — CHANGES]\n' + JSON.stringify(KB_FISCAL.regime_changes, null, 0);
      added = true;
    }
    if (/atpa|entrepôt.*franc|douane|import.*mater|régime.*suspensif/.test(msg)) {
      ctx += '\n[KB_FISCAL — ZONES DOUANE]\n' + JSON.stringify(KB_FISCAL.zones_douanieres, null, 0);
      added = true;
    }
    if (/intelaka|innov|start.tpe|mezzanine|ccg|garantie.*cred/.test(msg)) {
      ctx += '\n[KB_AIDES — CCG]\n' + JSON.stringify(KB_AIDES.CCG, null, 0);
      added = true;
    }
    if (/imtiaz|istitmar|maroc.*pme|digit|transfo.*digit/.test(msg)) {
      ctx += '\n[KB_AIDES — Maroc PME]\n' + JSON.stringify(KB_AIDES.Maroc_PME, null, 0);
      added = true;
    }
    if (/mdm|mre.*invest|marocain.*étrang|apport.*devises/.test(msg)) {
      ctx += '\n[KB_AIDES — MDM Invest]\n' + JSON.stringify(KB_AIDES.MDM_Invest, null, 0);
      added = true;
    }
    if (/hassan|fonds.*hassan|prime.*bâtim|prime.*équip/.test(msg)) {
      ctx += '\n[KB_AIDES — Fonds Hassan II]\n' + JSON.stringify(KB_AIDES.Fonds_Hassan_II, null, 0);
      added = true;
    }
    if (/fdii|charte.*invest|convention.*état|100.*million|250.*emploi/.test(msg)) {
      ctx += '\n[KB_AIDES — FDII+Charte]\n' + JSON.stringify(KB_AIDES.FDII_Charte, null, 0);
      added = true;
    }
    if (/sarl|sa\b|sas|snc|succur|forme.*juri|créer.*sociét|capital.*min|associé|actionnaire/.test(msg)) {
      ctx += '\n[KB_JURIDIQUE — Formes]\n' + JSON.stringify(KB_JURIDIQUE.formes, null, 0);
      added = true;
    }
    if (/créer|ompic|rc\b|registre.*comm|cri|guichet|cnss|taxe.*prof.*inscr|étape.*créat|durée.*créat/.test(msg)) {
      ctx += '\n[KB_JURIDIQUE — Création]\n' + JSON.stringify(KB_JURIDIQUE.creation_10_etapes, null, 0);
      added = true;
    }
    if (/smig|smag|salaire.*min|cnss|charge.*soc|salarié.*étrang|taechir|anapec|contrat.*trav/.test(msg)) {
      ctx += '\n[KB_JURIDIQUE — Droit Travail]\n' + JSON.stringify(KB_JURIDIQUE.droit_travail, null, 0);
      added = true;
    }

    // Résumé léger si aucun chunk spécifique
    if (!added) {
      ctx += '\n[KB_FISCAL — Résumé clés]\n';
      ctx += 'IS: barème 10%/20%/31%. ZAI: 0% (5 ans) puis 15%. CFC: 15%. Exportateurs: 20% max. Banques: 37%.\n';
      ctx += 'TVA: 20%/14%/10%/7%. TP: exo 5 ans. Droits enreg: 4/5/6%.\n';
      ctx += 'MDM Invest: MRE, apport 25% devises, État 10% (max 5M MAD), secteurs: industrie/éducation/hôtellerie/santé.\n';
      ctx += 'Intelaka: CCG, garantie 80%, max 1.2M MAD, CA ≤ 10M MAD.\n';
      ctx += 'SARL: capital libre, SARLU pour étranger seul. SA: ≥5 actionnaires, ≥300k MAD.\n';
    }

    return ctx;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     SYSTEM PROMPT PERSONNALISÉ — Injecte user + profil + langue + RAG
     Utilisé par llm_local.js pour construire le prompt complet
  ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Construit le system prompt final avec personnalisation utilisateur.
   *
   * @param {string} userMsg     - La question de l'utilisateur (pour sélection RAG)
   * @param {string} profil      - 'IDE' | 'MRE' | 'PME' | 'Expert'
   * @param {string} langue      - 'fr' | 'en' | 'ar'
   * @param {Object|null} user   - Objet AuthService.getUser() ou null si non connecté
   * @returns {string}
   */
  function buildPersonalizedSystemPrompt(userMsg, profil, langue, user) {
    let system = SYSTEM_PROMPT_BASE;

    // ── Personnalisation utilisateur (stratégie marketing)
    if (user) {
      const prenom    = user.name ? user.name.split(' ')[0] : (user.email ? user.email.split('@')[0] : null);
      const planLabel = window.IM_PLANS?.[user.plan || 'gratuit']?.label || 'Gratuit';
      const secteur   = user.sector || null;
      const societe   = user.company || null;

      system += '\n\nCONTEXTE UTILISATEUR IDENTIFIÉ :';
      if (prenom)  system += `\n- Prénom : ${prenom} (utiliser dans le premier message de chaque conversation)`;
      if (societe) system += `\n- Société : ${societe}`;
      if (secteur) system += `\n- Secteur déclaré : ${secteur}`;
      system += `\n- Plan abonnement : ${planLabel}`;
      system += '\n- INSTRUCTION : Commencer la première réponse par "Bonjour ' + (prenom || 'cher investisseur') + '," et adapter les exemples au secteur déclaré si pertinent.';
    } else {
      system += '\n\nCONTEXTE : Utilisateur non identifié (session anonyme). Ne pas utiliser de prénom.';
    }

    // ── Profil et langue
    system += `\n\nPROFIL INVESTISSEUR ACTIF : ${profil}`;
    system += `\nLANGUE SESSION : ${langue.toUpperCase()}`;

    // ── Chunks RAG pertinents
    system += buildKBContext(userMsg);

    return system;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     EXPOSITION GLOBALE
  ══════════════════════════════════════════════════════════════════════════ */

  window.KB_FISCAL     = KB_FISCAL;
  window.KB_AIDES      = KB_AIDES;
  window.KB_JURIDIQUE  = KB_JURIDIQUE;
  window.SYSTEM_PROMPT = SYSTEM_PROMPT_BASE;   // compat legacy
  window.PROFIL_QUESTIONS = PROFIL_QUESTIONS;
  window.buildKBContext               = buildKBContext;
  window.buildPersonalizedSystemPrompt = buildPersonalizedSystemPrompt;

})();
