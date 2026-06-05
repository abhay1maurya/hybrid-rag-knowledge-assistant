import os
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
import shutil
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from config_router import router as config_router
from document_router import router as document_router
from evaluator.eval_router import router as eval_router
from llm_manager import clear_llm_cache, get_current_provider_info
from stream_pipeline import ask_question_stream
from rag_pipeline import ingest_document, ask_question, reset_user_session
from file_handlers import HandlerFactory 
from model_registry import LLM_PROVIDERS
from user_config_manager import get_user_config, update_user_config, validate_config

# FIX: Initialize the app EXACTLY ONCE
app = FastAPI(title="DocuMind AI Service", version="3.0")
ALLOWED_EXTENSIONS = HandlerFactory.supported_extensions()

# FIX: Apply CORS exactly once
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"],
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"]
)

# Mount routers
app.include_router(config_router)
app.include_router(document_router)  
app.include_router(eval_router)  

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
def read_root():
    return {"status": "DocuMind AI Service is running.", "version": "3.0"}

@app.post("/upload")
async def upload_file(user_id: str = Form(...), file: UploadFile = File(...)):
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
    result = ask_question(query, user_id)
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["answer"])
    return result

@app.get("/ask/stream")
async def ask_stream(request: Request, query: str, user_id: str):
    async def event_generator():
        async for event in ask_question_stream(query, user_id):
            if await request.is_disconnected():
                break
            yield event

    return EventSourceResponse(event_generator())

@app.get("/provider")
def get_provider(user_id: str = None):
    return get_current_provider_info(user_id=user_id)

@app.post("/provider/switch")
async def switch_provider(
    provider: str = Form(...),         
    online_provider: str = Form(None),  
    user_id: str = Form(None)
):
    valid_providers = ["offline", "online"]
    valid_online    = ["groq", "openai", "anthropic"]

    if provider not in valid_providers:
        raise HTTPException(status_code=400, detail=f"Invalid provider. Choose from: {valid_providers}")
    if provider == "online" and online_provider not in valid_online:
        raise HTTPException(status_code=400, detail=f"Invalid online provider. Choose from: {valid_online}")

    resolved_provider = "offline" if provider == "offline" else (online_provider or "groq")
    resolved_model = next(iter(LLM_PROVIDERS[resolved_provider]["models"]))

    if user_id:
        update_payload = {
            "llm_provider": resolved_provider,
            "llm_model": resolved_model,
        }
        # FIX: Pass the current configuration into validate_config to prevent a TypeError crash
        current_config = get_user_config(user_id)
        is_valid, error_msg = validate_config(update_payload, current_config)
        
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)

        update_user_config(user_id, update_payload)
        clear_llm_cache()

        return {
            "status": "success",
            "message": f"Switched user {user_id} to {resolved_provider} ({resolved_model})",
            "user_id": user_id,
            "provider": resolved_provider,
            "online_provider": online_provider,
            "model": resolved_model,
            "config": get_user_config(user_id),
        }

    os.environ["LLM_PROVIDER"]    = provider
    os.environ["ONLINE_PROVIDER"] = online_provider or "groq"

    import config
    config.LLM_PROVIDER    = provider
    config.ONLINE_PROVIDER = online_provider or "groq"

    clear_llm_cache()

    return {
        "status": "success",
        "message": f"Switched to {provider} ({online_provider or 'ollama'})",
        "provider": provider,
        "online_provider": online_provider
    }

@app.post("/reset")
async def reset_session(user_id: str = Form(...)):
    try:
        result = reset_user_session(user_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check(user_id: str = None):
    from ollama_manager import is_ollama_running, is_model_available
    from config import OLLAMA_MODEL
    
    # FIX: Fetch the provider info specific to the user, not just the global state
    provider_info = get_current_provider_info(user_id=user_id)
    
    # Extract the actual resolved provider string ("offline" or "online")
    active_tier = provider_info.get("provider", "offline")

    # FIX: Check Ollama status based on the user's active tier, not the global config
    ollama_ok = is_ollama_running() if active_tier == "offline" else None
    model_ok = is_model_available(OLLAMA_MODEL) if ollama_ok else None

    return {
        "status": "ok",
        "active_provider": provider_info,
        "ollama_running": ollama_ok,
        "ollama_model_ready": model_ok,
    }