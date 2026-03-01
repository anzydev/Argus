/**
 * Argus — Frontend Script
 *
 * Connects to backend API endpoints:
 *   POST /compare       — Dual file comparison
 *   POST /compare_zip   — ZIP batch comparison
 *   POST /detect_ai_single — Single file AI detection
 *   POST /detect_ai_batch  — Batch AI detection
 *   GET  /random_code   — Load sample code
 *   GET  /health        — API health check
 */

(function () {
  'use strict';

  const API_BASE = 'http://127.0.0.1:8000';

  // ── Gate Screen Logic ──
  let validatedApiKey = '';

  (function initGate() {
    const overlay = document.getElementById('gate-overlay');
    const gateInput = document.getElementById('gate-api-key');
    const gateBtn = document.getElementById('gate-btn');
    const gateError = document.getElementById('gate-error');
    const gateToggle = document.getElementById('gate-toggle-vis');
    const gateEye = document.getElementById('gate-eye');
    const particlesContainer = document.getElementById('gate-particles');

    // Create floating particles
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'gate-particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.width = (3 + Math.random() * 4) + 'px';
      p.style.height = p.style.width;
      p.style.animationDuration = (6 + Math.random() * 10) + 's';
      p.style.animationDelay = (Math.random() * 8) + 's';
      p.style.opacity = 0.2 + Math.random() * 0.4;
      particlesContainer.appendChild(p);
    }

    // Toggle password visibility
    gateToggle.addEventListener('click', () => {
      const isPassword = gateInput.type === 'password';
      gateInput.type = isPassword ? 'text' : 'password';
      gateEye.textContent = isPassword ? '🙈' : '👁';
    });

    function showGateError(msg) {
      gateError.textContent = msg;
      gateError.classList.add('visible');
      gateInput.classList.add('shake');
      gateInput.style.borderColor = '#ff6b6b';
      setTimeout(() => gateInput.classList.remove('shake'), 500);
    }

    function clearGateError() {
      gateError.classList.remove('visible');
      gateInput.style.borderColor = '';
    }

    gateInput.addEventListener('input', clearGateError);

    async function validateAndEnter() {
      const key = gateInput.value.trim();
      if (!key) { showGateError('Please enter your Groq API key.'); return; }
      if (!key.startsWith('gsk_')) { showGateError('Invalid format — Groq keys start with "gsk_".'); return; }

      gateBtn.classList.add('loading');
      gateBtn.disabled = true;
      clearGateError();

      try {
        const resp = await fetch(`${API_BASE}/validate_key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: key }),
        });
        const data = await resp.json();

        if (data.valid) {
          validatedApiKey = key;
          overlay.classList.add('success');
          gateBtn.querySelector('.gate-btn-text').textContent = '✓ Verified';

          const mainKeyInput = document.getElementById('api-key');
          if (mainKeyInput) mainKeyInput.value = key;

          setTimeout(() => {
            overlay.classList.add('unlocking');
            setTimeout(() => overlay.classList.add('hidden'), 700);
          }, 600);
        } else {
          // Extract friendly message from Groq error if possible
          let msg = data.message || 'Invalid API key.';
          if (msg.includes("'message':")) {
            const match = msg.match(/'message':\s*'([^']+)'/);
            if (match) msg = match[1];
          }
          showGateError(msg);
        }
      } catch (err) {
        showGateError('Cannot reach Argus server. Is it running on port 8000?');
      } finally {
        gateBtn.classList.remove('loading');
        gateBtn.disabled = false;
      }
    }

    gateBtn.addEventListener('click', validateAndEnter);
    gateInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') validateAndEnter(); });
    setTimeout(() => gateInput.focus(), 800);
  })();

  // ── DOM Elements ──
  const modeTabs = document.querySelectorAll('.mode-tab');
  const dualSection = document.getElementById('dual-mode-section');
  const aiSingleSection = document.getElementById('ai-single-mode-section');
  const zipSection = document.getElementById('zip-mode-section');
  const aiSection = document.getElementById('ai-mode-section');
  const sections = { dual: dualSection, zip: zipSection, 'ai-single': aiSingleSection, ai: aiSection };

  const codeA = document.getElementById('code-a');
  const codeB = document.getElementById('code-b');
  const codeAi = document.getElementById('code-ai');
  const countA = document.getElementById('count-a');
  const countB = document.getElementById('count-b');
  const countAi = document.getElementById('count-ai');
  const langSelect = document.getElementById('lang-select');
  const ngramSlider = document.getElementById('ngram-size');
  const ngramDisplay = document.getElementById('ngram-display');
  const apiKeyInput = document.getElementById('api-key');

  const scanBtn = document.getElementById('scan-btn');
  const scanAiSingleBtn = document.getElementById('scan-ai-single-btn');
  const scanZipBtn = document.getElementById('scan-zip-btn');
  const scanAiBtn = document.getElementById('scan-ai-btn');

  const gaugeFill = document.getElementById('gauge-fill');
  const gaugePct = document.getElementById('gauge-pct');

  const errorToast = document.getElementById('error-toast');
  const successToast = document.getElementById('success-toast');

  const dualResults = document.getElementById('dual-results-grid');
  const batchResults = document.getElementById('batch-results-grid');
  const aiSingleResults = document.getElementById('ai-single-results-grid');
  const aiResults = document.getElementById('ai-results-grid');

  const drawerOverlay = document.getElementById('drawer-overlay');
  const drawer = document.getElementById('drawer');
  const drawerClose = document.getElementById('drawer-close');
  const drawerBody = document.getElementById('drawer-body');

  const CIRCUMFERENCE = 2 * Math.PI * 48; // gauge circle radius=48

  let currentMode = 'dual';
  let batchData = null;

  // Helper to get active API key (gate key or manually-entered key)
  function getActiveApiKey() {
    const manualKey = apiKeyInput.value.trim();
    return manualKey || validatedApiKey;
  }

  // ── Mode Switching ──
  modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      switchMode(mode);
    });
  });

  function switchMode(mode) {
    currentMode = mode;
    modeTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    Object.entries(sections).forEach(([key, el]) => {
      el.style.display = key === mode ? '' : 'none';
    });
    [dualResults, batchResults, aiSingleResults, aiResults].forEach(r => r.style.display = 'none');
  }

  // ── Character Counts ──
  codeA.addEventListener('input', () => { countA.textContent = codeA.value.length + ' chars'; });
  codeB.addEventListener('input', () => { countB.textContent = codeB.value.length + ' chars'; });
  codeAi.addEventListener('input', () => { countAi.textContent = codeAi.value.length + ' chars'; });

  // ── N-gram Slider ──
  ngramSlider.addEventListener('input', () => { ngramDisplay.textContent = ngramSlider.value; });

  // ── Load Sample ──
  document.getElementById('load-sample-a').addEventListener('click', (e) => { e.stopPropagation(); loadSample('a'); });
  document.getElementById('load-sample-b').addEventListener('click', (e) => { e.stopPropagation(); loadSample('b'); });

  async function loadSample(target) {
    const btn = document.getElementById('load-sample-' + target);
    const origText = btn.textContent;
    btn.textContent = 'Loading…';
    btn.disabled = true;

    try {
      const lang = langSelect.value;
      const resp = await fetch(`${API_BASE}/random_code?language=${lang}`);
      if (!resp.ok) throw new Error('Failed to fetch sample');
      const data = await resp.json();
      const textarea = target === 'a' ? codeA : codeB;
      textarea.value = data.code || '';
      textarea.dispatchEvent(new Event('input'));
    } catch (err) {
      showError(err.message);
    } finally {
      btn.textContent = origText;
      btn.disabled = false;
    }
  }

  // ── ZIP Upload ──
  const zipFile = document.getElementById('zip-file');
  const aiZipFile = document.getElementById('ai-zip-file');
  const dropZoneZip = document.getElementById('drop-zone-zip');
  const dropZoneAi = document.getElementById('drop-zone-ai');

  document.getElementById('browse-zip').addEventListener('click', (e) => { e.stopPropagation(); zipFile.click(); });
  document.getElementById('browse-ai').addEventListener('click', (e) => { e.stopPropagation(); aiZipFile.click(); });

  dropZoneZip.addEventListener('click', () => zipFile.click());
  dropZoneAi.addEventListener('click', () => aiZipFile.click());

  [dropZoneZip, dropZoneAi].forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  });

  dropZoneZip.addEventListener('drop', e => {
    e.preventDefault(); dropZoneZip.classList.remove('drag-over');
    if (e.dataTransfer.files.length) { zipFile.files = e.dataTransfer.files; zipFile.dispatchEvent(new Event('change')); }
  });

  dropZoneAi.addEventListener('drop', e => {
    e.preventDefault(); dropZoneAi.classList.remove('drag-over');
    if (e.dataTransfer.files.length) { aiZipFile.files = e.dataTransfer.files; aiZipFile.dispatchEvent(new Event('change')); }
  });

  zipFile.addEventListener('change', () => {
    scanZipBtn.disabled = !zipFile.files.length;
    if (zipFile.files.length) {
      dropZoneZip.querySelector('.upload-title').textContent = zipFile.files[0].name;
    }
  });

  aiZipFile.addEventListener('change', () => {
    scanAiBtn.disabled = !aiZipFile.files.length;
    if (aiZipFile.files.length) {
      dropZoneAi.querySelector('.upload-title').textContent = aiZipFile.files[0].name;
    }
  });

  // ── Toast System (pop animations) ──
  let errorTimer = null;
  let successTimer = null;

  function showError(msg) {
    clearTimeout(errorTimer);
    errorToast.textContent = msg;
    errorToast.classList.remove('pop-in', 'pop-out');
    void errorToast.offsetWidth;
    errorToast.classList.add('pop-in');

    errorTimer = setTimeout(() => {
      errorToast.classList.remove('pop-in');
      errorToast.classList.add('pop-out');
    }, 4000);
  }

  function showSuccess(msg) {
    clearTimeout(successTimer);
    successToast.textContent = msg;
    successToast.classList.remove('pop-in', 'pop-out');
    void successToast.offsetWidth;
    successToast.classList.add('pop-in');

    successTimer = setTimeout(() => {
      successToast.classList.remove('pop-in');
      successToast.classList.add('pop-out');
    }, 3000);
  }

  // ── Gauge Update ──
  function updateGauge(score) {
    const pct = score * 100;
    const offset = CIRCUMFERENCE * (1 - score);
    gaugeFill.style.strokeDashoffset = offset;
    gaugePct.textContent = pct.toFixed(1) + '%';

    if (score >= 0.7) {
      gaugeFill.style.stroke = 'var(--danger)';
    } else if (score >= 0.4) {
      gaugeFill.style.stroke = 'var(--warning)';
    } else {
      gaugeFill.style.stroke = 'var(--success)';
    }
  }

  function resetGauge() {
    gaugeFill.style.strokeDashoffset = CIRCUMFERENCE;
    gaugePct.textContent = '—';
    gaugeFill.style.stroke = 'var(--accent)';
  }

  // ── Button Loading State ──
  function setBtnLoading(btn, loading) {
    if (loading) {
      btn._origHTML = btn.innerHTML;
      btn.innerHTML = '<span class="btn-icon" style="animation: spin 0.8s linear infinite;">⏳</span><span>Analyzing…</span>';
      btn.disabled = true;
    } else {
      btn.innerHTML = btn._origHTML;
      btn.disabled = false;
    }
  }

  // ── DUAL SCAN ──
  scanBtn.addEventListener('click', runDualScan);

  async function runDualScan() {
    const c1 = codeA.value.trim();
    const c2 = codeB.value.trim();
    if (!c1 || !c2) { showError('Please paste code in both editors.'); return; }

    setBtnLoading(scanBtn, true);
    resetGauge();
    dualResults.style.display = 'none';

    try {
      const payload = {
        code1: c1,
        code2: c2,
        ngram_size: parseInt(ngramSlider.value),
        language: langSelect.value,
      };
      const key = getActiveApiKey();
      if (key) payload.api_key = key;

      const resp = await fetch(`${API_BASE}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'Analysis failed');
      }

      const data = await resp.json();
      renderDualResults(data);
      showSuccess('Analysis complete');
    } catch (err) {
      showError(err.message);
    } finally {
      setBtnLoading(scanBtn, false);
    }
  }

  function renderDualResults(data) {
    const score = data.score;
    updateGauge(score);

    document.getElementById('verdict-text').textContent = data.verdict;
    document.getElementById('verdict-pct').textContent = data.score_pct;
    document.getElementById('verdict-sub').textContent = `Analysis of ${langSelect.value} code with N-gram size ${ngramSlider.value}`;

    const icon = document.getElementById('verdict-icon');
    const card = document.getElementById('verdict-card');
    card.style.borderLeftWidth = '4px';
    if (score >= 0.7) {
      icon.textContent = '🚨';
      card.style.borderLeftColor = 'var(--danger)';
    } else if (score >= 0.4) {
      icon.textContent = '⚠️';
      card.style.borderLeftColor = 'var(--warning)';
    } else {
      icon.textContent = '✅';
      card.style.borderLeftColor = 'var(--success)';
    }

    const d = data.details;
    document.getElementById('s-nodes-a').textContent = d.nodes_a_count || '—';
    document.getElementById('s-nodes-b').textContent = d.nodes_b_count || '—';
    document.getElementById('s-ngrams-a').textContent = d.ngrams_a_count || '—';
    document.getElementById('s-ngrams-b').textContent = d.ngrams_b_count || '—';
    document.getElementById('s-intersection').textContent = d.intersection || '—';
    document.getElementById('s-union').textContent = d.union || '—';
    document.getElementById('s-ngram-size').textContent = ngramSlider.value;
    document.getElementById('s-score').textContent = data.score_pct;

    renderAiBadge('ai-badge-a', d.code1_ai);
    renderAiBadge('ai-badge-b', d.code2_ai);

    dualResults.style.display = 'grid';
    dualResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderAiBadge(elementId, aiData) {
    const el = document.getElementById(elementId);
    if (!aiData || aiData.reason === 'No API key') {
      el.textContent = 'N/A';
      el.title = 'No API key provided';
      return;
    }
    if (aiData.is_ai) {
      el.innerHTML = `<span style="color:var(--danger);font-weight:600;">AI (${aiData.confidence}%)</span>`;
      el.title = aiData.reason || '';
    } else {
      el.innerHTML = `<span style="color:var(--success);font-weight:600;">Human (${100 - (aiData.confidence || 0)}%)</span>`;
      el.title = aiData.reason || '';
    }
  }

  // ── ZIP BATCH SCAN ──
  scanZipBtn.addEventListener('click', runZipScan);

  async function runZipScan() {
    if (!zipFile.files.length) return;
    setBtnLoading(scanZipBtn, true);

    try {
      const formData = new FormData();
      formData.append('file', zipFile.files[0]);
      formData.append('ngram_size', ngramSlider.value);
      formData.append('language', langSelect.value);
      const key = getActiveApiKey();
      if (key) formData.append('api_key', key);

      const resp = await fetch(`${API_BASE}/compare_zip`, { method: 'POST', body: formData });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'Batch analysis failed');
      }

      const data = await resp.json();
      batchData = data;
      renderBatchResults(data);
      showSuccess(`Batch analysis complete — ${data.results.length} pairs compared`);
    } catch (err) {
      showError(err.message);
    } finally {
      setBtnLoading(scanZipBtn, false);
    }
  }

  function renderBatchResults(data) {
    const tbody = document.getElementById('batch-table-body');
    tbody.innerHTML = '';

    const numFiles = Object.keys(data.files || {}).length;
    document.getElementById('batch-subtitle').textContent =
      `Pairwise comparisons across ${numFiles} files — ${data.results.length} pairs`;

    data.results.forEach((r, idx) => {
      const tr = document.createElement('tr');
      const badgeClass = r.score >= 0.7 ? 'badge-high' : r.score >= 0.4 ? 'badge-moderate' : 'badge-low';
      tr.innerHTML = `
                <td><span class="similarity-badge ${badgeClass}">${r.score_pct}</span></td>
                <td>${esc(r.file1)}</td>
                <td>${esc(r.file2)}</td>
                <td style="max-width:280px;font-size:0.8rem;">${esc(r.verdict)}</td>
                <td style="text-align:right;">
                    <button class="btn-detail" data-idx="${idx}">Details</button>
                </td>
            `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-detail').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        openDrawer(data.results[idx], data.files);
      });
    });

    batchResults.style.display = 'block';
    batchResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── AI SINGLE SCAN ──
  scanAiSingleBtn.addEventListener('click', runAiSingleScan);

  async function runAiSingleScan() {
    const code = codeAi.value.trim();
    if (!code) { showError('Please paste code to analyze.'); return; }
    setBtnLoading(scanAiSingleBtn, true);

    try {
      const payload = { code, language: langSelect.value };
      const key = getActiveApiKey();
      if (key) payload.api_key = key;

      const resp = await fetch(`${API_BASE}/detect_ai_single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'AI detection failed');
      }

      const data = await resp.json();
      renderAiSingleResult(data);
      showSuccess('AI detection complete');
    } catch (err) {
      showError(err.message);
    } finally {
      setBtnLoading(scanAiSingleBtn, false);
    }
  }

  function renderAiSingleResult(data) {
    const icon = document.getElementById('ai-single-icon');
    const title = document.getElementById('ai-single-title');
    const sub = document.getElementById('ai-single-sub');
    const badge = document.getElementById('ai-single-badge');

    if (data.is_ai) {
      icon.textContent = '🤖';
      title.textContent = 'AI-Generated Code Detected';
      title.style.color = 'var(--danger)';
      badge.innerHTML = `<span class="similarity-badge badge-high" style="font-size:1rem;padding:6px 20px;">Confidence: ${data.confidence}%</span>`;
    } else {
      icon.textContent = '👤';
      title.textContent = 'Human-Written Code';
      title.style.color = 'var(--success)';
      badge.innerHTML = `<span class="similarity-badge badge-low" style="font-size:1rem;padding:6px 20px;">Confidence: ${100 - (data.confidence || 0)}%</span>`;
    }
    sub.textContent = data.reason || '';

    aiSingleResults.style.display = 'block';
    aiSingleResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── AI BATCH SCAN ──
  scanAiBtn.addEventListener('click', runAiBatchScan);

  async function runAiBatchScan() {
    if (!aiZipFile.files.length) return;
    setBtnLoading(scanAiBtn, true);

    try {
      const formData = new FormData();
      formData.append('file', aiZipFile.files[0]);
      formData.append('language', langSelect.value);
      const key = getActiveApiKey();
      if (key) formData.append('api_key', key);

      const resp = await fetch(`${API_BASE}/detect_ai_batch`, { method: 'POST', body: formData });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'AI batch detection failed');
      }

      const data = await resp.json();
      renderAiBatchResults(data);
      showSuccess(`AI detection complete — ${data.results.length} files analyzed`);
    } catch (err) {
      showError(err.message);
    } finally {
      setBtnLoading(scanAiBtn, false);
    }
  }

  function renderAiBatchResults(data) {
    const tbody = document.getElementById('ai-table-body');
    tbody.innerHTML = '';

    document.getElementById('ai-batch-subtitle').textContent =
      `AI detection across ${data.results.length} files`;

    data.results.forEach(r => {
      const tr = document.createElement('tr');
      const badgeClass = r.is_ai ? 'badge-high' : 'badge-low';
      const label = r.is_ai ? `AI ${r.confidence}%` : `Human ${100 - (r.confidence || 0)}%`;
      tr.innerHTML = `
                <td><span class="similarity-badge ${badgeClass}">${esc(label)}</span></td>
                <td>${esc(r.file)}</td>
                <td>${r.is_ai ? '🤖 AI Generated' : '👤 Human Written'}</td>
                <td style="max-width:320px;font-size:0.8rem;">${esc(r.reason)}</td>
            `;
      tbody.appendChild(tr);
    });

    aiResults.style.display = 'block';
    aiResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Investigation Drawer ──
  function openDrawer(result, files) {
    let html = '';

    html += `<div class="drawer-section">
            <div class="drawer-section-title">Comparison</div>
            <div class="drawer-pair">${esc(result.file1)}<span class="vs-text">vs</span>${esc(result.file2)}</div>
        </div>`;

    html += `<div class="drawer-section">
            <div class="drawer-section-title">Structural Similarity</div>
            <div class="drawer-big-pct">${result.score_pct}</div>
            <div style="font-size:0.82rem;color:var(--text-muted);margin-top:4px;">${esc(result.verdict)}</div>
        </div>`;

    const d = result.details || {};
    html += `<div class="drawer-section">
            <div class="drawer-section-title">Technical Specs</div>
            <div class="drawer-stat-row"><span>AST Nodes (A)</span><span class="val">${d.nodes_a_count || '—'}</span></div>
            <div class="drawer-stat-row"><span>AST Nodes (B)</span><span class="val">${d.nodes_b_count || '—'}</span></div>
            <div class="drawer-stat-row"><span>N-grams (A)</span><span class="val">${d.ngrams_a_count || '—'}</span></div>
            <div class="drawer-stat-row"><span>N-grams (B)</span><span class="val">${d.ngrams_b_count || '—'}</span></div>
            <div class="drawer-stat-row"><span>Shared N-grams</span><span class="val">${d.intersection || '—'}</span></div>
            <div class="drawer-stat-row"><span>Union N-grams</span><span class="val">${d.union || '—'}</span></div>
            <div class="drawer-stat-row"><span>Jaccard Score</span><span class="val">${result.score_pct}</span></div>
        </div>`;

    const reasoning = d.ai_reasoning || '';
    if (reasoning) {
      html += `<div class="drawer-section">
                <div class="drawer-section-title">AI Forensic Analysis</div>
                <div class="drawer-reasoning">${esc(reasoning)}</div>
            </div>`;
    }

    if (files) {
      const code1 = files[result.file1];
      const code2 = files[result.file2];
      if (code1) {
        html += `<div class="drawer-section">
                    <div class="drawer-section-title">${esc(result.file1)}</div>
                    <pre style="background:var(--bg-code);padding:12px;border-radius:var(--radius-sm);font-family:var(--font-mono);font-size:0.75rem;overflow-x:auto;max-height:200px;border:1px solid var(--border);color:var(--text-mid);line-height:1.6;">${esc(code1.slice(0, 1500))}</pre>
                </div>`;
      }
      if (code2) {
        html += `<div class="drawer-section">
                    <div class="drawer-section-title">${esc(result.file2)}</div>
                    <pre style="background:var(--bg-code);padding:12px;border-radius:var(--radius-sm);font-family:var(--font-mono);font-size:0.75rem;overflow-x:auto;max-height:200px;border:1px solid var(--border);color:var(--text-mid);line-height:1.6;">${esc(code2.slice(0, 1500))}</pre>
                </div>`;
      }
    }

    drawerBody.innerHTML = html;
    drawer.classList.add('open');
    drawerOverlay.classList.add('open');
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    drawerOverlay.classList.remove('open');
  }

  drawerClose.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  // ── Helpers ──
  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // ── Spinner keyframe ──
  const style = document.createElement('style');
  style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);

})();