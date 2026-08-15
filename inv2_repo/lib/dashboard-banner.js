/**
 * Smart-Invest.ia — User Dashboard Banner
 * Composant injecté dans index.html et portail.html
 * Affiche : état de connexion, plan actuel, modules débloqués, usage IA
 */

(function() {
  'use strict';

  function render() {
    const user = window.AuthService ? AuthService.getUser() : null;
    const plan = user && AuthService.getCurrentPlan ? AuthService.getCurrentPlan() : 'gratuit';
    
    const PLAN_DATA = {
      gratuit: { label: 'Gratuit', icon: '🌱', color: '#1A6B3C', bg: 'rgba(26,107,60,.08)', border: 'rgba(26,107,60,.2)', modules: 9, aiLimit: 10, aiUnit: '/jour' },
      pro:     { label: 'Pro',     icon: '⚡', color: '#B8862A', bg: 'rgba(184,134,42,.08)', border: 'rgba(184,134,42,.25)', modules: 19, aiLimit: 100, aiUnit: '/mois' },
      premium: { label: 'Premium', icon: '👑', color: '#1E4D6B', bg: 'rgba(30,77,107,.08)', border: 'rgba(30,77,107,.2)', modules: 26, aiLimit: '∞', aiUnit: '' },
    };

    const pd = PLAN_DATA[plan] || PLAN_DATA.gratuit;
    const usage = user?.usage || { aiMessages: 0, reports: 0 };
    const firstName = user ? (user.name || user.email || 'Visiteur').split(/[\s@]/)[0] : null;
    const trialLeft = user?.isTrial && user?.trialEnd ? Math.max(0, Math.ceil((user.trialEnd - Date.now()) / 86400000)) : null;
    const aiUsed = pd.aiLimit === '∞' ? 0 : Math.min(100, Math.round((usage.aiMessages / pd.aiLimit) * 100));

    const banner = document.createElement('div');
    banner.id = 'im-dashboard-banner';
    banner.style.cssText = `
      background:${pd.bg};
      border-bottom:1px solid ${pd.border};
      padding:10px 24px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:16px;
      flex-wrap:wrap;
      font-family:'Space Grotesk',sans-serif;
      font-size:12.5px;
    `;

    if (!user) {
      banner.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;color:#4A4A40">
          <span style="font-size:16px">👋</span>
          <span>Bienvenue sur Smart-Invest.ia — <strong>9 modules gratuits</strong> disponibles sans compte.</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <a href="Smart-Invest_login_v2.html" style="font-family:'JetBrains Mono',monospace;font-size:10px;padding:6px 14px;border:1px solid rgba(184,134,42,.3);border-radius:6px;color:#B8862A;text-decoration:none;transition:all .2s">
            Se connecter
          </a>
          <a href="Smart-Invest_register_v2.html" style="font-family:'JetBrains Mono',monospace;font-size:10px;padding:6px 14px;background:#B8862A;color:#0E0E0C;border-radius:6px;text-decoration:none;font-weight:700">
            Essai gratuit 7j →
          </a>
        </div>`;
    } else {
      const progressBar = pd.aiLimit === '∞' ? `<span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:${pd.color}">∞ illimité</span>` : `
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:60px;height:4px;background:rgba(0,0,0,.1);border-radius:2px;overflow:hidden">
            <div style="width:${aiUsed}%;height:100%;background:${aiUsed > 80 ? '#B91C1C' : pd.color};border-radius:2px;transition:width .4s"></div>
          </div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:${pd.color}">${usage.aiMessages}/${pd.aiLimit}${pd.aiUnit}</span>
        </div>`;

      const trialHtml = trialLeft !== null ? `<span style="font-family:'JetBrains Mono',monospace;font-size:9px;background:rgba(192,88,32,.1);color:#C05820;border:1px solid rgba(192,88,32,.2);padding:2px 8px;border-radius:100px">⏱ Essai: ${trialLeft}j restants</span>` : '';

      banner.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:32px;height:32px;border-radius:50%;background:${pd.bg};border:2px solid ${pd.color}40;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:${pd.color};flex-shrink:0">
            ${(user.name || 'U').split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0,2)}
          </div>
          <div>
            <div style="font-weight:600;color:#0E0E0C;margin-bottom:2px">
              Bonjour, ${firstName} !
              <span style="font-family:'JetBrains Mono',monospace;font-size:9px;padding:2px 8px;border-radius:100px;background:${pd.bg};color:${pd.color};border:1px solid ${pd.color}30;margin-left:6px">${pd.icon} ${pd.label}</span>
              ${trialHtml}
            </div>
            <div style="font-size:11px;color:#7A7A70;display:flex;align-items:center;gap:10px">
              <span>📦 ${pd.modules} modules débloqués</span>
              <span style="opacity:.4">·</span>
              <span>🤖 IA: ${progressBar}</span>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${plan !== 'premium' ? `<a href="Smart-Invest_abonnements_v2.html" style="font-family:'JetBrains Mono',monospace;font-size:10px;padding:6px 14px;background:${pd.color};color:${plan === 'pro' ? '#0E0E0C' : '#fff'};border-radius:6px;text-decoration:none;font-weight:700">Upgrader →</a>` : `<span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:${pd.color}">✓ Plan complet</span>`}
          <a href="Smart-Invest_abonnements_v2.html" style="font-family:'JetBrains Mono',monospace;font-size:10px;padding:6px 12px;border:1px solid rgba(0,0,0,.12);border-radius:6px;color:#7A7A70;text-decoration:none">Mon compte</a>
          <button onclick="if(window.AuthService)AuthService.logout();" style="font-family:'JetBrains Mono',monospace;font-size:10px;padding:5px 10px;border:1px solid rgba(0,0,0,.08);border-radius:6px;color:rgba(0,0,0,.3);background:none;cursor:pointer">✕</button>
        </div>`;
    }

    // Find header and insert after it
    const header = document.querySelector('header');
    if (header && header.nextSibling) {
      header.parentNode.insertBefore(banner, header.nextSibling);
    } else if (document.body.firstChild) {
      document.body.insertBefore(banner, document.body.firstChild.nextSibling);
    }
  }

  document.addEventListener('DOMContentLoaded', render);
  window.IMDashboard = { render };
})();
