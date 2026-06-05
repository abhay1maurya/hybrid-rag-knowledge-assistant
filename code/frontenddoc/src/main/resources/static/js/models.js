const API = "http://localhost:8000";

const DEFAULT_OPTIONS = {
  embedding_models: {
    "bge-large": {
      model_name: "BAAI/bge-large-en-v1.5",
      dimensions: 1024,
      normalize: true,
      speed: "slow",
      accuracy: "very high",
      size: "1.3GB",
      description: "Best accuracy, recommended for production"
    },
    "bge-base": {
      model_name: "BAAI/bge-base-en-v1.5",
      dimensions: 768,
      normalize: true,
      speed: "medium",
      accuracy: "high",
      size: "430MB",
      description: "Good balance of speed and accuracy"
    },
    "bge-small": {
      model_name: "BAAI/bge-small-en-v1.5",
      dimensions: 384,
      normalize: true,
      speed: "fast",
      accuracy: "medium",
      size: "130MB",
      description: "Fastest, good for development and testing"
    },
    "minilm": {
      model_name: "sentence-transformers/all-MiniLM-L6-v2",
      dimensions: 384,
      normalize: false,
      speed: "very fast",
      accuracy: "medium",
      size: "90MB",
      description: "Lightest model, best for low-resource environments"
    },
    "mpnet": {
      model_name: "sentence-transformers/all-mpnet-base-v2",
      dimensions: 768,
      normalize: false,
      speed: "medium",
      accuracy: "high",
      size: "420MB",
      description: "Strong general-purpose embedding model"
    }
  },
  chunking_strategies: {
    recursive: {
      description: "Fast rule-based chunking -- best for most documents",
      speed: "very fast",
      accuracy: "good",
      params: {
        chunk_size: {
          default: 600,
          min: 100,
          max: 2000,
          description: "Max characters per chunk"
        },
        chunk_overlap: {
          default: 100,
          min: 0,
          max: 500,
          description: "Overlap between consecutive chunks"
        }
      }
    },
    semantic: {
      description: "ML-based chunking -- splits on semantic boundaries (slow on CPU)",
      speed: "slow",
      accuracy: "very good",
      params: {
        breakpoint_threshold_type: {
          default: "standard_deviation",
          options: ["percentile", "standard_deviation", "interquartile"],
          description: "Method to detect semantic breaks"
        },
        breakpoint_threshold_amount: {
          default: 1.0,
          min: 0.5,
          max: 2.0,
          description: "Sensitivity of semantic break detection"
        }
      }
    },
    fixed: {
      description: "Simple fixed-size chunking -- fastest, least context-aware",
      speed: "very fast",
      accuracy: "basic",
      params: {
        chunk_size: {
          default: 500,
          min: 100,
          max: 2000,
          description: "Fixed characters per chunk"
        },
        chunk_overlap: {
          default: 50,
          min: 0,
          max: 300,
          description: "Overlap between consecutive chunks"
        }
      }
    }
  },
  llm_providers: {
    offline: {
      description: "Fully local -- no internet or API key required",
      requires_key: false,
      models: {
        mistral: {
          description: "Fast, capable 7B model -- best for offline use",
          speed: "medium",
          accuracy: "good"
        },
        llama3: {
          description: "Meta LLaMA 3 -- strong reasoning",
          speed: "medium",
          accuracy: "very good"
        },
        phi3: {
          description: "Microsoft Phi-3 -- lightweight and fast",
          speed: "fast",
          accuracy: "good"
        },
        gemma2: {
          description: "Google Gemma 2 -- efficient and capable",
          speed: "medium",
          accuracy: "good"
        }
      }
    },
    groq: {
      description: "Ultra-fast cloud inference -- free tier available",
      requires_key: true,
      get_key_url: "https://console.groq.com",
      models: {
        "llama-3.3-70b-versatile": {
          description: "Best Groq model -- strong reasoning and speed",
          speed: "very fast",
          accuracy: "very high"
        },
        "llama-3.1-8b-instant": {
          description: "Fastest Groq model -- great for quick answers",
          speed: "ultra fast",
          accuracy: "good"
        },
        "mixtral-8x7b-32768": {
          description: "Large context window -- good for long documents",
          speed: "fast",
          accuracy: "high"
        },
        "gemma2-9b-it": {
          description: "Google Gemma 2 via Groq -- fast and reliable",
          speed: "very fast",
          accuracy: "good"
        }
      }
    },
    openai: {
      description: "OpenAI cloud models -- reliable and widely used",
      requires_key: true,
      get_key_url: "https://platform.openai.com",
      models: {
        "gpt-4o": {
          description: "Most capable OpenAI model",
          speed: "fast",
          accuracy: "very high"
        },
        "gpt-4o-mini": {
          description: "Cost-effective, strong accuracy",
          speed: "fast",
          accuracy: "high"
        },
        "gpt-3.5-turbo": {
          description: "Fastest and cheapest OpenAI model",
          speed: "very fast",
          accuracy: "medium"
        }
      }
    },
    anthropic: {
      description: "Anthropic Claude -- best for document QA accuracy",
      requires_key: true,
      get_key_url: "https://console.anthropic.com",
      models: {
        "claude-sonnet-4-20250514": {
          description: "Best accuracy for document QA tasks",
          speed: "fast",
          accuracy: "very high"
        },
        "claude-haiku-4-5-20251001": {
          description: "Fastest Claude model -- great for quick answers",
          speed: "very fast",
          accuracy: "high"
        }
      }
    }
  },
  retriever_options: {
    k_candidates: {
      default: 10,
      min: 3,
      max: 30,
      description: "Number of chunks to fetch before reranking"
    },
    top_n_rerank: {
      default: 3,
      min: 1,
      max: 10,
      description: "Number of chunks to keep after reranking"
    },
    bm25_weight: {
      default: 0.4,
      min: 0.0,
      max: 1.0,
      description: "Weight for BM25 keyword search (FAISS weight = 1 - this)"
    },
    use_multi_query: {
      default: true,
      description: "Generate multiple query variants for better recall"
    },
    use_reranker: {
      default: true,
      description: "Use cross-encoder reranker for more accurate ranking"
    }
  },
  default_config: {
    embedding_model: "bge-large",
    chunking_strategy: "recursive",
    chunking_params: {
      chunk_size: 600,
      chunk_overlap: 100
    },
    llm_provider: "groq",
    llm_model: "llama-3.3-70b-versatile",
    retriever: {
      k_candidates: 10,
      top_n_rerank: 3,
      bm25_weight: 0.4,
      use_multi_query: true,
      use_reranker: true
    }
  }
};

const els = {
  embeddingGrid: document.getElementById("embedding-grid"),
  chunkingGrid: document.getElementById("chunking-grid"),
  providerGrid: document.getElementById("provider-grid"),
  retrieverBody: document.getElementById("retriever-body"),
  defaultConfig: document.getElementById("default-config"),
  statusPill: document.getElementById("status-pill"),
  lastUpdated: document.getElementById("last-updated"),
  toast: document.getElementById("toast"),
  refreshBtn: document.getElementById("btn-refresh")
};

function escHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  clearTimeout(els.toast._timer);
  els.toast._timer = setTimeout(() => els.toast.classList.add("hidden"), 2200);
}

function formatRange(info) {
  const min = info?.min;
  const max = info?.max;
  if (min === undefined && max === undefined) return "-";
  if (min === undefined) return `<= ${max}`;
  if (max === undefined) return `>= ${min}`;
  return `${min} - ${max}`;
}

function setStatus(text, tone = "neutral") {
  if (!els.statusPill) return;
  els.statusPill.textContent = text;
  const map = {
    ok: "var(--accent-2)",
    warn: "var(--accent)",
    neutral: "var(--muted)",
    error: "#f87171"
  };
  els.statusPill.style.borderColor = map[tone] || map.neutral;
  els.statusPill.style.color = map[tone] || map.neutral;
}

function renderEmbeddings(models) {
  if (!els.embeddingGrid) return;
  const cards = Object.entries(models || {}).map(([key, info]) => {
    const tags = [
      `Dim ${info.dimensions ?? "-"}`,
      `Speed ${info.speed ?? "-"}`,
      `Accuracy ${info.accuracy ?? "-"}`,
      `Size ${info.size ?? "-"}`,
      info.normalize === undefined ? null : `Normalize ${info.normalize ? "yes" : "no"}`
    ].filter(Boolean);

    return `
      <article class="card">
        <h3>${escHtml(key)}</h3>
        <p>${escHtml(info.description || "No description")}</p>
        <div class="tag-row">${tags.map(tag => `<span class="tag">${escHtml(tag)}</span>`).join("")}</div>
        ${info.model_name ? `<div class="kv-list"><span>Model</span><strong>${escHtml(info.model_name)}</strong></div>` : ""}
      </article>
    `;
  });
  els.embeddingGrid.innerHTML = cards.join("") || "<p>No embedding models returned.</p>";
}

function renderChunking(strategies) {
  if (!els.chunkingGrid) return;
  const cards = Object.entries(strategies || {}).map(([key, info]) => {
    const params = Object.entries(info.params || {}).map(([param, detail]) => {
      const details = [];
      if (detail.default !== undefined) details.push(`Default: ${detail.default}`);
      if (detail.min !== undefined || detail.max !== undefined) details.push(`Range: ${formatRange(detail)}`);
      if (detail.options) details.push(`Options: ${detail.options.join(", ")}`);
      return `
        <div class="param">
          <div class="param-title">${escHtml(param)}</div>
          <div class="param-desc">${escHtml(detail.description || "")}</div>
          <div class="param-desc">${escHtml(details.join(" | "))}</div>
        </div>
      `;
    }).join("");

    return `
      <article class="card">
        <h3>${escHtml(key)}</h3>
        <p>${escHtml(info.description || "")}</p>
        <div class="tag-row">
          <span class="tag">Speed ${escHtml(info.speed || "-")}</span>
          <span class="tag">Accuracy ${escHtml(info.accuracy || "-")}</span>
        </div>
        <div class="param-grid">${params || "<span class=\"param-desc\">No parameters.</span>"}</div>
      </article>
    `;
  });
  els.chunkingGrid.innerHTML = cards.join("") || "<p>No chunking strategies returned.</p>";
}

function renderProviders(providers) {
  if (!els.providerGrid) return;
  const cards = Object.entries(providers || {}).map(([key, info]) => {
    const models = Object.entries(info.models || {}).map(([model, detail]) => {
      return `
        <div class="model-item">
          <strong>${escHtml(model)}</strong>
          <span>${escHtml(detail.description || "")}</span>
        </div>
      `;
    }).join("");

    return `
      <article class="card">
        <h3>${escHtml(key)}</h3>
        <p>${escHtml(info.description || "")}</p>
        <div class="tag-row">
          <span class="tag">API key ${info.requires_key ? "required" : "not required"}</span>
          ${info.get_key_url ? `<span class="tag">${escHtml(info.get_key_url)}</span>` : ""}
        </div>
        <div class="model-list">${models || "<span class=\"param-desc\">No models listed.</span>"}</div>
      </article>
    `;
  });
  els.providerGrid.innerHTML = cards.join("") || "<p>No LLM providers returned.</p>";
}

function renderRetriever(options) {
  if (!els.retrieverBody) return;
  const rows = Object.entries(options || {}).map(([key, info]) => {
    return `
      <tr>
        <td class="mono">${escHtml(key)}</td>
        <td>${escHtml(info.default ?? "-")}</td>
        <td>${escHtml(formatRange(info))}</td>
        <td>${escHtml(info.description || "")}</td>
      </tr>
    `;
  });
  els.retrieverBody.innerHTML = rows.join("") || "<tr><td colspan=\"4\">No retriever options returned.</td></tr>";
}

function renderDefaults(defaultConfig) {
  if (!els.defaultConfig) return;
  const formatted = JSON.stringify(defaultConfig || {}, null, 2);
  els.defaultConfig.textContent = formatted || "{}";
}

async function loadOptions() {
  setStatus("Loading config options...", "warn");
  try {
    const res = await fetch(`${API}/config/options`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    renderEmbeddings(data.embedding_models);
    renderChunking(data.chunking_strategies);
    renderProviders(data.llm_providers);
    renderRetriever(data.retriever_options);
    renderDefaults(data.default_config);

    const stamp = new Date();
    if (els.lastUpdated) {
      els.lastUpdated.textContent = `Last updated: ${stamp.toLocaleString()}`;
    }
    setStatus("Options loaded", "ok");
  } catch (err) {
    renderEmbeddings(DEFAULT_OPTIONS.embedding_models);
    renderChunking(DEFAULT_OPTIONS.chunking_strategies);
    renderProviders(DEFAULT_OPTIONS.llm_providers);
    renderRetriever(DEFAULT_OPTIONS.retriever_options);
    renderDefaults(DEFAULT_OPTIONS.default_config);
    setStatus("Showing default options", "warn");
    showToast("API unavailable. Showing default options.");
  }
}

if (els.refreshBtn) {
  els.refreshBtn.addEventListener("click", loadOptions);
}

loadOptions();
