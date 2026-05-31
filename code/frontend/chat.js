/* ═══════════════════════════════════════════════
   DocuMind AI — Chat JS
   Fully connected to FastAPI backend endpoints
   ═══════════════════════════════════════════════ */

const API = 'http://localhost:8000';

// ── State ──────────────────────────────────────
let userId       = 'user_1';
let useStream    = true;
let turnCount    = 0;
let historyItems = [];
let allDocs      = [];
let evalQuestions = [];
let activeStream  = null;   // AbortController for SSE
let streamingBubble = null; // DOM element being streamed into

// ── Toast ──────────────────────────────────────
function toast(msg, dur = 2200) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), dur);
}

// ── Sidebar toggle ─────────────────────────────
function toggleSidebar(side) {
  const shell = document.querySelector('.shell');
  const el = document.getElementById(`sidebar-${side}`);
  const isMobile = window.matchMedia('(max-width: 700px)').matches;
  const otherSide = side === 'left' ? 'right' : 'left';
  const otherEl = document.getElementById(`sidebar-${otherSide}`);

  if (isMobile) {
    const isOpen = shell?.classList.contains(`${side}-open`);
    shell?.classList.remove('left-open', 'right-open');
    if (otherEl) otherEl.classList.add('collapsed');

    if (!isOpen) {
      el.classList.remove('collapsed');
      shell?.classList.add(`${side}-open`);
    }
  } else {
    el.classList.toggle('collapsed');
    shell?.classList.toggle(`${side}-collapsed`);
    shell?.classList.remove(`${side}-open`);
  }
}

function closeMobileSidebars() {
  if (!window.matchMedia('(max-width: 700px)').matches) return;
  const shell = document.querySelector('.shell');
  shell?.classList.remove('left-open', 'right-open');
}

function isMobileDrawerOpen() {
  const shell = document.querySelector('.shell');
  return !!shell && (shell.classList.contains('left-open') || shell.classList.contains('right-open'));
}

// ── Tab switching ──────────────────────────────
function switchTab(name, btn) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  btn.classList.add('active');
  if (name === 'documents') loadDocuments();
  if (name === 'eval')      loadEvalQuestions();
  if (name === 'history')   renderHistory();
}

// ── UID ────────────────────────────────────────
function onUidChange() {
  userId = document.getElementById('user-id-input').value.trim() || 'user_1';
  document.getElementById('display-uid').textContent = userId;
  loadDocuments();
}

// ── Stream toggle ──────────────────────────────
function onStreamToggle() {
  useStream = document.getElementById('stream-toggle').checked;
  toast(useStream ? 'Streaming enabled' : 'Streaming disabled');
}

// ═══════════════════════════════════════════════
// HEALTH CHECK — GET /health
// ═══════════════════════════════════════════════
async function checkHealth() {
  try {
    const r = await fetch(`${API}/health`);
    const d = await r.json();

    // Ollama
    const ollOk = d.ollama_running;
    setDot('dot-ollama', ollOk === null ? 'amber' : ollOk ? 'green' : 'red');
    document.getElementById('val-ollama').textContent =
      ollOk === null ? 'N/A' : ollOk ? 'Running' : 'Down';

    // Model
    const modOk = d.ollama_model_ready;
    setDot('dot-model', modOk === null ? 'amber' : modOk ? 'green' : 'red');
    document.getElementById('val-model').textContent =
      modOk === null ? 'N/A' : modOk ? 'Ready' : 'Missing';

    // Provider badge
    const prov = d.active_provider || {};
    document.getElementById('provider-label').textContent =
      `${prov.service || prov.provider || '—'} / ${prov.model || '—'}`;

    toast('Status refreshed');
  } catch(e) {
    setDot('dot-ollama', 'red');
    setDot('dot-model', 'red');
    toast('Cannot reach API — is the server running?');
  }
}

function setDot(id, color) {
  const el = document.getElementById(id);
  el.className = 'status-dot';
  if (color === 'green') el.classList.add('dot-green');
  else if (color === 'amber') el.classList.add('dot-amber');
  else el.classList.add('dot-red');
}

// ═══════════════════════════════════════════════
// PROVIDER — GET /provider + POST /provider/switch
// ═══════════════════════════════════════════════
async function loadProvider() {
  try {
    const r = await fetch(`${API}/provider`);
    const d = await r.json();
    const sel = document.getElementById('provider-select');

    // Map provider+service to select value
    if (d.provider === 'offline') sel.value = 'offline';
    else sel.value = d.service || d.provider;

    updateActiveModelLabel(d);
  } catch(e) {}
}

function onProviderChange() {
  const v = document.getElementById('provider-select').value;
  document.getElementById('btn-switch-provider').textContent =
    `Apply: ${v === 'offline' ? 'Offline' : v.charAt(0).toUpperCase() + v.slice(1)}`;
}

async function switchProvider() {
  const v = document.getElementById('provider-select').value;
  const isOffline = v === 'offline';
  const body = new URLSearchParams({
    provider: isOffline ? 'offline' : 'online',
    online_provider: isOffline ? '' : v
  });
  try {
    const r = await fetch(`${API}/provider/switch`, { method: 'POST', body });
    const d = await r.json();
    toast(d.message || 'Provider switched');
    await loadProvider();
    await checkHealth();
  } catch(e) {
    toast('Failed to switch provider');
  }
}

function updateActiveModelLabel(info) {
  if (!info) return;
  const label = `${info.service || info.provider || '—'} · ${info.model || '—'}`;
  document.getElementById('active-model-label').textContent = label;
  document.getElementById('provider-label').textContent = label;
}

// ═══════════════════════════════════════════════
// SESSION — POST /reset
// ═══════════════════════════════════════════════
async function resetSession() {
  const body = new URLSearchParams({ user_id: userId });
  try {
    await fetch(`${API}/reset`, { method: 'POST', body });
    toast('Memory cleared for ' + userId);
    historyItems = [];
    renderHistory();
  } catch(e) {
    toast('Failed to reset session');
  }
}

function newSession() {
  clearChat();
  resetSession();
}

// ═══════════════════════════════════════════════
// DOCUMENTS — GET + DELETE /documents/{user_id}
// ═══════════════════════════════════════════════
async function loadDocuments() {
  try {
    const r = await fetch(`${API}/documents/${userId}`);
    const d = await r.json();
    allDocs = d.documents || [];
    renderDocs();
    renderStorageStats(d);
  } catch(e) {
    document.getElementById('docs-list').innerHTML =
      '<p class="empty-hint">Could not load documents.</p>';
  }
}

function filterDocs() {
  renderDocs(document.getElementById('doc-search').value.toLowerCase());
}

function renderDocs(filter = '') {
  const list = document.getElementById('docs-list');
  const filtered = allDocs.filter(d =>
    !filter || d.filename.toLowerCase().includes(filter)
  );

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
  if (!data) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="stat-row"><span>Documents</span><strong>${data.total_documents || 0}</strong></div>
    <div class="stat-row"><span>Total chunks</span><strong>${data.total_chunks || 0}</strong></div>`;
}

async function deleteDoc(docId, name) {
  if (!confirm(`Delete "${name}"? This will remove its chunks from the index.`)) return;
  try {
    const r = await fetch(`${API}/documents/${userId}/${docId}`, { method: 'DELETE' });
    const d = await r.json();
    toast(d.message || 'Deleted');
    await loadDocuments();
  } catch(e) {
    toast('Failed to delete document');
  }
}

// ═══════════════════════════════════════════════
// UPLOAD — POST /upload
// ═══════════════════════════════════════════════
function onDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('drag-over');
}
function onDragLeave(e) {
  document.getElementById('upload-zone').classList.remove('drag-over');
}
function onDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files);
  uploadFiles(files);
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
    const pct = Math.round(((i) / files.length) * 100);
    fill.style.width = pct + '%';
    label.textContent = `Uploading ${file.name}…`;

    const form = new FormData();
    form.append('user_id', userId);
    form.append('file', file);

    try {
      const r = await fetch(`${API}/upload`, { method: 'POST', body: form });
      const d = await r.json();
      if (d.status === 'success') {
        toast(`✓ ${file.name} — ${d.chunks_created} chunks`);
      } else {
        toast(`✗ ${file.name}: ${d.message || d.detail}`);
      }
    } catch(e) {
      toast(`✗ ${file.name}: Upload failed`);
    }
  }

  fill.style.width = '100%';
  label.textContent = 'Done!';
  setTimeout(() => prog.classList.add('hidden'), 1200);
  await loadDocuments();
}

// ═══════════════════════════════════════════════
// CHAT — POST /ask + GET /ask/stream
// ═══════════════════════════════════════════════
async function sendMessage(e) {
  e.preventDefault();
  const box = document.getElementById('prompt');
  const text = box.value.trim();
  if (!text) return;

  box.value = '';
  updateCharCount();
  appendUserBubble(text);

  document.getElementById('send-btn').disabled = true;

  if (useStream) {
    await streamAnswer(text);
  } else {
    await blockingAnswer(text);
  }

  document.getElementById('send-btn').disabled = false;
  turnCount++;
  document.getElementById('display-turns').textContent = turnCount;
}

// ── Blocking ask ───────────────────────────────
async function blockingAnswer(query) {
  const typing = appendTyping();
  try {
    const body = new URLSearchParams({ query, user_id: userId });
    const r = await fetch(`${API}/ask`, { method: 'POST', body });
    const d = await r.json();
    typing.remove();

    if (d.status === 'blocked') {
      appendBotBubble(d.answer, [], 'blocked');
    } else if (d.status === 'error') {
      appendBotBubble('Error: ' + d.answer, [], 'error');
    } else {
      appendBotBubble(d.answer, d.sources || [], 'ok', d.processed_query);
      pushHistory(query, d.answer);
    }
  } catch(err) {
    typing.remove();
    appendBotBubble('Connection error. Is the API running?', [], 'error');
  }
}

// ── Streaming ask ──────────────────────────────
async function streamAnswer(query) {
  const url = `${API}/ask/stream?query=${encodeURIComponent(query)}&user_id=${encodeURIComponent(userId)}`;

  // Create streaming bubble immediately
  streamingBubble = createStreamingBubble();
  document.getElementById('stream-bar').classList.remove('hidden');

  activeStream = new AbortController();
  let fullAnswer = '';
  let sources = [];

  try {
    const response = await fetch(url, { signal: activeStream.signal });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          handleStreamEvent(ev);
          if (ev.event === 'token') fullAnswer += ev.token;
          if (ev.event === 'done') sources = ev.sources || [];
        } catch(e) {}
      }
    }
  } catch(err) {
    if (err.name !== 'AbortError') {
      if (streamingBubble) {
        streamingBubble.querySelector('p').textContent = 'Stream error. Try disabling streaming.';
      }
    }
  }

  // Finalize bubble
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

  switch(ev.event) {
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
      if (streamingBubble) {
        streamingBubble.querySelector('p').textContent = ev.answer;
      }
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
      }
      break;
  }
}

function stopStream() {
  if (activeStream) {
    activeStream.abort();
    activeStream = null;
    if (streamingBubble) {
      streamingBubble.querySelector('p').classList.remove('streaming-cursor');
    }
    document.getElementById('stream-bar').classList.add('hidden');
    toast('Stream stopped');
  }
}

// ═══════════════════════════════════════════════
// DOM — Message Bubble Helpers
// ═══════════════════════════════════════════════
function appendUserBubble(text) {
  const row = document.createElement('div');
  row.className = 'msg-row user';
  row.innerHTML = `
    <div class="msg-bubble bubble-user"><p>${escHtml(text)}</p></div>
    <div class="msg-avatar avatar-user">U</div>`;
  document.getElementById('log').appendChild(row);
  scrollLog();
}

function appendBotBubble(text, sources = [], status = 'ok', processedQ = null) {
  const row = document.createElement('div');
  row.className = 'msg-row';

  const bubbleClass = status === 'blocked' ? 'bubble-bot bubble-blocked'
                    : status === 'error'   ? 'bubble-bot bubble-error'
                    : 'bubble-bot';

  const prefix = status === 'blocked' ? '🚫 ' : status === 'error' ? '⚠ ' : '';

  row.innerHTML = `
    <div class="msg-avatar avatar-bot">AI</div>
    <div class="msg-bubble ${bubbleClass}"><p>${prefix}${escHtml(text)}</p></div>`;

  document.getElementById('log').appendChild(row);

  if (sources.length) {
    attachSources(row.querySelector('.msg-bubble'), sources, processedQ);
  }
  scrollLog();
}

function createStreamingBubble() {
  const row = document.createElement('div');
  row.className = 'msg-row';
  row.innerHTML = `
    <div class="msg-avatar avatar-bot">AI</div>
    <div class="msg-bubble bubble-bot"><p class="streaming-cursor"></p></div>`;
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
  row.innerHTML = `
    <div class="msg-avatar avatar-bot">AI</div>
    <div class="msg-bubble bubble-bot">
      <div class="typing-dots"><span></span><span></span><span></span></div>
    </div>`;
  document.getElementById('log').appendChild(row);
  scrollLog();
  return row;
}

function scrollLog() {
  const log = document.getElementById('log');
  log.scrollTop = log.scrollHeight;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

// ═══════════════════════════════════════════════
// EVALUATION — /eval endpoints
// ═══════════════════════════════════════════════
async function loadEvalQuestions() {
  try {
    const r = await fetch(`${API}/eval/${userId}/test-set`);
    const d = await r.json();
    evalQuestions = d.questions || [];
    renderEvalQuestions();
    await loadEvalResults();
  } catch(e) {}
}

function renderEvalQuestions() {
  const list = document.getElementById('eval-questions-list');
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
    const r = await fetch(`${API}/eval/${userId}/test-set/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, ground_truth: gt || null })
    });
    const d = await r.json();
    if (d.status === 'error') { toast(d.message); return; }
    toast('Question added');
    document.getElementById('eval-question-input').value = '';
    document.getElementById('eval-gt-input').value = '';
    hideAddQuestion();
    await loadEvalQuestions();
  } catch(e) { toast('Failed to add question'); }
}

async function deleteEvalQuestion(qId) {
  try {
    await fetch(`${API}/eval/${userId}/test-set/${qId}`, { method: 'DELETE' });
    toast('Question removed');
    await loadEvalQuestions();
  } catch(e) { toast('Failed to delete'); }
}

async function autoGenerateQuestions() {
  toast('Generating questions from your documents…');
  try {
    const r = await fetch(`${API}/eval/${userId}/test-set/auto-generate?n=5`, { method: 'POST' });
    const d = await r.json();
    toast(d.message || 'Questions generated');
    await loadEvalQuestions();
  } catch(e) { toast('Auto-generate failed'); }
}

async function runEvaluation() {
  const btn = document.getElementById('btn-run-eval');
  btn.disabled = true;
  btn.textContent = '⏳ Running…';
  toast('Running evaluation — this may take a minute…', 6000);

  try {
    const r = await fetch(`${API}/eval/${userId}/run`, { method: 'POST' });
    const d = await r.json();

    if (d.status === 'error') {
      toast(d.message);
    } else {
      toast(`Eval complete — pass rate: ${Math.round((d.pass_rate || 0) * 100)}%`);
      renderEvalResults(d);
    }
  } catch(e) {
    toast('Evaluation failed');
  }

  btn.disabled = false;
  btn.textContent = '▶ Run Eval';
}

async function loadEvalResults() {
  try {
    const r = await fetch(`${API}/eval/${userId}/results/latest`);
    const d = await r.json();
    if (d.status === 'success' && d.evaluation) {
      renderEvalResults(d.evaluation);
    }
  } catch(e) {}
}

function renderEvalResults(data) {
  const container = document.getElementById('eval-results');
  const grid = document.getElementById('scores-grid');
  const recs = document.getElementById('eval-recommendations');
  container.classList.remove('hidden');

  const scores = data.overall_scores || {};
  const metrics = [
    { key: 'faithfulness',      label: 'Faithful' },
    { key: 'answer_relevancy',  label: 'Relevancy' },
    { key: 'context_precision', label: 'Precision' },
    { key: 'context_recall',    label: 'Recall' },
  ];

  grid.innerHTML = metrics.map(m => {
    const val = scores[m.key];
    const pct = val !== null && val !== undefined ? Math.round(val * 100) : null;
    const cls = pct === null ? 'score-na' : pct >= 70 ? 'score-pass' : 'score-fail';
    return `
      <div class="score-card">
        <div class="score-metric">${m.label}</div>
        <div class="score-value ${cls}">${pct !== null ? pct + '%' : 'N/A'}</div>
      </div>`;
  }).join('');

  // Pass rate card
  const passRate = data.pass_rate !== undefined ? Math.round(data.pass_rate * 100) : null;
  if (passRate !== null) {
    grid.innerHTML += `
      <div class="score-card" style="grid-column: span 2;">
        <div class="score-metric">Pass Rate · ${data.passed}/${data.total_questions} passed</div>
        <div class="score-value ${passRate >= 70 ? 'score-pass' : 'score-fail'}">${passRate}%</div>
      </div>`;
  }

  // Recommendations
  const recommendations = data.recommendations || [];
  recs.innerHTML = recommendations
    .filter(r => r.metric !== 'overall')
    .slice(0, 2)
    .map(r => `
      <div class="eval-rec">
        <strong>${r.metric}: ${Math.round((scores[r.metric] || 0) * 100)}%</strong>
        ${r.issue}<br>
        <em>${(r.fixes || []).slice(0,1).join('')}</em>
      </div>`).join('');
}

// ═══════════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════════
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
  const items = historyItems.filter(h =>
    !filter || (h.q + h.a).toLowerCase().includes(filter)
  );
  if (!items.length) {
    list.innerHTML = '<p class="empty-hint">No history yet.</p>';
    return;
  }
  list.innerHTML = items.map(h => `
    <div class="history-card">
      <div class="history-time">${h.time}</div>
      <div class="history-role">YOU</div>
      <div class="history-q">${escHtml(h.q.slice(0,90))}${h.q.length>90?'…':''}</div>
      <div class="history-role" style="margin-top:4px">AI</div>
      <div class="history-a">${escHtml(h.a.slice(0,120))}${h.a.length>120?'…':''}</div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════
function clearChat() {
  document.getElementById('log').innerHTML = '';
  turnCount = 0;
  document.getElementById('display-turns').textContent = '0';
  greet();
  toast('Conversation cleared');
}

function applyQuick(text) {
  document.getElementById('prompt').value = text;
  updateCharCount();
  document.getElementById('prompt').focus();
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

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const prompt = document.getElementById('prompt');
  const chatMain = document.querySelector('.chat-main');

  // Textarea auto-resize + char count
  prompt.addEventListener('input', () => {
    updateCharCount();
    prompt.style.height = 'auto';
    prompt.style.height = Math.min(prompt.scrollHeight, 150) + 'px';
  });

  // Enter to send
  prompt.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('chat-form').requestSubmit();
    }
  });

  if (chatMain) {
    chatMain.addEventListener('pointerdown', closeMobileSidebars);
  }

  document.addEventListener('pointerdown', e => {
    if (!window.matchMedia('(max-width: 700px)').matches) return;
    if (!isMobileDrawerOpen()) return;
    if (e.target.closest('.hamburger')) return;
    if (e.target.closest('.sidebar')) return;
    closeMobileSidebars();
  });

  // Sync user-id display
  document.getElementById('display-uid').textContent = userId;

  // Initial data load
  checkHealth();
  loadProvider();
  loadDocuments();

  // Greeting
  greet();
});