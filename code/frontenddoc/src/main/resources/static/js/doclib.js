const API = 'http://localhost:8000';
let userId = 'user_1';
let deleteAllArmed = false;
let deleteAllTimer = null;

function toast(msg) {
    const note = document.getElementById('note');
    note.textContent = msg;
    note.classList.remove('hidden');

    setTimeout(() => {
        note.classList.add('hidden');
    }, 1800);
}

function setUserIdFromInput() {
    const input = document.getElementById('user-id-input');
    userId = input?.value.trim() || 'user_1';
    if (input) input.value = userId;
}

function formatBytesKb(kb) {
    if (kb === undefined || kb === null) return '0 KB';
    if (kb < 1024) return `${kb} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
}

function statusBadge(status) {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'indexed') {
        return '<span class="badge-success">Indexed</span>';
    }
    if (normalized === 'processing') {
        return '<span class="badge-warning">Processing</span>';
    }
    return '<span class="badge-warning">Pending</span>';
}

function renderDocuments(documents) {
    const tbody = document.getElementById('docs-tbody');
    const emptyState = document.getElementById('empty-state');

    if (!tbody) return;
    tbody.innerHTML = '';

    if (!documents.length) {
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    documents.forEach(doc => {
        const ext = (doc.filename.split('.').pop() || '').toUpperCase();
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="cell-name">${doc.filename}</td>
            <td class="cell-type">${ext}</td>
            <td>${statusBadge(doc.status)}</td>
            <td class="actions-cell">
                <button class="action-link" data-action="view" data-doc="${doc.doc_id}">View</button>
                <button class="action-link" data-action="reprocess" data-doc="${doc.doc_id}">Reprocess</button>
                <button class="action-danger" data-action="delete" data-doc="${doc.doc_id}">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function loadSupportedFormats() {
    const formatsEl = document.getElementById('supported-formats');
    const fileInput = document.getElementById('document-upload');

    try {
        const res = await fetch(`${API}/supported-formats`);
        const data = await res.json();
        const extensions = data.supported_extensions || [];
        if (fileInput && extensions.length) fileInput.accept = extensions.join(',');
        if (formatsEl) {
            formatsEl.textContent = extensions.length
                ? `Supported: ${extensions.join(', ')}`
                : 'Supported formats unavailable.';
        }
    } catch (err) {
        if (formatsEl) formatsEl.textContent = 'Supported formats unavailable.';
    }
}

async function loadDocuments() {
    setUserIdFromInput();

    const countEl = document.getElementById('doc-count');
    const chunkEl = document.getElementById('chunk-count');

    try {
        const res = await fetch(`${API}/documents/${encodeURIComponent(userId)}`);
        const data = await res.json();
        const documents = data.documents || [];

        if (countEl) countEl.textContent = data.total_documents ?? documents.length;
        if (chunkEl) chunkEl.textContent = data.total_chunks ?? 0;
        renderDocuments(documents);
    } catch (err) {
        toast('Failed to load documents.');
    }
}

async function uploadFiles(files) {
    if (!files.length) return;
    setUserIdFromInput();

    for (const file of files) {
        const form = new FormData();
        form.append('user_id', userId);
        form.append('file', file);

        try {
            toast(`Uploading: ${file.name}...`);
            const res = await fetch(`${API}/upload`, { method: 'POST', body: form });
            const data = await res.json();
            if (!res.ok) {
                toast(data.detail || 'Upload failed.');
            } else {
                toast(data.message || 'Upload complete.');
            }
        } catch (err) {
            toast('Upload failed.');
        }
    }

    await loadDocuments();
}

async function handleRowAction(action, docId) {
    if (action === 'view') {
        try {
            const res = await fetch(`${API}/documents/${encodeURIComponent(userId)}/${encodeURIComponent(docId)}`);
            const data = await res.json();
            if (res.ok) {
                toast(`${data.filename} - ${formatBytesKb(data.file_size_kb)} - v${data.version}`);
            } else {
                toast(data.detail || 'Unable to load document details.');
            }
        } catch (err) {
            toast('Unable to load document details.');
        }
        return;
    }

    if (action === 'reprocess') {
        toast('Reprocess is not available yet.');
        return;
    }

    if (action === 'delete') {
        if (!confirm('Delete this document?')) return;
        try {
            const res = await fetch(`${API}/documents/${encodeURIComponent(userId)}/${encodeURIComponent(docId)}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (res.ok) {
                toast(data.message || 'Document deleted.');
                await loadDocuments();
            } else {
                toast(data.detail || 'Delete failed.');
            }
        } catch (err) {
            toast('Delete failed.');
        }
    }
}

async function deleteAllDocuments() {
    const deleteBtn = document.getElementById('delete-all-btn');
    const warning = document.getElementById('delete-all-warning');

    if (!deleteAllArmed) {
        deleteAllArmed = true;
        if (deleteBtn) deleteBtn.classList.add('is-armed');
        if (warning) warning.classList.remove('hidden');
        deleteAllTimer = setTimeout(() => {
            deleteAllArmed = false;
            if (deleteBtn) deleteBtn.classList.remove('is-armed');
            if (warning) warning.classList.add('hidden');
        }, 5000);
        return;
    }

    if (deleteAllTimer) {
        clearTimeout(deleteAllTimer);
        deleteAllTimer = null;
    }
    deleteAllArmed = false;
    if (deleteBtn) deleteBtn.classList.remove('is-armed');
    if (warning) warning.classList.add('hidden');

    setUserIdFromInput();

    try {
        const res = await fetch(`${API}/documents/${encodeURIComponent(userId)}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok) {
            toast(data.message || 'All documents deleted.');
            await loadDocuments();
        } else {
            toast(data.detail || 'Delete all failed.');
        }
    } catch (err) {
        toast('Delete all failed.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('document-upload');
    const loadBtn = document.getElementById('load-btn');
    const deleteAllBtn = document.getElementById('delete-all-btn');
    const tbody = document.getElementById('docs-tbody');

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (event) => {
            const files = Array.from(event.target.files || []);
            if (files.length) uploadFiles(files);
            fileInput.value = '';
        });
    }

    if (loadBtn) {
        loadBtn.addEventListener('click', loadDocuments);
    }

    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', deleteAllDocuments);
    }

    if (tbody) {
        tbody.addEventListener('click', (event) => {
            const target = event.target.closest('button');
            if (!target) return;
            const action = target.getAttribute('data-action');
            const docId = target.getAttribute('data-doc');
            if (!action || !docId) return;
            handleRowAction(action, docId);
        });
    }

    loadSupportedFormats();
    loadDocuments();
});