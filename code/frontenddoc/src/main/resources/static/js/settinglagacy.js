document.addEventListener("DOMContentLoaded", () => {
    // Bulletproof API Base resolution
    const API_BASE = (() => {
        if (typeof window.__DOCUMIND_API_BASE__ === 'string' && window.__DOCUMIND_API_BASE__.trim() !== '') {
            return window.__DOCUMIND_API_BASE__.trim();
        }
        return 'http://localhost:8000';
    })();

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
                    "breakpoint_threshold_amount": { "default": 1, "min": 0.5, "max": 2, "step": 0.1 }
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
        userIdInput: document.getElementById("user-id-input"),
        userIdDisplay: document.getElementById("user-id-display"),
        embedModel: document.getElementById("embed-model"),
        chunkStrategy: document.getElementById("chunk-strategy"),
        chunkParams: document.getElementById("chunk-params-container"),
        llmProvider: document.getElementById("llm-provider"),
        llmModel: document.getElementById("llm-model"),
        multiQuery: document.getElementById("use-multi-query"),
        reranker: document.getElementById("use-reranker"),
        kCand: document.getElementById("k-candidates"),
        topN: document.getElementById("top-n-rerank"),
        bm25: document.getElementById("bm25-weight"),
        jsonPreview: document.getElementById("json-preview")
    };

    let BACKEND_SCHEMA = null;
    let USER_ID = ""; 

    function getCurrentUserId() {
        return USER_ID || "user_1";
    }

    function setUserId(id) {
        if (!id || id.trim() === "") return false;
        USER_ID = id.trim();
        localStorage.setItem("user_id", USER_ID);
        
        if (els.userIdDisplay) els.userIdDisplay.textContent = USER_ID;
        if (els.userIdInput && els.userIdInput.value !== USER_ID) {
            els.userIdInput.value = USER_ID;
        }
        return true;
    }

    function buildConfigUrl(path) {
        // Strip trailing slash from base and leading slash from path to prevent double slashes
        const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${base}${cleanPath}`;
    }

    function showToast(msg, isError = false) {
        const toast = document.getElementById("toast");
        if (!toast) return;
        toast.textContent = msg;
        toast.style.background = isError ? "#ef4444" : "#10b981";
        toast.classList.remove("hidden");
        setTimeout(() => toast.classList.add("hidden"), 2500);
    }

    function initStaticOptions() {
        const source = BACKEND_SCHEMA || CONFIG_SCHEMA;
        if (!source) return;
        
        els.embedModel.innerHTML = "";
        Object.keys(source.embedding_models || {}).forEach(k => els.embedModel.add(new Option(k, k)));
        
        els.llmProvider.innerHTML = "";
        Object.keys(source.llm_providers || {}).forEach(k => els.llmProvider.add(new Option(k.toUpperCase(), k)));

        const retr = source.retriever || source.retriever_options || CONFIG_SCHEMA.retriever;
        if (retr && els.kCand) {
            els.kCand.min = retr.k_candidates?.min ?? 3;
            els.kCand.max = retr.k_candidates?.max ?? 30;
        }
        if (retr && els.topN) {
            els.topN.min = retr.top_n_rerank?.min ?? 1;
            els.topN.max = retr.top_n_rerank?.max ?? 10;
        }
        if (retr && els.bm25) {
            els.bm25.min = retr.bm25_weight?.min ?? 0;
            els.bm25.max = retr.bm25_weight?.max ?? 1;
        }
    }

    function updateEmbedMeta() {
        const source = BACKEND_SCHEMA || CONFIG_SCHEMA;
        const meta = (source.embedding_models || {})[els.embedModel.value] || {};
        const dimEl = document.getElementById("meta-dim");
        const sizeEl = document.getElementById("meta-size");
        
        if (dimEl) dimEl.textContent = meta.dimensions || "-";
        if (sizeEl) sizeEl.textContent = meta.size || "-";
        updateLivePreview();
    }

    function buildChunkingParams() {
        const strategy = els.chunkStrategy.value;
        const source = BACKEND_SCHEMA || CONFIG_SCHEMA;
        const params = ((source.chunking_strategies || {})[strategy] || {}).params || {};
        
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
                select.dataset.param = key; 
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
                slider.dataset.param = key; 
                slider.min = data.min; slider.max = data.max;
                
                const defaultStep = Number.isInteger(data.min) && Number.isInteger(data.max) ? 1 : 0.1;
                slider.step = data.step || defaultStep;
                slider.value = data.default;
                
                slider.addEventListener("input", (e) => {
                    const rawValue = parseFloat(e.target.value);
                    valDisplay.textContent = Number.isInteger(rawValue) ? rawValue : rawValue.toFixed(2);
                    updateLivePreview();
                });
                wrapper.append(header, slider);
                activeChunkingParamsState[key] = () => parseFloat(slider.value);
            }
            els.chunkParams.appendChild(wrapper);
        });
        updateLivePreview();
    }

    function getProviderModelsFromSchema(provider) {
        const source = BACKEND_SCHEMA || CONFIG_SCHEMA;
        const providerConfig = source?.llm_providers?.[provider];
        const models = providerConfig?.models;
        if (Array.isArray(models)) return models;
        if (models && typeof models === "object") return Object.keys(models);
        return [];
    }

    function setLlmModelOptions(models, preferredModel) {
        if (!els.llmModel) return;
        const previous = preferredModel || els.llmModel.value;
        els.llmModel.innerHTML = "";
        models.forEach((model) => {
            els.llmModel.add(new Option(model, model));
        });
        if (previous && models.includes(previous)) {
            els.llmModel.value = previous;
        } else if (models.length > 0) {
            els.llmModel.value = models[0];
        }
    }

    async function updateProvider(preferredModel = null) {
        const provider = els.llmProvider.value;
        const schemaModels = getProviderModelsFromSchema(provider);
        setLlmModelOptions(schemaModels, preferredModel);
        updateLivePreview();
        await fetchAvailableModels(provider, preferredModel);
    }

    function updateSliders() {
        const kVal = document.getElementById("k-val");
        const topVal = document.getElementById("top-n-val");
        const bm25Val = document.getElementById("bm25-val");

        if (kVal) kVal.textContent = els.kCand.value;
        if (topVal) topVal.textContent = els.topN.value;
        if (bm25Val) bm25Val.textContent = parseFloat(els.bm25.value).toFixed(2);
        
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
            retriever: {
                use_multi_query: els.multiQuery.checked,
                use_reranker: els.reranker.checked,
                k_candidates: parseInt(els.kCand.value, 10) || 10,
                top_n_rerank: parseInt(els.topN.value, 10) || 3,
                bm25_weight: parseFloat(els.bm25.value) || 0.4
            }
        };
    }

    function updateLivePreview() {
        const payload = generatePayload();
        if (els.jsonPreview) {
            els.jsonPreview.textContent = JSON.stringify(payload, null, 2);
        }
    }

    function loadDefaults() {
        const defaults = (BACKEND_SCHEMA && BACKEND_SCHEMA.default_config) || CONFIG_SCHEMA.default_config || {
            embedding_model: "bge-large",
            chunking_strategy: "recursive",
            llm_provider: "groq",
            llm_model: "llama-3.3-70b-versatile",
            retriever: { k_candidates: 10, top_n_rerank: 3, bm25_weight: 0.4, use_multi_query: true, use_reranker: true }
        };

        els.embedModel.value = defaults.embedding_model;
        els.chunkStrategy.value = defaults.chunking_strategy;
        els.llmProvider.value = defaults.llm_provider;
        els.multiQuery.checked = defaults.retriever?.use_multi_query ?? true;
        els.reranker.checked = defaults.retriever?.use_reranker ?? true;
        els.kCand.value = defaults.retriever?.k_candidates ?? 10;
        els.topN.value = defaults.retriever?.top_n_rerank ?? 3;
        els.bm25.value = defaults.retriever?.bm25_weight ?? 0.4;

        updateEmbedMeta();
        buildChunkingParams();
        updateProvider(defaults.llm_model);
        updateSliders();
    }

    // Bind Core Events
    els.embedModel.addEventListener("change", updateEmbedMeta);
    els.chunkStrategy.addEventListener("change", buildChunkingParams);
    els.llmProvider.addEventListener("change", updateProvider);
    els.llmModel.addEventListener("change", updateLivePreview);
    els.multiQuery.addEventListener("change", updateLivePreview);
    els.reranker.addEventListener("change", updateLivePreview);
    els.kCand.addEventListener("input", updateSliders);
    els.topN.addEventListener("input", updateSliders);
    els.bm25.addEventListener("input", updateSliders);

    document.getElementById("btn-copy")?.addEventListener("click", () => {
        navigator.clipboard.writeText(JSON.stringify(generatePayload(), null, 2));
        showToast("JSON payload copied to clipboard.");
    });

    document.getElementById("btn-reset-defaults")?.addEventListener("click", async () => {
        const userId = getCurrentUserId();
        if (!confirm(`Reset all settings to defaults for ${userId}?`)) return;
        try {
            const res = await fetch(buildConfigUrl(`/config/${encodeURIComponent(userId)}/reset`), { method: "POST" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast(`Configuration reset for ${userId}`);
            await loadUserConfig();
        } catch (err) {
            showToast("Failed to reset configuration.", true);
        }
    });

    document.getElementById("btn-save-config")?.addEventListener("click", async () => {
        const userId = getCurrentUserId();
        const payload = generatePayload();
        try {
            const res = await fetch(buildConfigUrl(`/config/${encodeURIComponent(userId)}`), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if(!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.detail || `HTTP ${res.status}`);
            }
            showToast(`Configuration saved for ${userId}`);
        } catch (err) {
            showToast("Failed to save configuration.", true);
            console.error(err);
        }
    });

    if (els.userIdInput) {
        els.userIdInput.addEventListener("change", async () => {
            const newId = els.userIdInput.value.trim();
            if (!newId) return;
            setUserId(newId);
            await loadUserConfig();
        });
    }

    async function fetchConfigOptions() {
        try {
            // Removed fragile AbortSignal.timeout API 
            const res = await fetch(buildConfigUrl("/config/options"));
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            BACKEND_SCHEMA = await res.json();
            return BACKEND_SCHEMA;
        } catch (err) {
            console.warn("Failed to fetch options from backend, using local schema. Ensure backend is running.", err);
            BACKEND_SCHEMA = null;
            return null;
        }
    }

    async function loadUserConfig() {
        const userId = getCurrentUserId();
        try {
            const res = await fetch(buildConfigUrl(`/config/${encodeURIComponent(userId)}`));
            if (!res.ok) {
                if (res.status === 404) {
                    // Normal behavior for a first-time user
                    return false; 
                }
                throw new Error(`HTTP ${res.status}`);
            }
            const body = await res.json();
            const config = body.config || body;
            if (!config) return false;

            if (config.embedding_model && els.embedModel) els.embedModel.value = config.embedding_model;
            
            if (config.chunking_strategy && els.chunkStrategy) {
                els.chunkStrategy.value = config.chunking_strategy;
                buildChunkingParams();
                
                if (config.chunking_params) {
                    Object.entries(config.chunking_params).forEach(([k, v]) => {
                        const el = els.chunkParams.querySelector(`[data-param="${k}"]`);
                        if (el) {
                            el.value = v;
                            el.dispatchEvent(new Event('input'));
                        }
                    });
                }
            }
            
            if (config.llm_provider && els.llmProvider) {
                els.llmProvider.value = config.llm_provider;
                await updateProvider(config.llm_model);
            }
            
            if (config.retriever) {
                if (els.multiQuery) els.multiQuery.checked = config.retriever.use_multi_query ?? true;
                if (els.reranker) els.reranker.checked = config.retriever.use_reranker ?? true;
                if (els.kCand) els.kCand.value = config.retriever.k_candidates ?? els.kCand.value;
                if (els.topN) els.topN.value = config.retriever.top_n_rerank ?? els.topN.value;
                if (els.bm25) els.bm25.value = config.retriever.bm25_weight ?? els.bm25.value;
                updateSliders();
            }
            
            updateLivePreview();
            return true;
        } catch (err) {
            console.error("Failed to load user config", err);
            return false;
        }
    }

    async function fetchAvailableModels(requestedProvider = null, preferredModel = null) {
        const userId = getCurrentUserId();
        const provider = requestedProvider || els.llmProvider?.value;
        if (!provider) return;
        try {
            // Replaced fragile new URL() constructor with safe string concatenation
            const url = buildConfigUrl(`/config/${encodeURIComponent(userId)}/llm-models?provider=${encodeURIComponent(provider)}`);
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data.provider && data.provider !== provider) return null;

            const models = Array.isArray(data.models) ? data.models : Object.keys(data.available_models || {});
            setLlmModelOptions(models, preferredModel);
            updateLivePreview();
            return data;
        } catch (err) {
            console.warn("Failed to fetch available models", err);
            return null;
        }
    }

    async function boot() {
        // Priority 1: Check what is hardcoded in the HTML input field right now
        let resolvedId = "user_1";
        const inputVal = els.userIdInput?.value.trim();
        const localVal = localStorage.getItem("user_id");

        if (inputVal && inputVal !== "user_1") {
            resolvedId = inputVal;
        } else if (localVal) {
            resolvedId = localVal;
        }
        
        // Lock ID across the UI immediately
        setUserId(resolvedId);

        // Fetch schema -> Build UI -> Load User Data -> Fallback to Defaults if none exist
        await fetchConfigOptions(); 
        initStaticOptions();
        
        const hasSavedConfig = await loadUserConfig();
        if (!hasSavedConfig) {
            loadDefaults();
        }
    }

    boot();
});