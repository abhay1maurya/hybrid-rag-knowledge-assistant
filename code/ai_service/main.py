from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
from rag_pipeline import process_document, ask_question

app = FastAPI(title="DocuMind AI Service", version="1.0")

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

@app.post("/upload")
async def upload_file(
    user_id: str = Form(...), 
    file: UploadFile = File(...)
):
    """
    Endpoint to upload a PDF and process it into the FAISS vector database.
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_path = os.path.join(UPLOAD_DIR, f"{user_id}_{file.filename}")

    try:
        # Save file locally temporarily
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Process the document through the RAG pipeline
        chunks_created = process_document(file_path, user_id)
        
        return {
            "status": "success", 
            "message": f"Processed {file.filename} successfully.",
            "chunks_created": chunks_created
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up the temporary PDF file if needed
        # if os.path.exists(file_path):
        #     os.remove(file_path)
        pass

@app.post("/ask")
async def ask(
    query: str = Form(...), 
    user_id: str = Form(...)
):
    """
    Endpoint to ask a question against the uploaded documents.
    """
    try:
        answer = ask_question(query, user_id)
        return {
            "status": "success",
            "answer": answer
        }
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

# Simple health check
@app.get("/")
def read_root():
    return {"status": "DocuMind AI Service is running."}