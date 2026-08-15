/**
 * Smart-Invest.ia — LLM Local Engine v2.0
 * ─────────────────────────────────────────
 * Moteur IA 100% navigateur, sans clé API.
 *
 * STRATÉGIE :
 *   1. Tente WebLLM (MLC) via la bonne API v0.2.8x
 *   2. Fallback automatique sur transformers.js (HuggingFace)
 *   Les deux tournent dans des Web Workers avec WebGPU/WASM.
 *
 * CHANGEMENT v2 vs v1 :
 *   - API WebLLM corrigée (MLCEngine au lieu de CreateMLCEngine direct)
 *   - Import via script tag UMD (plus fiable que ESM dynamique)
 *   - Fallback transformers.js si WebLLM échoue
 *   - Meilleure gestion des erreurs d'initialisation
 *
 * Expose : window.LocalLLM  (même interface que v1)
 */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════
     CONFIGURATION
  ══════════════════════════════════════════════════════ */

  // Modèle WebLLM principal (Llama 3.2 - 1B quantisé)
  const WEBLLM_MODEL    = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

  // Modèle transformers.js fallback (Phi-3.5 mini - bon français, plus léger)
  const TRANSFORMERS_MODEL = 'Xenova/Phi-3.5-mini-instruct';

  // CDN WebLLM — UMD bundle (plus stable que ESM dynamique)
  const WEBLLM_CDN      = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.83/dist/webllm.js';

  // CDN Transformers.js officiel HuggingFace
  const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.2';

  const GEN_CONFIG = {
    temperature: 0.15,
    top_p:       0.9,
    max_tokens:  900,
  };

  const TIMEOUT_MS = 120_000; // 2 min max par inférence

  /* ══════════════════════════════════════════════════════
     ÉTAT
  ══════════════════════════════════════════════════════ */

  let _engine         = null;
  let _engineType     = null;   // 'webllm' | 'transformers'
  let _initPromise    = null;
  let _conversHistory = [];
  let _firstTurn      = true;
  let _onStatusChange = null;

  const status = {
    state:    'idle',   // idle | loading | ready | error | unsupported
    progress: 0,
    error:    null,
    engine:   null,
  };

  function _emit(patch) {
    Object.assign(status, patch);
    if (typeof _onStatusChange === 'function') {
      try { _onStatusChange({ ...status }); } catch (_) {}
    }
  }

  /* ══════════════════════════════════════════════════════
     DÉTECTION WEBGPU
  ══════════════════════════════════════════════════════ */

  async function _hasWebGPU() {
    if (typeof navigator === 'undefined' || !navigator.gpu) return false;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch (_) {
      return false;
    }
  }

  /* ══════════════════════════════════════════════════════
     CHARGEMENT SCRIPT DYNAMIQUE
  ══════════════════════════════════════════════════════ */

  function _loadScript(url) {
    return new Promise((resolve, reject) => {
      // Si déjà chargé
      if (document.querySelector(`script[src="${url}"]`)) {
        resolve(); return;
      }
      const s    = document.createElement('script');
      s.src      = url;
      s.type     = 'text/javascript';
      s.onload   = resolve;
      s.onerror  = () => reject(new Error('Impossible de charger : ' + url));
      document.head.appendChild(s);
    });
  }

  /* ══════════════════════════════════════════════════════
     TENTATIVE 1 — WebLLM (MLC)
  ══════════════════════════════════════════════════════ */

  async function _tryWebLLM() {
    _emit({ state: 'loading', progress: 2, error: null });

    // Charger le script UMD
    await _loadScript(WEBLLM_CDN);

    // L'UMD expose window.webllm
    const webllm = window.webllm;
    if (!webllm) throw new Error('window.webllm non trouvé après chargement du script.');

    // API correcte depuis v0.2.78+ : new webllm.MLCEngine()
    const engine = new webllm.MLCEngine();

    await engine.reload(WEBLLM_MODEL, {
      initProgressCallback: (report) => {
        const pct = Math.round((report.progress || 0) * 100);
        _emit({ state: 'loading', progress: pct });
      },
    });

    _engine     = engine;
    _engineType = 'webllm';
    return true;
  }

  /* ══════════════════════════════════════════════════════
     TENTATIVE 2 — Transformers.js (HuggingFace) FALLBACK
  ══════════════════════════════════════════════════════ */

  async function _tryTransformers() {
    _emit({ state: 'loading', progress: 5, error: null });

    let pipeline;
    try {
      // Import ESM via CDN
      const mod  = await import(TRANSFORMERS_CDN);
      pipeline   = mod.pipeline;
      if (!pipeline) throw new Error('pipeline() non trouvé dans transformers.js');
    } catch (e) {
      throw new Error('Import transformers.js échoué : ' + e.message);
    }

    let lastPct = 5;
    const generator = await pipeline('text-generation', TRANSFORMERS_MODEL, {
      dtype:    'q4',
      device:   'webgpu',
      progress_callback: (p) => {
        if (p.status === 'downloading' || p.status === 'loading') {
          const pct = Math.round((p.progress || lastPct));
          lastPct   = pct;
          _emit({ state: 'loading', progress: Math.min(pct, 95) });
        }
      },
    });

    _engine     = generator;
    _engineType = 'transformers';
    return true;
  }

  /* ══════════════════════════════════════════════════════
     INIT — orchestration
  ══════════════════════════════════════════════════════ */

  async function init() {
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
      _emit({ state: 'loading', progress: 0, error: null, engine: null });

      const gpuOk = await _hasWebGPU();
      if (!gpuOk) {
        _emit({
          state: 'unsupported',
          error: 'WebGPU indisponible. Ouvrez cette page dans Google Chrome 113+ sur desktop (pas en navigation privée).'
        });
        return false;
      }

      // Tentative 1 : WebLLM
      try {
        await _tryWebLLM();
        _emit({ state: 'ready', progress: 100, engine: 'webllm' });
        console.info('[LocalLLM] ✓ WebLLM prêt —', WEBLLM_MODEL);
        return true;
      } catch (e1) {
        console.warn('[LocalLLM] WebLLM échoué, tentative transformers.js :', e1.message);
        _emit({ state: 'loading', progress: 5, error: null, engine: null });
      }

      // Tentative 2 : Transformers.js
      try {
        await _tryTransformers();
        _emit({ state: 'ready', progress: 100, engine: 'transformers' });
        console.info('[LocalLLM] ✓ Transformers.js prêt —', TRANSFORMERS_MODEL);
        return true;
      } catch (e2) {
        const msg = 'Aucun moteur IA local disponible. WebLLM et Transformers.js ont échoué. Détails : ' + e2.message;
        _emit({ state: 'error', error: msg });
        console.error('[LocalLLM] Échec total :', e2);
        _initPromise = null;
        return false;
      }
    })();

    return _initPromise;
  }

  /* ══════════════════════════════════════════════════════
     ASK — appel unifié WebLLM ou Transformers.js
  ══════════════════════════════════════════════════════ */

  async function ask(userMsg, opts = {}) {
    if (status.state !== 'ready') {
      throw new Error('Moteur LLM non prêt. État : ' + status.state);
    }
    if (!userMsg?.trim()) throw new Error('Message vide.');

    const profil  = opts.profil  || 'IDE';
    const langue  = opts.langue  || 'fr';
    const doStream = opts.stream !== false;
    const onToken  = typeof opts.onToken === 'function' ? opts.onToken : null;

    // Récupérer user AuthService
    let user = null;
    try {
      if (window.AuthService?.isLoggedIn()) user = window.AuthService.getUser();
    } catch (_) {}

    // System prompt RAG personnalisé
    let systemContent = 'Tu es InvestBot, assistant spécialisé investissement Maroc.';
    try {
      if (typeof window.buildPersonalizedSystemPrompt === 'function') {
        systemContent = window.buildPersonalizedSystemPrompt(userMsg, profil, langue, user);
      }
    } catch (e) {
      console.warn('[LocalLLM] buildPersonalizedSystemPrompt indisponible :', e.message);
    }

    // Historique (5 derniers tours)
    _conversHistory.push({ role: 'user', content: userMsg });
    const history = _conversHistory.slice(-10);
    if (_firstTurn) _firstTurn = false;

    let fullText = '';

    const inferencePromise = (async () => {

      if (_engineType === 'webllm') {
        // ── WebLLM API v0.2.8x
        const messages = [{ role: 'system', content: systemContent }, ...history];

        if (doStream && onToken) {
          const stream = await _engine.chat.completions.create({
            messages, stream: true,
            temperature: GEN_CONFIG.temperature,
            top_p:       GEN_CONFIG.top_p,
            max_tokens:  GEN_CONFIG.max_tokens,
          });
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content || '';
            if (delta) { fullText += delta; onToken(delta); }
          }
        } else {
          const resp = await _engine.chat.completions.create({
            messages, stream: false,
            temperature: GEN_CONFIG.temperature,
            top_p:       GEN_CONFIG.top_p,
            max_tokens:  GEN_CONFIG.max_tokens,
          });
          fullText = resp.choices?.[0]?.message?.content || '';
          if (onToken && fullText) onToken(fullText);
        }

      } else if (_engineType === 'transformers') {
        // ── Transformers.js pipeline API
        // Construire le prompt en format chat
        const promptParts = [
          `<|system|>\n${systemContent}<|end|>`,
          ...history.map(m => `<|${m.role}|>\n${m.content}<|end|>`),
          '<|assistant|>'
        ];
        const prompt = promptParts.join('\n');

        const output = await _engine(prompt, {
          max_new_tokens: GEN_CONFIG.max_tokens,
          temperature:    GEN_CONFIG.temperature,
          top_p:          GEN_CONFIG.top_p,
          do_sample:      true,
          callback_function: onToken ? (beams) => {
            // Streaming approximatif via callback
            const newText = beams[0]?.output_token_ids?.length
              ? '' // transformers.js ne supporte pas le streaming token-par-token facilement
              : '';
          } : undefined,
        });

        // Extraire uniquement la réponse générée (après le dernier <|assistant|>)
        const raw = output?.[0]?.generated_text || output?.generated_text || '';
        fullText  = raw.split('<|assistant|>').pop().replace(/<\|end\|>.*$/s, '').trim();
        if (onToken && fullText) onToken(fullText);
      }

    })();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Délai dépassé (${TIMEOUT_MS/1000}s).`)), TIMEOUT_MS)
    );

    try {
      await Promise.race([inferencePromise, timeoutPromise]);
    } catch (e) {
      _conversHistory.pop();
      throw e;
    }

    if (fullText) {
      _conversHistory.push({ role: 'assistant', content: fullText });
    }

    // Tracking (non bloquant)
    try {
      if (window.AuthService?.isLoggedIn()) {
        window.AuthService.trackUsage('aiMessage').catch(() => {});
        window.AuthService.track('investbot_local_msg', { engine: _engineType, profil, langue });
      }
    } catch (_) {}

    return fullText;
  }

  /* ══════════════════════════════════════════════════════
     UTILITAIRES
  ══════════════════════════════════════════════════════ */

  function isReady()   { return status.state === 'ready';   }
  function isLoading() { return status.state === 'loading'; }

  function reset() {
    _conversHistory = [];
    _firstTurn      = true;
    console.debug('[LocalLLM] Historique réinitialisé.');
  }

  function getStatusLabel() {
    const e = status.engine === 'webllm' ? 'WebLLM' : status.engine === 'transformers' ? 'Transformers.js' : '';
    return {
      idle:        { label: 'En attente',                    color: '#7A7A70' },
      loading:     { label: `Chargement ${status.progress}%`, color: '#B8862A' },
      ready:       { label: `● Actif (${e})`,               color: '#1A6B3C' },
      error:       { label: '✕ Erreur moteur',              color: '#8B1A1A' },
      unsupported: { label: '✕ WebGPU indisponible',        color: '#8B1A1A' },
    }[status.state] || { label: '…', color: '#7A7A70' };
  }

  /* ══════════════════════════════════════════════════════
     EXPOSITION GLOBALE
  ══════════════════════════════════════════════════════ */

  window.LocalLLM = {
    init,
    ask,
    isReady,
    isLoading,
    reset,
    getStatusLabel,
    status,
    set onStatusChange(fn) { _onStatusChange = fn; },
  };

  console.info('[LocalLLM v2] Module chargé. Appelez LocalLLM.init() pour démarrer.');

})();