document.addEventListener("DOMContentLoaded", () => {
    // 1. Bulletproof API Base resolution (No hardcoding)
    const API = (() => {
        if (typeof window.__DOCUMIND_API_BASE__ === 'string' && window.__DOCUMIND_API_BASE__.trim() !== '') {
            return window.__DOCUMIND_API_BASE__.trim();
        }
        return 'http://localhost:8000';
    })();

    const USER_ID_KEY = "documind_user_id";

    // 2. Safely grab DOM elements after page load
    const statTotalDocs = document.getElementById("stat-total-docs");
    const statTotalChunks = document.getElementById("stat-total-chunks");
    const statDocSize = document.getElementById("stat-doc-size");
    const statIndexSize = document.getElementById("stat-index-size");
    const statDocsMeta = document.getElementById("stat-docs-meta");
    const statChunksMeta = document.getElementById("stat-chunks-meta");
    const statDocSizeMeta = document.getElementById("stat-doc-size-meta");
    const statIndexMeta = document.getElementById("stat-index-meta");

    const recentDocs = document.getElementById("recent-docs");
    const statusList = document.getElementById("statusList");
    const docTableBody = document.getElementById("docTableBody");
    const evalSummary = document.getElementById("evalSummary");

    const userIdInput = document.getElementById("user-id-input");
    const refreshBtn = document.getElementById("refresh-btn");
    const reloadBtn = document.getElementById("reload-btn");
    const uploadBtn = document.getElementById("upload-btn");
    const fileInput = document.getElementById("document-upload");

    function toast(msg) {
        const n = document.getElementById('note');
        if (!n) return;
        n.textContent = msg;
        n.classList.remove('hidden');
        setTimeout(() => n.classList.add('hidden'), 1800);
    }

    function formatNumber(value) {
        return typeof value === "number" ? value.toLocaleString() : String(value || "--");
    }

    function formatBytesKb(kb) {
        if (kb === undefined || kb === null) return "--";
        if (kb < 1024) return `${kb.toFixed(2)} KB`;
        if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(2)} MB`;
        return `${(kb / 1024 / 1024).toFixed(2)} GB`;
    }

    function formatDate(value) {
        if (!value) return "--";
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return value;
        return dt.toLocaleString();
    }

    // 3. Strict priority resolution: Thymeleaf Input > Local Storage > Default
    function getUserId() {
        const fromInput = userIdInput?.value.trim();
        const stored = localStorage.getItem(USER_ID_KEY);
        
        // Priority to what the backend injected into the HTML
        const userId = fromInput || stored || "user_1";
        
        if (userIdInput && userIdInput.value !== userId) {
            userIdInput.value = userId;
        }
        localStorage.setItem(USER_ID_KEY, userId);
        return userId;
    }

    async function fetchJson(url, options) {
        const res = await fetch(url, options);
        const data = await res.json();
        if (!res.ok) {
            const detail = data?.detail || data?.message || "Request failed";
            throw new Error(detail);
        }
        return data;
    }

    function renderRecentDocuments(documents) {
        if (!recentDocs) return;
        if (!documents.length) {
            recentDocs.innerHTML = '<li class="empty-hint">No documents uploaded yet.</li>';
            return;
        }
        recentDocs.innerHTML = documents.slice(0, 5).map((doc) => `
            <li>✓ ${doc.filename} • ${formatDate(doc.uploaded_at)} • ${formatBytesKb(doc.file_size_kb)}</li>
        `).join("");
    }

    function renderDocumentTable(documents) {
        if (!docTableBody) return;
        if (!documents.length) {
            docTableBody.innerHTML = '<tr><td colspan="5" class="empty-hint">No documents available.</td></tr>';
            return;
        }

        docTableBody.innerHTML = documents.map((doc) => `
            <tr>
                <td><strong>${doc.filename}</strong></td>
                <td>${formatDate(doc.uploaded_at)}</td>
                <td>${formatNumber(doc.chunks_created)}</td>
                <td>${formatBytesKb(doc.file_size_kb)}</td>
                <td>${doc.status || "indexed"}</td>
            </tr>
        `).join("");
    }

    function renderStatusBreakdown(documents) {
        if (!statusList) return;
        if (!documents.length) {
            statusList.innerHTML = '<li class="empty-hint">No document status data yet.</li>';
            return;
        }

        const counts = documents.reduce((acc, doc) => {
            const key = (doc.status || "indexed").toLowerCase();
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        const total = documents.length;
        const items = Object.entries(counts).map(([status, count]) => {
            const share = Math.round((count / total) * 100);
            return `
                <li>
                    <div class="stat-header">
                        <span>${status}</span>
                        <span>${count}</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${share}%"></div>
                    </div>
                </li>
            `;
        });
        statusList.innerHTML = items.join("");
    }

    function renderEvaluationSummary(summary) {
        if (!evalSummary) return;
        if (!summary) {
            evalSummary.innerHTML = '<p class="empty-hint">No evaluation history yet.</p>';
            return;
        }

        const latest = summary.latest_scores || {};
        const items = Object.entries(latest).map(([metric, value]) => `
            <div class="eval-item">
                <span>${metric.replace(/_/g, " ")}</span>
                <strong>${typeof value === "number" ? value.toFixed(4) : value}</strong>
            </div>
        `).join("");

        evalSummary.innerHTML = `
            <div class="eval-meta">
                <p><strong>Total runs:</strong> ${summary.total_runs}</p>
                <p><strong>Pass threshold:</strong> ${summary.pass_threshold}</p>
            </div>
            <div class="eval-grid">${items || "<p class=\"empty-hint\">No scores available.</p>"}</div>
        `;
    }

    async function loadStats(userId) {
        try {
            const stats = await fetchJson(`${API}/documents/${encodeURIComponent(userId)}/stats`);
            if (statTotalDocs) statTotalDocs.textContent = formatNumber(stats.total_documents);
            if (statTotalChunks) statTotalChunks.textContent = formatNumber(stats.total_chunks);
            if (statDocSize) statDocSize.textContent = formatBytesKb(stats.total_pdf_size_kb || 0);
            if (statIndexSize) statIndexSize.textContent = formatBytesKb(stats.index_size_kb || 0);
            if (statDocsMeta) statDocsMeta.textContent = `User: ${stats.user_id}`;
            if (statChunksMeta) statChunksMeta.textContent = `Index exists: ${stats.index_exists ? "yes" : "no"}`;
            if (statDocSizeMeta) statDocSizeMeta.textContent = "Total uploaded size";
            if (statIndexMeta) statIndexMeta.textContent = stats.index_exists ? "Index ready" : "No index yet";
        } catch (err) {
            if (statTotalDocs) statTotalDocs.textContent = "--";
            if (statTotalChunks) statTotalChunks.textContent = "--";
            if (statDocSize) statDocSize.textContent = "--";
            if (statIndexSize) statIndexSize.textContent = "--";
            if (statDocsMeta) statDocsMeta.textContent = "";
            if (statChunksMeta) statChunksMeta.textContent = "";
            if (statDocSizeMeta) statDocSizeMeta.textContent = "";
            if (statIndexMeta) statIndexMeta.textContent = "";
            toast(`Failed to load stats: ${err.message}`);
        }
    }

    async function loadDocuments(userId) {
        try {
            const data = await fetchJson(`${API}/documents/${encodeURIComponent(userId)}`);
            const documents = data.documents || [];
            renderRecentDocuments(documents);
            renderDocumentTable(documents);
            renderStatusBreakdown(documents);
        } catch (err) {
            if (recentDocs) recentDocs.innerHTML = '<li class="empty-hint">Unable to load documents.</li>';
            if (docTableBody) docTableBody.innerHTML = '<tr><td colspan="5" class="empty-hint">Unable to load documents.</td></tr>';
            if (statusList) statusList.innerHTML = '<li class="empty-hint">Unable to load document status.</li>';
            toast(`Failed to load documents: ${err.message}`);
        }
    }

    async function loadEvaluation(userId) {
        try {
            const summary = await fetchJson(`${API}/eval/${encodeURIComponent(userId)}/summary`);
            renderEvaluationSummary(summary);
        } catch (err) {
            renderEvaluationSummary(null);
        }
    }

    async function uploadFiles(files) {
        if (!files.length) return;
        const userId = getUserId();

        for (const file of files) {
            const form = new FormData();
            form.append("user_id", userId);
            form.append("file", file);
            try {
                toast(`Uploading: ${file.name}...`);
                const data = await fetchJson(`${API}/upload`, { method: "POST", body: form });
                toast(data.message || "Upload complete.");
            } catch (err) {
                toast(`Upload failed: ${err.message}`);
            }
        }

        await refreshData();
    }

    async function refreshData() {
        const userId = getUserId();
        await Promise.all([
            loadStats(userId),
            loadDocuments(userId),
            loadEvaluation(userId)
        ]);
    }

    // 4. Bind Events Safely
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", (event) => {
            const files = Array.from(event.target.files || []);
            if (files.length) uploadFiles(files);
            fileInput.value = ""; // Reset input so same file can be uploaded again if needed
        });
    }

    if (refreshBtn) refreshBtn.addEventListener("click", refreshData);
    if (reloadBtn) reloadBtn.addEventListener("click", refreshData);
    if (userIdInput) {
        userIdInput.addEventListener("change", refreshData);
        userIdInput.addEventListener("blur", refreshData);
    }

    // 5. Initial Boot
    refreshData();
});