# AI Service

This directory contains the FastAPI-based backend that powers the Hybrid RAG Knowledge Assistant's ingestion, embedding, vector-store management, and RAG question-answering pipelines.

This README documents how to set up, run, and develop the `ai_service`. It also lists environment variables, API endpoints, developer notes, and troubleshooting tips.

## Table of contents

- Overview
- Requirements
- Setup (dev & production)
- Environment variables (detailed)
- Running the service
- HTTP API (endpoints & examples)
- Data flow and architecture
- Models & providers
- Storage & persistence
- Testing & verification
- Troubleshooting
- Contributing

## Overview

The `ai_service` implements the backend API used by the frontend to:

- Ingest documents (PDF/TXT), chunk and embed text, and store embeddings in a FAISS vector store.
- Build retrieval pipelines and run conversational RAG flows.
- Select and call different LLM providers (local Ollama or online providers such as OpenAI, Anthropic, Groq).

Core modules:

- `main.py` — FastAPI app and HTTP routes.
- `config.py` — loads environment variables and default configuration.
- `document_processor.py` — document loaders and chunking strategies.
- `embeddings.py` — wrapper around embedding providers.
- `rag_pipeline.py` — orchestration of retrieval and LLM answer generation.
- `llm_manager.py` — provider selection logic and LLM wrappers.
- `model_registry.py` — lists of supported models and chunking strategies.

## Requirements

- Python 3.11+ recommended
- `pip` for dependency installation
- See `requirements.txt` for project dependencies

If you want reproducible installs, create a virtual environment and pin exact versions (see "Pinning versions").

## Setup

1) Use the included virtualenv (optional)

PowerShell:

```powershell
# activate prebuilt venv
. aivenv\Scripts\Activate.ps1
```

Windows CMD:

```cmd
aivenv\Scripts\activate.bat
```

Alternatively, create a fresh venv:

```bash
python -m venv .venv
source .venv/Scripts/activate  # or Activate.ps1 on PowerShell
```

2) Install dependencies

```bash
pip install -r requirements.txt
```

3) (Optional) Pin current environment versions

```bash
pip freeze > requirements.txt
```

4) Create `.env` file

Copy any environment variables you need (see next section) into a `.env` file in this folder or set them in your environment. `code/ai_service/config.py` loads `.env` via `python-dotenv`.

## Environment variables (detailed)

Below are common environment variables referenced by the code. Check `code/ai_service/config.py` for exact names and any defaults.

- `OPENAI_API_KEY` — OpenAI API key for the OpenAI provider. If unset, OpenAI provider will be unavailable.
- `ANTHROPIC_API_KEY` — Anthropic API key for Anthropic provider.
- `GROQ_API_KEY` — Groq API key for Groq provider.
- `OLLAMA_BASE_URL` — Base URL for local Ollama server (e.g. `http://localhost:11434`).
- `OLLAMA_MODEL` — Default Ollama model name used for local LLM calls.
- `LLM_PROVIDER` — Preferred LLM provider key (e.g., `ollama`, `openai`, `anthropic`, `groq`). See `model_registry.py`.
- `ONLINE_PROVIDER` — Flag used in code to prefer online providers.
- `VECTOR_STORE_PATH` — Filesystem path where FAISS indexes and vector store artifacts are saved (default: `vector_store/` under this service).
- `PORT` — Port to run the FastAPI app (default used in run commands: `8000`).

Security note: Keep API keys out of source control. Use environment-specific secret storage or CI/CD secrets for production.

## Running the service

Development (auto-reload):

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Production (example using `gunicorn` + `uvicorn.workers.UvicornWorker`):

```bash
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

If you use docker, create a small Dockerfile that installs `requirements.txt` and runs `uvicorn`.

## HTTP API (endpoints & examples)

The main routes are defined in `main.py`. Example payloads below.

1) POST /ingest — upload document and index

curl (multipart/form-data):

```bash
curl -X POST "http://localhost:8000/ingest" \
	-F "file=@/path/to/doc.pdf" \
	-F "user_id=user_1" \
	-F "chunk_strategy=recursive" 
```

Expected behavior: the server will extract text, chunk according to the configured strategy, compute embeddings, and persist vectors to the user's vector store directory (e.g., `vector_store/user_user_1/`).

2) POST /ask — ask a question (RAG)

```bash
curl -X POST "http://localhost:8000/ask" \
	-H "Content-Type: application/json" \
	-d '{"user_id":"user_1","question":"What did the document say about X?"}'
```

Response: JSON object containing the LLM answer, supporting contexts and metadata (see `rag_pipeline.py` for the exact response shape).

3) GET /config or /health — informational endpoints

Refer to `main.py` for additional routes and their exact request/response shapes.

## Data flow and architecture

1. Document ingestion (`/ingest`)
	 - Loader (PyPDFLoader or other) reads the file.
	 - Text splitter chunks the document according to `CHUNKING_STRATEGIES`.
	 - `embeddings.get_embeddings()` computes vector representations.
	 - Vectors stored in FAISS via `langchain_community.vectorstores.FAISS` under user-specific folders.

2. Question answering (`/ask`)
	 - Query pre-processing (`query_processor.py`) cleans or reformulates the question.
	 - Retriever (BM25 / FAISS / ensemble) finds top-k candidate chunks.
	 - Optional reranking (cross-encoder) improves retrieval ordering.
	 - Condense prompt + LLM call to produce final answer.

## Models & providers

- Local: Ollama — used when `LLM_PROVIDER` is set to `ollama` and `OLLAMA_BASE_URL` is reachable.
- Online: OpenAI, Anthropic, Groq — used when API keys are provided and `LLM_PROVIDER` is set accordingly.

See `llm_manager.py` for provider selection logic; switching provider is typically done by setting `LLM_PROVIDER` and the corresponding API key/env vars.

## Storage & persistence

- `vector_store/` — per-user FAISS indexes (committed to disk by the ingestion flow).
- `model_cache/` — local model files and weights for offline models; ensure enough disk and memory for large models.

Backups: Copy `vector_store/` and `model_cache/` to persistent storage for production.

## Testing & verification

Quick smoke test (after running the server):

```bash
curl -s http://localhost:8000/health || true
```

Unit tests: none included by default. Recommended quick tests:

- Run ingestion against a small PDF and verify `vector_store/<user>/index.faiss` appears.
- Run a sample `POST /ask` and ensure response contains `answer`.

## Troubleshooting

- Missing import errors: ensure you installed dependencies into the active venv. Use `pip show <package>` to confirm.
- FAISS issues on Windows: If `faiss-cpu` installation fails, consider using a Linux dev environment or use `faiss-cpu` wheels compatible with your Python version.
- Ollama unreachable: confirm `OLLAMA_BASE_URL` and that Ollama daemon is running locally.
- Large model memory errors: use smaller models or run on a machine with sufficient RAM/VRAM.

## Development notes

- Code follows a modular structure: keep provider-specific wrappers in `llm_manager.py` and `embeddings.py`.
- `model_registry.py` centralizes supported models and chunking defaults — update it when adding new models.

## Contributing

- Create feature branches, add tests if applicable, and open PRs describing the change.
- When adding dependencies, update `requirements.txt` and pin versions if the change is intended for production.

## License

See project root `LICENSE`.

---
If you'd like, I can also:

- Pin exact dependency versions in `requirements.txt` from the current `aivenv` and create a `requirements-pinned.txt`.
- Add a small `health` unit test and a GitHub Actions workflow to smoke-start the service.
