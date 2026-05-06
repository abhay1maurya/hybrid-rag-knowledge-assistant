document.addEventListener("DOMContentLoaded", () => {
    const SETTINGS_KEY = 'hybrid-rag-settings-v1';

    const tempSlider = document.getElementById('temp-slider');
    const tempDisplay = document.getElementById('temp-display');
    const radioInputs = document.querySelectorAll('input[name="search-mode"]');
    const hybridLabel = document.getElementById('strategy-hybrid');
    const vectorLabel = document.getElementById('strategy-vector');
    const themeBtns = document.querySelectorAll('.theme-btn');
    const htmlTag = document.documentElement;
    const btnSave = document.getElementById('btn-save');
    const btnDiscard = document.getElementById('btn-discard');
    const btnNotifications = document.getElementById('btn-notifications');
    const btnUpgrade = document.getElementById('btn-upgrade');
    const btnChangePhoto = document.getElementById('btn-change-photo');
    const profileUpload = document.getElementById('profile-upload');

    const runtimeMode = document.getElementById('runtime-mode');
    const onlineAvailable = document.getElementById('online-available');
    const offlineAvailable = document.getElementById('offline-available');
    const runtimeStatus = document.getElementById('runtime-status');
    const onlineModel = document.getElementById('online-model');
    const offlineModel = document.getElementById('offline-model');
    const onlineModelWrap = document.getElementById('online-model-wrap');
    const offlineModelWrap = document.getElementById('offline-model-wrap');
    const maxSources = document.getElementById('max-sources');
    const saveHistory = document.getElementById('save-history');

    function showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 1800);
    }

    function setStrategySelection(value) {
        if (value === 'hybrid') {
            hybridLabel.classList.add('active');
            vectorLabel.classList.remove('active');
        } else {
            hybridLabel.classList.remove('active');
            vectorLabel.classList.add('active');
        }
    }

    function setActiveThemeBtn(selectedTheme) {
        themeBtns.forEach(btn => {
            const indicator = btn.querySelector('.indicator');
            const isSelected = btn.getAttribute('data-theme') === selectedTheme;

            if (isSelected) {
                btn.classList.add('active');
                indicator.innerHTML = '<span class="material-symbols-outlined text-[10px] text-white font-bold">check</span>';
            } else {
                btn.classList.remove('active');
                indicator.innerHTML = '';
            }
        });
    }

    function applyTheme(theme) {
        if (theme === 'light') {
            htmlTag.classList.remove('dark');
        } else if (theme === 'dark') {
            htmlTag.classList.add('dark');
        } else {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                htmlTag.classList.add('dark');
            } else {
                htmlTag.classList.remove('dark');
            }
        }
        setActiveThemeBtn(theme);
    }

    function updateRuntimeStatus() {
        const mode = runtimeMode.value;
        const online = onlineAvailable.checked;
        const offline = offlineAvailable.checked;
        const available = mode === 'hybrid' ? (online || offline) : (mode === 'online' ? online : offline);

        if (available) {
            runtimeStatus.className = 'status-banner available';
            runtimeStatus.textContent = mode.charAt(0).toUpperCase() + mode.slice(1) + ' mode is available.';
        } else {
            runtimeStatus.className = 'status-banner unavailable';
            runtimeStatus.textContent = mode.charAt(0).toUpperCase() + mode.slice(1) + ' mode is unavailable. Enable a compatible runtime.';
        }

        const showOnline = mode === 'online' || mode === 'hybrid';
        const showOffline = mode === 'offline' || mode === 'hybrid';
        onlineModelWrap.classList.toggle('hidden', !showOnline);
        offlineModelWrap.classList.toggle('hidden', !showOffline);
        onlineModel.disabled = !online;
        offlineModel.disabled = !offline;
    }

    function collectSettings() {
        return {
            runtimeMode: runtimeMode.value,
            onlineAvailable: onlineAvailable.checked,
            offlineAvailable: offlineAvailable.checked,
            onlineModel: onlineModel.value,
            offlineModel: offlineModel.value,
            searchMode: document.querySelector('input[name="search-mode"]:checked').value,
            primaryModel: document.getElementById('model-select').value,
            temperature: document.getElementById('temp-slider').value,
            maxSources: maxSources.value,
            saveHistory: saveHistory.checked,
            name: document.getElementById('input-name').value,
            email: document.getElementById('input-email').value,
            title: document.getElementById('input-title').value,
            department: document.getElementById('input-dept').value,
            theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
        };
    }

    function applySettings(settings) {
        runtimeMode.value = settings.runtimeMode || 'hybrid';
        onlineAvailable.checked = settings.onlineAvailable !== false;
        offlineAvailable.checked = settings.offlineAvailable !== false;
        onlineModel.value = settings.onlineModel || 'gpt-4.1-online';
        offlineModel.value = settings.offlineModel || 'llama-3.1-8b-local';

        const searchMode = settings.searchMode || 'hybrid';
        const modeRadio = document.querySelector('input[name="search-mode"][value="' + searchMode + '"]');
        if (modeRadio) {
            modeRadio.checked = true;
            setStrategySelection(searchMode);
        }

        document.getElementById('model-select').value = settings.primaryModel || 'gpt-4o';
        document.getElementById('temp-slider').value = settings.temperature || 70;
        tempDisplay.textContent = ((document.getElementById('temp-slider').value / 100).toFixed(1));
        maxSources.value = settings.maxSources || '5';
        saveHistory.checked = settings.saveHistory !== false;
        document.getElementById('input-name').value = settings.name || 'Alexander Wright';
        document.getElementById('input-email').value = settings.email || 'alexander.w@enterprise.ai';
        document.getElementById('input-title').value = settings.title || 'Knowledge Manager';
        document.getElementById('input-dept').value = settings.department || 'Information Systems';
        applyTheme(settings.theme || 'dark');
        updateRuntimeStatus();
    }

    function loadSavedSettings() {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (raw) {
                applySettings(JSON.parse(raw));
            } else {
                setStrategySelection('hybrid');
                applyTheme('dark');
                updateRuntimeStatus();
            }
        } catch (err) {
            console.error('Failed to load settings', err);
            setStrategySelection('hybrid');
            applyTheme('dark');
            updateRuntimeStatus();
        }
    }

    tempSlider.addEventListener('input', (event) => {
        tempDisplay.textContent = (event.target.value / 100).toFixed(1);
    });

    radioInputs.forEach(input => {
        input.addEventListener('change', (e) => setStrategySelection(e.target.value));
    });

    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            applyTheme(btn.getAttribute('data-theme'));
        });
    });

    runtimeMode.addEventListener('change', updateRuntimeStatus);
    onlineAvailable.addEventListener('change', updateRuntimeStatus);
    offlineAvailable.addEventListener('change', updateRuntimeStatus);

    btnNotifications.addEventListener('click', () => showToast('No new notifications.'));
    btnUpgrade.addEventListener('click', () => {
        window.location.href = 'pricinglagacy.html';
    });
    btnChangePhoto.addEventListener('click', () => profileUpload.click());
    profileUpload.addEventListener('change', () => {
        if (profileUpload.files && profileUpload.files.length) {
            showToast('Profile photo selected: ' + profileUpload.files[0].name);
        }
    });

    btnSave.addEventListener('click', () => {
        const settings = collectSettings();
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

        const originalText = btnSave.innerText;
        btnSave.innerText = 'Saved!';
        btnSave.classList.add('success');

        setTimeout(() => {
            btnSave.innerText = originalText;
            btnSave.classList.remove('success');
        }, 1600);

        showToast('Settings saved successfully.');
    });

    btnDiscard.addEventListener('click', () => {
        if (confirm('Are you sure you want to discard your unsaved changes?')) {
            loadSavedSettings();
            showToast('Unsaved changes discarded.');
        }
    });

    // Initialize
    loadSavedSettings();
});