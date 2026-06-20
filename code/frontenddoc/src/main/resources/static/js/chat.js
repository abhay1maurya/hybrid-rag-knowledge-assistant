/* ═══════════════════════════════════════════════
   DocuMind AI — Chat JS
   Fully connected to FastAPI backend endpoints
   ═══════════════════════════════════════════════ */

const API = (() => {
  const globalBase = typeof window.__DOCUMIND_API_BASE__ === 'string' ? window.__DOCUMIND_API_BASE__.trim() : '';
  const queryBase = new URLSearchParams(window.location.search).get('api')?.trim() || '';
  const storageBase = localStorage.getItem('documind-api-base')?.trim() || '';
  return globalBase || queryBase || storageBase || 'http://localhost:8000';
})();

// FIX: Do not hardcode 'user_3'. Wait for DOM to read the template-injected value, or fallback.
let userId = ''; 
let useStream = false;
let turnCount = 0;
let historyItems = [];
let allDocs = [];
let evalQuestions = [];
let activeStream = null;
let streamingBubble = null;

function apiPath(path) {
  return `${API}${path}`;
}

function toast(msg, dur = 2200) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), dur);
}

function setProviderLabel(info) {
  const label = `${info?.provider || '—'} · ${info?.model || '—'}`;
  const activeModel = document.getElementById('active-model-label');
  if (activeModel) activeModel.textContent = label;
}



function toggleSidebar(side) {
  const shell = document.querySelector('.shell');
  const el = document.getElementById(`sidebar-${side}`);
  const isMobile = window.matchMedia('(max-width: 700px)').matches;
  const otherSide = side === 'left' ? 'right' : 'left';
  const otherEl = document.getElementById(`sidebar-${otherSide}`);

  if (!el || !shell) return;

  if (isMobile) {
    const isOpen = shell.classList.contains(`${side}-open`);
    shell.classList.remove('left-open', 'right-open');
    if (otherEl) otherEl.classList.add('collapsed');
    if (!isOpen) {
      el.classList.remove('collapsed');
      shell.classList.add(`${side}-open`);
    }
  } else {
    el.classList.toggle('collapsed');
    shell.classList.toggle(`${side}-collapsed`);
    shell.classList.remove(`${side}-open`);
  }
}

function closeMobileSidebars() {
  if (!window.matchMedia('(max-width: 700px)').matches) return;
  document.querySelector('.shell')?.classList.remove('left-open', 'right-open');
}

function isMobileDrawerOpen() {
  const shell = document.querySelector('.shell');
  return !!shell && (shell.classList.contains('left-open') || shell.classList.contains('right-open'));
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${name}`)?.classList.add('active');
  btn?.classList.add('active');
  
  if (name === 'documents') loadDocuments();
  if (name === 'eval') loadEvalQuestions();
  if (name === 'history') renderHistory();
}

function onUidChange() {
  userId = document.getElementById('user-id-input').value.trim() || 'user_3';
  document.getElementById('display-uid').textContent = userId;
  loadProvider();
  loadDocuments();
  loadEvalQuestions();
}

// FIX: Added HTTP status checking so frontend doesn't crash on backend 500/404 errors
async function fetchJson(path, options) {
  const response = await fetch(apiPath(path), options);
  if (!response.ok) {
    let errorMsg = `HTTP error ${response.status}`;
    try {
      const errData = await response.json();
      errorMsg = errData.detail || errData.message || errorMsg;
    } catch (e) {}
    throw new Error(errorMsg);
  }
  return response.json();
}

async function loadServiceInfo() {
  try {
    const info = await fetchJson('/');
    const sub = document.getElementById('chat-sub');
    if (sub && info?.version) {
      sub.textContent = `DocuMind AI v${info.version} · ${API}`;
    }
  } catch {
    setEndpointLabel();
  }
}
// 1. Stop hijacking the API status box with the base URL
function setEndpointLabel() {
  const sub = document.getElementById('chat-sub');
  if (sub) sub.textContent = `Grounded answers from your documents · ${API}`;
}

// 2. Centralize the logic: drive the UI based on the active configuration
function updateSystemStatus(info) {
  if (!info) return;
  const provider = info.provider || 'offline';
  const model = info.model || 'Unknown';

  const valOllama = document.getElementById('val-ollama');
  const valModel = document.getElementById('val-model');
  const valApi = document.getElementById('val-provider-name');

  if (provider === 'offline') {
    // Offline mode selected (Ollama active)
    setDot('dot-ollama', 'green');
    valOllama.textContent = 'Yes';

    setDot('dot-model', 'green');
    valModel.textContent = model;

    setDot('dot-api', 'amber');
    valApi.textContent = 'N/A';
  } else {
    // Online API selected (Groq, OpenAI, etc.)
    setDot('dot-ollama', 'amber');
    valOllama.textContent = 'N/A';

    setDot('dot-model', 'green');
    valModel.textContent = model;

    setDot('dot-api', 'green');
    // Capitalize the provider name
    valApi.textContent = provider.charAt(0).toUpperCase() + provider.slice(1);
  }
}

// 3. Inject the status updater into your provider load
async function loadProvider() {
  try {
    const d = await fetchJson(`/provider?user_id=${encodeURIComponent(userId)}`);
    const sel = document.getElementById('provider-select');
    if (sel) sel.value = d.provider || 'offline';
    setProviderLabel(d);
    updateSystemStatus(d); // Force UI to reflect config on load
  } catch {}
}

// 4. Clean up checkHealth to use the unified state
async function checkHealth() {
  try {
    const d = await fetchJson(`/health?user_id=${encodeURIComponent(userId)}`);
    const providerInfo = d.active_provider || {};
    
    setProviderLabel(providerInfo);
    updateSystemStatus(providerInfo); // Map the health payload to our UI logic
    setEndpointLabel();
    
    toast('Status refreshed');
  } catch {
    // Handle true backend failure
    setDot('dot-ollama', 'red');
    setDot('dot-model', 'red');
    setDot('dot-api', 'red');
    document.getElementById('val-ollama').textContent = 'Error';
    document.getElementById('val-model').textContent = 'Error';
    document.getElementById('val-provider-name').textContent = 'Error';
    toast('Cannot reach API — is the server running?');
  }
}


function setDot(id, color) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'status-dot';
  if (color === 'green') el.classList.add('dot-green');
  else if (color === 'amber') el.classList.add('dot-amber');
  else el.classList.add('dot-red');
}



function onProviderChange() {
  const v = document.getElementById('provider-select').value;
  const btn = document.getElementById('btn-switch-provider');
  if (btn) btn.textContent = `Apply: ${v === 'offline' ? 'Offline' : v.charAt(0).toUpperCase() + v.slice(1)}`;
}

async function switchProvider() {
  const v = document.getElementById('provider-select').value;
  const isOffline = v === 'offline';
  const body = new URLSearchParams({
    provider: isOffline ? 'offline' : 'online',
    online_provider: isOffline ? '' : v,
    user_id: userId
  });

  try {
    const d = await fetchJson('/provider/switch', { method: 'POST', body });
    toast(d.message || 'Provider switched');
    if (d.model) {
      const warning = document.getElementById('config-warning');
      if (warning) {
        warning.textContent = `Active model: ${d.model}`;
        warning.classList.remove('hidden');
      }
    }
    await loadProvider();
    await checkHealth();
  } catch (err) {
    toast(`Failed to switch provider: ${err.message}`);
  }
}

async function resetSession() {
  try {
    await fetchJson('/reset', {
      method: 'POST',
      body: new URLSearchParams({ user_id: userId })
    });
    toast('Memory cleared for ' + userId);
    historyItems = [];
    renderHistory();
  } catch {
    toast('Failed to reset session');
  }
}

function newSession() {
  clearChat();
  resetSession();
}

async function loadDocuments() {
  try {
    const d = await fetchJson(`/documents/${encodeURIComponent(userId)}`);
    allDocs = d.documents || [];
    renderDocs();
    renderStorageStats(d);
  } catch {
    document.getElementById('docs-list').innerHTML = '<p class="empty-hint">Could not load documents.</p>';
  }
}

function filterDocs() {
  renderDocs(document.getElementById('doc-search').value.toLowerCase());
}

function renderDocs(filter = '') {
  const list = document.getElementById('docs-list');
  const filtered = allDocs.filter(d => !filter || d.filename.toLowerCase().includes(filter));

  if (!filtered.length) {
    list.innerHTML = '<p class="empty-hint">No documents found.</p>';
    return;
  }

  list.innerHTML = filtered.map(doc => {
    const ext = doc.filename.split('.').pop().toUpperCase();
    const isIndexed = doc.status === 'indexed';
    const dotColor = isIndexed ? '#10b981' : '#f59e0b';
    const chunks = doc.chunks_created || 0;
    const kb = doc.file_size_kb || '—';

    return `
      <div class="doc-card">
        <span class="doc-type-badge">${ext}</span>
        <div class="doc-info">
          <div class="doc-name" title="${doc.filename}">${doc.filename}</div>
          <div class="doc-meta">${chunks} chunks · ${kb}KB · v${doc.version || 1}</div>
        </div>
        <span class="doc-status-dot" style="background:${dotColor};box-shadow:0 0 5px ${dotColor}"></span>
        <button class="doc-delete" onclick="deleteDoc('${doc.doc_id}','${doc.filename}')" title="Delete">✕</button>
      </div>`;
  }).join('');
}

function renderStorageStats(data) {
  const el = document.getElementById('storage-stats');
  if (!el) return;
  if (!data) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `
    <div class="stat-row"><span>Documents</span><strong>${data.total_documents || 0}</strong></div>
    <div class="stat-row"><span>Total chunks</span><strong>${data.total_chunks || 0}</strong></div>`;
}

async function deleteDoc(docId, name) {
  if (!confirm(`Delete "${name}"? This will remove its chunks from the index.`)) return;
  try {
    const d = await fetchJson(`/documents/${encodeURIComponent(userId)}/${encodeURIComponent(docId)}`, { method: 'DELETE' });
    toast(d.message || 'Deleted');
    await loadDocuments();
  } catch {
    toast('Failed to delete document');
  }
}

function onDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('drag-over');
}

function onDragLeave() {
  document.getElementById('upload-zone').classList.remove('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag-over');
  uploadFiles(Array.from(e.dataTransfer.files));
}

function handleFileUpload(e) {
  uploadFiles(Array.from(e.target.files));
  e.target.value = '';
}

async function uploadFiles(files) {
  if (!files.length) return;
  const prog = document.getElementById('upload-progress');
  const fill = document.getElementById('progress-fill');
  const label = document.getElementById('progress-label');

  prog.classList.remove('hidden');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pct = Math.round((i / files.length) * 100);
    fill.style.width = pct + '%';
    label.textContent = `Uploading ${file.name}…`;

    const form = new FormData();
    form.append('user_id', userId);
    form.append('file', file);

    try {
      const r = await fetch(apiPath('/upload'), { method: 'POST', body: form });
      const d = await r.json();
      if (r.ok && d.status === 'success') {
        toast(`✓ ${file.name} — ${d.chunks_created} chunks`);
      } else {
        toast(`✗ ${file.name}: ${d.message || d.detail || 'Upload failed'}`);
      }
    } catch {
      toast(`✗ ${file.name}: Network error`);
    }
  }

  fill.style.width = '100%';
  label.textContent = 'Done!';
  setTimeout(() => prog.classList.add('hidden'), 1200);
  await loadDocuments();
}

function appendUserBubble(text) {
  const row = document.createElement('div');
  row.className = 'msg-row user';
  row.innerHTML = `<div class="msg-bubble bubble-user"><p>${escHtml(text)}</p></div><div class="msg-avatar avatar-user">U</div>`;
  document.getElementById('log').appendChild(row);
  scrollLog();
}

function appendBotBubble(text, sources = [], status = 'ok', processedQ = null) {
  const row = document.createElement('div');
  row.className = 'msg-row';
  const bubbleClass = status === 'blocked' ? 'bubble-bot bubble-blocked' : status === 'error' ? 'bubble-bot bubble-error' : 'bubble-bot';
  const prefix = status === 'blocked' ? '🚫 ' : status === 'error' ? '⚠ ' : '';

  row.innerHTML = `
  <div class="msg-avatar avatar-bot">AI</div>
  <div class="msg-bubble ${bubbleClass}">
      <p>${prefix}${escHtml(text)}</p>
      <div class="msg-actions">
          <button class="audio-btn" onclick="speakTextFromButton(this)" title="Listen">🔊</button>
      </div>
  </div>`;
  
  document.getElementById('log').appendChild(row);
  if (sources && sources.length) attachSources(row.querySelector('.msg-bubble'), sources, processedQ);
  scrollLog();
}

function createStreamingBubble() {
  const row = document.createElement('div');
  row.className = 'msg-row';
  row.innerHTML = `
  <div class="msg-avatar avatar-bot">AI</div>
  <div class="msg-bubble bubble-bot">
      <p class="streaming-cursor"></p>
      <div class="msg-actions">
          <button class="audio-btn" onclick="speakTextFromButton(this)" title="Listen">🔊</button>
      </div>
  </div>`;
  document.getElementById('log').appendChild(row);
  scrollLog();
  return row.querySelector('.msg-bubble');
}

function attachSources(bubble, sources, processedQ = null) {
  const meta = document.createElement('div');
  meta.className = 'msg-meta';

  sources.forEach(s => {
    const pill = document.createElement('span');
    pill.className = 'source-pill';
    pill.textContent = s;
    meta.appendChild(pill);
  });

  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-msg';
  copyBtn.textContent = 'Copy';
  copyBtn.onclick = () => {
    const text = bubble.querySelector('p')?.textContent || '';
    navigator.clipboard.writeText(text).then(() => toast('Copied'));
  };
  meta.appendChild(copyBtn);

  bubble.appendChild(meta);
}

function appendTyping() {
  const row = document.createElement('div');
  row.className = 'msg-row';
  row.innerHTML = `<div class="msg-avatar avatar-bot">AI</div><div class="msg-bubble bubble-bot"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  document.getElementById('log').appendChild(row);
  scrollLog();
  return row;
}

function scrollLog() {
  const log = document.getElementById('log');
  if (log) log.scrollTop = log.scrollHeight;
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

async function sendMessage(e) {
  e.preventDefault();
  const box = document.getElementById('prompt');
  const text = box.value.trim();
  if (!text) return;

  box.value = '';
  updateCharCount();
  appendUserBubble(text);
  document.getElementById('send-btn').disabled = true;

  if (useStream) await streamAnswer(text);
  else await blockingAnswer(text);

  document.getElementById('send-btn').disabled = false;
  turnCount++;
  document.getElementById('display-turns').textContent = turnCount;
}

async function blockingAnswer(query) {
  const typing = appendTyping();
  try {
    const body = new URLSearchParams({ query, user_id: userId });
    const r = await fetch(apiPath('/ask'), { method: 'POST', body });
    const d = await r.json();
    typing.remove();

    if (d.status === 'blocked') {
      appendBotBubble(d.answer || d.message || 'Blocked by guardrails.', [], 'blocked');
    } else if (!r.ok || d.status === 'error') {
      appendBotBubble('Error: ' + (d.answer || d.detail || d.message || 'Unknown error'), [], 'error');
    } else {
      appendBotBubble(d.answer || d.message || '', d.sources || [], 'ok', d.processed_query);
      pushHistory(query, d.answer || '');
    }
  } catch (err) {
    typing.remove();
    appendBotBubble(`Connection error: ${err.message}`, [], 'error');
  }
}

async function streamAnswer(query) {
  const url = `${apiPath('/ask/stream')}?query=${encodeURIComponent(query)}&user_id=${encodeURIComponent(userId)}`;

  streamingBubble = createStreamingBubble();
  document.getElementById('stream-bar').classList.remove('hidden');

  activeStream = new AbortController();
  let fullAnswer = '';
  let sources = [];

  try {
    const response = await fetch(url, { signal: activeStream.signal });
    if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last incomplete chunk in the buffer
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          handleStreamEvent(ev);
          if (ev.event === 'token') fullAnswer += ev.token;
          if (ev.event === 'done') sources = ev.sources || [];
        } catch (e) {
            // Ignore incomplete JSON chunks until the next iteration appends the rest
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError' && streamingBubble) {
      streamingBubble.querySelector('p').textContent = `Stream error: ${err.message}. Try disabling streaming.`;
      streamingBubble.classList.add('bubble-error');
    }
  }

  if (streamingBubble) {
    const p = streamingBubble.querySelector('p');
    p.classList.remove('streaming-cursor');
    if (sources.length) attachSources(streamingBubble, sources);
  }

  document.getElementById('stream-bar').classList.add('hidden');
  document.getElementById('stream-status-text').textContent = 'Generating...';
  streamingBubble = null;
  activeStream = null;

  if (fullAnswer) pushHistory(query, fullAnswer);
}

function handleStreamEvent(ev) {
  const statusEl = document.getElementById('stream-status-text');

  switch (ev.event) {
    case 'status':
      statusEl.textContent = ev.message;
      break;
    case 'query_processed':
      statusEl.textContent = 'Query processed…';
      break;
    case 'generating':
      statusEl.textContent = 'Generating answer…';
      break;
    case 'token':
      if (streamingBubble) {
        const p = streamingBubble.querySelector('p');
        p.textContent += ev.token;
        scrollLog();
      }
      break;
    case 'guardrail':
      if (streamingBubble) streamingBubble.querySelector('p').textContent = ev.answer;
      break;
    case 'blocked':
      if (streamingBubble) {
        streamingBubble.querySelector('p').textContent = '🚫 ' + ev.message;
        streamingBubble.classList.add('bubble-blocked');
      }
      break;
    case 'error':
      if (streamingBubble) {
        streamingBubble.querySelector('p').textContent = '⚠ ' + ev.message;
        streamingBubble.classList.add('bubble-error');
      }
      break;
  }
}

function stopStream() {
  if (activeStream) {
    activeStream.abort();
    activeStream = null;
    if (streamingBubble) streamingBubble.querySelector('p').classList.remove('streaming-cursor');
    document.getElementById('stream-bar').classList.add('hidden');
    toast('Stream stopped');
  }
}

function loadEvalQuestions() {
  return fetchJson(`/eval/${encodeURIComponent(userId)}/test-set`)
    .then(d => {
      evalQuestions = d.questions || [];
      renderEvalQuestions();
      return loadEvalResults();
    })
    .catch(() => {});
}

function renderEvalQuestions() {
  const list = document.getElementById('eval-questions-list');
  if (!list) return;
  if (!evalQuestions.length) {
    list.innerHTML = '<p class="empty-hint">No test questions. Add some to evaluate.</p>';
    return;
  }

  list.innerHTML = evalQuestions.map(q => `
    <div class="eval-q-card">
      <div class="eval-q-text">${escHtml(q.question)}${q.ground_truth ? `<br><em style="color:var(--text-3)">GT: ${escHtml(q.ground_truth)}</em>` : ''}</div>
      <button class="eval-q-del" onclick="deleteEvalQuestion('${q.q_id}')">✕</button>
    </div>`).join('');
}

function showAddQuestion() { document.getElementById('add-question-form').classList.remove('hidden'); }
function hideAddQuestion() { document.getElementById('add-question-form').classList.add('hidden'); }

async function addEvalQuestion() {
  const q = document.getElementById('eval-question-input').value.trim();
  const gt = document.getElementById('eval-gt-input').value.trim();
  if (!q) { toast('Enter a question'); return; }

  try {
    const d = await fetchJson(`/eval/${encodeURIComponent(userId)}/test-set/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, ground_truth: gt || null })
    });
    if (d.status === 'error') { toast(d.message); return; }
    toast('Question added');
    document.getElementById('eval-question-input').value = '';
    document.getElementById('eval-gt-input').value = '';
    hideAddQuestion();
    await loadEvalQuestions();
  } catch {
    toast('Failed to add question');
  }
}

async function deleteEvalQuestion(qId) {
  try {
    await fetchJson(`/eval/${encodeURIComponent(userId)}/test-set/${encodeURIComponent(qId)}`, { method: 'DELETE' });
    toast('Question removed');
    await loadEvalQuestions();
  } catch {
    toast('Failed to delete');
  }
}

async function autoGenerateQuestions() {
  toast('Generating questions from your documents…');
  try {
    const d = await fetchJson(`/eval/${encodeURIComponent(userId)}/test-set/auto-generate?n=5`, { method: 'POST' });
    toast(d.message || 'Questions generated');
    await loadEvalQuestions();
  } catch {
    toast('Auto-generate failed');
  }
}

async function runEvaluation() {
  const btn = document.getElementById('btn-run-eval');
  btn.disabled = true;
  btn.textContent = '⏳ Running…';
  toast('Running evaluation — this may take a minute…', 6000);

  try {
    const d = await fetchJson(`/eval/${encodeURIComponent(userId)}/run`, { method: 'POST' });
    if (d.status === 'error') {
      toast(d.message);
    } else {
      toast(`Eval complete — pass rate: ${Math.round((d.pass_rate || 0) * 100)}%`);
      renderEvalResults(d);
    }
  } catch {
    toast('Evaluation failed');
  }

  btn.disabled = false;
  btn.textContent = '▶ Run Eval';
}

function loadEvalResults() {
  return fetchJson(`/eval/${encodeURIComponent(userId)}/results/latest`)
    .then(d => {
      if (d.status === 'success' && d.evaluation) renderEvalResults(d.evaluation);
    })
    .catch(() => {});
}

function renderEvalResults(data) {
  const container = document.getElementById('eval-results');
  const grid = document.getElementById('scores-grid');
  const recs = document.getElementById('eval-recommendations');
  container.classList.remove('hidden');

  const scores = data.overall_scores || {};
  const metrics = [
    { key: 'faithfulness', label: 'Faithful' },
    { key: 'answer_relevancy', label: 'Relevancy' },
    { key: 'context_precision', label: 'Precision' },
    { key: 'context_recall', label: 'Recall' },
  ];

  grid.innerHTML = metrics.map(m => {
    const val = scores[m.key];
    const pct = val !== null && val !== undefined ? Math.round(val * 100) : null;
    const cls = pct === null ? 'score-na' : pct >= 70 ? 'score-pass' : 'score-fail';
    return `<div class="score-card"><div class="score-metric">${m.label}</div><div class="score-value ${cls}">${pct !== null ? pct + '%' : 'N/A'}</div></div>`;
  }).join('');

  const passRate = data.pass_rate !== undefined ? Math.round(data.pass_rate * 100) : null;
  if (passRate !== null) {
    grid.innerHTML += `<div class="score-card" style="grid-column: span 2;"><div class="score-metric">Pass Rate · ${data.passed}/${data.total_questions} passed</div><div class="score-value ${passRate >= 70 ? 'score-pass' : 'score-fail'}">${passRate}%</div></div>`;
  }

  const recommendations = data.recommendations || [];
  recs.innerHTML = recommendations
    .filter(r => r.metric !== 'overall')
    .slice(0, 2)
    .map(r => `<div class="eval-rec"><strong>${r.metric}: ${Math.round((scores[r.metric] || 0) * 100)}%</strong>${r.issue}<br><em>${(r.fixes || []).slice(0, 1).join('')}</em></div>`)
    .join('');
}

function pushHistory(query, answer) {
  const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  historyItems.unshift({ time: t, q: query, a: answer });
  if (historyItems.length > 20) historyItems.pop();
  renderHistory();
}

function filterHistory() {
  renderHistory(document.getElementById('history-search').value.toLowerCase());
}

function renderHistory(filter = '') {
  const list = document.getElementById('history-list');
  const items = historyItems.filter(h => !filter || (h.q + h.a).toLowerCase().includes(filter));
  if (!items.length) {
    list.innerHTML = '<p class="empty-hint">No history yet.</p>';
    return;
  }
  list.innerHTML = items.map(h => `
    <div class="history-card">
      <div class="history-time">${h.time}</div>
      <div class="history-role">YOU</div>
      <div class="history-q">${escHtml(h.q.slice(0, 90))}${h.q.length > 90 ? '…' : ''}</div>
      <div class="history-role" style="margin-top:4px">AI</div>
      <div class="history-a">${escHtml(h.a.slice(0, 120))}${h.a.length > 120 ? '…' : ''}</div>
    </div>`).join('');
}

function clearChat() {
  document.getElementById('log').innerHTML = '';
  turnCount = 0;
  document.getElementById('display-turns').textContent = '0';
  greet();
  toast('Conversation cleared');
}

function updateCharCount() {
  const v = document.getElementById('prompt').value;
  document.getElementById('char-count').textContent = `${v.length} / 800`;
}

function greet() {
  const row = document.createElement('div');
  row.className = 'msg-row';
  row.innerHTML = `
    <div class="msg-avatar avatar-bot">AI</div>
    <div class="msg-bubble bubble-bot">
      <p>Hello! I'm DocuMind AI. Upload your documents and ask me anything — every answer is grounded in your indexed content with source citations.</p>
      <div class="msg-meta">
        <span class="source-pill">Ready</span>
        <span class="source-pill">Grounded</span>
        <span class="source-pill">Cited</span>
      </div>
    </div>`;
  document.getElementById('log').appendChild(row);
}

document.addEventListener('DOMContentLoaded', () => {
  const prompt = document.getElementById('prompt');
  const chatMain = document.querySelector('.chat-main');

  prompt.addEventListener('input', () => {
    updateCharCount();
    prompt.style.height = 'auto';
    prompt.style.height = Math.min(prompt.scrollHeight, 150) + 'px';
  });

  prompt.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('chat-form').requestSubmit();
    }
  });

  if (chatMain) chatMain.addEventListener('pointerdown', closeMobileSidebars);

  document.addEventListener('pointerdown', e => {
    if (!window.matchMedia('(max-width: 700px)').matches) return;
    if (!isMobileDrawerOpen()) return;
    if (e.target.closest('.hamburger')) return;
    if (e.target.closest('.sidebar')) return;
    closeMobileSidebars();
  });

  // FIX: Properly initialize user ID from the Thymeleaf/HTML template value injected by the backend.
  const uidInput = document.getElementById('user-id-input');
  if (uidInput && uidInput.value) {
      userId = uidInput.value.trim();
  } else {
      userId = 'user_3'; // fallback
      if (uidInput) uidInput.value = userId;
  }
  
  document.getElementById('display-uid').textContent = userId;


  setEndpointLabel();
  loadServiceInfo();
  checkHealth();
  loadProvider();
  loadDocuments();
  loadEvalQuestions();
  greet();
});