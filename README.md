# DocuMind AI — Hybrid RAG Knowledge Assistant & Web Application

DocuMind AI is a secure, multi-tenant hybrid Retrieval-Augmented Generation (RAG) assistant designed for document indexing, semantic search, and context-grounded question answering. It features user data isolation, dynamic LLM provider switching (local Ollama or remote Groq/OpenAI/Anthropic), two-stage guardrails to prevent hallucinations, a complete Spring AI-based companion chatbot, and an integrated RAG evaluation suite.

For the exhaustive developer guide covering file mappings, data flow designs, and inner system mechanics, refer to the [Complete Technical Readme](file:///d:/projects/hybrid-rag-knowledge-assistant/proj_readme.md).

---

## 1. System Architecture Overview

The platform uses a modular, four-tier microservice architecture to partition the frontend, secure gateway routing, persistent user metadata, and AI pipeline computations.

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

### Subsystems & Ports:
* **Frontend Web App (`code/frontend`)**: Interacts with the Spring Boot Gateway to access services.
* **Spring Boot UI Gateway (`code/frontenddoc` - Port 8080)**: Enforces role-based security filter chains (using custom UserDetailsService) and proxies REST operations downstream via OpenFeign.
* **Spring Boot Database & Chatbot (`code/Documind_At` - Port 8081)**: Manages relational data (JPA + Hibernate) on MySQL and provides a standalone chatbot engine powered by **Spring AI**.
* **Python FastAPI AI Service (`code/ai_service` - Port 8000)**: Coordinates document splitting, FAISS database indexing, hybrid retrieval (BM25 + FAISS + Cross-Encoder Reranker), guardrails, and streaming QA generation.

---

## 2. Technology Stack & Key Features

* **AI & RAG Orchestration**: FastAPI, LangChain, PyPDF, Pandas, Sentence Transformers, and Rank-BM25.
* **Vector Store**: Facebook AI Similarity Search (FAISS) isolated per-user (`vector_store/user_{user_id}`).
* **Relational Database**: MySQL (`documind_db`) managed via Spring Data JPA.
* **Chat Frameworks**: LangChain ConversationalRetrievalChain (FastAPI) and Spring AI ChatClient (Spring Boot).
* **Security & Auth**: Spring Security configuration utilizing custom `UserDetailsService` and Feign proxy channels.
* **Evaluation Framework**: Integrated RAGAS-based evaluator measuring *Faithfulness*, *Answer Relevancy*, *Context Precision*, *Context Recall*, and *Answer Correctness*.

---

## 3. Environment Setup & Configurations

### 3.1 Python AI Service `.env`
Create a `.env` file in `code/ai_service/` (or the workspace root):

```ini
# Active Provider: offline | online
LLM_PROVIDER=offline

# Online Provider Selection: groq | openai | anthropic
ONLINE_PROVIDER=groq

# API Keys (Set only the ones you use)
GROQ_API_KEY=gsk_...
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...

# Local Ollama Settings
OLLAMA_MODEL=mistral
OLLAMA_REQUEST_TIMEOUT=60
```

### 3.2 Spring Boot Database Backend Configuration
In `code/Documind_At/src/main/resources/application.properties`, configure your MySQL parameters:

```properties
server.port=8081
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
spring.datasource.url=jdbc:mysql://localhost:3306/documind_db
spring.datasource.username=root
spring.datasource.password=YOUR_PASSWORD

spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.MySQLDialect

# Spring AI Key
spring.ai.openai.api-key=YOUR_OPENAI_KEY
```

---

## 4. Run Guide (Step-by-Step)

### Step 1: Initialize the MySQL Database
Log into your MySQL CLI and create the database schema:
```sql
CREATE DATABASE documind_db;
```

### Step 2: Launch the Python FastAPI AI Service
1. Navigate to the AI folder, create a virtual environment, and activate it:
   ```bash
   cd code/ai_service
   python -m venv .venv
   # Windows PowerShell
   .venv\Scripts\Activate.ps1
   # Linux/macOS
   source .venv/bin/activate
   ```
2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the FastAPI development server:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

### Step 3: Run the Database & Spring AI Service
Open a new terminal, navigate to the `Documind_At` folder, and compile/run the application:
```bash
cd code/Documind_At
# Windows Maven Wrapper
mvnw.cmd spring-boot:run
# Linux/macOS Maven Wrapper
./mvnw spring-boot:run
```
*Verify: The service should start on Port `8081` and generate relational tables inside the database.*

### Step 4: Run the Spring Boot UI Gateway
Open a third terminal, navigate to the `frontenddoc` folder, and run:
```bash
cd code/frontenddoc
# Windows Maven Wrapper
mvnw.cmd spring-boot:run
# Linux/macOS Maven Wrapper
./mvnw spring-boot:run
```
*Verify: The gateway should start on Port `8080`.*

### Step 5: Access the Application
Open your browser and navigate to `http://localhost:8080`.
1. Sign up for a new account (credentials will save to the MySQL database).
2. Log in using your registered credentials.
3. Access the dashboard, upload files, configure retriever settings, and ask questions!