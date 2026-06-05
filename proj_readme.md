# DocuMind AI — Technical Architecture, Subsystems, and Operational Guide

DocuMind AI is a secure, privacy-respecting, and highly modular hybrid Retrieval-Augmented Generation (RAG) assistant. It allows users to upload unstructured documents (PDFs, Word documents, text files, spreadsheets), isolates their data in user-specific vector databases, and performs grounded question answering with explicit source citations. It supports both fully local offline large language models (via Ollama) and cloud-hosted LLM APIs (Groq, OpenAI, Anthropic) with runtime provider switching.

---

## 1. System Architecture & Components Overview

The project is structured as a multi-tier, multi-language application consisting of four primary modules:

1. **Frontend UI (`code/frontend`)**: A client-side web interface using standard HTML5, CSS3 (with responsive layouts, CSS variables, and modern styling), and Vanilla Javascript. It communicates directly with the Spring Boot UI gateway.
2. **Spring Boot UI Gateway (`code/frontenddoc`)**: A Java-based MVC and security middleware built on Spring Boot 4.0.6 and Java 21. It serves frontend pages, enforces role-based access control (Spring Security), and proxies API calls to the downstream microservices.
3. **Spring Boot Auth & Chatbot Backend (`code/Documind_At`)**: A Java-based data repository and Spring AI chatbot service built on Spring Boot 4.0.5 and Java 21. It manages user credentials via a MySQL database and hosts an OpenAI-powered chat client with streaming capabilities.
4. **FastAPI AI Service (`code/ai_service`)**: A Python-based microservice orchestrating document parsing, text chunking, embedding generation, vector search, query pre-processing, guardrail checks, LLM coordination, and evaluation.

```mermaid
flowchart TD
    subgraph Client Tier
        UI[Frontend UI: HTML/CSS/JS]
    end

    subgraph UI Gateway Tier (Port 8080)
        SB[Spring Boot Gateway: frontenddoc]
    end

    subgraph Database & Spring AI Tier (Port 8081)
        DB_BE[Spring Boot Backend: Documind_At]
        MYSQL[(MySQL Database: documind_db)]
    end

    subgraph Python RAG AI Tier (Port 8000)
        FA[FastAPI AI Service: main.py]
        OLL[Ollama Service: Port 11434]
    end

    subgraph Data & Storage Tier
        VS[Vector Store: FAISS Files]
        META[JSON Document Metadata]
        CFG[User Configuration JSONs]
        EVAL[Evaluation Test Sets & Results]
    end

    UI <-->|HTTP Page & REST Requests| SB
    SB <-->|OpenFeign Client| DB_BE
    SB <-->|OpenFeign Client| FA
    DB_BE <-->|JDBC / Hibernate| MYSQL
    FA <-->|REST / Stream API| OLL
    FA <-->|Disk Read/Write| VS
    FA <-->|Disk Read/Write| META
    FA <-->|Disk Read/Write| CFG
    FA <-->|Disk Read/Write| EVAL
    UI -.->|Direct API calls optionally| FA
```

---

## 2. Spring Boot UI Gateway Subsystem (`code/frontenddoc`)

The gateway provides security boundaries, handles page navigation using Thymeleaf templates, and integrates with internal backend services via OpenFeign clients.

### 2.1 Configuration and Dependencies (`pom.xml` & Properties)
- **Runtime Environment**: Java 21, Spring Boot 4.0.6, Spring Cloud 2025.1.1.
- **Key Dependencies**:
  - `spring-boot-starter-thymeleaf`: HTML templates engine.
  - `spring-boot-starter-webmvc`: Web controller support.
  - `spring-boot-starter-security`: For authentication and authorization.
  - `spring-cloud-starter-openfeign`: Declarative REST client for inter-service communication.
- **Application Properties**: Includes basic naming configurations and specifies server ports (defaulting to 8080).

### 2.2 Security Architecture (`websecrity.java` & `CustomUserDetailsService.java`)
- **CSRF**: Disabled for simplicity in local setups (`csrf -> csrf.disable()`).
- **Route Authorization rules**:
  - **Permit All**: `/loginpage`, `/signup`, `/submiting`, `/landingpage`, `/`, `/faq`, `/pricinglagacy`, `/features`, and all static resource routes (`/css/**`, `/js/**`, `/imag/**`).
  - **Protected (Requires `USER` role)**: All other requests (e.g., `/dashboard`, `/chat`, `/profile`, `/settinglagacy`, `/doclib`, `/models`, `/policies`, `/support`).
- **Form Login**: Uses a custom login page `/loginpage`, processes logic on `/login`, maps parameters (`email`, `password`), and redirects to `/dashboard` on success.
- **Password Encoder**: Utilizes `NoOpPasswordEncoder.getInstance()` (plaintext passwords, intended for development).
- **User Detail Retrieval**: Maps user records by calling the external database service running on `http://localhost:8081` via OpenFeign.

### 2.3 Declarative HTTP Clients (Feign Clients)
- **`aiservicesbackend.java`**: Hooks onto the Python FastAPI service (`http://localhost:8000`). It exposes proxy mappings for:
  - System health checks (`/`, `/health`, `/supported-formats`).
  - Provider management (`/provider`, `/provider/switch`, `/reset`).
  - Uploads (`/upload`) and Ask QA (`/ask`, `/ask/stream`).
  - Configuration updates (`/config/options`, `/config/{user_id}`, etc.).
  - Document Management (`/documents/{user_id}`, `/documents/{user_id}/{doc_id}`).
  - Evaluations (`/eval/{user_id}/run`, `/eval/{user_id}/results`, etc.).
- **`BackendAi.java`**: Hooks onto the secondary database backend (`http://localhost:8081`). Exposes methods for:
  - Registering users (`POST /savedata`).
  - User logins (`GET /findByUsername?email={email}`).

### 2.4 Controllers
- **`pagecontroller.java`**: Standard Spring MVC controller directing secure and insecure page navigation. It injects user details into the Thymeleaf models for the dashboard, profile, and chat pages by checking the security context principal.
- **`homecontrolles.java`**: Coordinates public signup form submissions (`GET /signup`, `GET /submiting`), assigns a default `USER` role and creation timestamp, and proxies the `/health` endpoint directly from the FastAPI service.

---

## 3. Spring Boot Backend & Chatbot Subsystem (`code/Documind_At`)

This Java service acts as the central data storage engine and implements an independent conversational chatbot using the **Spring AI** framework.

### 3.1 Configuration and Dependencies (`pom.xml` & Properties)
- **Runtime Environment**: Java 21, Spring Boot 4.0.5, Spring AI BOM `2.0.0-M8`.
- **Key Dependencies**:
  - `spring-boot-starter-data-jpa`: Object-relational mapping (ORM) abstraction.
  - `spring-boot-starter-webmvc`: Web controller support for API endpoints.
  - `spring-ai-starter-model-openai`: OpenAI integration via Spring AI.
  - `mysql-connector-j`: JDBC driver for MySQL database connectivity.
- **Application Properties**:
  - Sets the server port to `8081`.
  - Database Driver: `com.mysql.cj.jdbc.Driver`.
  - Database URL: `jdbc:mysql://localhost:3306/documind_db` (using standard login parameters).
  - Hibernate DDL: `update` (dynamically creates tables on startup).
  - OpenAI Key: Configured via `spring.ai.openai.api-key` for OpenAI client authentication.

### 3.2 Database Models & Schema (`model/` & `repository/`)
The system maps its data structures directly to the MySQL database `documind_db`:
- **`User.java`**: Maps to table `users`. Holds `userId`, `name`, `email` (unique), `password`, `role`, `createdAt`, and maps a one-to-many relationship to `Document`.
- **`Document.java`**: Maps to table `documents`. Holds `docId`, `fileName`, `fileType`, `filePath`, `uploadDate`, and maps a many-to-one relationship to `User`, and a one-to-many relationship to `ChunkMetadata`.
- **`ChunkMetadata.java`**: Maps to table `chunk_metadata`. Holds `chunkId`, `chunkText` (column type `TEXT`), `embeddingId`, and references the parent `Document`.
- **`QueryHistory.java`**: Maps to table `query_history`. Holds user questions, generated AI responses, timestamps, and references the initiating `User`.
- **`ModelConfig.java`**: Maps to table `model_config`. Holds configuration parameters like AI `mode` (online/offline), `modelName`, and `apiKey`.
- **`userrepository.java`**: Provides JpaRepository query handlers, notably `findByEmail(String email)`.

### 3.3 Controllers & Services (`controllers/` & `Services/`)
- **`maincontrollers.java`**: Exposes REST interfaces to support gateway authentication and registration:
  - `POST /savedata`: Persists user parameters to the MySQL database (invoked by `homecontrolles.java` on the gateway).
  - `GET /findByUsername`: Retrieves user info by email (invoked by `CustomUserDetailsService` on the gateway).
- **`ChatController.java`**: Exposes Spring AI OpenAI chatbot operations under the `/ai` prefix:
  - `GET /ai/demo`: Direct query interface that calls the OpenAI chat client and returns a static string response.
  - `GET /ai/ask`: Returns a reactive stream `Flux<String>` (`MediaType.TEXT_EVENT_STREAM_VALUE`) for real-time token output.
- **`openchatclineservices.java`**: Orchestrates OpenAI calls via Spring AI's `ChatClient.Builder`. Implements two core modes:
  - **Static Mode (`ask`)**: Invokes a detailed `SYSTEM_PROMPT` defining DocuMind AI’s role (concise, context-aware RAG assistant, < 80 words, professional tone).
  - **Streaming Mode (`Streemchat`)**: Configures a dynamic career coach/student support persona:
    `"You are DocuMind AI, a helpful assistant for students and freshers. Focus on study help, interview preparation, coding, and career guidance."`

---

## 4. Python FastAPI AI Subsystem (`code/ai_service`)

The Python AI service serves as the execution engine for data extraction, hybrid retrieval, LLM inference, and guardrails.

### 4.1 Runtime Configurations (`config.py` & `model_registry.py`)
- **Hardware Auto-Detection**:
  ```python
  if torch.cuda.is_available():
      BEST_DEVICE = "cuda"
  elif torch.backends.mps.is_available():
      BEST_DEVICE = "mps"
  else:
      BEST_DEVICE = "cpu"
  ```
  Forces embedding models to run on GPU processing if available.
- **Default Paths**: Vector stores are persisted in `vector_store/`, and embedding models are cached locally in `./model_cache` to support air-gapped runtimes.
- **API and Model Integrations**:
  - **Ollama**: Default endpoint `http://localhost:11434`. Models are dynamically pulled if not present (Default: `mistral`, Guardrails/Preprocessing: `qwen2.5:0.5b`).
  - **Groq**: `llama-3.3-70b-versatile` (Default online).
  - **OpenAI**: `gpt-4o-mini`.
  - **Anthropic**: `claude-sonnet-4-20250514`.

### 4.2 Registry of Capabilities (`model_registry.py`)
- **Embedding Models**: Lists options like `bge-large` (1024 dims), `bge-base` (768 dims), `bge-small` (384 dims), `all-MiniLM-L6-v2` (384 dims), and `all-mpnet-base-v2` (768 dims).
- **Chunking Strategies**:
  - `recursive`: Rule-based parsing with custom paragraph and sentence splitters.
  - `semantic`: Uses embedding breakpoint thresholds (Standard Deviation, Percentile, or Interquartile) to segment text on logical boundaries.
  - `fixed`: Standard fixed-size chunking.
- **Retrieval Parameters**: Sets defaults for `k_candidates` (retrieval volume, default: 10), `top_n_rerank` (reranking window, default: 3), `bm25_weight` (lexical search weight, default: 0.3), `use_multi_query` (default: false), and `use_reranker` (default: true).

### 4.3 Dynamic User Configuration (`user_config_manager.py` & `config_router.py`)
- **Data Model**: Saves individual JSON settings in `user_configs/{user_id}.json`. When a user accesses the system for the first time, default settings (`DEFAULT_USER_CONFIG`) are generated.
- **Validation Suite**: `validate_config()` checks bounds on parameters like `k_candidates` (3 to 30), `top_n_rerank` (1 to 10), `bm25_weight` (0.0 to 1.0), and matches LLM models to their respective providers.
- **State Migration Warnings**: If a user updates their `embedding_model`, the server issues a structural incompatibility warning indicating that their current FAISS indices must be purged and re-uploaded.

### 4.4 Multi-Format Document Ingestion (`file_handlers/`)
All file parsers inherit from `BaseFileHandler` (`base_handler.py`), enforcing a unified interface for loading files. The `HandlerFactory` maps file extensions to appropriate handlers:

1. **`pdf_handler.py`**: Uses `PyPDFLoader` to extract page content and page numbers.
2. **`txt_handler.py`**: Handles `.txt`, `.md`, `.rst`, and `.log` files. Autodetects encodings (falling back to `latin-1` if `utf-8` fails) and groups text blocks into logical pages (maximum size 3,000 characters) at double newlines to maintain citation capabilities.
3. **`docx_handler.py`**: Extracts text from paragraphs grouped by headings (e.g. Heading 1, Heading 2), and converts Word tables into markdown text blocks containing row indexes.
4. **`csv_handler.py`**: Parses `.csv`, `.xlsx`, and `.xls` files using `pandas`.
   - **Summary Documents**: Generates a schema sheet overview mapping columns, row counts, and sample values.
   - **Data Documents**: Converts table records into natural language descriptions, grouped in batches of 50 rows.

### 4.5 Document Processor & Vector Management (`document_processor.py` & `document_manager.py`)
- **Ingestion Pipeline (`document_processor.py`)**:
  - Validates format compatibility.
  - Normalizes whitespace and merges broken hyphens.
  - Instantiates the text splitter. For `semantic` chunking, it processes chunks sequentially to prevent memory spikes.
  - Adds metadata (`user_id`, `chunk_size`, `embedding_model`, `chunking_strategy`, `page`, and overrides the original `source` file name).
  - Initializes or appends chunks to the user's FAISS vector store located in `vector_store/user_{user_id}/`.
- **Metadata Management (`document_manager.py`)**:
  - Persists indexes in `doc_metadata/{user_id}.json`.
  - Tracks document names, versions, sizes, chunk sizes, upload times, and strategy parameters.
  - **Targeted Purges**: The `delete_document()` function allows users to delete a single document. Instead of rebuilding the entire vector store, it scans the FAISS index, retrieves the specific LangChain docstore IDs, and runs:
    ```python
    vectorstore.delete(ids_to_delete)
    vectorstore.save_local(index_path)
    ```
    This removes only the target chunks without affecting the rest of the index.

### 4.6 Hybrid Retrieval and Reranking Pipeline (`retriever.py`)
To maximize precision and recall, the system builds a hybrid retrieval graph:

```
                  ┌───────────────────────┐
                  │ User Question / Query │
                  └───────────┬───────────┘
                              ▼
                ┌───────────────────────────┐
                │    MultiQueryRetriever    │
                │ (Generated Query Variants)│
                └─────────────┬─────────────┘
                              ▼
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
┌───────────────────────┐           ┌───────────────────────┐
│     BM25Retriever     │           │    FAISS Vector Store │
│   (Lexical Recall)    │           │   (Semantic Search)   │
└───────────┬───────────┘           └───────────┬───────────┘
            │                                   │
            └─────────────────┬─────────────────┘
                              ▼
                ┌───────────────────────────┐
                │     EnsembleRetriever     │
                │ (Combines & Weighs Hits)  │
                └─────────────┬─────────────┘
                              ▼
                ┌───────────────────────────┐
                │   CrossEncoderReranker    │
                │ (BAAI/bge-reranker-base)  │
                └─────────────┬─────────────┘
                              ▼
                ┌───────────────────────────┐
                │    Top-N Context Chunks   │
                └───────────────────────────┘
```

1. **Lexical Retrieval (BM25)**: Evaluates all documents currently loaded in the user's FAISS instance to identify exact terms and keyword hits.
2. **Dense Semantic Retrieval (FAISS)**: Searches embedding vectors to capture conceptual relationships.
3. **Ensemble Blending**: Combines results from BM25 and FAISS using weighted parameters.
4. **Query Expansion (Multi-Query)**: Generates query variations to resolve ambiguities.
5. **Cross-Encoder Reranking**: Re-evaluates retrieval candidates against the query using `BAAI/bge-reranker-base`, narrowing down results to the top `top_n_rerank` context chunks.

### 4.7 Query Preprocessing & Latency Optimizations (`query_processor.py`)
- **Query Cleaning**: Normalizes spacing and strips basic punctuation.
- **Filler Word Stripping**: Removes conversational phrases (e.g., *"please tell me"*, *"can you help me with"*).
- **Latency Optimization**:
  ```python
  if not expand or word_count < 7:
      # Bypass LLM expansion for short queries to reduce latency
      return core_text
  ```
  If the cleaned query is under 7 words, it bypasses LLM expansion to avoid extra API latency. For longer, complex queries, it uses the fast `qwen2.5:0.5b` model to generate an optimized vector database search query.

### 4.8 Dual-Stage Guardrails (`guardrails.py`)
- **Input Content Filter**: Scans queries using RegEx pattern matching (`HARMFUL_PATTERNS`) to detect harmful queries without adding LLM latency.
- **Context Sufficiency Check**: Checks if the retrieved documents contain substantive content. If no relevant chunks are found, it blocks generation and returns a user-friendly fallback response.
- **Hallucination Detection**: Compares the generated answer against the top 3 retrieved contexts using `qwen2.5:0.5b`. If the answer introduces claims not present in the context, it replaces the response with a fallback message:
  *"I found some related content in your documents but couldn't generate a reliable answer. Please try rephrasing..."*

### 4.9 LLM Session Management & Streaming (`llm_manager.py`, `rag_pipeline.py`, `stream_pipeline.py`, `streaming.py`)
- **Caching**: The `llm_manager` caches provider clients by stitching the provider name and model into a unique cache key (`provider__model`), clearing the cache when configuration changes occur.
- **Standard QA Pipeline**:
  - Resolves active settings, checks input guardrails, and loads user FAISS vectors.
  - Formats retrieved chunks using a `PromptTemplate` prefix (`"--- SOURCE: Page {page} ---"`).
  - Uses `ConversationalRetrievalChain` to run the condensed question and context prompts, checks output guardrails, and appends the exchange to the user's sliding-window memory (`memory_manager.py`, default: k=5).
- **Streaming QA Pipeline**:
  - Yields real-time generation updates as Server-Sent Events (SSE).
  - Streaming clients are created on a per-request basis.
  - Spawns the LLM call inside a non-blocking thread executor (`asyncio.create_task()`).
  - Catches generated tokens using a custom `StreamingCallbackHandler` (`AsyncCallbackHandler`), queues them in an asynchronous queue, and yields them to the client.
  - Runs output guardrails on the completed text string. If a hallucination is detected, it pushes a `guardrail` correction event to update the client UI.

---

## 5. Evaluation Module (`code/ai_service/evaluator`)

The evaluator provides tools to test RAG pipelines and measure performance.

### 5.1 Test Set Management (`test_set_manager.py` & `eval_router.py`)
- **CRUD Operations**: Saves test queries and ground-truth values to `eval_test_sets/{user_id}_testset.json`.
- **Automated Generation**:
  - Loads a sample of up to 10 document chunks from the user's FAISS index.
  - Uses the active LLM to generate `n` diverse test questions based on the document content.

### 5.2 Scoring Framework (`ragas_evaluator.py`)
Measures five metrics on a scale of `0.0` to `1.0`:
1. **Faithfulness**: Verifies if the generated answer is fully grounded in the retrieved context.
2. **Answer Relevancy**: Checks if the answer directly addresses the user's question.
3. **Context Precision**: Measures the ratio of retrieved context chunks that are relevant.
4. **Context Recall**: Verifies if the retrieved context contains the information needed to match the ground truth.
5. **Answer Correctness**: Compares the generated answer to the ground truth.

### 5.3 Actionable Optimization Feedback
Evaluations returning scores below `0.7` automatically generate tuning suggestions:

| Target Metric | Detected Issue | Recommended Fix |
| :--- | :--- | :--- |
| **Faithfulness** | LLM is introducing claims not present in the context. | Set temperature to 0, enforce strict instructions, or increase the rerank size. |
| **Answer Relevancy** | Generated answers do not directly address the question. | Improve query preprocessing or enable query expansion. |
| **Context Precision** | Retriever is returning irrelevant context chunks. | Decrease `k_candidates` (try 5-7), increase BM25 weights, or enable reranking. |
| **Context Recall** | Retriever is missing relevant context chunks. | Increase `k_candidates` (try 15-20), enable multi-query, or use smaller chunk sizes. |

### 5.4 Results Store (`eval_store.py`)
- **Storage**: Saves results in `eval_results/{user_id}_results.json`.
- **Fault Tolerance**: Checks JSON formatting during read operations. If corruption is detected, it backs up the file to `{user_id}_results.json.corrupted` and creates a fresh instance.
- **Trend Analysis**:
  - Aggregates average, best, and worst scores for each metric across runs.
  - Evaluates performance trends (e.g., *improving*, *declining*, *stable*) based on the last three runs.

---

## 6. System Data Flows

### 6.1 Document Ingestion Flow
```
[User File Upload]
       │
       ▼
[FastAPI: main.py] ──► Checks Allowed Extensions
       │
       ▼
[document_processor.py]
       │
       ├──► 1. Load File Content (file_handlers/)
       ├──► 2. Normalize and Clean Whitespace
       ├──► 3. Instantiate Splitter (recursive / semantic)
       ├──► 4. Apply Metadata (user_id, source filename, page)
       └──► 5. Generate Embeddings & Save to FAISS index
```

### 6.2 QA Query Flow (Streaming Example)
```
[User Query Input]
       │
       ▼
[FastAPI: GET /ask/stream]
       │
       ├──► 1. Run Input Guardrails (RegEx content scan)
       ├──► 2. Preprocess Query (conditional expansion via qwen2.5:0.5b)
       ├──► 3. Load user FAISS Vector store & Reranker
       ├──► 4. Retrieve Context Chunks (BM25 + FAISS + Cross-Encoder Rerank)
       ├──► 5. Send 'generating' status event
       ├──► 6. Stream Tokens in real-time via SSE Events
       ├──► 7. Evaluate completed answer via Output Guardrails
       └──► 8. Emit 'done' event with source citations
```

---

## 7. API References

### 7.1 Core API Endpoints

#### `POST /upload`
- **Payload**: Multipart form-data with `user_id` (string) and `file` (binary).
- **Behavior**: Parses, chunks, embeds, and indexes documents into the user's vector store.
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Document processed successfully.",
    "doc_id": "document_name_pdf",
    "chunks_created": 14,
    "user_id": "user_1",
    "config_used": {
      "embedding_model": "bge-base",
      "chunking_strategy": "recursive",
      "chunking_params": { "chunk_size": 600, "chunk_overlap": 100 }
    }
  }
  ```

#### `POST /ask`
- **Payload**: Form-data with `query` (string) and `user_id` (string).
- **Behavior**: Retrieves context and returns the complete answer.
- **Response**:
  ```json
  {
    "status": "success",
    "answer": "Grounded answer text here.",
    "sources": ["Page 1", "Page 4"],
    "original_query": "User query",
    "processed_query": "Cleaned user query",
    "llm_provider": {
      "provider": "groq",
      "model": "llama-3.3-70b-versatile",
      "speed": "very fast",
      "accuracy": "very high",
      "requires_key": true
    }
  }
  ```

#### `GET /ask/stream`
- **Parameters**: Query string with `query` and `user_id`.
- **Response**: SSE stream containing events (`start`, `status`, `query_processed`, `generating`, `token`, `guardrail`, `sources`, `done`, `blocked`, `error`).

---

### 7.2 Configuration API Endpoints

#### `GET /config/options`
- **Response**: Returns available embedding models, chunking strategies, LLM models, and default configurations.

#### `PATCH /config/{user_id}`
- **Payload**: JSON update parameters.
- **Behavior**: Updates settings on disk. Updates to embedding models return a warning about index compatibility.

---

### 7.3 Document API Endpoints

#### `GET /documents/{user_id}`
- **Response**: Lists all indexed documents, including version numbers and chunk counts.

#### `DELETE /documents/{user_id}/{doc_id}`
- **Behavior**: Deletes chunks associated with the document from the user's FAISS index.

---

### 7.4 Evaluation API Endpoints

#### `POST /eval/{user_id}/test-set/add`
- **Payload**: JSON with `question` and `ground_truth`.
- **Response**: Adds the question to the evaluation set.

#### `POST /eval/{user_id}/run`
- **Response**: Runs evaluation and returns scores, pass/fail status, and tuning recommendations.

Viewed proj_readme.md:421-429

Here is the complete end-to-end flowchart of the project, detailing how users, gateways, database backends, AI servers, and vector databases interact.

### 1. Unified Project Flowchart (Mermaid)

```mermaid
flowchart TD
    %% Define Styles
    classDef client fill:#f9f,stroke:#333,stroke-width:2px;
    classDef gateway fill:#bbf,stroke:#333,stroke-width:2px;
    classDef backend fill:#fbf,stroke:#333,stroke-width:2px;
    classDef aiservice fill:#bfb,stroke:#333,stroke-width:2px;
    classDef datastore fill:#ffb,stroke:#333,stroke-width:2px;
    
    %% Client Tier
    subgraph Client [Client UI - code/frontend]
        Browser["User Browser (HTML / CSS / JS)"]
    end
    class Browser client;

    %% Gateways & Core Routing Tier
    subgraph Gateway [Gateway - code/frontenddoc (Port 8080)]
        SecFilter{"Spring Security Filter"}
        PageController["pagecontroller (Thymeleaf Router)"]
        HomeController["homecontrolles (Signup/Health Handler)"]
        FeignAI["aiservicesbackend (Feign Client)"]
        FeignDB["BackendAi (Feign Client)"]
    end
    class SecFilter,PageController,HomeController,FeignAI,FeignDB gateway;

    %% Database & Spring AI Tier
    subgraph RelationalDB [Relational Backend - code/Documind_At (Port 8081)]
        MainController["maincontrollers (User Controller)"]
        ChatController["ChatController (Spring AI Interface)"]
        UserService["userservices (JPA Handler)"]
        SpringAIClient["openchatclineservices (Spring AI ChatClient)"]
        MySQL[("MySQL (documind_db)")]
    end
    class MainController,ChatController,UserService,SpringAIClient,MySQL backend;

    %% Python RAG AI Service Tier
    subgraph RAGService [Python AI Service - code/ai_service (Port 8000)]
        FastAPIApp["main.py (FastAPI App)"]
        ConfigRouter["config_router.py"]
        DocRouter["document_router.py"]
        DocProcessor["document_processor.py"]
        DocManager["document_manager.py"]
        QueryProcessor["query_processor.py"]
        Guardrails["guardrails.py (Input/Output Safety)"]
        Retriever["retriever.py (BM25 + FAISS + Cross-Encoder)"]
        RAGPipeline["rag_pipeline.py / stream_pipeline.py"]
        LLMManager["llm_manager.py (LLM Cache Factory)"]
        OllamaManager["ollama_manager.py (Ollama Daemon Controller)"]
        Evaluator["evaluator/ (Ragas Scoring Router)"]
    end
    class FastAPIApp,ConfigRouter,DocRouter,DocProcessor,DocManager,QueryProcessor,Guardrails,Retriever,RAGPipeline,LLMManager,OllamaManager,Evaluator aiservice;

    %% Physical Storage Tier
    subgraph DataStorage [Storage & Inference Assets]
        FAISS_DB[("FAISS Vector Index (per-user)")]
        DocMeta[("JSON Metadata (doc_metadata/)")]
        UserConfigs[("User Configurations (user_configs/)")]
        EvalResults[("Test Sets & Results (eval_results/)")]
        OllamaAPI["Ollama Service (Port 11434)"]
        OpenAIAPI["OpenAI API Client"]
        CloudLLM["Cloud LLM Providers (Groq / Anthropic)"]
    end
    class FAISS_DB,DocMeta,UserConfigs,EvalResults,OllamaAPI,OpenAIAPI,CloudLLM datastore;

    %% ──── DATA FLOW CONNECTIONS ────

    %% Auth & Navigation Flow
    Browser -->|1. GET Route / Request| SecFilter
    SecFilter -->|Auth Check Failed| Browser
    SecFilter -->|Public Route / Auth OK| PageController
    PageController -->|Render Thymeleaf Views| Browser
    SecFilter -->|Signup Request| HomeController
    HomeController -->|Register User| FeignDB
    FeignDB -->|REST Call /savedata| MainController
    MainController --> UserService
    UserService -->|Insert User Credentials| MySQL
    SecFilter -->|Load Session Username| FeignDB
    FeignDB -->|REST Call /findByUsername| MainController
    
    %% Spring AI Chatbot Flow
    Browser -->|Direct Spring AI Chat Request /ai/*| ChatController
    ChatController --> SpringAIClient
    SpringAIClient -->|Prompt + System Rules| OpenAIAPI

    %% Document Ingestion Flow
    Browser -->|Upload File (PDF/CSV/Word/TXT)| HomeController
    HomeController -->|Proxy File| FeignAI
    FeignAI -->|Multipart POST /upload| FastAPIApp
    FastAPIApp -->|Process & Tokenize| DocProcessor
    DocProcessor -->|File Type Detection| Handlers["file_handlers/ (Factory Registry)"]
    Handlers -->|Extract Page Text & Metadata| DocProcessor
    DocProcessor -->|Segment & Embed (GPU/CPU)| FAISS_DB
    DocProcessor -->|Update Index Metadata| DocManager
    DocManager -->|Save JSON Details| DocMeta

    %% Hybrid RAG Ask / QA Flow (Blocking & SSE Streaming)
    Browser -->|Submit Question /ask| FeignAI
    FeignAI -->|POST /ask or GET /ask/stream| FastAPIApp
    FastAPIApp --> RAGPipeline
    RAGPipeline -->|1. Input Security Scan| Guardrails
    RAGPipeline -->|2. Query Normalization & Condensation| QueryProcessor
    QueryProcessor -->|Short Queries (< 7 Words)| DirectRetrieval["Skip Query Expansion"]
    QueryProcessor -->|Complex Queries| OllamaManager
    OllamaManager -->|Pull & Launch qwen2.5:0.5b| OllamaAPI
    OllamaAPI -->|Synonym Expansion| QueryProcessor
    RAGPipeline -->|3. Fetch Candidates| Retriever
    Retriever -->|Dense Embedding Match| FAISS_DB
    Retriever -->|Lexical Keyword Match| BM25["BM25 Index (InMemory)"]
    BM25 & FAISS_DB -->|Ensemble Fusion| Ensemble["EnsembleRetriever"]
    Ensemble -->|4. Context Re-Scoring| CrossEncoder["CrossEncoderReranker (bge-reranker-base)"]
    CrossEncoder -->|Retrieve Top-N Chunks| RAGPipeline
    RAGPipeline -->|5. Build Context Prompt| LLMManager
    LLMManager -->|Load User Config Provider| LLM_Inference{"Provider Match"}
    LLM_Inference -->|Offline| OllamaAPI
    LLM_Inference -->|Online| CloudLLM
    LLM_Inference -->|Stream Tokens back via SSE| FastAPIApp
    LLM_Inference -->|Completed Answer| Guardrails
    Guardrails -->|6. Hallucination Check| RAGPipeline
    RAGPipeline -->|7. Append Memory (k=5)| Memory["memory_manager.py"]
    RAGPipeline -->|8. Form Citations & Return Answer| Browser

    %% Evaluation Suite Flow
    Browser -->|Manage Test Set & Run| FeignAI
    FeignAI -->|Proxy /eval/*| FastAPIApp
    FastAPIApp --> Evaluator
    Evaluator -->|Auto-generate Questions| SampleChunks["Load Doc Chunks"]
    SampleChunks -->|Prompt LLM to Create Qs| Evaluator
    Evaluator -->|Run Ragas Pipeline| TestSuite["Validate QA Pairs"]
    TestSuite -->|Score: Faithfulness, Relevancy, Precision, Recall, Correctness| EvalResults
    TestSuite -->|Generate Actionable Parameter Tuning Suggestions| Browser
```

---

### 2. Deep Dive Into Flow Phases

#### A. User & Session Authentications
* **Step 1**: The user requests a protected view (e.g. `/chat`, `/dashboard`). 
* **Step 2**: The gateway **Spring Security Filter** intercepts the request. If not authenticated, the user is redirected to the `/loginpage`.
* **Step 3**: On login, `CustomUserDetailsService` queries the relational backend `Documind_At` on port `8081` using a declarative OpenFeign client (`BackendAi`).
* **Step 4**: The relational backend queries the **MySQL Database** to check credentials, verifying usernames/emails and passwords.

#### B. Document Ingestion Pipeline
* **Step 1**: The user drops a file (PDF, TXT, MD, DOCX, CSV, Excel) in the document library interface.
* **Step 2**: The gateway proxies the upload stream to the Python AI service (`/upload`).
* **Step 3**: The FastAPI service handles routing:
  1. The **Handler Factory** allocates the appropriate document loader class (e.g., `PDFHandler`, `CSVHandler`).
  2. The parser extracts page text, headers, headings, tables, or row data and normalizes whitespace.
  3. The **Text Splitter** splits the text into chunks based on the user's config (e.g. `recursive` or `semantic`).
  4. Local embedding models (loaded and cached in `model_cache/` using CUDA/MPS/CPU processing) vectorize the text.
  5. Chunks are saved to a user-isolated **FAISS Index** (`vector_store/user_{user_id}`).
  6. Document metadata (file details, chunk count, timestamp, processing configuration) is saved in `doc_metadata/{user_id}.json`.

#### C. Grounded Hybrid RAG QA Pipeline
* **Step 1**: The user submits a query. The request is processed as a blocking REST call (`/ask`) or a Server-Sent Event stream (`/ask/stream`).
* **Step 2**: The query runs through an **Input Guardrail** to filter harmful keywords or SQL injections.
* **Step 3**: The query is cleaned of filler words. If it contains fewer than 7 words, query expansion is bypassed to reduce latency. Otherwise, `qwen2.5:0.5b` generates synonym expansions.
* **Step 4**: The **Retriever** runs hybrid search:
  * **Lexical Match (BM25)**: Evaluates term frequencies on the active document chunks.
  * **Dense Match (FAISS)**: Finds semantic neighbors in the vector store.
  * **Ensemble Fusion**: Combines and weights the results.
  * **Cross-Encoder Reranker**: Re-ranks the combined documents using `bge-reranker-base` to find the most relevant context chunks.
* **Step 5**: The prompt is assembled with strict instructions: *"Answer using ONLY the context provided below. If insufficient, state so... Cite sources as [Source: DocName/PageNumber]"*.
* **Step 6**: The query is routed to the configured provider client (local Ollama or remote Groq/OpenAI/Anthropic).
* **Step 7**: The generated answer is checked by the **Output Guardrail** for hallucinations by comparing it against the source context using `qwen2.5:0.5b`. If it fails validation, a standard fallback response is returned.
* **Step 8**: The query and answer are saved to the user's sliding-window conversational memory (k=5), and the response is sent back to the browser.

Edited proj_readme.md
Viewed proj_readme.md:544-576

Here is the complete **System Architecture** of the **DocuMind AI** project, detailing the layered structure, deployment ports, and the integration paradigms used across the modules.

---

### 1. Multi-Tiered System Architecture Layout

The project employs a modular, four-tier microservice architecture to decouple the presentation, gateway orchestration, database persistence, and heavy AI inference computations.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT TIER                                │
│                     Browser UI (HTML5, Vanilla CSS, JS)                 │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTP (Port 8080)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            UI GATEWAY TIER                              │
│              Spring Boot UI Gateway (frontenddoc - Port 8080)           │
│        [Thymeleaf Router]  [Spring Security]  [OpenFeign Clients]       │
└──────────────────────┬───────────────────────────┬──────────────────────┘
                       │                           │
         Feign (8081)  │                           │ Feign (8000)
                       ▼                           ▼
┌───────────────────────────────┐   ┌─────────────────────────────────────┐
│    DATABASE & SPRING AI TIER  │   │          CORE AI INFERENCE TIER     │
│   Backend Service (Port 8081) │   │     FastAPI AI Service (Port 8000)   │
│  [Spring Data JPA] [Spring AI]│   │    [RAG Pipeline] [Reranker / BM25] │
└──────────────┬────────────────┘   └──────────────┬──────────────┬───────┘
               │                                   │              │
               │ JDBC                              │ REST         │ Local Disk
               ▼                                   ▼              ▼
┌───────────────────────────────┐   ┌───────────────────────────┐ ┌───────┐
│     DATA PERSISTENCE TIER     │   │   LOCAL LLM DAEMON TIER   │ │Local  │
│      MySQL (documind_db)      │   │    Ollama (Port 11434)    │ │Disk   │
│ [Users, History, Documents]   │   │  [mistral, qwen2.5:0.5b]  │ │Store  │
└───────────────────────────────┘   └───────────────────────────┘ └───────┘
```

---

### 2. Detailed Architectural Layers

#### Tier 1: Client / Presentation Tier (`code/frontend`)
* **Technology Stack**: HTML5, Vanilla CSS3 (utilizing modern styling, dark-mode styling, glassmorphism, responsive grids, and variables), and Vanilla JavaScript.
* **Architecture**: Stateless client. Main interfaces like [chat.html](file:///d:/projects/hybrid-rag-knowledge-assistant/code/frontend/chat.html) and [chat.js](file:///d:/projects/hybrid-rag-knowledge-assistant/code/frontend/chat.js) load data dynamically. The UI communicates with the downstream Spring Boot Gateway, and can optionally point directly to the FastAPI service.

#### Tier 2: UI Gateway Tier (`code/frontenddoc`)
* **Technology Stack**: Java 21, Spring Boot 4.0.6, Thymeleaf, Spring Security, Spring Cloud OpenFeign.
* **Role**:
  * **File Server**: Serves HTML pages mapped under `src/main/resources/templates` and styles/scripts under `src/main/resources/static`.
  * **Security Layer**: Intercepts requests, handles logins, and checks for the `USER` role.
  * **Declarative API Gateway**: Uses **OpenFeign** interfaces to route requests downstream, keeping client browsers insulated from backend server IPs and ports.

#### Tier 3: Database & Spring AI Tier (`code/Documind_At`)
* **Technology Stack**: Java 21, Spring Boot 4.0.5, Spring Data JPA, Spring AI (OpenAI Client Builder), MySQL JDBC Connector.
* **Role**:
  * **User & Document Registry**: Manages user details (`users` table), files (`documents`), document chunks (`chunk_metadata`), and configurations (`model_config`).
  * **Spring AI Chat Engine**: Exposes independent chatbot endpoints at `/ai/ask` and `/ai/demo` which connect directly to OpenAI's models via Spring AI integration.

#### Tier 4: Core RAG AI Inference Tier (`code/ai_service`)
* **Technology Stack**: Python 3.11+, FastAPI, Uvicorn, LangChain, FAISS, PyTorch (CUDA/MPS auto-detection), Sentence Transformers.
* **Role**:
  * **Document Ingestion Engine**: Orchestrates the multi-format pipeline (PDF, CSV, Word, Markdown, plain text), handles semantic/recursive splits, generates embeddings, and indexes them into the user's vector store.
  * **Hybrid Retriever**: Runs an Ensemble Retriever of dense vectors (FAISS) and lexical keywords (BM25) followed by Cross-Encoder re-scoring (`BAAI/bge-reranker-base`).
  * **Inference Orchestrator**: Handles guardrail checks, conditional query expansions, and streams token-by-token generation outputs via Server-Sent Events (SSE).

---

### 3. Subsystem Communication Mappings

The microservices communicate over standard REST and SSE streams using specific port allocations:

| Source Subsystem | Destination Subsystem | Protocol | Port / Destination | Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| **Client UI** | **Gateway (`frontenddoc`)** | HTTP / HTML | `8080` | Client loading of pages and static resource assets. |
| **Gateway (`frontenddoc`)** | **FastAPI AI Service** | HTTP / SSE | `8000` | Proxying document uploads, ask queries, configurations, and evaluation runs. |
| **Gateway (`frontenddoc`)** | **Relational DB (`Documind_At`)**| HTTP / JSON | `8081` | Authentication lookups and registering newly signed-up users. |
| **Relational DB (`Documind_At`)**| **MySQL Database** | JDBC | `3306` | SQL CRUD operations for user profiles, configuration history, and document logs. |
| **FastAPI AI Service** | **Ollama Daemon** | HTTP / REST | `11434` | Invoking local LLMs (`mistral`, `qwen2.5:0.5b`) for query rewrite, guardrails, and generation. |
| **FastAPI AI Service** | **Cloud APIs** | HTTPS | Port `443` (Remote) | Accessing API services (Groq, OpenAI, Anthropic) if configured as active providers. |

---

### 4. Storage & State Management Architecture

* **Relational Database (`MySQL`)**: Persists structured entities (`users`, `documents`, `query_history`, `model_config`, `chunk_metadata`). Table mappings are managed via JPA.
* **Vector Store (`FAISS`)**: Embeddings are stored on disk in the [vector_store/](file:///d:/projects/hybrid-rag-knowledge-assistant/code/ai_service/vector_store/) directory. FAISS creates binary index files (e.g. `index.faiss`, `index.pkl`) mapped per-user (`user_<id>`) for data isolation.
* **Metadata Directory**: Flat JSON files in `doc_metadata/{user_id}.json` track the processing status, sizes, version history, and chunk counts of every document uploaded.
* **Evaluation test sets**: Saved in `eval_test_sets/` and results in `eval_results/` to evaluate retrieval precision, recall, and correctness.