# Smart-Invest.ia — Dossier reconstruit et nettoyé

Ce dossier est prêt à être poussé tel quel dans un nouveau repository GitHub,
puis connecté à Netlify (déploiement statique, aucune configuration serveur requise).

## Contenu

- `landing.html` — page d'accueil, reconstruite selon la méthodologie d'audit
  (parcours en 5 étapes, hubs, essentiels) — tous les modules visibles sans clic.
- `mapping_portal.html` — portail alternatif, liens corrigés.
- 37 pages modules métier (fiscalité, juridique, zones économiques, etc.)
- 6 pages compte/infra (login, pricing, onboarding, owner_setup, sign_in_register, test_guard)
- `admin/` — 3 pages backoffice (accès restreint)
- `lib/` — 11 scripts JS réellement utilisés par le site (le 12e, `database.js`,
  n'était référencé nulle part et a été exclu)
- `fiscal-engine.js` — moteur de calcul fiscal, utilisé par 2 modules
- `netlify.toml` — configuration de déploiement (publie la racine du dossier)

## Ce qui a été exclu volontairement

- **43 fichiers `.html.bak`** — doublons de sauvegarde sans utilité en production
- **Le chantier Next.js inachevé** à la racine (`_app.tsx`, `index.tsx`, `pages/`,
  `src/`, `routes/`, `backend/`, `middleware/`, `supabase/`, `dev-tools/`,
  `package.json`, `next.config.js`, `tailwind.config.js`, `vercel.json`, etc.)
  — non connecté au site statique actuel, à ne réintégrer que si un jour la
  migration Next.js reprend.
- `lib/database.js` — présent mais non référencé par aucune page.
- `data/`, `backend/data/` (fichiers `.db`) — bases de données locales non
  utilisées par le site statique.
- L'ancien `public/smart_invest_landing.html` — remplacé par `landing.html`.

## Corrections appliquées

1. **Lien retour cassé** (`smart_invest_landing.html` → `landing.html`) corrigé
   sur 23 pages qui pointaient vers un fichier absent à la racine.
2. **`comptabilite GA.html` et `RH manager.html`** — bouton "← Retour au portail"
   ajouté (absent à l'origine).
3. **`landing.html`** — `navigateTo()` encode désormais les noms de fichiers
   (`encodeURI`) pour gérer sans risque les 2 fichiers dont le nom contient un
   espace, sans avoir besoin de les renommer.
4. **Module orphelin intégré** : `guide_des_investissements.html` ("Guide des
   IDE") existait dans le repo mais n'était relié depuis aucune page — ajouté
   à l'étape 1 (Orientation) du parcours.
5. Compteur de modules corrigé : 37 (vérifié mécaniquement contre le nombre
   réel de pages sur disque).

## Point de vigilance restant (non corrigé, hors périmètre du site public)

Les 3 pages dans `admin/` référencent certains scripts (`analytics.js`,
`auth.js`, etc.) sans le préfixe `lib/` — ces liens sont cassés. Comme cette
zone est un backoffice à accès restreint et non le site public, je ne l'ai
pas corrigée automatiquement. Dites-moi si vous voulez que je la répare aussi.

## Vérifications mécaniques passées

- ✅ 37 modules déclarés dans `landing.html` = 37 appelés = 37 pages réellement
  présentes sur disque (aucun lien mort, aucun module orphelin)
- ✅ Ancres internes (`#stage-x`) toutes valides
- ✅ Balises HTML équilibrées
- ✅ Syntaxe JavaScript valide
