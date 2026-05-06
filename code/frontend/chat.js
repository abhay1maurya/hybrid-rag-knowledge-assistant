let chatTurn = 0;
let historyItems = [];
let runtimeAvailability = {
  online: true,
  offline: true
};
let runtimeConfig = {
  mode: 'hybrid',
  onlineModel: 'gpt-4.1-online',
  offlineModel: 'llama-3.1-8b-local'
};
let draftConfig = {
  mode: 'hybrid',
  onlineModel: 'gpt-4.1-online',
  offlineModel: 'llama-3.1-8b-local'
};

let documents = [
  { name: 'Q3_Financial_Report.pdf', type: 'PDF', status: 'Indexed' },
  { name: 'Architecture_Guide.docx', type: 'DOCX', status: 'Processing' },
  { name: 'Security_Policies.txt', type: 'TXT', status: 'Indexed' }
];

function scrollLogToBottom() {
  const log = document.getElementById('log');
  log.scrollTop = log.scrollHeight;
}

function appendBubble(role, text, meta) {
  const log = document.getElementById('log');
  const wrap = document.createElement('article');
  const isUser = role === 'user';

  wrap.className = isUser ? 'message-row message-user message-appear' : 'message-row message-bot message-appear';

  const icon = document.createElement('div');
  icon.className = isUser ? 'message-icon icon-user' : 'message-icon icon-bot';
  icon.textContent = isUser ? 'U' : 'AI';

  const bubble = document.createElement('div');
  bubble.className = isUser ? 'message-bubble bubble-user' : 'message-bubble bubble-bot';

  const content = document.createElement('p');
  content.textContent = text;
  bubble.appendChild(content);

  if (meta && !isUser) {
    const metaLine = document.createElement('div');
    metaLine.className = 'source-line';

    meta.sources.forEach(function (source) {
      const pill = document.createElement('span');
      pill.className = 'source-pill';
      pill.textContent = source;
      metaLine.appendChild(pill);
    });

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(text).then(function () {
        if (window.appToast) window.appToast('Response copied');
      });
    });
    metaLine.appendChild(copyBtn);

    bubble.appendChild(metaLine);
  }

  if (isUser) {
    wrap.appendChild(bubble);
    wrap.appendChild(icon);
  } else {
    wrap.appendChild(icon);
    wrap.appendChild(bubble);
  }

  log.appendChild(wrap);
  scrollLogToBottom();
}

function renderTyping() {
  const log = document.getElementById('log');
  const typing = document.createElement('div');
  typing.id = 'typing-row';
  typing.className = 'message-row message-bot message-appear';
  typing.innerHTML = '<div class="message-icon icon-bot">AI</div><div class="message-bubble bubble-bot"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  log.appendChild(typing);
  scrollLogToBottom();
}

function removeTyping() {
  const typing = document.getElementById('typing-row');
  if (typing) typing.remove();
}

function nextDemoResponse(prompt) {
  const drafts = [
    {
      text: 'Based on your indexed material, the strongest answer is to combine retrieval grounding with lightweight re-ranking to keep factual consistency high.',
      sources: ['Architecture Notes', 'RAG Evaluation Matrix']
    },
    {
      text: 'I found aligned context in your corpus. The best next step is to add query rewriting before retrieval so ambiguous user intents map to better chunks.',
      sources: ['Pipeline Design', 'Chunking Guidelines']
    },
    {
      text: 'The evidence points to hybrid search as the most robust choice here: semantic retrieval for intent plus lexical matching for exact entity recall.',
      sources: ['Hybrid Search Study', 'Index Tuning Notes']
    }
  ];

  const item = drafts[chatTurn % drafts.length];
  chatTurn += 1;

  if (/latency|slow|speed/i.test(prompt)) {
    return {
      text: 'To reduce latency, prioritize top-k trimming after vector retrieval and cache embeddings for repeated prompts. This usually lowers median response time significantly.',
      sources: ['Performance Checklist', 'Serving Guide']
    };
  }

  return item;
}

function modeLabel(mode) {
  if (mode === 'online') return 'Online';
  if (mode === 'offline') return 'Offline';
  return 'Hybrid';
}

function modeAvailable(mode) {
  if (mode === 'online') return runtimeAvailability.online;
  if (mode === 'offline') return runtimeAvailability.offline;
  return runtimeAvailability.online || runtimeAvailability.offline;
}

function activeModelLabel(config) {
  const cfg = config || runtimeConfig;
  if (cfg.mode === 'online') {
    return runtimeAvailability.online ? cfg.onlineModel : 'Unavailable';
  }

  if (cfg.mode === 'offline') {
    return runtimeAvailability.offline ? cfg.offlineModel : 'Unavailable';
  }

  if (runtimeAvailability.online && runtimeAvailability.offline) {
    return cfg.onlineModel + ' + ' + cfg.offlineModel;
  }

  if (runtimeAvailability.online) return cfg.onlineModel;
  if (runtimeAvailability.offline) return cfg.offlineModel;
  return 'Unavailable';
}

function setModeAvailabilityInfo(mode) {
  const state = document.getElementById('mode-availability-state');
  const detail = document.getElementById('mode-availability-detail');
  if (!state || !detail) return;

  if (modeAvailable(mode)) {
    state.textContent = modeLabel(mode) + ' mode is available';
    state.className = 'status-badge status-available';
  } else {
    state.textContent = modeLabel(mode) + ' mode is unavailable';
    state.className = 'status-badge status-unavailable';
  }

  const onlineText = runtimeAvailability.online ? 'Available' : 'Unavailable';
  const offlineText = runtimeAvailability.offline ? 'Available' : 'Unavailable';
  detail.textContent = 'Online: ' + onlineText + ' | Offline: ' + offlineText;
}

function updateAppliedRuntimeUI() {
  const currentModel = document.getElementById('current-model');
  const warning = document.getElementById('config-warning');
  const sendBtn = document.getElementById('send-btn');
  const prompt = document.getElementById('prompt');

  currentModel.textContent = 'Model: ' + activeModelLabel(runtimeConfig);

  const canRun = modeAvailable(runtimeConfig.mode);
  sendBtn.disabled = !canRun;
  prompt.disabled = !canRun;

  if (!canRun) {
    warning.classList.remove('hidden');
    warning.textContent = modeLabel(runtimeConfig.mode) + ' mode is not available with current runtime switches.';
    prompt.placeholder = 'Enable a compatible runtime in Configuration to continue chatting.';
  } else {
    warning.classList.add('hidden');
    prompt.placeholder = 'Ask about architecture, risks, performance, or evidence...';
  }
}

function updateConfigurationUI() {
  const modeSelect = document.getElementById('mode-select');
  const onlineModelSelect = document.getElementById('online-model-select');
  const offlineModelSelect = document.getElementById('offline-model-select');
  const onlineWrap = document.getElementById('online-model-wrap');
  const offlineWrap = document.getElementById('offline-model-wrap');
  const confirmBtn = document.getElementById('config-confirm-btn');

  modeSelect.value = draftConfig.mode;
  onlineModelSelect.value = draftConfig.onlineModel;
  offlineModelSelect.value = draftConfig.offlineModel;

  const showOnline = draftConfig.mode === 'online' || draftConfig.mode === 'hybrid';
  const showOffline = draftConfig.mode === 'offline' || draftConfig.mode === 'hybrid';
  
  showOnline ? onlineWrap.classList.remove('hidden') : onlineWrap.classList.add('hidden');
  showOffline ? offlineWrap.classList.remove('hidden') : offlineWrap.classList.add('hidden');

  onlineModelSelect.disabled = !runtimeAvailability.online;
  offlineModelSelect.disabled = !runtimeAvailability.offline;

  setModeAvailabilityInfo(draftConfig.mode);

  const canApply = modeAvailable(draftConfig.mode);
  confirmBtn.disabled = !canApply;
}

function applyConfiguration() {
  if (!modeAvailable(draftConfig.mode)) {
    if (window.appToast) window.appToast('Selected mode is unavailable. Choose another mode.');
    return;
  }
  runtimeConfig.mode = draftConfig.mode;
  runtimeConfig.onlineModel = draftConfig.onlineModel;
  runtimeConfig.offlineModel = draftConfig.offlineModel;
  updateAppliedRuntimeUI();
  if (window.appToast) window.appToast('Configuration confirmed');
}

function bindConfigurationEvents() {
  document.getElementById('mode-select').addEventListener('change', function (event) {
    draftConfig.mode = event.target.value;
    updateConfigurationUI();
  });

  document.getElementById('online-model-select').addEventListener('change', function (event) {
    draftConfig.onlineModel = event.target.value;
    updateConfigurationUI();
  });

  document.getElementById('offline-model-select').addEventListener('change', function (event) {
    draftConfig.offlineModel = event.target.value;
    updateConfigurationUI();
  });

  document.getElementById('config-confirm-btn').addEventListener('click', applyConfiguration);
}

function renderHistoryList() {
  const list = document.getElementById('query-history');
  const search = (document.getElementById('history-search')?.value || '').trim().toLowerCase();
  if (!list) return;

  const filtered = historyItems.filter(function (item) {
    if (!search) return true;
    return (item.user + ' ' + item.assistant).toLowerCase().indexOf(search) !== -1;
  });

  if (!filtered.length) {
    list.innerHTML = '<p class="history-bubble history-text text-center">No chat history yet.</p>';
    return;
  }

  list.innerHTML = filtered.map(function (item) {
    return '<article class="history-card">' +
      '<div class="history-card-header">' +
      '<p class="history-time">' + item.time + '</p>' +
      '<span class="history-badge">Chat turn</span>' +
      '</div>' +
      '<div class="history-bubble">' +
      '<p class="history-role">You</p>' +
      '<p class="history-text">' + item.user + '</p>' +
      '</div>' +
      '<div class="history-bubble">' +
      '<p class="history-role history-role-assistant">Assistant</p>' +
      '<p class="history-text">' + item.assistant + '</p>' +
      '</div>' +
      '</article>';
  }).join('');
}

function pushHistory(prompt, response) {
  const timestamp = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  historyItems.unshift({
    time: 'Today, ' + timestamp,
    user: prompt.length > 92 ? prompt.slice(0, 89) + '...' : prompt,
    assistant: response.length > 120 ? response.slice(0, 117) + '...' : response
  });
  historyItems = historyItems.slice(0, 12);
  renderHistoryList();
}

function getDocStatusBadge(status) {
  if (status === 'Indexed') {
    return '<span class="status-indexed">Indexed</span>';
  }
  return '<span class="status-processing">Processing</span>';
}

function renderDocuments() {
  const body = document.getElementById('docs-body');
  const search = (document.getElementById('doc-search')?.value || '').trim().toLowerCase();
  if (!body) return;

  const filtered = documents.filter(function (doc) {
    if (!search) return true;
    return (doc.name + ' ' + doc.type + ' ' + doc.status).toLowerCase().indexOf(search) !== -1;
  });

  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="4" style="text-align: center; color: rgba(255,255,255,0.6); font-size: 0.75rem;">No documents found.</td></tr>';
    return;
  }

  body.innerHTML = filtered.map(function (doc) {
    return '<tr>' +
      '<td class="doc-name">' + doc.name + '</td>' +
      '<td class="doc-type">' + doc.type + '</td>' +
      '<td>' + getDocStatusBadge(doc.status) + '</td>' +
      '<td class="doc-action">Open</td>' +
      '</tr>';
  }).join('');
}

function fileTypeFromName(name) {
  const ext = name.split('.').pop();
  if (!ext) return 'FILE';
  return ext.toUpperCase();
}

function handleUpload(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  files.forEach(function (file) {
    documents.unshift({
      name: file.name,
      type: fileTypeFromName(file.name),
      status: 'Processing'
    });
  });
  documents = documents.slice(0, 20);
  renderDocuments();
  if (window.appToast) window.appToast(files.length + ' document(s) added to library');
  event.target.value = '';
}

function updatePromptMeta() {
  const box = document.getElementById('prompt');
  const counter = document.getElementById('prompt-count');
  const max = 800;
  if (box.value.length > max) {
    box.value = box.value.slice(0, max);
  }
  counter.textContent = box.value.length + '/' + max;
  box.style.height = 'auto';
  box.style.height = Math.min(box.scrollHeight, 168) + 'px';
}

function sendMessage(event) {
  event.preventDefault();
  const box = document.getElementById('prompt');
  const text = box.value.trim();
  if (!text) return;
  if (!modeAvailable(runtimeConfig.mode)) {
    if (window.appToast) window.appToast('Selected mode is unavailable. Update Configuration first.');
    return;
  }

  appendBubble('user', text);
  box.value = '';
  updatePromptMeta();

  renderTyping();
  const reply = nextDemoResponse(text);

  setTimeout(function () {
    removeTyping();
    appendBubble('bot', reply.text, { sources: reply.sources });
    pushHistory(text, reply.text);
  }, 420);
}

function applyQuickPrompt(text) {
  const box = document.getElementById('prompt');
  box.value = text;
  updatePromptMeta();
  box.focus();
}

function clearConversation() {
  const log = document.getElementById('log');
  log.innerHTML = '';
  historyItems = [];
  renderHistoryList();
  appendBubble('bot', 'New session started. Ask me anything about your documents and I will ground each response in available sources.', {
    sources: ['System Prompt']
  });
  if (window.appToast) window.appToast('Conversation cleared');
}

document.addEventListener('DOMContentLoaded', function () {
  const box = document.getElementById('prompt');
  updatePromptMeta();

  box.addEventListener('input', updatePromptMeta);
  box.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      document.getElementById('chat-form').requestSubmit();
    }
  });

  document.querySelectorAll('[data-quick-prompt]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyQuickPrompt(btn.getAttribute('data-quick-prompt') || '');
    });
  });

  document.getElementById('clear-chat').addEventListener('click', clearConversation);
  document.getElementById('history-search').addEventListener('input', renderHistoryList);
  document.getElementById('doc-search').addEventListener('input', renderDocuments);
  document.getElementById('upload-doc').addEventListener('click', function () {
    document.getElementById('doc-upload-input').click();
  });
  document.getElementById('doc-upload-input').addEventListener('change', handleUpload);
  bindConfigurationEvents();

  renderHistoryList();
  renderDocuments();
  updateAppliedRuntimeUI();
  updateConfigurationUI();
  appendBubble('bot', 'Hello. I can answer from your indexed knowledge base and show which sources informed the response.', {
    sources: ['Getting Started Guide']
  });
});