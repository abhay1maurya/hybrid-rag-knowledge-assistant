# DocuMind AI — FastAPI AI Service Backend (`code/ai_service`)

This directory houses the core Python microservice that powers the document processing, hybrid retrieval, LLM orchestration, safety guardrails, and RAG evaluation pipelines of the DocuMind AI platform.

For a detailed list of REST endpoint schemas, payloads, and SSE stream events, refer to [ENDPOINTS.md](file:///d:/projects/hybrid-rag-knowledge-assistant/code/ai_service/ENDPOINTS.md).

---

## 1. Directory Structure & Module Responsibilities

The Python backend is organized into modular services and routers:

```
code/ai_service/
├─ main.py                  # Entrypoint: mounts routes, middleware, and routers.
├─ config.py                # Environment configurations and hardware auto-detection.
├─ config_router.py         # REST Router: user configurations (/config/*).
├─ document_router.py       # REST Router: CRUD document operations (/documents/*).
├─ document_manager.py      # Operations: metadata registry and targeted FAISS purges.
├─ document_processor.py    # Pipeline: document loading, chunking, and FAISS indexing.
├─ embeddings.py            # Service: Hugging Face embedding loader with caching.
├─ guardrails.py            # Safety: regex filters, context adequacy, and hallucination checks.
├─ llm_manager.py           # Orchestration: provider switching and LLM instance caching.
├─ ollama_manager.py        # Service: Ollama server lifecycle controller and model downloader.
├─ memory_manager.py        # State: per-user sliding-window conversational memory (k=5).
├─ prompts.py               # Prompt Templates: standalone condensation and grounded QA.
├─ query_processor.py       # Pipeline: query normalization and conditional expansion.
├─ rag_pipeline.py          # Pipeline: blocking ask execution.
├─ stream_pipeline.py       # Pipeline: streaming ask execution (using Server-Sent Events).
├─ streaming.py             # Helpers: async queue handler and SSE formatters.
├─ requirements.txt         # Project dependencies.
├─ file_handlers/           # Submodule: parsing extensions (PDF, TXT, DOCX, CSV, Excel).
│  ├─ base_handler.py       # Abstract base file handler class.
│  ├─ handler_factory.py    # Registry mapping file extensions to loader classes.
│  └─ [format]_handler.py   # Loader subclasses for specific formats.
└─ evaluator/               # Submodule: RAGAS-based performance evaluations.
   ├─ eval_router.py        # REST Router: evaluation trigger and test set CRUD (/eval/*).
   ├─ test_set_manager.py   # Operations: test sets and auto-generating questions.
   ├─ ragas_evaluator.py    # Service: Faithfulness, Relevancy, Precision, Recall, and Correctness metrics.
   └─ eval_store.py         # Persistence: runs history, metrics aggregation, and trends.
```

---

## 2. Requirements & Hardware Acceleration

- **Python Version**: Python 3.11+ is recommended.
- **Hardware Acceleration**: Auto-detects system capability on startup. If a compatible GPU is found, the system defaults embedding calculations to the hardware processor:
  - **NVIDIA GPU**: Utilizes `cuda` acceleration.
  - **Apple Silicon (M1/M2/M3)**: Utilizes Apple Metal Performance Shaders (`mps`).
  - **Fallback**: Defaults to `cpu` execution.
- **Model Cache**: Pre-downloaded models are cached in `./model_cache` to support offline deployments.

---

## 3. Environment Setup & Configurations

The service uses `python-dotenv` to load configurations from a `.env` file in the project root or the `code/ai_service/` directory.

### Key Environment Variables:
- **LLM Provider Options**:
  - `LLM_PROVIDER`: Set to `offline` (for local Ollama) or `online` (for cloud APIs).
  - `ONLINE_PROVIDER`: Selects the online engine (`groq`, `openai`, or `anthropic`).
- **Inference Keys**:
  - `GROQ_API_KEY`: API key for Groq Cloud.
  - `OPENAI_API_KEY`: API key for OpenAI.
  - `ANTHROPIC_API_KEY`: API key for Anthropic Claude.
- **Ollama Configurations**:
  - `OLLAMA_BASE_URL`: Daemon endpoint (default: `http://localhost:11434`).
  - `OLLAMA_MODEL`: Generation model (default: `mistral`).
  - `OLLAMA_REQUEST_TIMEOUT`: Timeout for local inference (default: `60` seconds).
- **Paths**:
  - `VECTOR_STORE_PATH`: Local directory for FAISS indexing files (default: `vector_store`).

---

## 4. Local Development Guide

### Step 1: Initialize Virtual Environment
Navigate to the directory, build the environment, and activate it:
```bash
# Create venv
python -m venv .venv

# Activate (Windows PowerShell)
.venv\Scripts\Activate.ps1

# Activate (Linux / macOS)
source .venv/bin/activate
```

### Step 2: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Run the FastAPI Application
Run the service locally on Port `8000`:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
*Note: Gunicorn can be used in production using `uvicorn.workers.UvicornWorker` for multi-process routing.*

---

## 5. Directory Mapping & Persistence Stores

The service maintains state on disk using the following folders (created automatically on startup):
- `vector_store/`: Stores user FAISS indexes (e.g. `vector_store/user_{user_id}`). Contains binary index and serialization files (`index.faiss` and `index.pkl`).
- `doc_metadata/`: Stores user document catalogs (`{user_id}.json`) with filenames, upload dates, chunk counts, versions, and sizes.
- `user_configs/`: Stores customized configurations for chunking, retriever weights, and LLM settings per user.
- `eval_test_sets/`: Stores user test set questions and ground-truth values.
- `eval_results/`: Stores user evaluation run results and performance trend histories.

---

## 6. Troubleshooting & Diagnostics

- **GPU Embedding Memory Spikes**:
  For semantic chunking on large documents, chunking is processed sequentially to prevent memory issues. If out-of-memory errors occur, configure the user's chunking strategy to `recursive` or switch `DEVICE` in `config.py` to `cpu`.
- **Targeted Deletions Fail**:
  If deleting a single document leaves empty registries, `document_manager.py` will delete the empty index directory. If issues persist, verify that the metadata file in `doc_metadata/{user_id}.json` matches the index contents.
- **Ollama Initialization Timeout**:
  On startup, the system tries to automatically start the Ollama daemon if it is not running. If starting the daemon fails, verify your system path configuration or run `ollama serve` manually in a terminal.
- **Incompatible Index Warnings**:
  Changing the `embedding_model` parameter inside a user's configuration makes existing FAISS indexes incompatible. PURGE the user's vector store and metadata using `DELETE /documents/{user_id}` and re-upload the files to rebuild the indexes.
