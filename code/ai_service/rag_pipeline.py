import os
from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaLLM
from langchain_classic.chains import ConversationalRetrievalChain

from config import VECTOR_STORE_PATH, OLLAMA_MODEL
from embeddings import get_embeddings
from ollama_manager import ensure_ollama_ready
from memory_manager import get_memory, clear_memory
from retriever import build_retriever
from prompts import get_condense_question_prompt, get_answer_prompt
from document_processor import process_document

# ✅ Cache LLM instance
_llm_instance = None

def get_llm():
    """Returns cached LLM — initialized only once."""
    global _llm_instance
    if _llm_instance is None:
        print("Initializing Ollama LLM... (only happens once)")
        _llm_instance = OllamaLLM(model=OLLAMA_MODEL)
        print("LLM ready.")
    return _llm_instance

def ingest_document(file_path: str, user_id: str) -> dict:
    """
    Public API — processes and indexes a PDF for a user.
    Called by REST API upload endpoint.
    """
    try:
        chunk_count = process_document(file_path, user_id)
        return {
            "status": "success",
            "message": f"Document processed successfully.",
            "chunks_created": chunk_count,
            "user_id": user_id
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

def ask_question(query: str, user_id: str) -> dict:
    """
    Public API — answers a question using the user's indexed documents.
    Called by REST API ask endpoint.
    """
    user_index_path = os.path.join(VECTOR_STORE_PATH, f"user_{user_id}")

    if not os.path.exists(user_index_path):
        return {
            "status": "error",
            "answer": "No documents found. Please upload a document first."
        }

    try:
        # 1. Ensure Ollama is running and model is ready
        ensure_ollama_ready(OLLAMA_MODEL)

        # 2. Load vector store
        embeddings = get_embeddings()
        vectorstore = FAISS.load_local(
            user_index_path,
            embeddings,
            allow_dangerous_deserialization=True
        )

        # 3. Initialize LLM
        llm = get_llm()

        # 4. Build retriever pipeline
        retriever = build_retriever(vectorstore, llm)

        # 5. Load prompts
        condense_prompt = get_condense_question_prompt()
        answer_prompt = get_answer_prompt()

        # 6. Load user memory
        memory = get_memory(user_id)

        # 7. Build chain
        qa_chain = ConversationalRetrievalChain.from_llm(
            llm=llm,
            retriever=retriever,
            memory=memory,
            return_source_documents=True,
            condense_question_prompt=condense_prompt,
            combine_docs_chain_kwargs={"prompt": answer_prompt}
        )

        # 8. Run query
        result = qa_chain.invoke({"question": query})

        # 9. Extract sources
        sources = list(set([
            f"Page {doc.metadata.get('page', 'N/A')}"
            for doc in result['source_documents']
        ]))

        return {
            "status": "success",
            "answer": result["answer"],
            "sources": sources
        }

    except RuntimeError as e:
        return {"status": "error", "answer": f"Service error: {str(e)}"}
    except Exception as e:
        return {"status": "error", "answer": f"An error occurred: {str(e)}"}

def reset_user_session(user_id: str) -> dict:
    """
    Public API — clears memory for a user.
    Called by REST API reset endpoint.
    """
    clear_memory(user_id)
    return {"status": "success", "message": f"Session cleared for user {user_id}"}