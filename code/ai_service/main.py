from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from config_router import router as config_router
import shutil
from llm_manager import clear_llm_cache, get_current_provider_info
import os
from rag_pipeline import ingest_document, ask_question, reset_user_session

app = FastAPI(title="DocuMind AI Service", version="3.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

# ✅ Mount config router — adds all /config/* endpoints
app.include_router(config_router)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.get("/")
def read_root():
    """Health check endpoint."""
    return {"status": "DocuMind AI Service is running.", "version": "2.0"}


@app.post("/upload")
async def upload_file(
    user_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Upload a PDF and process it into the FAISS vector database.
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_path = os.path.join(UPLOAD_DIR, f"{user_id}_{file.filename}")

    try:
        # Save file temporarily
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # ✅ Use ingest_document from rag_pipeline (returns a dict now)
        result = ingest_document(file_path, user_id)

        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["message"])

        return {
            "status": "success",
            "message": f"Processed '{file.filename}' successfully.",
            "chunks_created": result["chunks_created"],
            "user_id": user_id
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temp file after processing
        if os.path.exists(file_path):
            os.remove(file_path)


@app.post("/ask")
async def ask(
    query: str = Form(...),
    user_id: str = Form(...)
):
    result = ask_question(query, user_id)

    # ✅ Guardrail blocked — return 200 with explanation, not 500
    if result["status"] == "blocked":
        return {
            "status": "blocked",
            "reason": result.get("reason"),
            "answer": result["answer"],
            "sources": []
        }

    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["answer"])

    return {
        "status": "success",
        "answer": result["answer"],
        "sources": result.get("sources", []),
        "original_query": result.get("original_query", query),
        "processed_query": result.get("processed_query", query)
    }



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