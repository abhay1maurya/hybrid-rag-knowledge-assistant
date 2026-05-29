ACKNOWLEDGEMENT
............................................................ i

We acknowledge the open-source projects, tools, and community contributions that made DocuMind AI possible: FastAPI and Uvicorn for web serving, FAISS for vector indexing, Hugging Face for embeddings, Ollama and cloud LLM providers for inference, and numerous Python libraries used for text processing. Special thanks to contributors and early testers who provided feedback and sample documents.

LIST OF FIGURES
............................................................ ii

- Figure 1: System architecture (Mermaid diagram) — Chapter 2
- Figure 2: Data flow for document ingestion — Chapter 3
- Figure 3: Deployment diagram (FastAPI + optional Spring Boot + reverse proxy) — Chapter 3

ABBREVIATIONS
............................................................ iii

- RAG: Retrieval-Augmented Generation
- LLM: Large Language Model
- FAISS: Facebook AI Similarity Search
- API: Application Programming Interface
- JWT: JSON Web Token
- DB: Database
- CSV: Comma-Separated Values

ABSTRACT
............................................................ iv

DocuMind AI is a hybrid Retrieval-Augmented Generation system designed to enable secure, accurate, and auditable question answering over user-uploaded documents. It combines semantic vector search (FAISS), classic lexical retrieval (BM25), and modern LLMs (local via Ollama or cloud providers) in a modular pipeline. The project demonstrates how to balance privacy, performance, and explainability by producing answers with cited source passages and runtime provider switching.

Chapter 1: Introduction
............................................................ 1

1.1 Problem Statement
----------------------

Organizations and individuals increasingly rely on domain-specific documents (policies, technical specs, legal agreements, research articles). Manually finding answers across these sources is slow and error-prone. Existing QA systems may provide fluent responses but often lack provenance, may hallucinate, and may expose private data to remote services.

DocuMind AI aims to provide:

- Accurate, context-aware answers with explicit source citations.
- Per-user data isolation by maintaining separate vector indices per user.
- Option to use local models (Ollama) to retain data privacy and control costs.
- Extensibility to swap cloud providers when better performance or models are required.

1.2 Objectives
-------------

This project targets the following technical objectives:

1. Build a robust ingestion pipeline that turns multi-page PDFs into semantically meaningful chunks with preserved metadata (page number, document id, text offsets).
2. Create a hybrid retrieval stack: BM25 for speedy lexical matching and FAISS for dense semantic similarity, combined via an ensemble that can be tuned per workload.
3. Implement reranking (cross-encoder) to refine candidate contexts before LLM consumption.
4. Provide an LLM orchestration layer supporting both local (Ollama) and online providers, with a small management API to switch providers at runtime.
5. Add detection and guardrails for harmful queries, off-topic content, and answer hallucinations; provide `status: blocked` responses when necessary.
6. Supply developer documentation, example deployment manifests, and a minimal frontend to exercise the APIs.

Chapter 2: Literature Review
............................................................ 3

2.1 Scope Of Work
------------------

DocuMind AI focuses on practical, production-friendly RAG design patterns:

- Per-user FAISS indices to reduce data bleed between users and to scale read/write operations independently.
- Hybrid lexical/dense retrieval strategies — building on research showing complementary strengths (lexical for exact terms, dense for semantic matches).
- Reranking via cross-encoders to improve passage relevance before generation, a technique validated in information retrieval literature.
- Prompt engineering and contextual compression to present only necessary context to LLMs, reducing token usage and Hallucination risk.

Key related works and components:

- FAISS (Johnson et al.) for scalable vector lookup in high-dimensional spaces.
- BM25 and other lexical retrieval models widely used in IR.
- Cross-encoder reranking approaches from information retrieval research.
- RAG (Lewis et al.) as a paradigm for grounding LLM outputs in retrieved context.

2.2 Key Responsibilities
------------------------

Detailed mapping of repository modules to responsibilities and extensibility points:

- `code/ai_service/document_processor.py`
  - Responsibilities: reading various document formats (PDF, DOCX), text normalization (unicode normalization, whitespace collapse), semantic chunking (using sentence-boundary aware splitters), metadata extraction (page indices, headings), and storing raw chunks and embeddings.
  - Extension points: custom chunker, OCR integration for scanned PDFs, streaming ingestion API.

- `code/ai_service/embeddings.py`
  - Responsibilities: instantiate and cache embedding model client, batch embedding calls, fallback strategies when HF_TOKEN not provided.
  - Extension points: swap different embedding models, dynamic batching, GPU acceleration.

- `code/ai_service/retriever.py`
  - Responsibilities: build BM25 index over chunk text, FAISS index management, combined scoring and candidate deduplication, and expose a `get_candidates(query, k)` method.
  - Extension points: add ANN index alternatives (HNSW), tune distance metrics, per-user scoring thresholds.

- `code/ai_service/rag_pipeline.py`
  - Responsibilities: orchestrate retrieval, optional query expansion, reranking, context assembly, LLM call orchestration, and post-processing (citation formatting).
  - Extension points: plug different prompt templates, multi-hop retrieval, chain-of-thought toggles.

- `code/ai_service/guardrails.py`
  - Responsibilities: implement policy checks (blacklisted topics, PII detection), output consistency checks (compare answer against retrieved context), and scoring heuristics to detect hallucinations.
  - Extension points: integrate with external safety services, custom per-tenant policies.

2.3 Project Timeline
--------------------

Detailed timeline with deliverables and acceptance criteria (MVP-focused):

- Sprint 0 (setup, 2 days)
  - Initialize repo, create `.venv`, install dependencies, verify sample PDF ingestion.
  - Acceptance: `POST /upload` successfully stores chunks in a local vector store for a sample PDF.

- Sprint 1 (ingestion & embeddings, 1 week)
  - Implement `document_processor`, integrate Hugging Face embeddings, and persist to FAISS.
  - Acceptance: `code/vector_store/user_test/index.faiss` exists after upload and embeddings model produces non-empty vectors.

- Sprint 2 (retrieval & rerank, 1 week)
  - Implement BM25, FAISS query, and cross-encoder reranker; expose `get_candidates`.
  - Acceptance: retrieval precision measured on sample queries exceeds baseline lexical-only approach.

- Sprint 3 (LLM integration & API, 1 week)
  - Add `rag_pipeline` orchestration, integrate Ollama client and one online provider, implement `/ask` endpoint.
  - Acceptance: `/ask` returns answers with sources for sample queries; provider switch works via management API.

- Sprint 4 (guardrails, UI, testing, 1 week)
  - Implement `guardrails`, integrate simple frontend demo, add tests and CI.
  - Acceptance: Guardrail blocks a set of intentionally harmful queries; tests pass locally.

2.4 Project Flowchart
---------------------

Mermaid flowchart (renderable in Mermaid viewers):

```mermaid
flowchart TD
  A[User Browser] --> B[Frontend (Static)]
  B --> C{Optional Spring Boot}
  C -- proxy API --> D[FastAPI RAG Service]
  D --> E[Retriever (BM25 + FAISS)]
  E --> F[Reranker (Cross-Encoder)]
  F --> G[LLM (Ollama / Online)]
  G --> H[Guardrails]
  H --> I[Response with Citations]
  E --> V[Vector Store (per-user FAISS)]
  subgraph infra
    V
    G
  end
```

Figure 1 (above) illustrates how the frontend interacts with an optional Java-based website backend and the core Python RAG service.

Chapter 3: Technology And Methods
............................................................ 9

3.1 Software Requirements
-------------------------

Minimum software stack (development):

- OS: Windows, macOS, or Linux (development tested on Windows and Linux)
- Python 3.11+ (project contains `aivenv` but local venv recommended)
- Java 17+ and Maven/Gradle (only for optional Spring Boot backend)
- Docker (optional for containerized deployment)

Key Python dependencies (representative):

```
fastapi==0.98.0
uvicorn[standard]==0.22.0
faiss-cpu==1.7.3
transformers==4.35.0
sentence-transformers==2.2.2
langchain==0.1.0
python-dotenv==1.0.0
requests
pdfplumber
whoosh
rank-bm25
```

3.2 Hardware Requirements
-------------------------

Estimating resource needs by dataset size:

- Small (<= 100 documents, avg 10 pages): 4 CPU cores, 8 GB RAM, 5–10 GB disk.
- Medium (<= 1,000 documents): 8 CPU cores, 16–32 GB RAM, 50–200 GB disk.
- Large / Production (> 10k documents): consider distributed FAISS, dedicated vector DB, multiple workers and GPU-backed inference for embeddings or local LLMs.

Recommendations:

- Use SSD-backed storage for `model_cache/` and `code/vector_store/` to reduce IO latency.
- Use GPU instances for embedding or local LLM model serving; otherwise use cloud provider LLMs.

3.3 Methodology
---------------

End-to-end method with implementation notes and command examples:

1) Ingest & chunk

- Use `PyPDFLoader` or `pdfplumber` to extract page text and metadata.
- Clean text: normalize whitespace, remove page headers/footers heuristically, preserve page indices.
- Chunking: semantic chunk size (recommended 200–600 tokens) with overlap (10–20%) to preserve context across boundaries.

Code sketch (Python):

```python
from document_processor import SemanticChunker
chunks = SemanticChunker(chunk_size=400, overlap=80).split_text(pdf_text)
for chunk in chunks:
    metadata = {"doc_id": doc_id, "page": chunk.page}
    embedding = embedder.embed_text(chunk.text)
    faiss_index.add(embedding, metadata)
```

2) Embeddings

- Batch embedding for throughput and rate-limiting-friendly usage when calling remote APIs.
- Use local GPU-backed models via `sentence-transformers` when privacy or cost is a concern.

3) Retrieval & rerank

- BM25 provides quick lexical recall for named entities and exact phrasing.
- FAISS returns dense neighbors for semantic similarity; merge candidate lists and deduplicate on chunk id and text.
- Cross-encoder reranker scores combined candidates with the query and returns top-N for context assembly.

4) Prompting & generation

- Use a prompt template that includes: user query, curated context passages with citations, an instruction to answer concisely with source citations, and a safety fallback (e.g., "If insufficient context, say 'Insufficient information'.").
- Example prompt snippet:

```
You are a helpful assistant. Use only the provided contexts to answer. Cite sources in square brackets with page numbers.

CONTEXT:
<context passages>

QUESTION: <user question>

Answer:
```

5) Guardrails

- Check input for prohibited keywords and patterns (e.g., instructions for illegal activities).
- After generation, compare the answer's claims vs. retrieved context; if claims cannot be grounded, flag or redact.

Chapter 4: Results And Discussion
.......................................................... 12

4.1 Expected Outcome
---------------------

Functional expectations for the MVP:

- Document ingestion that produces persistent per-user indices.
- `/ask` returns accurate, concise answers with at least one supporting citation per factual claim when available.
- Management endpoints to switch LLM providers at runtime without server restart (clear LLM clients and reinitialize).

4.2 Final Outcome
------------------

Evaluation metrics and validation approach:

- Precision@k for retrieval: measure if top-k passages contain the ground-truth answer (if labeled dataset available).
- Answer faithfulness: automatic heuristic that computes overlap between generated answer tokens and retrieved context tokens; flag low overlap as potential hallucination.
- Latency: measure 95th percentile response time for `/ask` under realistic loads (including retrieval and LLM time).

Quick validation steps (developer):

```bash
# start service
cd code/ai_service
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# upload fixture
curl -X POST http://localhost:8000/upload -F "user_id=test" -F "file=@tests/fixtures/sample.pdf"

# ask a query
curl -X POST http://localhost:8000/ask -F "user_id=test" -F "query=What is the main conclusion of the document?"
```

4.3 Future Scope
-----------------

Longer-term roadmap items:

- Multi-tenant hardened storage with encryption-at-rest and per-tenant encryption keys.
- Replace FAISS with managed vector DB (Pinecone/Redis/Weaviate) for scale and reliability.
- Add a retriever training pipeline using human feedback to improve reranker and retrieval recall.
- Add full-text search index with morphological normalization and language-specific analyzers.

Chapter 5: Conclusions
.......................................................... 18

The DocuMind AI project offers a pragmatic template for building RAG systems that are both privacy-aware and production-ready. The modular architecture enables incremental improvements: swap retrievers, change embedding models, or adopt new LLM providers.

References
.......................................................... 19

- FAISS — https://github.com/facebookresearch/faiss
- RAG: Retrieval-Augmented Generation — Lewis et al.
- BM25 and classical IR literature
- Ollama docs — https://ollama.com
- Hugging Face embeddings — https://huggingface.co

Appendix A
File Structure Of Project
.......................................................... 20

Full file structure and notes (expanded):

```
d:/projects/hybrid-rag-knowledge-assistant/
├─ LICENSE
├─ README.md
├─ docs/
│  ├─ project_documentation.md
│  └─ springboot_backend.md
├─ code/
│  └─ ai_service/
│     ├─ main.py                # FastAPI application entry
│     ├─ rag_pipeline.py        # Orchestration of retrieval and generation
│     ├─ retriever.py           # BM25 + FAISS candidate retrieval
│     ├─ embeddings.py          # Embedding model loader and cache
│     ├─ document_processor.py  # PDF parsing and chunking
│     ├─ guardrails.py          # Safety checks
│     ├─ memory_manager.py      # Conversation memory per-user
│     ├─ ollama_manager.py      # Ollama client helpers
│     └─ requirements.txt
├─ model_cache/
└─ vector_store/
```

Source Code
.......................................................... 21

Representative code snippets and usage patterns:

1) `main.py` (startup snippet)

```python
from fastapi import FastAPI
from rag_pipeline import RagPipeline

app = FastAPI()
pipeline = RagPipeline()

@app.post('/ask')
async def ask(user_id: str, query: str):
    return pipeline.ask(user_id, query)
```

2) `retriever.py` (simplified combination)

```python
def get_candidates(query, k=20):
    bm25_hits = bm25.search(query, k=10)
    faiss_hits = faiss_index.search(embed(query), k=10)
    merged = merge_and_dedup(bm25_hits, faiss_hits)
    return merged[:k]
```

Appendix B
Abstract In Hindi
.......................................................... 25

संक्षेप:

DocuMind AI एक हाइब्रिड RAG (Retrieval-Augmented Generation) सहायक है जो उपयोगकर्ताओं को दस्तावेज़ अपलोड करने, FAISS-आधारित इनडेक्स बनाने और ऑफ़लाइन LLM (Ollama) या ऑनलाइन प्रदाताओं (Groq/OpenAI/Anthropic) के माध्यम से प्राकृतिक भाषा प्रश्नों के उत्तर प्राप्त करने की सुविधा देता है। यह प्रणाली गोपनीयता, तेज़ी और उत्तरों की विश्वसनीयता के बीच संतुलन बनाती है और संदर्भित स्रोतों के साथ जवाब प्रदान करती है।

Appendix C
Vitae
.......................................................... 26

Author / Maintainer: (Fill in your name and contact details here)

Short CV: (Add a brief biography, affiliations, and key skills)

Figures
-------

- Include `docs/flowchart.png` and `docs/deployment_diagram.png` for visual aids. The Mermaid diagram in Section 2.4 is a text-first representation and can be rendered to PNG using Mermaid CLI or online editors.

