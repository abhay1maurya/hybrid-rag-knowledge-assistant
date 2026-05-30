from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from config_router import router as config_router
import shutil
import os
from llm_manager import clear_llm_cache, get_current_provider_info
from stream_pipeline import ask_question_stream
from rag_pipeline import ingest_document, ask_question, reset_user_session
from document_router import router as document_router
from file_handlers import HandlerFactory 
from evaluator.eval_router import router as eval_router

app = FastAPI(title="DocuMind AI Service", version="3.0")
ALLOWED_EXTENSIONS = HandlerFactory.supported_extensions()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

# ✅ Mount config router — adds all /config/* endpoints
app.include_router(config_router)
app.include_router(document_router)  
app.include_router(eval_router)  

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.get("/")
def read_root():
    """Health check endpoint."""
    return {"status": "DocuMind AI Service is running.", "version": "3.0"}


@app.post("/upload")
async def upload_file(user_id: str = Form(...), file: UploadFile = File(...)):
    """Supports PDF, TXT, MD, DOCX, CSV, XLSX."""

    # ✅ Dynamic extension check — works for all supported types
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Supported: {ALLOWED_EXTENSIONS}"
        )

    file_path = os.path.join(UPLOAD_DIR, f"{user_id}_{file.filename}")
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        result = ingest_document(file_path, user_id)
        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["message"])
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

@app.get("/supported-formats")
def supported_formats():
    """Returns all supported file formats."""
    return {
        "supported_extensions": ALLOWED_EXTENSIONS,
        "formats": {
            "pdf":  {"extensions": [".pdf"],              "description": "PDF documents"},
            "text": {"extensions": [".txt", ".md", ".rst", ".log"], "description": "Plain text and markdown"},
            "word": {"extensions": [".docx", ".doc"],     "description": "Microsoft Word documents"},
            "data": {"extensions": [".csv", ".xlsx", ".xls"], "description": "Spreadsheets and CSV data"},
        }
    }


@app.post("/ask")
async def ask(query: str = Form(...), user_id: str = Form(...)):
    """Standard blocking endpoint — waits for full answer."""
    result = ask_question(query, user_id)
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["answer"])
    return result

@app.get("/ask/stream")
async def ask_stream(request: Request, query: str, user_id: str):
    """
    Streaming endpoint — returns tokens as Server-Sent Events.
    Client receives tokens in real-time as LLM generates them.

    Usage:
        GET /ask/stream?query=your+question&user_id=user_1

    SSE Event Types:
        start          → stream started
        status         → progress update
        query_processed→ shows original vs processed query
        generating     → LLM started generating
        token          → single LLM token (stream these to UI)
        guardrail      → output guardrail triggered
        sources        → page citations
        done           → stream complete, includes sources + provider info
        blocked        → guardrail blocked the query
        error          → something went wrong
    """
    async def event_generator():
        # Stop streaming if client disconnects
        async for event in ask_question_stream(query, user_id):
            if await request.is_disconnected():
                break
            yield event

    return EventSourceResponse(event_generator())

@app.get("/provider")
def get_provider():
    """Returns the currently active LLM provider."""
    return get_current_provider_info()


@app.post("/provider/switch")
async def switch_provider(
    provider: str = Form(...),         # "offline" | "online"
    online_provider: str = Form(None)  # "groq" | "openai" | "anthropic"
):
    """
    Switches LLM provider at runtime without restarting the server.
    """
    valid_providers = ["offline", "online"]
    valid_online    = ["groq", "openai", "anthropic"]

    if provider not in valid_providers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider. Choose from: {valid_providers}"
        )
    if provider == "online" and online_provider not in valid_online:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid online provider. Choose from: {valid_online}"
        )

    # ✅ Update environment variables at runtime
    os.environ["LLM_PROVIDER"]    = provider
    os.environ["ONLINE_PROVIDER"] = online_provider or "groq"

    # ✅ Reload config values
    import config
    config.LLM_PROVIDER    = provider
    config.ONLINE_PROVIDER = online_provider or "groq"

    # ✅ Clear cache so next request uses new provider
    clear_llm_cache()

    return {
        "status": "success",
        "message": f"Switched to {provider} ({online_provider or 'ollama'})",
        "provider": provider,
        "online_provider": online_provider
    }


@app.post("/reset")
async def reset_session(
    user_id: str = Form(...)
):
    """
    Clears conversation memory for a user.
    Call this when starting a new session or topic.
    """
    try:
        result = reset_user_session(user_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health_check():
    from ollama_manager import is_ollama_running, is_model_available
    from config import OLLAMA_MODEL, LLM_PROVIDER

    provider_info = get_current_provider_info()
    ollama_ok     = is_ollama_running() if LLM_PROVIDER == "offline" else None
    model_ok      = is_model_available(OLLAMA_MODEL) if ollama_ok else None

    return {
        "status": "ok",
        "active_provider": provider_info,
        "ollama_running": ollama_ok,
        "ollama_model_ready": model_ok,
    }