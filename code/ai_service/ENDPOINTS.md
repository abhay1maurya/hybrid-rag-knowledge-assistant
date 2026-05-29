# AI Service — Endpoints Reference

This document lists all HTTP endpoints provided by the `ai_service`, with request/response examples, parameter descriptions, and common error cases.

Base URL (local dev): http://localhost:8000

Contents
- Health & root
- Document ingestion
- Question answering (RAG)
- Provider management
- Session management
- Configuration API (under `/config`)

---

## 1. Root / Health

- GET `/` — Health / root
  - Description: basic service status.
  - Response (200):

```json
{
  "status": "DocuMind AI Service is running.",
  "version": "2.0"
}
```

- GET `/health` — Detailed health
  - Description: checks active provider, Ollama status (if used), and model readiness.
  - Response (200):

```json
{
  "status": "ok",
  "active_provider": {"provider": "offline", "model": "llama-3.3-70b-versatile", "speed": "fast", "accuracy": "high", "requires_key": false},
  "ollama_running": true,
  "ollama_model_ready": true
}
```

---

## 2. Document ingestion

- POST `/upload` — Upload and index a PDF
  - Description: Accepts a PDF file and a `user_id`, processes the PDF into chunks, computes embeddings, and stores them in the user's FAISS index.
  - Content-Type: `multipart/form-data`
  - Form fields:
    - `user_id` (string, required) — user identifier used to store per-user index
    - `file` (file, required) — PDF file to upload (only `.pdf` accepted)
  - Success (200):

```json
{
  "status": "success",
  "message": "Processed 'doc.pdf' successfully.",
  "chunks_created": 42,
  "user_id": "user_1"
}
```

  - Common errors:
    - 400: when uploaded file is not a PDF (the endpoint validates `file.filename.endswith('.pdf')`)
    - 500: processing error (loader/embedding/indexing failure). If `ingest_document` returns `status: "error"`, `main.py` raises HTTP 500 with the error message.

  - Temporary file behavior: uploaded file is saved under `uploads/{user_id}_{original_filename}` and removed after processing (cleanup happens in a `finally` block).

  - Vector store location: embeddings are persisted under `{VECTOR_STORE_PATH}/user_{user_id}` (see `config.py` for `VECTOR_STORE_PATH`); absence of that folder will prevent queries until documents are uploaded.

  - Example curl:

```bash
curl -X POST "http://localhost:8000/upload" \
  -F "user_id=user_1" \
  -F "file=@/path/to/doc.pdf"
```

Notes: changing the embedding model in user config will not automatically migrate existing indexes — re-uploading is required to rebuild the index with the new embeddings.

---

## 3. Question answering (RAG)

- POST `/ask` — Ask a question
  - Description: Runs the RAG pipeline using the user's vector store and the configured LLM provider.
  - Content-Type: `application/x-www-form-urlencoded` (or `multipart/form-data`)
  - Form fields:
    - `query` (string, required)
    - `user_id` (string, required)
  - Behavior notes:
    - If the user's vector store path `{VECTOR_STORE_PATH}/user_{user_id}` does not exist, the pipeline returns `status: "error"` with `answer: "No documents found. Please upload a document first."`. `main.py` converts this into an HTTP 500.
    - The service applies input guardrails (may raise `GuardrailException`) before running retrieval; blocked queries return a 200 with `status: "blocked"`.
  - Success (200):

```json
{
  "status": "success",
  "answer": "The document explains that...",
  "sources": ["Page 1", "Page 3"],
  "original_query": "What does the document say about X?",
  "processed_query": "what is X"
}
```

  - Blocked (200):

```json
{
  "status": "blocked",
  "reason": "safety:disallowed_topic",
  "answer": "The request was blocked by guardrails.",
  "sources": []
}
```

  - Error (500):

```json
{
  "detail": "No documents found. Please upload a document first."
}
```

  - Example curl:

```bash
curl -X POST "http://localhost:8000/ask" \
  -F "query=What is the summary?" \
  -F "user_id=user_1"
```

---

## 4. Provider management

- GET `/provider` — Current provider info
  - Returns the currently active provider, selected model, and metadata. The implementation calls `llm_manager.get_current_provider_info()` which returns:

```json
{
  "provider": "groq",
  "model": "groq-chat-medium",
  "speed": "fast",
  "accuracy": "medium",
  "requires_key": true
}
```

- POST `/provider/switch` — Switch provider at runtime
  - Description: Change the LLM provider without restarting the server.
  - Content-Type: `application/x-www-form-urlencoded`
  - Form fields:
    - `provider` (string, required) — allowed: `offline`, `online`
    - `online_provider` (string, optional) — when `provider=online`; allowed: `groq`, `openai`, `anthropic`
  - Success (200): returns status and new provider settings.
  - Errors:
    - 400: invalid provider or invalid online_provider

Example curl:

```bash
curl -X POST "http://localhost:8000/provider/switch" \
  -F "provider=online" \
  -F "online_provider=openai"
```

Notes: this endpoint sets environment variables and updates `config` module globals (`LLM_PROVIDER`, `ONLINE_PROVIDER`), then clears the LLM cache so changes take effect immediately. Response example:

```json
{
  "status": "success",
  "message": "Switched to online (openai)",
  "provider": "online",
  "online_provider": "openai"
}
```

---

## 5. Session / memory management

- POST `/reset` — Reset conversation memory for a user
  - Content-Type: `application/x-www-form-urlencoded`
  - Form fields: `user_id` (string, required)
  - Success: returns result from `reset_user_session` (usually a confirmation JSON)

Example curl:

```bash
curl -X POST "http://localhost:8000/reset" -F "user_id=user_1"
```

---

## 6. Configuration API (`/config/*`)

All configuration routes are mounted under the `/config` prefix by `config_router.py`.

1) GET `/config/options`
   - Description: retrieves available embedding models, chunking strategies, LLM providers and defaults.

   - Example response (truncated):

```json
{
  "embedding_models": {"hf-bge": {"description":"...","dimensions":768}},
  "chunking_strategies": {...},
  "llm_providers": {...},
  "retriever_options": {...},
  "default_config": {...}
}
```

2) GET `/config/{user_id}`
   - Returns user-specific configuration.

3) PATCH `/config/{user_id}`
   - Body: JSON patch-like partial update following the `UserConfigUpdate` model.
   - Example body:

```json
{
  "embedding_model": "hf-bge",
  "chunking_strategy": "recursive",
  "retriever": {"k_candidates": 10, "use_reranker": true}
}
```

   - Warnings: changing `embedding_model` may invalidate existing vector indexes; the API will return a `warnings` array if applicable.

4) POST `/config/{user_id}/reset`
   - Resets the user's config to defaults.

5) GET `/config/{user_id}/llm-models`
   - Returns available models for the user's configured provider, plus `requires_key` and `get_key_url` hints.

---

## Error handling summary

- 200: successful responses (including `status: "blocked"` for guardrail blocks).
- 400: client errors (invalid parameters, invalid provider selection).
- 500: server errors (processing failures, embedding/LLM errors).

When reporting issues, include server logs from `uvicorn` output and a reproducible curl request.

---

## Tips for automation / tests

- To test ingestion in CI, run `curl` to `/upload` with a known small PDF and assert the presence of `vector_store/<user>/index.faiss`.
- For RAG pipeline integration tests, pre-seed a small index and call `/ask` verifying the returned `answer` and `sources`.

---

File generated from endpoint code in `main.py` and `config_router.py`.
