document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL_KEY = 'hybrid-rag-api-base-url';
    const USER_ID_KEY = 'hybrid-rag-config-user-id';

    function getDefaultApiBaseUrl() {
        if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
            return window.location.origin;
        }
        return 'http://localhost:8000';
    }

    const state = {
        options: null,
        config: null,
        userId: localStorage.getItem(USER_ID_KEY) || 'user_1',
        apiBaseUrl: localStorage.getItem(API_BASE_URL_KEY) || getDefaultApiBaseUrl(),
        chunkingDrafts: {},
        modelDrafts: {}
    };

    const statusEl = document.getElementById('config-status');
    const toastEl = document.getElementById('toast');
    const previewEl = document.getElementById('config-preview');
    const userIdInput = document.getElementById('user-id-input');
    const apiBaseUrlInput = document.getElementById('api-base-url');
    const btnLoad = document.getElementById('btn-load');
    const btnSave = document.getElementById('btn-save');
    const btnReset = document.getElementById('btn-reset');
    const btnUseDefaultApi = document.getElementById('btn-use-default-api');
    const btnNotifications = document.getElementById('btn-notifications');

    const embeddingSelect = document.getElementById('embedding-model');
    const embeddingHelp = document.getElementById('embedding-help');
    const chunkingSelect = document.getElementById('chunking-strategy');
    const chunkingHelp = document.getElementById('chunking-help');
    const chunkingSummary = document.getElementById('chunking-summary');
    const chunkingParams = document.getElementById('chunking-params');
    const providerSelect = document.getElementById('llm-provider');
    const providerHelp = document.getElementById('provider-help');
    const modelSelect = document.getElementById('llm-model');
    const modelHelp = document.getElementById('model-help');
    const kCandidatesInput = document.getElementById('k-candidates');
    const kCandidatesHelp = document.getElementById('k-candidates-help');
    const topNRerankInput = document.getElementById('top-n-rerank');
    const topNRerankHelp = document.getElementById('top-n-rerank-help');
    const bm25WeightInput = document.getElementById('bm25-weight');
    const bm25WeightHelp = document.getElementById('bm25-weight-help');
    const useMultiQueryInput = document.getElementById('use-multi-query');
    const useRerankerInput = document.getElementById('use-reranker');

    function showToast(message) {
        toastEl.textContent = message;
        toastEl.classList.remove('hidden');
        window.clearTimeout(showToast.timer);
        showToast.timer = window.setTimeout(() => toastEl.classList.add('hidden'), 1800);
    }

    function setStatus(message, kind = 'available') {
        statusEl.className = `status-banner ${kind}`;
        statusEl.textContent = message;
    }

    function setBusy(isBusy) {
        [btnLoad, btnSave, btnReset, btnUseDefaultApi].forEach((button) => {
            if (button) {
                button.disabled = isBusy;
            }
        });
        document.querySelector('.settings-card.full-width')?.classList.toggle('is-loading', isBusy);
    }

    function apiUrl(path) {
        const base = (state.apiBaseUrl || getDefaultApiBaseUrl()).replace(/\/+$/, '');
        return `${base}${path}`;
    }

    async function requestJson(path, options = {}) {
        const response = await fetch(apiUrl(path), {
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            ...options
        });

        const contentType = response.headers.get('content-type') || '';
        const payload = contentType.includes('application/json') ? await response.json() : await response.text();

        if (!response.ok) {
            const detail = payload && typeof payload === 'object' && 'detail' in payload ? payload.detail : payload;
            throw new Error(detail || `Request failed with ${response.status}`);
        }

        return payload;
    }

    function setSelectOptions(selectEl, entries, selectedValue, formatter) {
        selectEl.innerHTML = '';
        const keys = Object.keys(entries || {});

        keys.forEach((key) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = formatter(key, entries[key]);
            if (key === selectedValue) {
                option.selected = true;
            }
            selectEl.appendChild(option);
        });

        if (!selectEl.value && keys.length) {
            selectEl.value = keys[0];
        }
    }

    function captureChunkingDraft(strategy) {
        const draft = {};
        chunkingParams.querySelectorAll('[data-param-key]').forEach((input) => {
            const key = input.dataset.paramKey;
            if (!key) {
                return;
            }
            if (input.type === 'checkbox') {
                draft[key] = input.checked;
            } else if (input.tagName === 'SELECT') {
                draft[key] = input.value;
            } else if (input.type === 'number') {
                draft[key] = input.value === '' ? null : Number(input.value);
            } else {
                draft[key] = input.value;
            }
        });
        state.chunkingDrafts[strategy] = draft;
    }

    function captureModelDraft(provider) {
        state.modelDrafts[provider] = modelSelect.value;
    }

    function syncMetadataDisplays() {
        const embedding = state.options?.embedding_models?.[embeddingSelect.value];
        const chunking = state.options?.chunking_strategies?.[chunkingSelect.value];
        const provider = state.options?.llm_providers?.[providerSelect.value];
        const model = provider?.models?.[modelSelect.value];
        const retriever = state.options?.retriever_options || {};

        embeddingHelp.textContent = embedding ? `${embedding.description} | ${embedding.dimensions} dims | ${embedding.speed} | ${embedding.accuracy}` : '';
        chunkingHelp.textContent = chunking ? `${chunking.description} | ${chunking.speed} | ${chunking.accuracy}` : '';
        chunkingSummary.textContent = chunking ? `Selected: ${chunkingSelect.value}` : '';
        providerHelp.textContent = provider ? `${provider.description}${provider.requires_key ? ` | requires ${provider.get_key_url || 'an API key'}` : ' | no API key required'}` : '';
        modelHelp.textContent = model ? `${model.description} | ${model.speed} | ${model.accuracy}` : '';
        kCandidatesHelp.textContent = retriever.k_candidates ? `${retriever.k_candidates.description} (${retriever.k_candidates.min} - ${retriever.k_candidates.max})` : '';
        topNRerankHelp.textContent = retriever.top_n_rerank ? `${retriever.top_n_rerank.description} (${retriever.top_n_rerank.min} - ${retriever.top_n_rerank.max})` : '';
        bm25WeightHelp.textContent = retriever.bm25_weight ? `${retriever.bm25_weight.description} (0.0 - 1.0)` : '';
    }

    function syncApiUi() {
        apiBaseUrlInput.value = state.apiBaseUrl;
        const defaultApiBaseUrl = getDefaultApiBaseUrl();
        btnUseDefaultApi.classList.toggle('is-active', state.apiBaseUrl === defaultApiBaseUrl);
    }

    function renderChunkingParams(strategy, configValues = {}) {
        const strategyInfo = state.options?.chunking_strategies?.[strategy];
        const params = strategyInfo?.params || {};
        chunkingParams.innerHTML = '';

        Object.entries(params).forEach(([key, schema]) => {
            const card = document.createElement('div');
            card.className = 'param-card';

            const label = document.createElement('label');
            label.className = 'param-label';
            label.setAttribute('for', `chunking-${key}`);
            label.textContent = key;

            const hint = document.createElement('p');
            hint.className = 'setting-desc';
            hint.textContent = schema.description || '';

            const currentValue = key in configValues ? configValues[key] : schema.default;
            let input;

            if (Array.isArray(schema.options)) {
                input = document.createElement('select');
                input.className = 'form-select w-full';
                input.id = `chunking-${key}`;
                input.dataset.paramKey = key;

                schema.options.forEach((optionValue) => {
                    const option = document.createElement('option');
                    option.value = optionValue;
                    option.textContent = optionValue;
                    if (optionValue === currentValue) {
                        option.selected = true;
                    }
                    input.appendChild(option);
                });
            } else {
                input = document.createElement('input');
                input.className = 'form-input w-full';
                input.id = `chunking-${key}`;
                input.dataset.paramKey = key;
                input.type = 'number';
                input.step = Number.isInteger(schema.default) ? '1' : '0.1';
                if (schema.min !== undefined) {
                    input.min = schema.min;
                }
                if (schema.max !== undefined) {
                    input.max = schema.max;
                }
                input.value = currentValue ?? '';
            }

            card.appendChild(label);
            card.appendChild(input);
            card.appendChild(hint);
            chunkingParams.appendChild(card);
        });

        if (!Object.keys(params).length) {
            const emptyState = document.createElement('p');
            emptyState.className = 'setting-desc';
            emptyState.textContent = 'This strategy does not expose extra parameters.';
            chunkingParams.appendChild(emptyState);
        }

        syncMetadataDisplays();
    }

    function renderModelOptions(provider, selectedModel) {
        const providerInfo = state.options?.llm_providers?.[provider];
        const models = providerInfo?.models || {};
        setSelectOptions(modelSelect, models, selectedModel, (key, value) => `${key} - ${value.description}`);

        if (!modelSelect.value) {
            const keys = Object.keys(models);
            if (keys.length) {
                modelSelect.value = keys[0];
            }
        }

        syncMetadataDisplays();
    }

    function renderTopLevelOptions(config) {
        setSelectOptions(embeddingSelect, state.options.embedding_models, config.embedding_model, (key, value) => `${key} - ${value.description}`);
        setSelectOptions(chunkingSelect, state.options.chunking_strategies, config.chunking_strategy, (key, value) => `${key} - ${value.description}`);
        setSelectOptions(providerSelect, state.options.llm_providers, config.llm_provider, (key, value) => `${key} - ${value.description}`);

        const retrieverConfig = config.retriever || state.options.default_config.retriever;

        kCandidatesInput.min = state.options.retriever_options.k_candidates.min;
        kCandidatesInput.max = state.options.retriever_options.k_candidates.max;
        kCandidatesInput.value = retrieverConfig.k_candidates;

        topNRerankInput.min = state.options.retriever_options.top_n_rerank.min;
        topNRerankInput.max = state.options.retriever_options.top_n_rerank.max;
        topNRerankInput.value = retrieverConfig.top_n_rerank;

        bm25WeightInput.min = state.options.retriever_options.bm25_weight.min;
        bm25WeightInput.max = state.options.retriever_options.bm25_weight.max;
        bm25WeightInput.step = '0.1';
        bm25WeightInput.value = retrieverConfig.bm25_weight;

        useMultiQueryInput.checked = retrieverConfig.use_multi_query;
        useRerankerInput.checked = retrieverConfig.use_reranker;

        state.chunkingDrafts[config.chunking_strategy] = {
            ...(state.chunkingDrafts[config.chunking_strategy] || {}),
            ...(config.chunking_params || {})
        };
        state.modelDrafts[config.llm_provider] = config.llm_model;

        renderChunkingParams(config.chunking_strategy, state.chunkingDrafts[config.chunking_strategy] || config.chunking_params || {});
        renderModelOptions(config.llm_provider, state.modelDrafts[config.llm_provider] || config.llm_model);
        syncMetadataDisplays();
    }

    function buildPayload() {
        const params = {};
        chunkingParams.querySelectorAll('[data-param-key]').forEach((input) => {
            const key = input.dataset.paramKey;
            if (!key) {
                return;
            }
            if (input.tagName === 'SELECT') {
                params[key] = input.value;
                return;
            }

            if (input.value === '') {
                return;
            }
            params[key] = input.step === '1' ? parseInt(input.value, 10) : parseFloat(input.value);
        });

        return {
            embedding_model: embeddingSelect.value,
            chunking_strategy: chunkingSelect.value,
            chunking_params: params,
            llm_provider: providerSelect.value,
            llm_model: modelSelect.value,
            retriever: {
                k_candidates: parseInt(kCandidatesInput.value, 10),
                top_n_rerank: parseInt(topNRerankInput.value, 10),
                bm25_weight: parseFloat(bm25WeightInput.value),
                use_multi_query: useMultiQueryInput.checked,
                use_reranker: useRerankerInput.checked
            }
        };
    }

    function updatePreview() {
        previewEl.textContent = JSON.stringify({
            user_id: state.userId,
            ...buildPayload()
        }, null, 2);
    }

    function syncDraftsFromInputs() {
        captureChunkingDraft(chunkingSelect.value);
        captureModelDraft(providerSelect.value);
        updatePreview();
        syncMetadataDisplays();
    }

    async function loadConfig(userId) {
        state.userId = userId;
        localStorage.setItem(USER_ID_KEY, userId);
        userIdInput.value = userId;
        setStatus(`Loading configuration for ${userId}...`, 'available');
        setBusy(true);

        try {
            const response = await requestJson(`/config/${encodeURIComponent(userId)}`);
            state.config = response.config || state.options.default_config;
            renderTopLevelOptions(state.config);
            updatePreview();
            setStatus(`Loaded configuration for ${userId}.`, 'available');
            showToast(`Loaded ${userId}.`);
        } catch (error) {
            console.error(error);
            setStatus(`Unable to load configuration: ${error.message}`, 'unavailable');
            showToast(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function saveConfig() {
        const userId = userIdInput.value.trim() || state.userId;
        const payload = buildPayload();

        setStatus(`Saving configuration for ${userId}...`, 'available');
        setBusy(true);
        try {
            const response = await requestJson(`/config/${encodeURIComponent(userId)}`, {
                method: 'PATCH',
                body: JSON.stringify(payload)
            });

            state.userId = userId;
            state.config = response.config;
            if (Array.isArray(response.warnings) && response.warnings.length) {
                setStatus(response.warnings[0], 'unavailable');
            } else {
                setStatus(`Configuration saved for ${userId}.`, 'available');
            }
            updatePreview();
            showToast('Configuration saved.');
        } catch (error) {
            console.error(error);
            setStatus(`Save failed: ${error.message}`, 'unavailable');
            showToast(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function resetConfig() {
        const userId = userIdInput.value.trim() || state.userId;
        if (!window.confirm(`Reset configuration for ${userId} to defaults?`)) {
            return;
        }

        setStatus(`Resetting ${userId} to defaults...`, 'available');
        setBusy(true);
        try {
            const response = await requestJson(`/config/${encodeURIComponent(userId)}/reset`, {
                method: 'POST'
            });

            state.userId = userId;
            state.config = response.config;
            renderTopLevelOptions(response.config);
            updatePreview();
            setStatus(response.message || 'Configuration reset to defaults.', 'available');
            showToast('Defaults restored.');
        } catch (error) {
            console.error(error);
            setStatus(`Reset failed: ${error.message}`, 'unavailable');
            showToast(error.message);
        } finally {
            setBusy(false);
        }
    }

    function wireDynamicEvents() {
        embeddingSelect.addEventListener('change', syncDraftsFromInputs);
        providerSelect.addEventListener('change', () => {
            captureModelDraft(providerSelect.value);
            renderModelOptions(providerSelect.value, state.modelDrafts[providerSelect.value] || Object.keys(state.options.llm_providers[providerSelect.value].models)[0]);
            syncDraftsFromInputs();
        });
        chunkingSelect.addEventListener('change', () => {
            captureChunkingDraft(chunkingSelect.value);
            renderChunkingParams(chunkingSelect.value, state.chunkingDrafts[chunkingSelect.value] || {});
            updatePreview();
        });
        modelSelect.addEventListener('change', syncDraftsFromInputs);
        [kCandidatesInput, topNRerankInput, bm25WeightInput, useMultiQueryInput, useRerankerInput].forEach((input) => {
            input.addEventListener('input', updatePreview);
            input.addEventListener('change', updatePreview);
        });
        chunkingParams.addEventListener('input', () => {
            captureChunkingDraft(chunkingSelect.value);
            updatePreview();
        });
        chunkingParams.addEventListener('change', () => {
            captureChunkingDraft(chunkingSelect.value);
            updatePreview();
        });
    }

    async function bootstrap() {
        try {
            syncApiUi();
            state.options = await requestJson('/config/options');
            userIdInput.value = state.userId;
            const defaultConfig = state.options.default_config;
            renderTopLevelOptions(defaultConfig);
            updatePreview();
            await loadConfig(state.userId);
        } catch (error) {
            console.error(error);
            setStatus(`Unable to initialize settings: ${error.message}`, 'unavailable');
            previewEl.textContent = '';
            showToast(error.message);
        }
    }

    btnLoad.addEventListener('click', () => {
        const userId = userIdInput.value.trim();
        if (!userId) {
            setStatus('Enter a user ID first.', 'unavailable');
            return;
        }
        loadConfig(userId);
    });
    btnSave.addEventListener('click', saveConfig);
    btnReset.addEventListener('click', resetConfig);
    btnNotifications.addEventListener('click', () => showToast('No new notifications.'));
    apiBaseUrlInput.addEventListener('change', () => {
        const nextValue = apiBaseUrlInput.value.trim() || getDefaultApiBaseUrl();
        state.apiBaseUrl = nextValue;
        localStorage.setItem(API_BASE_URL_KEY, nextValue);
        syncApiUi();
        showToast(`API endpoint set to ${nextValue}`);
    });
    btnUseDefaultApi.addEventListener('click', () => {
        state.apiBaseUrl = getDefaultApiBaseUrl();
        localStorage.setItem(API_BASE_URL_KEY, state.apiBaseUrl);
        syncApiUi();
        showToast('Using the default API endpoint.');
    });
    userIdInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            loadConfig(userIdInput.value.trim() || state.userId);
        }
    });

    wireDynamicEvents();
    bootstrap();
});
