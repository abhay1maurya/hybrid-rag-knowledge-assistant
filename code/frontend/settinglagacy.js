document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = "http://localhost:8000";

    const CONFIG_SCHEMA = {
        "embedding_models": {
            "bge-large": { "dimensions": 1024, "size": "1.3GB" },
            "bge-base": { "dimensions": 768, "size": "430MB" },
            "bge-small": { "dimensions": 384, "size": "130MB" },
            "minilm": { "dimensions": 384, "size": "90MB" },
            "mpnet": { "dimensions": 768, "size": "420MB" }
        },
        "chunking_strategies": {
            "recursive": {
                "params": {
                    "chunk_size": { "default": 600, "min": 100, "max": 2000 },
                    "chunk_overlap": { "default": 100, "min": 0, "max": 500 }
                }
            },
            "semantic": {
                "params": {
                    "breakpoint_threshold_type": { "default": "standard_deviation", "options": ["percentile", "standard_deviation", "interquartile"] },
                    "breakpoint_threshold_amount": { "default": 1, "min": 0.5, "max": 2 }
                }
            },
            "fixed": {
                "params": {
                    "chunk_size": { "default": 500, "min": 100, "max": 2000 },
                    "chunk_overlap": { "default": 50, "min": 0, "max": 300 }
                }
            }
        },
        "llm_providers": {
            "offline": { "requires_key": false, "models": ["mistral", "llama3", "phi3", "gemma2"] },
            "groq": { "requires_key": true, "models": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"] },
            "openai": { "requires_key": true, "models": ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"] },
            "anthropic": { "requires_key": true, "models": ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"] }
        },
        "retriever": {
            "k_candidates": { "default": 10, "min": 3, "max": 30 },
            "top_n_rerank": { "default": 3, "min": 1, "max": 10 },
            "bm25_weight": { "default": 0.4, "min": 0, "max": 1 }
        }
    };

    let activeChunkingParamsState = {};

    const els = {
        embedModel: document.getElementById("embed-model"),
        chunkStrategy: document.getElementById("chunk-strategy"),
        chunkParams: document.getElementById("chunk-params-container"),
        llmProvider: document.getElementById("llm-provider"),
        llmModel: document.getElementById("llm-model"),
        apiKey: document.getElementById("api-key"),
        keyContainer: document.getElementById("key-container"),
        multiQuery: document.getElementById("use-multi-query"),
        reranker: document.getElementById("use-reranker"),
        kCand: document.getElementById("k-candidates"),
        topN: document.getElementById("top-n-rerank"),
        bm25: document.getElementById("bm25-weight"),
        jsonPreview: document.getElementById("json-preview")
    };

    function showToast(msg, isError = false) {
        const toast = document.getElementById("toast");
        toast.textContent = msg;
        toast.style.background = isError ? "#ef4444" : "#10b981";
        toast.classList.remove("hidden");
        setTimeout(() => toast.classList.add("hidden"), 2500);
    }

    function initStaticOptions() {
        Object.keys(CONFIG_SCHEMA.embedding_models).forEach(k => els.embedModel.add(new Option(k, k)));
        Object.keys(CONFIG_SCHEMA.llm_providers).forEach(k => els.llmProvider.add(new Option(k.toUpperCase(), k)));
        
        els.kCand.min = CONFIG_SCHEMA.retriever.k_candidates.min;
        els.kCand.max = CONFIG_SCHEMA.retriever.k_candidates.max;
        els.topN.min = CONFIG_SCHEMA.retriever.top_n_rerank.min;
        els.topN.max = CONFIG_SCHEMA.retriever.top_n_rerank.max;
        els.bm25.min = CONFIG_SCHEMA.retriever.bm25_weight.min;
        els.bm25.max = CONFIG_SCHEMA.retriever.bm25_weight.max;
    }

    function updateEmbedMeta() {
        const meta = CONFIG_SCHEMA.embedding_models[els.embedModel.value];
        document.getElementById("meta-dim").textContent = meta.dimensions;
        document.getElementById("meta-size").textContent = meta.size;
        updateLivePreview();
    }

    function buildChunkingParams() {
        const strategy = els.chunkStrategy.value;
        const params = CONFIG_SCHEMA.chunking_strategies[strategy].params;
        els.chunkParams.innerHTML = "";
        activeChunkingParamsState = {};

        Object.entries(params).forEach(([key, data]) => {
            const wrapper = document.createElement("div");
            wrapper.className = "form-group";
            
            const header = document.createElement("div");
            header.className = "slider-header";
            header.innerHTML = `<label>${key.replace(/_/g, ' ').toUpperCase()}</label>`;
            
            if (data.options) {
                const select = document.createElement("select");
                select.className = "form-select";
                data.options.forEach(o => select.add(new Option(o, o)));
                select.value = data.default;
                select.addEventListener("change", updateLivePreview);
                wrapper.append(header, select);
                activeChunkingParamsState[key] = () => select.value;
            } else {
                const valDisplay = document.createElement("span");
                valDisplay.className = "numerical-display";
                valDisplay.textContent = data.default;
                header.appendChild(valDisplay);
                
                const slider = document.createElement("input");
                slider.type = "range";
                slider.className = "range-slider";
                slider.min = data.min; slider.max = data.max;
                slider.step = data.step || 1;
                slider.value = data.default;
                
                slider.addEventListener("input", (e) => {
                    valDisplay.textContent = e.target.value;
                    updateLivePreview();
                });
                wrapper.append(header, slider);
                activeChunkingParamsState[key] = () => parseFloat(slider.value);
            }
            els.chunkParams.appendChild(wrapper);
        });
        updateLivePreview();
    }

    function updateProvider() {
        const provider = els.llmProvider.value;
        const config = CONFIG_SCHEMA.llm_providers[provider];
        
        els.llmModel.innerHTML = "";
        config.models.forEach(m => els.llmModel.add(new Option(m, m)));
        
        els.keyContainer.classList.toggle("hidden", !config.requires_key);
        if(!config.requires_key) els.apiKey.value = "";
        updateLivePreview();
    }

    function updateSliders() {
        document.getElementById("k-val").textContent = els.kCand.value;
        document.getElementById("top-n-val").textContent = els.topN.value;
        document.getElementById("bm25-val").textContent = parseFloat(els.bm25.value).toFixed(2);
        updateLivePreview();
    }

    function generatePayload() {
        const chunkingParams = {};
        Object.entries(activeChunkingParamsState).forEach(([k, getter]) => {
            chunkingParams[k] = getter();
        });

        return {
            embedding_model: els.embedModel.value,
            chunking_strategy: els.chunkStrategy.value,
            chunking_params: chunkingParams,
            llm_provider: els.llmProvider.value,
            llm_model: els.llmModel.value,
            api_key: els.apiKey.value || null,
            retriever: {
                use_multi_query: els.multiQuery.checked,
                use_reranker: els.reranker.checked,
                k_candidates: parseInt(els.kCand.value, 10),
                top_n_rerank: parseInt(els.topN.value, 10),
                bm25_weight: parseFloat(els.bm25.value)
            }
        };
    }

    function updateLivePreview() {
        const payload = generatePayload();
        // Hide API key in preview for security
        const displayPayload = { ...payload };
        if (displayPayload.api_key) displayPayload.api_key = "********";
        els.jsonPreview.textContent = JSON.stringify(displayPayload, null, 2);
    }

    function loadDefaults() {
        els.embedModel.value = "bge-large";
        els.chunkStrategy.value = "recursive";
        els.llmProvider.value = "groq";
        els.multiQuery.checked = true;
        els.reranker.checked = true;
        els.kCand.value = 10;
        els.topN.value = 3;
        els.bm25.value = 0.4;
        
        updateEmbedMeta();
        buildChunkingParams();
        updateProvider();
        els.llmModel.value = "llama-3.3-70b-versatile";
        updateSliders();
    }

    // Bind Core Events
    els.embedModel.addEventListener("change", updateEmbedMeta);
    els.chunkStrategy.addEventListener("change", buildChunkingParams);
    els.llmProvider.addEventListener("change", updateProvider);
    els.llmModel.addEventListener("change", updateLivePreview);
    els.apiKey.addEventListener("input", updateLivePreview);
    els.multiQuery.addEventListener("change", updateLivePreview);
    els.reranker.addEventListener("change", updateLivePreview);
    els.kCand.addEventListener("input", updateSliders);
    els.topN.addEventListener("input", updateSliders);
    els.bm25.addEventListener("input", updateSliders);

    document.getElementById("btn-copy").addEventListener("click", () => {
        navigator.clipboard.writeText(JSON.stringify(generatePayload(), null, 2));
        showToast("JSON payload copied to clipboard.");
    });

    document.getElementById("btn-reset-defaults").addEventListener("click", loadDefaults);

    document.getElementById("btn-save-config").addEventListener("click", async () => {
        const payload = generatePayload();
        try {
            const res = await fetch(`${API_BASE}/config/update`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if(!res.ok) throw new Error("Backend rejected payload");
            showToast("Configuration successfully deployed.");
        } catch (err) {
            showToast("Failed to deploy to backend.", true);
        }
    });

    // Boot
    initStaticOptions();
    loadDefaults();
});