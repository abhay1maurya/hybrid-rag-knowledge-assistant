from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os

# ✅ Updated imports from modular rag_pipeline
from rag_pipeline import ingest_document, ask_question, reset_user_session

app = FastAPI(title="DocuMind AI Service", version="2.0")

# Allow CORS for local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    """
    Ask a question against the user's uploaded documents.
    """
    try:
        # ✅ ask_question now returns a dict with status, answer, sources
        result = ask_question(query, user_id)

        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["answer"])

        return {
            "status": "success",
            "answer": result["answer"],
            "sources": result.get("sources", [])  # ✅ returns page citations
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    """
    Detailed health check — verifies Ollama is reachable.
    """
    from ollama_manager import is_ollama_running, is_model_available
    from config import OLLAMA_MODEL

    ollama_running = is_ollama_running()
    model_ready = is_model_available(OLLAMA_MODEL) if ollama_running else False

    return {
        "status": "ok" if ollama_running and model_ready else "degraded",
        "ollama_running": ollama_running,
        "model_available": model_ready,
        "model": OLLAMA_MODEL
    }