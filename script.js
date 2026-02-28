const SAMPLE_A = `"""
data/script_a.py — Clean Two-Sum solution using a hash map.
"""

def two_sum(numbers: list, target: int) -> list:
    """Find indices of two numbers that add up to target."""
    seen = {}
    for index, value in enumerate(numbers):
        complement = target - value
        if complement in seen:
            return [seen[complement], index]
        seen[value] = index
    return []

if __name__ == "__main__":
    nums = [2, 7, 11, 15]
    t = 9
    result = two_sum(nums, t)
    print(f"Output: {result}")`;

const SAMPLE_B = `"""
data/script_b.py — Obfuscated Two-Sum solution.
All variables renamed, for-loop → while-loop, noise injected.
"""
import random

def xQ7(z: list, k: int) -> list:
    print("starting process...")
    q = {}
    p = 0
    print(f"DEBUG: list length is {len(z)}")
    while p < len(z):
        v = z[p]
        print("iteration:", p, "value:", v)
        r = k - v
        if r in q:
            print("match found!")
            return [q[r], p]
        q[v] = p
        p += 1
    print("no result found")
    return []

if __name__ == "__main__":
    a = [2, 7, 11, 15]
    b = 9
    print(random.random())
    c = xQ7(a, b)
    print(c)`;

// ── API base URL ──────────────────────────────────────────────────────
const API = 'http://localhost:8000';

// ── Load samples ──────────────────────────────────────────────────────
async function loadSample(which, btn) {
  const originalText = btn.textContent;
  btn.textContent = 'Fetching...';
  btn.disabled = true;

  try {
    const lang = document.getElementById('lang-select').value;
    const res = await fetch(`${API}/random_code?language=${lang}`);
    if (!res.ok) throw new Error('Failed to fetch from GitHub via backend API');
    const data = await res.json();

    if (which === 'a') {
      document.getElementById('code-a').value = data.code;
    } else {
      document.getElementById('code-b').value = data.code;
    }
  } catch (err) {
    showError('GitHub fetch failed, falling back to local samples.');
    if (which === 'a') {
      document.getElementById('code-a').value = SAMPLE_A;
    } else {
      document.getElementById('code-b').value = SAMPLE_B;
    }
  } finally {
    updateCount();
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// ── Character counts ──────────────────────────────────────────────────
function updateCount() {
  const a = document.getElementById('code-a') ? document.getElementById('code-a').value : '';
  const b = document.getElementById('code-b') ? document.getElementById('code-b').value : '';
  const ai = document.getElementById('code-ai') ? document.getElementById('code-ai').value : '';

  if (document.getElementById('count-a')) document.getElementById('count-a').textContent = a.length.toLocaleString() + ' chars';
  if (document.getElementById('count-b')) document.getElementById('count-b').textContent = b.length.toLocaleString() + ' chars';
  if (document.getElementById('count-ai')) document.getElementById('count-ai').textContent = ai.length.toLocaleString() + ' chars';
}

if (document.getElementById('code-a')) document.getElementById('code-a').addEventListener('input', updateCount);
if (document.getElementById('code-b')) document.getElementById('code-b').addEventListener('input', updateCount);
if (document.getElementById('code-ai')) document.getElementById('code-ai').addEventListener('input', updateCount);

// ── N-gram slider ─────────────────────────────────────────────────────
const ngramSlider = document.getElementById('ngram-size');
const ngramDisplay = document.getElementById('ngram-display');
ngramSlider.addEventListener('input', () => {
  ngramDisplay.textContent = ngramSlider.value;
});

// ── Gauge helpers ─────────────────────────────────────────────────────
const CIRCUMFERENCE = 326.73;
const gaugeFill = document.getElementById('gauge-fill');
const gaugePct = document.getElementById('gauge-pct');

function setGauge(fraction) {
  const offset = CIRCUMFERENCE * (1 - fraction);
  gaugeFill.style.strokeDashoffset = offset;

  // Colour: green → amber → red
  let colour;
  if (fraction < 0.40) colour = '#10b981';
  else if (fraction < 0.70) colour = '#f59e0b';
  else colour = '#f43f5e';
  gaugeFill.style.stroke = colour;

  gaugePct.textContent = Math.round(fraction * 100) + '%';
}

function resetGauge() {
  gaugeFill.style.strokeDashoffset = CIRCUMFERENCE;
  gaugeFill.style.stroke = '#10b981';
  gaugePct.textContent = '—';
}

// ── Error display ─────────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('error-toast');
  el.style.display = 'block';
  el.textContent = '⚠️  ' + msg;
  setTimeout(() => { el.style.display = 'none'; }, 8000);
}

function hideError() {
  document.getElementById('error-toast').style.display = 'none';
}

function showSuccess(msg) {
  const el = document.getElementById('success-toast');
  el.style.display = 'block';
  el.textContent = '✅  ' + msg;
  setTimeout(() => { el.style.display = 'none'; }, 6000);
}

// ── Mode switcher ─────────────────────────────────────────────────────
let currentMode = 'dual'; // 'dual' or 'zip'

function switchMode(mode) {
  currentMode = mode;

  const tabs = document.querySelectorAll('.mode-tab');
  tabs.forEach(t => t.classList.remove('active'));
  document.querySelector(`.mode-tab[onclick="switchMode('${mode}')"]`).classList.add('active');

  document.getElementById('dual-mode-section').style.display = mode === 'dual' ? 'grid' : 'none';
  document.getElementById('zip-mode-section').style.display = mode === 'zip' ? 'block' : 'none';
  document.getElementById('ai-single-mode-section').style.display = mode === 'ai-single' ? 'grid' : 'none';
  document.getElementById('ai-mode-section').style.display = mode === 'ai' ? 'block' : 'none';

  document.getElementById('results-section').classList.remove('visible');
}

// ── File Drop & Upload Logic ──────────────────────────────────────────
const setupDropZone = (zoneId, inputId, btnId, isAi) => {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', e => { e.preventDefault(); zone.classList.remove('dragover'); });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0], isAi);
  });

  input.addEventListener('change', e => {
    if (e.target.files && e.target.files.length > 0) handleFile(e.target.files[0], isAi);
  });
};

setupDropZone('drop-zone-zip', 'zip-file', 'scan-zip-btn', false);
setupDropZone('drop-zone-ai', 'ai-zip-file', 'scan-ai-btn', true);

let selectedZipFile = null;
let selectedAiZipFile = null;

function handleFile(file, isAi) {
  hideError();
  if (!file.name.endsWith('.zip')) {
    showError('Please select a valid .zip file.');
    if (isAi) selectedAiZipFile = null; else selectedZipFile = null;
    updateUI(isAi);
    return;
  }
  if (isAi) selectedAiZipFile = file; else selectedZipFile = file;
  updateUI(isAi);
}

function updateUI(isAi) {
  const zone = document.getElementById(isAi ? 'drop-zone-ai' : 'drop-zone-zip');
  const btn = document.getElementById(isAi ? 'scan-ai-btn' : 'scan-zip-btn');
  const file = isAi ? selectedAiZipFile : selectedZipFile;

  if (file) {
    zone.querySelector('h2').textContent = file.name;
    zone.querySelector('p').textContent = `Ready to analyse ${(file.size / 1024).toFixed(1)} KB`;
    zone.querySelector('.zip-icon').textContent = '✅';
    btn.disabled = false;
    zone.style.borderColor = 'var(--safe)';
  } else {
    zone.querySelector('h2').textContent = isAi ? 'Upload ZIP for AI Detection' : 'Upload ZIP for Batch Analysis';
    zone.querySelector('p').innerHTML = isAi ? `Drop a .zip file containing scripts to scan for LLM generation, or <span class="browse-link" onclick="document.getElementById('ai-zip-file').click()">browse your files</span>.` : `Drop a .zip file containing multiple Python scripts, or <span class="browse-link" onclick="document.getElementById('zip-file').click()">browse your files</span>.`;
    zone.querySelector('.zip-icon').textContent = isAi ? '🤖' : '📦';
    btn.disabled = true;
    zone.style.borderColor = 'var(--border)';
  }
}

// ── Results display ───────────────────────────────────────────────────
function showResults(data, ngramSize) {
  const section = document.getElementById('results-section');
  document.getElementById('dual-results-grid').style.display = 'grid';
  document.getElementById('batch-results-grid').style.display = 'none';
  document.getElementById('ai-results-grid').style.display = 'none';

  const score = data.score;
  const pct = (score * 100).toFixed(1) + '%';

  setGauge(score);

  // Verdict
  let icon, colour;
  if (score >= 0.70) {
    icon = '⚠️';
    colour = 'rgba(244,63,94,0.35)';
  } else if (score >= 0.40) {
    icon = '🔍';
    colour = 'rgba(245,158,11,0.35)';
  } else {
    icon = '✅';
    colour = 'rgba(16,185,129,0.25)';
  }

  const title = data.verdict || 'Analysis Complete';

  document.getElementById('verdict-icon').textContent = icon;
  document.getElementById('verdict-text').textContent = title;
  document.getElementById('verdict-sub').textContent = `Jaccard Index: ${score.toFixed(6)}  ·  N-gram size: ${ngramSize}`;
  document.getElementById('verdict-pct').textContent = pct;
  document.getElementById('verdict-card').style.borderColor = colour.replace('0.35', '0.6').replace('0.25', '0.6');
  document.getElementById('verdict-card').style.background = colour;

  // Stat fields
  document.getElementById('s-nodes-a').textContent = (data.details?.nodes_a_count ?? '—').toLocaleString();
  document.getElementById('s-nodes-b').textContent = (data.details?.nodes_b_count ?? '—').toLocaleString();
  document.getElementById('s-ngrams-a').textContent = (data.details?.ngrams_a_count ?? '—').toLocaleString();
  document.getElementById('s-ngrams-b').textContent = (data.details?.ngrams_b_count ?? '—').toLocaleString();
  document.getElementById('s-intersection').textContent = (data.details?.intersection ?? '—').toLocaleString();
  document.getElementById('s-union').textContent = (data.details?.union ?? '—').toLocaleString();
  document.getElementById('s-ngram-size').textContent = ngramSize;
  document.getElementById('s-score').textContent = score.toFixed(6);

  // AI Authorship Badges
  const renderAiBadge = (elId, aiData) => {
    const el = document.getElementById(elId);
    if (!aiData || aiData.confidence === 0) {
      el.textContent = "—";
      el.title = aiData?.reason || "No API key provided / Check Failed";
      el.className = "val";
      return;
    }

    if (aiData.is_ai) {
      el.innerHTML = `<span class="badge danger">🤖 ${aiData.confidence}% AI Generated</span>`;
    } else {
      el.innerHTML = `<span class="badge safe">👤 ${aiData.confidence}% Likely Human</span>`;
    }
    el.title = aiData.reason || "";
    el.className = "val"; // Reset any stray classes
  };

  renderAiBadge('ai-badge-a', data.details?.code1_ai);
  renderAiBadge('ai-badge-b', data.details?.code2_ai);

  section.classList.add('visible');
}

function showBatchResults(data, ngramSize) {
  const section = document.getElementById('results-section');
  document.getElementById('dual-results-grid').style.display = 'none';
  document.getElementById('ai-results-grid').style.display = 'none';
  document.getElementById('batch-results-grid').style.display = 'block';

  const numComparisons = data.results.length;
  window.batchFiles = data.files || {};

  const suspiciousCount = data.results.filter(r => r.score >= 0.40).length;
  const subtitle = document.getElementById('batch-subtitle');
  if (suspiciousCount > 0) {
    subtitle.innerHTML = `🚨 Found <strong>${suspiciousCount} suspicious matches</strong> out of ${numComparisons} pairs examined.`;
  } else {
    subtitle.innerHTML = `✅ No plagiarism detected across ${numComparisons} pairs.`;
  }

  const tbody = document.getElementById('batch-table-body');
  tbody.innerHTML = '';

  if (numComparisons === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--muted);">No comparisons could be made. Ensure the ZIP has at least 2 .py files.</td></tr>`;
  }

  data.results.forEach(res => {
    let colourClass = 'safe';
    if (res.verdict && (res.verdict.includes('Common') || res.verdict.includes('No Plagiarism'))) {
      colourClass = 'muted';
    } else if (res.score >= 0.70) {
      colourClass = 'danger';
    } else if (res.score >= 0.40) {
      colourClass = 'warn';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
          <td><span class="badge ${colourClass}">${res.score_pct}</span></td>
          <td class="file-col">${res.file1}</td>
          <td class="file-col">${res.file2}</td>
          <td class="verdict-col ${colourClass}-text">${res.verdict}</td>
          <td style="text-align: right;">
            <button class="editor-load-btn" onclick="viewPair('${res.file1}', '${res.file2}', ${ngramSize})">View Side-by-Side</button>
          </td>
        `;
    tbody.appendChild(tr);
  });

  section.classList.add('visible');

  // Show success notification
  if (numComparisons > 0) {
    if (suspiciousCount > 0) {
      showSuccess(`Scanned ${numComparisons} pairs. Found ${suspiciousCount} suspicious matches!`);
    } else {
      showSuccess(`Successfully scanned ${numComparisons} pairs. No plagiarism detected.`);
    }
  }
}

// ── Load dual view from batch row ──────────────────────────────────────
function viewPair(f1, f2, n) {
  if (!window.batchFiles || !window.batchFiles[f1] || !window.batchFiles[f2]) return;

  document.getElementById('code-a').value = window.batchFiles[f1];
  document.getElementById('code-b').value = window.batchFiles[f2];

  document.getElementById('label-a').textContent = f1;
  document.getElementById('label-b').textContent = f2;

  updateCount();

  currentMode = 'dual';
  const tabs = document.querySelectorAll('.mode-tab');
  tabs.forEach(t => t.classList.remove('active'));
  document.querySelector(`.mode-tab[onclick="switchMode('dual')"]`).classList.add('active');

  document.getElementById('dual-mode-section').style.display = 'grid';
  document.getElementById('zip-mode-section').style.display = 'none';

  ngramSlider.value = n;
  ngramDisplay.textContent = n;

  runScan();
}

// ── Main scan functions ────────────────────────────────────────────────
async function runScan() {
  if (currentMode === 'zip') return runZipScan();
  if (currentMode === 'ai') return runAiBatchScan();
  if (currentMode === 'ai-single') return runAiSingleScan();

  const code1 = document.getElementById('code-a').value.trim();
  const code2 = document.getElementById('code-b').value.trim();
  const n = parseInt(ngramSlider.value);

  hideError();

  if (!code1 || !code2) {
    showError('Please paste Python code into both editors before scanning.');
    return;
  }

  const btn = document.getElementById('scan-btn');
  btn.disabled = true;
  btn.classList.add('loading');
  btn.querySelector('.btn-icon').textContent = '⏳';
  btn.querySelector('.btn-label').textContent = 'SCANNING';
  resetGauge();

  try {
    const lang = document.getElementById('lang-select').value;
    const apiKey = document.getElementById('api-key').value.trim();
    const payloadStr = { code1, code2, ngram_size: n, language: lang };
    if (apiKey) payloadStr.api_key = apiKey;

    const res = await fetch(`${API}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadStr),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    showResults(data, n);

  } catch (e) {
    if (e instanceof TypeError && e.message.includes('fetch')) {
      showError('Cannot reach the Argus API. Make sure the server is running:\n  uvicorn api.server:app --reload --port 8000');
    } else {
      showError(e.message);
    }
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.querySelector('.btn-icon').textContent = '⚡';
    btn.querySelector('.btn-label').textContent = 'SCAN';
  }
}

async function runZipScan() {
  if (!selectedZipFile) return;

  const n = parseInt(ngramSlider.value);
  hideError();

  const btn = document.getElementById('scan-zip-btn');
  btn.disabled = true;
  btn.classList.add('loading');
  btn.querySelector('.btn-icon').textContent = '⏳';
  btn.querySelector('.btn-label').textContent = 'PROCESSING...';

  const formData = new FormData();
  formData.append('file', selectedZipFile);

  const lang = document.getElementById('lang-select').value;
  const apiKey = document.getElementById('api-key').value.trim();

  let fetchUrl = `${API}/compare_zip?ngram_size=${n}&language=${lang}`;
  if (apiKey) formData.append('api_key', apiKey);

  try {
    const res = await fetch(fetchUrl, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    showBatchResults(data, n);

  } catch (e) {
    if (e instanceof TypeError && e.message.includes('fetch')) {
      showError('Cannot reach the Argus API. Make sure the server is running:\n  uvicorn api.server:app --reload --port 8000');
    } else {
      showError(e.message);
    }
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.querySelector('.btn-icon').textContent = '⚡';
    btn.querySelector('.btn-label').textContent = 'SCAN ZIP BATCH';
  }
}

async function runAiSingleScan() {
  const code = document.getElementById('code-ai').value.trim();
  hideError();

  if (!code) {
    showError('Please paste code into the editor before scanning.');
    return;
  }

  const btn = document.getElementById('scan-ai-single-btn');
  btn.disabled = true;
  btn.classList.add('loading');
  btn.querySelector('.btn-icon').textContent = '⏳';
  btn.querySelector('.btn-label').textContent = 'SCANNING...';

  try {
    const lang = document.getElementById('lang-select').value;
    const apiKey = document.getElementById('api-key').value.trim();
    const payloadStr = { code: code, language: lang };
    if (apiKey) payloadStr.api_key = apiKey;

    const res = await fetch(`${API}/detect_ai_single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadStr),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    showAiSingleResults(data);

  } catch (e) {
    if (e instanceof TypeError && e.message.includes('fetch')) {
      showError('Cannot reach the Argus API. Make sure the server is running:\\n  uvicorn api.server:app --reload --port 8000');
    } else {
      showError(e.message);
    }
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.querySelector('.btn-icon').textContent = '⚡';
    btn.querySelector('.btn-label').textContent = 'SCAN SNIPPET';
  }
}

function showAiSingleResults(data) {
  const section = document.getElementById('results-section');
  document.getElementById('dual-results-grid').style.display = 'none';
  document.getElementById('batch-results-grid').style.display = 'none';
  document.getElementById('ai-results-grid').style.display = 'none';
  document.getElementById('ai-single-results-grid').style.display = 'block';

  const card = document.getElementById('ai-single-verdict-card');
  const icon = document.getElementById('ai-single-icon');
  const title = document.getElementById('ai-single-title');
  const sub = document.getElementById('ai-single-sub');
  const badge = document.getElementById('ai-single-badge');

  if (!data || data.confidence === 0) {
    icon.textContent = '❌';
    title.textContent = 'Analysis Failed';
    sub.textContent = data?.reason || "Check API Key or rate limits.";
    badge.innerHTML = '';
    card.style.borderColor = 'var(--border-color)';
    card.style.background = 'var(--bg-primary)';
  } else if (data.is_ai) {
    icon.textContent = '🤖';
    title.textContent = 'AI Generated';
    sub.textContent = data.reason;
    badge.innerHTML = `<span class="badge danger" style="font-size: 1.1rem; padding: 0.5rem 1rem;">🤖 ${data.confidence}% AI Generated</span>`;
    card.style.borderColor = 'rgba(244,63,94,0.4)';
    card.style.background = 'rgba(244,63,94,0.1)';
  } else {
    icon.textContent = '👤';
    title.textContent = 'Likely Human';
    sub.textContent = data.reason;
    badge.innerHTML = `<span class="badge safe" style="font-size: 1.1rem; padding: 0.5rem 1rem;">👤 ${data.confidence}% Likely Human</span>`;
    card.style.borderColor = 'rgba(16,185,129,0.4)';
    card.style.background = 'rgba(16,185,129,0.1)';
  }

  section.classList.add('visible');
  showSuccess('Single file AI analysis complete.');
}

async function runAiBatchScan() {
  if (!selectedAiZipFile) return;

  hideError();

  const btn = document.getElementById('scan-ai-btn');
  btn.disabled = true;
  btn.classList.add('loading');
  btn.querySelector('.btn-icon').textContent = '⏳';
  btn.querySelector('.btn-label').textContent = 'PROCESSING...';

  const formData = new FormData();
  formData.append('file', selectedAiZipFile);

  const lang = document.getElementById('lang-select').value;
  const apiKey = document.getElementById('api-key').value.trim();

  formData.append('language', lang);
  if (apiKey) formData.append('api_key', apiKey);

  try {
    const res = await fetch(`${API}/detect_ai_batch`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    showAiBatchResults(data);

  } catch (e) {
    if (e instanceof TypeError && e.message.includes('fetch')) {
      showError('Cannot reach the Argus API. Make sure the server is running:\\n  uvicorn api.server:app --reload --port 8000');
    } else {
      showError(e.message);
    }
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.querySelector('.btn-icon').textContent = '⚡';
    btn.querySelector('.btn-label').textContent = 'SCAN AI BATCH';
  }
}

function showAiBatchResults(data) {
  const section = document.getElementById('results-section');
  document.getElementById('dual-results-grid').style.display = 'none';
  document.getElementById('batch-results-grid').style.display = 'none';
  document.getElementById('ai-results-grid').style.display = 'block';

  const numFiles = data.results.length;
  const aiCount = data.results.filter(r => r.is_ai).length;

  const subtitle = document.getElementById('ai-batch-subtitle');
  if (aiCount > 0) {
    subtitle.innerHTML = `🚨 Found <strong>${aiCount} AI-generated</strong> files out of ${numFiles} scanned.`;
  } else {
    subtitle.innerHTML = `✅ No AI-generation detected across ${numFiles} files. (Highly likely human)`;
  }

  const tbody = document.getElementById('ai-table-body');
  tbody.innerHTML = '';

  if (numFiles === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--muted);">No matching files found to analyse.</td></tr>`;
  }

  data.results.forEach(res => {
    let colourClass = res.is_ai ? 'danger' : 'safe';
    let icon = res.is_ai ? '🤖' : '👤';

    const tr = document.createElement('tr');
    tr.innerHTML = `
          <td><span class="badge ${colourClass}">${icon} ${res.confidence}%</span></td>
          <td class="file-col">${res.file}</td>
          <td class="verdict-col ${colourClass}-text">${res.is_ai ? 'AI Generated' : 'Likely Human'}</td>
          <td style="color: var(--muted); font-size: 0.85rem;">${res.reason}</td>
        `;
    tbody.appendChild(tr);
  });

  section.classList.add('visible');

  if (numFiles > 0) {
    if (aiCount > 0) showSuccess(`Scanned ${numFiles} files. Found ${aiCount} AI generations.`);
    else showSuccess(`Successfully scanned ${numFiles} files. 0 AI generations detected.`);
  }
}

// ── Keyboard shortcut ─────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    if (currentMode === 'dual') runScan();
    else if (currentMode === 'zip' && selectedZipFile) runZipScan();
    else if (currentMode === 'ai' && selectedAiZipFile) runAiBatchScan();
    else if (currentMode === 'ai-single') runAiSingleScan();
  }
});

// ── API health check on load ──────────────────────────────────────────
async function checkApi() {
  const statusEl = document.getElementById('api-status');
  try {
    const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      statusEl.textContent = 'API Online';
      statusEl.parentElement.querySelector('.badge-dot').style.background = '#10b981';
    } else { throw new Error(); }
  } catch {
    statusEl.textContent = 'API Offline';
    const dot = statusEl.parentElement.querySelector('.badge-dot');
    dot.style.background = '#f43f5e';
    dot.style.boxShadow = '0 0 8px #f43f5e';
    dot.style.animation = 'none';
    dot.style.opacity = '1';
  }
}

checkApi();