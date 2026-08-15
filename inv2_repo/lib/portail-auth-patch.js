/**
 * Smart-Invest.ia — Patch Auth pour Portail & Index
 * Injecter dans portail.html et index.html APRÈS auth.js
 * Remplace openModule() et ajoute le user badge
 */

(function() {
  'use strict';

  const PLAN_LEVEL = { gratuit: 0, pro: 1, premium: 2 };

  // Map des accès requis par fichier
  const MODULE_ACCESS = {
    'Smart-Invest_simulateur_fiscal.html':    'gratuit',
    'Smart-Invest_forme_juridique.html':      'gratuit',
    'Smart-Invest_zones_economiques.html':    'gratuit',
    'Smart-Invest_matching_aides.html':       'gratuit',
    'Smart-Invest_tracker_cri.html':          'gratuit',
    'Smart-Invest_couts_installation.html':   'gratuit',
    'Smart-Invest_assistant.html':            'gratuit',
    'moniteur_monde.html':                   'gratuit',
    'guide_annexes_protection_ip.html':      'gratuit',
    'Smart-Invest_landing.html':              'gratuit',
    'Smart-Invest_cockpit_management.html':   'pro',
    'Smart-Invest_charte_investissement.html':'pro',
    'Smart-Invest_lean_sixsigma.html':        'pro',
    'Smart-Invest_contrats.html':             'pro',
    'Smart-Invest_gis_foncier.html':          'pro',
    'Smart-Invest_stopgo.html':               'pro',
    'Smart-Invest_tnb_2025.html':             'pro',
    'Smart-Invest_esg_rse.html':              'pro',
    'db.html':                               'pro',
    'invdemo_module23.html':                 'pro',
    'Smart-Invest_dashboard_projet.html':     'premium',
    'Smart-Invest_rapports_b2b.html':         'premium',
    'Smart-Invest_v2_agent_ia.html':          'premium',
    'Smart-Invest_v2_donnees_live.html':      'premium',
    'Smart-Invest_v2_parcours_communaute.html':'premium',
    'owner_setup.html':                      'premium',
    'Smart-Invest_backoffice.html':           'premium',
  };

  // ── OVERRIDE openModule ────────────────────────────────────────────────
  window.openModule = function(file) {
    const requiredPlan = MODULE_ACCESS[file] || 'gratuit';
    const user = window.AuthService ? AuthService.getUser() : null;
    const currentPlan = user ? (AuthService.getCurrentPlan ? AuthService.getCurrentPlan() : user.plan || 'gratuit') : 'gratuit';
    const userLevel = PLAN_LEVEL[currentPlan] ?? 0;
    const reqLevel  = PLAN_LEVEL[requiredPlan] ?? 0;

    if (!user && reqLevel > 0) {
      const ret = encodeURIComponent(file);
      window.location.href = 'Smart-Invest_login_v2.html?return=' + ret + '&reason=auth';
      return;
    }

    if (userLevel < reqLevel) {
      if (window.UpgradeModal) {
        const modName = getModuleName(file);
        UpgradeModal.show(requiredPlan, modName);
      } else {
        window.location.href = 'Smart-Invest_abonnements_v2.html?upgrade=' + requiredPlan + '&from=' + encodeURIComponent(file);
      }
      return;
    }

    // Accès autorisé — ouvrir
    window.open(file, '_blank');
    if (window.showToast) showToast('Ouverture de ' + getModuleName(file));
  };

  function getModuleName(file) {
    const names = {
      'Smart-Invest_simulateur_fiscal.html': 'Simulateur Fiscal',
      'Smart-Invest_cockpit_management.html': 'Cockpit Management',
      'Smart-Invest_charte_investissement.html': 'Charte Investissement',
      'Smart-Invest_lean_sixsigma.html': 'Lean Six Sigma',
      'Smart-Invest_gis_foncier.html': 'GIS Foncier',
      'Smart-Invest_dashboard_projet.html': 'Dashboard Projet',
      'Smart-Invest_v2_agent_ia.html': 'Agent IA InvestPilot',
      'Smart-Invest_rapports_b2b.html': 'Rapports B2B',
    };
    return names[file] || file.replace('Smart-Invest_','').replace('.html','').replace(/_/g,' ');
  }

  // ── INJECT VISUAL LOCK ICONS ON MODULE CARDS ───────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const user = window.AuthService ? AuthService.getUser() : null;
    const currentPlan = user ? (AuthService.getCurrentPlan ? AuthService.getCurrentPlan() : user.plan || 'gratuit') : 'gratuit';
    const userLevel = PLAN_LEVEL[currentPlan] ?? 0;

    // Inject user badge in header
    injectUserBadge(user, currentPlan);

    // Add visual lock to module cards
    document.querySelectorAll('.mc').forEach(card => {
      const onclickAttr = card.getAttribute('onclick') || '';
      const fileMatch = onclickAttr.match(/openModule\(['"]([^'"]+)['"]\)/);
      if (!fileMatch) return;
      const file = fileMatch[1];
      const reqPlan = MODULE_ACCESS[file] || 'gratuit';
      const reqLevel = PLAN_LEVEL[reqPlan] ?? 0;

      if (reqLevel > userLevel) {
        // Add lock overlay
        card.style.position = 'relative';
        const lockBadge = document.createElement('div');
        lockBadge.style.cssText = 'position:absolute;top:10px;left:10px;background:rgba(0,0,0,.7);color:#fff;font-size:11px;padding:3px 8px;border-radius:6px;font-family:var(--fm,monospace);display:flex;align-items:center;gap:4px;z-index:5;backdrop-filter:blur(4px)';
        const planLabels = { pro: '⚡ Pro', premium: '👑 Premium' };
        lockBadge.textContent = '🔒 ' + (planLabels[reqPlan] || reqPlan);
        card.appendChild(lockBadge);

        // Dim the card slightly
        card.style.opacity = '0.85';
        card.style.filter = 'saturate(0.7)';
        card.addEventListener('mouseenter', () => { card.style.opacity = '1'; card.style.filter = 'none'; });
        card.addEventListener('mouseleave', () => { card.style.opacity = '0.85'; card.style.filter = 'saturate(0.7)'; });
      }
    });
  });

  // ── USER BADGE ─────────────────────────────────────────────────────────
  function injectUserBadge(user, plan) {
    const header = document.querySelector('header.hd, .hd');
    if (!header) return;

    // Remove existing user badge if any
    const existing = document.getElementById('im-user-badge');
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.id = 'im-user-badge';
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px;margin-left:auto';

    if (!user) {
      wrap.innerHTML = `
        <a href="Smart-Invest_login_v2.html" style="font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(255,255,255,.4);text-decoration:none;padding:5px 12px;border:1px solid rgba(255,255,255,.1);border-radius:6px;transition:all .2s">
          Se connecter
        </a>
        <a href="Smart-Invest_register_v2.html" style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#0E0E0C;background:#B8862A;text-decoration:none;padding:5px 12px;border-radius:6px">
          S'inscrire
        </a>`;
    } else {
      const planColors = {
        gratuit: { bg: 'rgba(26,107,60,.15)', color: '#4ADE80', icon: '🌱' },
        pro:     { bg: 'rgba(184,134,42,.2)',  color: '#F0C460', icon: '⚡' },
        premium: { bg: 'rgba(100,160,220,.2)', color: '#93c5fd', icon: '👑' },
      };
      const pc = planColors[plan] || planColors.gratuit;
      const initials = (user.name || 'U').split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0,2) || 'U';

      wrap.innerHTML = `
        <a href="Smart-Invest_abonnements_v2.html" style="display:flex;align-items:center;gap:8px;text-decoration:none;cursor:pointer">
          <div style="width:28px;height:28px;border-radius:50%;background:${pc.bg};border:1.5px solid ${pc.color}50;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:${pc.color}">${initials}</div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:9px;padding:3px 9px;border-radius:100px;background:${pc.bg};color:${pc.color};border:1px solid ${pc.color}30">${pc.icon} ${plan.charAt(0).toUpperCase() + plan.slice(1)}</span>
        </a>
        <button onclick="if(window.AuthService)AuthService.logout();" style="font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(255,255,255,.25);background:none;border:1px solid rgba(255,255,255,.08);border-radius:5px;padding:4px 8px;cursor:pointer">
          Déconnexion
        </button>`;
    }

    // Find right side of header to append
    const rightEl = header.querySelector('.search-wrap, .back-home, [class*="right"]');
    if (rightEl) {
      rightEl.before(wrap);
    } else {
      header.appendChild(wrap);
    }
  }

})();
