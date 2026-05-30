import os
import json
import shutil
from datetime import datetime
from langchain_community.vectorstores import FAISS
from embeddings import get_embeddings
from config import VECTOR_STORE_PATH
from user_config_manager import get_user_config

DOCS_METADATA_DIR = "doc_metadata"
os.makedirs(DOCS_METADATA_DIR, exist_ok=True)


# ─────────────────────────────────────────
# METADATA HELPERS
# ─────────────────────────────────────────

def _meta_path(user_id: str) -> str:
    return os.path.join(DOCS_METADATA_DIR, f"{user_id}.json")

def _load_metadata(user_id: str) -> dict:
    """Loads document metadata for a user."""
    path = _meta_path(user_id)
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return {"documents": {}}

def _save_metadata(user_id: str, metadata: dict):
    """Saves document metadata for a user."""
    with open(_meta_path(user_id), "w") as f:
        json.dump(metadata, f, indent=2)


# ─────────────────────────────────────────
# REGISTER DOCUMENT AFTER UPLOAD
# ─────────────────────────────────────────

def register_document(
    user_id: str,
    filename: str,
    file_path: str,
    chunks_created: int,
    config_used: dict
):
    """
    Registers a document in user's metadata after successful indexing.
    Called automatically by ingest_document in rag_pipeline.py.
    """
    metadata = _load_metadata(user_id)

    # Use filename as doc_id (sanitized)
    doc_id = filename.replace(" ", "_").lower()

    # If doc already exists, increment version
    version = 1
    if doc_id in metadata["documents"]:
        version = metadata["documents"][doc_id].get("version", 1) + 1

    metadata["documents"][doc_id] = {
        "doc_id":         doc_id,
        "filename":       filename,
        "uploaded_at":    datetime.now().isoformat(),
        "chunks_created": chunks_created,
        "version":        version,
        "file_size_kb":   round(os.path.getsize(file_path) / 1024, 2) if os.path.exists(file_path) else 0,
        "config_used": {
            "embedding_model":   config_used.get("embedding_model", "bge-large"),
            "chunking_strategy": config_used.get("chunking_strategy", "recursive"),
            "chunking_params":   config_used.get("chunking_params", {})
        },
        "status": "indexed"
    }

    _save_metadata(user_id, metadata)
    print(f"[DocManager] Registered '{filename}' for user '{user_id}'.")
    return doc_id


# ─────────────────────────────────────────
# LIST DOCUMENTS
# ─────────────────────────────────────────

def list_documents(user_id: str) -> dict:
    """Returns all indexed documents for a user."""
    metadata = _load_metadata(user_id)
    documents = metadata.get("documents", {})

    if not documents:
        return {
            "status": "success",
            "user_id": user_id,
            "total_documents": 0,
            "documents": []
        }

    doc_list = []
    total_chunks = 0
    for doc_id, info in documents.items():
        doc_list.append({
            "doc_id":         info["doc_id"],
            "filename":       info["filename"],
            "uploaded_at":    info["uploaded_at"],
            "chunks_created": info["chunks_created"],
            "file_size_kb":   info.get("file_size_kb", 0),
            "version":        info.get("version", 1),
            "status":         info.get("status", "indexed")
        })
        total_chunks += info["chunks_created"]

    # Sort by upload date — newest first
    doc_list.sort(key=lambda x: x["uploaded_at"], reverse=True)

    return {
        "status":          "success",
        "user_id":         user_id,
        "total_documents": len(doc_list),
        "total_chunks":    total_chunks,
        "documents":       doc_list
    }


# ─────────────────────────────────────────
# GET SINGLE DOCUMENT STATS
# ─────────────────────────────────────────

def get_document_stats(user_id: str, doc_id: str) -> dict:
    """Returns detailed stats for a single document."""
    metadata  = _load_metadata(user_id)
    documents = metadata.get("documents", {})

    if doc_id not in documents:
        return {
            "status":  "error",
            "message": f"Document '{doc_id}' not found for user '{user_id}'."
        }

    info = documents[doc_id]

    # Count chunks from FAISS that belong to this doc
    chunks_in_index = _count_doc_chunks_in_index(user_id, info["filename"])

    return {
        "status":           "success",
        "doc_id":           doc_id,
        "filename":         info["filename"],
        "uploaded_at":      info["uploaded_at"],
        "chunks_created":   info["chunks_created"],
        "chunks_in_index":  chunks_in_index,
        "file_size_kb":     info.get("file_size_kb", 0),
        "version":          info.get("version", 1),
        "config_used":      info.get("config_used", {}),
        "status_label":     info.get("status", "indexed")
    }

def _count_doc_chunks_in_index(user_id: str, filename: str) -> int:
    """Counts how many FAISS chunks belong to a specific document."""
    try:
        config      = get_user_config(user_id)
        embeddings  = get_embeddings(config.get("embedding_model", "bge-large"))
        index_path  = os.path.join(VECTOR_STORE_PATH, f"user_{user_id}")

        if not os.path.exists(index_path):
            return 0

        vectorstore = FAISS.load_local(
            index_path, embeddings,
            allow_dangerous_deserialization=True
        )
        count = 0
        for doc_id in vectorstore.index_to_docstore_id.values():
            doc = vectorstore.docstore.search(doc_id)
            if doc and filename in doc.metadata.get("source", ""):
                count += 1
        return count
    except Exception:
        return 0


# ─────────────────────────────────────────
# DELETE DOCUMENT
# ─────────────────────────────────────────

def delete_document(user_id: str, doc_id: str) -> dict:
    """
    Deletes a document from:
    1. User metadata
    2. FAISS index (removes only that doc's chunks)
    """
    metadata  = _load_metadata(user_id)
    documents = metadata.get("documents", {})

    if doc_id not in documents:
        return {
            "status":  "error",
            "message": f"Document '{doc_id}' not found."
        }

    filename = documents[doc_id]["filename"]

    # Step 1: Remove chunks from FAISS index
    removed_chunks = _remove_doc_from_index(user_id, filename)

    # Step 2: Remove from metadata
    del metadata["documents"][doc_id]
    _save_metadata(user_id, metadata)

    print(f"[DocManager] Deleted '{filename}' ({removed_chunks} chunks) for user '{user_id}'.")
    return {
        "status":         "success",
        "message":        f"Document '{filename}' deleted successfully.",
        "doc_id":         doc_id,
        "chunks_removed": removed_chunks
    }

def _remove_doc_from_index(user_id: str, filename: str) -> int:
    """
    Removes all chunks belonging to a document from the FAISS index.
    Rebuilds the index without the deleted document's chunks.
    """
    try:
        config     = get_user_config(user_id)
        embeddings = get_embeddings(config.get("embedding_model", "bge-large"))
        index_path = os.path.join(VECTOR_STORE_PATH, f"user_{user_id}")

        if not os.path.exists(index_path):
            return 0

        vectorstore = FAISS.load_local(
            index_path, embeddings,
            allow_dangerous_deserialization=True
        )

        # Collect all docs that do NOT belong to the deleted file
        kept_docs    = []
        removed_count = 0

        for doc_id in vectorstore.index_to_docstore_id.values():
            doc = vectorstore.docstore.search(doc_id)
            if doc:
                if filename in doc.metadata.get("source", ""):
                    removed_count += 1
                else:
                    kept_docs.append(doc)

        # Rebuild FAISS index with remaining docs
        if kept_docs:
            new_vectorstore = FAISS.from_documents(kept_docs, embeddings)
            new_vectorstore.save_local(index_path)
        else:
            # No docs left — delete the entire index directory
            shutil.rmtree(index_path)
            print(f"[DocManager] No docs remaining — index deleted for user '{user_id}'.")

        return removed_count

    except Exception as e:
        print(f"[DocManager] Error removing from index: {e}")
        return 0


# ─────────────────────────────────────────
# DELETE ALL DOCUMENTS
# ─────────────────────────────────────────

def delete_all_documents(user_id: str) -> dict:
    """Deletes all documents and the entire FAISS index for a user."""
    metadata  = _load_metadata(user_id)
    doc_count = len(metadata.get("documents", {}))

    # Delete FAISS index
    index_path = os.path.join(VECTOR_STORE_PATH, f"user_{user_id}")
    if os.path.exists(index_path):
        shutil.rmtree(index_path)

    # Clear metadata
    _save_metadata(user_id, {"documents": {}})

    print(f"[DocManager] All documents deleted for user '{user_id}'.")
    return {
        "status":   "success",
        "message":  f"All {doc_count} document(s) deleted.",
        "user_id":  user_id
    }


# ─────────────────────────────────────────
# USER STORAGE STATS
# ─────────────────────────────────────────

def get_user_stats(user_id: str) -> dict:
    """Returns overall storage and usage stats for a user."""
    metadata  = _load_metadata(user_id)
    documents = metadata.get("documents", {})

    total_chunks    = sum(d["chunks_created"] for d in documents.values())
    total_size_kb   = sum(d.get("file_size_kb", 0) for d in documents.values())

    # Check FAISS index size on disk
    index_path = os.path.join(VECTOR_STORE_PATH, f"user_{user_id}")
    index_size_kb = 0
    if os.path.exists(index_path):
        for f in os.listdir(index_path):
            index_size_kb += os.path.getsize(os.path.join(index_path, f)) / 1024
        index_size_kb = round(index_size_kb, 2)

    return {
        "status":          "success",
        "user_id":         user_id,
        "total_documents": len(documents),
        "total_chunks":    total_chunks,
        "total_pdf_size_kb":   round(total_size_kb, 2),
        "index_size_kb":   index_size_kb,
        "index_exists":    os.path.exists(index_path)
    }