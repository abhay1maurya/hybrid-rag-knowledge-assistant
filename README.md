# DocuMind AI — Deep Documentation

DocuMind AI is a hybrid Retrieval-Augmented Generation (RAG) assistant that lets users upload documents, indexes them into FAISS per user, and answers natural-language questions using either an offline LLM (Ollama) or online providers (Groq / OpenAI / Anthropic).

This README provides a full developer and operator guide: architecture, configuration, runtime, API contract, provider switching, debugging, and deployment notes.

Contents
- Overview
- Architecture & Data Flow
- Detailed Components (files and responsibilities)
- Environment & Configuration
- Local Development (step-by-step)
- API Reference (endpoints & examples)
- Provider Switching (design + runtime switch)
- Troubleshooting & Tips
- Testing & CI
- Contributing
- License
- Spring Boot Backend (website backend summary; see docs/springboot_backend.md)

## Overview

Primary goals:
- Fast, accurate document QA via hybrid retrieval and LLMs.
- Easy switch between local/offline LLMs (for privacy) and hosted online LLMs (for speed and accuracy).
- Clear guardrails to reduce hallucination and block harmful queries.

The active implementation is in `code/ai_service` (Python + FastAPI). The web demo is in `code/frontend`.

## Architecture & Data Flow

High-level flow:

1. User uploads a PDF via `POST /upload`.
2. `document_processor` loads, cleans, and semantically chunks pages.
3. Chunks are embedded (Hugging Face embeddings) and stored in a per-user FAISS index (`code/vector_store/user_<id>`).
4. User asks a question via `POST /ask`.
5. The pipeline retrieves candidates (FAISS + BM25 + reranker), optionally expands the query via LLM, and generates an answer using the selected LLM provider.
6. Guardrails check input (harmful/off-topic) and output (hallucination/insufficient context). The response includes cited source pages.

Diagram (logical):

User → Frontend → FastAPI (`main.py`) → RAG Pipeline (`rag_pipeline.py`) → Retriever (`retriever.py`) → Vector Store (FAISS) → LLM (Ollama or Online) → Response

## Detailed Components

- `code/ai_service/main.py` — FastAPI app, upload/ask/reset endpoints, health. Will host provider switch endpoints.
- `code/ai_service/rag_pipeline.py` — orchestration: get embeddings, load vectorstore, preprocess query, build retriever, run chain, apply guardrails.
- `code/ai_service/document_processor.py` — PDF loading via `PyPDFLoader`, text cleaning, `SemanticChunker` fallback to `RecursiveCharacterTextSplitter`, and FAISS persistence.
- `code/ai_service/embeddings.py` — loads HuggingFace embeddings (cached module-level instance). Set `HF_TOKEN` env to avoid unauthenticated warnings.
- `code/ai_service/retriever.py` — builds hybrid pipeline: BM25 + FAISS → Ensemble → MultiQuery → Cross-Encoder reranker → ContextualCompressionRetriever.
- `code/ai_service/memory_manager.py` — in-memory per-user conversational memory (windowed buffer).
- `code/ai_service/ollama_manager.py` — helpers to start/check Ollama and ensure the selected Ollama model is available.
- `code/ai_service/guardrails.py` — input/output safety checks, harmful pattern detection, off-topic detection, hallucination detection.
- `code/ai_service/config.py` — runtime constants (vector path, model names, device). Consider updating to load `.env`.
- `code/frontend/` — static demo pages (HTML/CSS/JS) that call the API.

## Environment & Configuration

Primary runtime variables (recommended place: `.env` in project root or `code/ai_service`):

```ini
# LLM Provider switch: offline | online
LLM_PROVIDER=offline

# Online provider: groq | openai | anthropic
ONLINE_PROVIDER=groq

# API Keys (only set those you use)
GROQ_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Ollama
OLLAMA_MODEL=mistral

# Hugging Face token (optional)
HF_TOKEN=
```

Recommended `config.py` additions (use `python-dotenv`): see the README snippet earlier (it adds `LLM_PROVIDER`, `ONLINE_PROVIDER`, and provider API keys/model names).

Security note: never commit API keys. Use environment variables or a secrets store for production.

## Local Development — Step by Step

1. Create virtual environment and activate:

```bash
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# Windows cmd
.venv\Scripts\activate.bat
# macOS / Linux
source .venv/bin/activate
```

2. Install base dependencies:

```bash
pip install -r code/ai_service/requirements.txt
pip install python-dotenv
```

3. (Optional) Install online provider SDKs you plan to use:

```bash
pip install langchain-groq      # Groq
pip install langchain-openai    # OpenAI
pip install langchain-anthropic # Anthropic
```

4. Create `.env` and populate keys.

5. Start Ollama if using offline mode:

```bash
# Ollama must be installed separately (https://ollama.com)
ollama serve
ollama pull mistral
```

6. Run the API:

```bash
cd code/ai_service
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

7. Use the demo frontend (open `code/frontend/chat.html`) or curl to test endpoints.

## API Reference

1) POST /upload
- multipart form-data: `user_id` (string), `file` (PDF)
- returns: JSON with `status`, `message`, `chunks_created`, `user_id`

Example:

```bash
curl -X POST http://localhost:8000/upload \
  -F "user_id=alice" \
  -F "file=@/path/to/document.pdf"
```

2) POST /ask
- form fields: `query` (string), `user_id` (string)
- returns: JSON `{status, answer, sources, original_query, processed_query, llm_provider}`

3) POST /reset
- form field: `user_id` — clears conversation memory for that user.

4) GET /health
- returns runtime health including Ollama and provider info.

5) (Planned) GET /provider and POST /provider/switch
- `GET /provider` returns active provider info.
- `POST /provider/switch` expects `provider` and optional `online_provider` fields; it updates env vars, clears LLM cache, and switches provider at runtime.

Notes: API responses will use status `blocked` when guardrails block a query.

## Provider Switching — Design & Runtime

Design goals:
- Minimal code changes to switch providers at runtime.
- Centralized `llm_manager.py` that returns cached LLM clients based on `LLM_PROVIDER` and `ONLINE_PROVIDER`.
- `rag_pipeline` simply calls `get_llm()` and continues without caring about provider internals.

Runtime switching flow (server-side):

1. Client calls `POST /provider/switch` with `provider=online` and `online_provider=groq`.
2. Server updates `os.environ` and `config` values, calls `clear_llm_cache()`.
3. Next request to `/ask` will call `get_llm()` which initializes the selected online LLM client.

Caching: `llm_manager` caches per-provider instances to avoid reinitializing between requests. `clear_llm_cache()` is available to force reload.

## Troubleshooting & Tips

- If you see `No documents found. Please upload a document first.` — confirm files were successfully indexed into `code/vector_store/user_<id>`.
- If embeddings fail to load: ensure `HF_TOKEN` if using private Hugging Face models; check `EMBEDDING_MODEL` in `config.py`.
- Ollama errors: run `ollama serve` manually and verify `http://localhost:11434/api/tags` is reachable.
- Long CPU processing times: consider running on a machine with a GPU, or switch to an online provider for faster responses.
- Hallucination / unreliable answers: enable `guardrails` (they are on by default) and consider increasing retriever `k` or reranker quality.

## Testing & CI

- Add unit tests under `tests/` for: `document_processor` (chunking), `retriever` (returns), and `guardrails` (detection logic).
- Use a small PDF fixture for integration tests; mock LLM responses when testing pipeline logic.

## Contributing

- Fork, create a feature branch, open a PR with a clear description and tests where applicable.
- Preferred code style: follow existing formatting and keep changes focused.

## License

See the `LICENSE` file in the repository root.

---

If you want, I can now implement the `llm_manager.py`, add the runtime provider endpoints to `main.py`, and wire `rag_pipeline.py` to call `get_llm()` (I can also create a `.env.example`). Which would you like me to do next? 