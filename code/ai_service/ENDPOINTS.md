# DocuMind AI Service — API Endpoints Reference Guide

This document lists all the REST endpoints exposed by the Python FastAPI AI Service running on `http://localhost:8000`.

---

## 1. Health & Formats

### GET `/` — Root Verification
- **Description**: Returns the active state and service version.
- **Response (200)**:
  ```json
  {
    "status": "DocuMind AI Service is running.",
    "version": "3.0"
  }
  ```

### GET `/health` — System Health Audit
- **Description**: Evaluates active LLM providers, checks if the local Ollama server is running, and verifies if default models are loaded.
- **Response (200)**:
  ```json
  {
    "status": "ok",
    "active_provider": {
      "provider": "groq",
      "model": "llama-3.3-70b-versatile",
      "speed": "very fast",
      "accuracy": "very high",
      "requires_key": true
    },
    "ollama_running": true,
    "ollama_model_ready": true
  }
  ```

### GET `/supported-formats` — Supported File Formats
- **Description**: Returns all supported file extensions and categories for document ingestion.
- **Response (200)**:
  ```json
  {
    "supported_extensions": [".pdf", ".txt", ".md", ".rst", ".log", ".docx", ".doc", ".csv", ".xlsx", ".xls"],
    "formats": {
      "pdf":  { "extensions": [".pdf"], "description": "PDF documents" },
      "text": { "extensions": [".txt", ".md", ".rst", ".log"], "description": "Plain text and markdown" },
      "word": { "extensions": [".docx", ".doc"], "description": "Microsoft Word documents" },
      "data": { "extensions": [".csv", ".xlsx", ".xls"], "description": "Spreadsheets and CSV data" }
    }
  }
  ```

---

## 2. Document Ingestion

### POST `/upload` — Ingest and Index a Document
- **Description**: Accepts a supported document file, parses it, chunks it, generates embeddings, and indexes them in the user's FAISS index.
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `user_id` (string, required) — User identifier for index isolation.
  - `file` (file, required) — Document file (PDF, TXT, MD, DOCX, CSV, Excel).
- **Response (200)**:
  ```json
  {
    "status": "success",
    "message": "Document processed successfully.",
    "doc_id": "document_name_pdf",
    "chunks_created": 12,
    "user_id": "user_1",
    "config_used": {
      "embedding_model": "bge-base",
      "chunking_strategy": "recursive",
      "chunking_params": { "chunk_size": 600, "chunk_overlap": 100 }
    }
  }
  ```

---

## 3. Question Answering (RAG)

### POST `/ask` — Blocking Question Answering
- **Description**: Runs the RAG pipeline using the user's vector store and returns the full answer.
- **Content-Type**: `application/x-www-form-urlencoded`
- **Form Fields**:
  - `query` (string, required)
  - `user_id` (string, required)
- **Response (200 - Success)**:
  ```json
  {
    "status": "success",
    "answer": "Grounded answer text here.",
    "sources": ["Page 1", "Page 3"],
    "original_query": "User question",
    "processed_query": "Cleaned search question",
    "llm_provider": {
      "provider": "groq",
      "model": "llama-3.3-70b-versatile"
    }
  }
  ```
- **Response (200 - Blocked)**:
  ```json
  {
    "status": "blocked",
    "reason": "harmful_content",
    "answer": "I'm sorry, I cannot process this type of request.",
    "sources": [],
    "original_query": "Disallowed query",
    "processed_query": "Disallowed query"
  }
  ```

### GET `/ask/stream` — Streaming SSE Question Answering
- **Description**: Streams generated answer tokens in real-time as Server-Sent Events (SSE).
- **Parameters**:
  - `query` (string, required)
  - `user_id` (string, required)
- **SSE Event Types**:
  - `start`: Stream execution initialized.
  - `status`: Progress status updates (e.g. *Retrieving relevant context...*).
  - `query_processed`: Returns the original query vs processed query.
  - `generating`: LLM output has started.
  - `token`: Single token string generated.
  - `guardrail`: Triggered if the output guardrail modifies the answer.
  - `sources`: Lists page citations.
  - `done`: Stream complete (includes source list and provider metadata).
  - `blocked`: Triggered if input guardrails block the query.
  - `error`: Internal execution errors.

---

## 4. Provider & Session Management

### GET `/provider` — Current Provider Details
- **Description**: Returns active provider, model, speed, accuracy, and key requirements.
- **Response (200)**:
  ```json
  {
    "provider": "offline",
    "model": "mistral",
    "speed": "medium",
    "accuracy": "good",
    "requires_key": false
  }
  ```

### POST `/provider/switch` — Switch LLM Provider
- **Description**: Changes the active LLM provider. Can be applied process-wide or to a specific user.
- **Form Fields**:
  - `provider` (string, required) — `offline` or `online`.
  - `online_provider` (string, optional) — `groq`, `openai`, or `anthropic`.
  - `user_id` (string, optional) — If provided, updates config settings for that specific user.
- **Response (200)**:
  ```json
  {
    "status": "success",
    "message": "Switched to online (groq)",
    "provider": "online",
    "online_provider": "groq"
  }
  ```

### POST `/reset` — Reset Session Memory
- **Description**: Clears the sliding-window conversational memory for a specific user.
- **Form Fields**:
  - `user_id` (string, required)
- **Response (200)**:
  ```json
  {
    "status": "success",
    "message": "Session cleared for user user_1"
  }
  ```

---

## 5. Configuration APIs (prefix: `/config`)

Mounted in `config_router.py` to manage user-specific processing configurations.

### GET `/config/options`
- **Description**: Returns all supported embedding models, chunking strategies, and default parameters.

### GET `/config/{user_id}`
- **Description**: Retrieves config settings for a specific user.

### PATCH `/config/{user_id}`
- **Description**: Partially updates a user's configuration parameters.
- **Body (JSON)**:
  ```json
  {
    "embedding_model": "bge-base",
    "chunking_strategy": "recursive",
    "retriever": {
      "k_candidates": 12,
      "bm25_weight": 0.4
    }
  }
  ```
- **Response (200)**: Includes updated settings and warnings if model changes invalidate the current FAISS index.

### POST `/config/{user_id}/reset`
- **Description**: Resets a user's configuration to the system defaults.

### GET `/config/{user_id}/llm-models`
- **Description**: Lists available models for the user's active provider.

---

## 6. Document Management APIs (prefix: `/documents`)

CRUD operations for user documents and vector stores.

### GET `/documents/{user_id}`
- **Description**: Lists all indexed documents for a user, including sizes, upload times, and chunk counts.

### GET `/documents/{user_id}/stats`
- **Description**: Returns overall storage stats, total chunks, index sizes, and file size sums.

### GET `/documents/{user_id}/{doc_id}`
- **Description**: Returns detailed processing stats for a single document.

### DELETE `/documents/{user_id}/{doc_id}`
- **Description**: Deletes chunks associated with a specific document from the user's FAISS index.

### DELETE `/documents/{user_id}`
- **Description**: Deletes all documents, FAISS indices, and metadata associated with a user.

---

## 7. RAG Evaluation APIs (prefix: `/eval`)

Manages test sets and runs evaluations.

### GET `/eval/{user_id}/test-set`
- **Description**: Retrieves all saved evaluation questions for a user.

### POST `/eval/{user_id}/test-set/add`
- **Description**: Adds a question and an optional ground-truth answer to the user's test set.
- **Body (JSON)**:
  ```json
  {
    "question": "What is the primary conclusion?",
    "ground_truth": "The project is successful."
  }
  ```

### DELETE `/eval/{user_id}/test-set/{q_id}`
- **Description**: Removes a question from the test set.

### DELETE `/eval/{user_id}/test-set`
- **Description**: Clears the test set.

### POST `/eval/{user_id}/test-set/auto-generate`
- **Description**: Automatically generates test questions based on the user's indexed document chunks.
- **Parameters**: `n` (integer, default: 5).

### POST `/eval/{user_id}/run`
- **Description**: Runs evaluation on the test set. Computes *Faithfulness*, *Relevancy*, *Precision*, *Recall*, and *Correctness*, and saves results to disk.
- **Response (200)**: Returns per-question results, averages, and tuning recommendations.

### GET `/eval/{user_id}/results`
- **Description**: Returns historical evaluation runs.

### GET `/eval/{user_id}/results/latest`
- **Description**: Returns results for the most recent evaluation run.

### GET `/eval/{user_id}/summary`
- **Description**: Aggregates average, best, and worst scores across runs, and shows performance trends.

### DELETE `/eval/{user_id}/results`
- **Description**: Deletes all evaluation histories.
