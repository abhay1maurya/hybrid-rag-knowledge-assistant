import os
from langchain_community.vectorstores import FAISS
from langchain_classic.chains import ConversationalRetrievalChain

from config import VECTOR_STORE_PATH
from embeddings import get_embeddings
from memory_manager import get_memory, clear_memory
from retriever import build_retriever
from prompts import get_condense_question_prompt, get_answer_prompt
from document_processor import process_document
from query_processor import preprocess_query
from llm_manager import get_llm, get_current_provider_info
from user_config_manager import get_user_config
from guardrails import run_input_guardrails, run_output_guardrails, GuardrailException
from document_manager import register_document


def ingest_document(file_path: str, user_id: str) -> dict:
    try:
        config      = get_user_config(user_id)
        chunk_count = process_document(file_path, user_id, config)

        # ✅ Register document in metadata after successful indexing
        filename = os.path.basename(file_path).replace(f"{user_id}_", "")
        doc_id   = register_document(
            user_id       = user_id,
            filename      = filename,
            file_path     = file_path,
            chunks_created= chunk_count,
            config_used   = config
        )

        return {
            "status":        "success",
            "message":       "Document processed successfully.",
            "doc_id":        doc_id,
            "chunks_created": chunk_count,
            "user_id":       user_id,
            "config_used": {
                "embedding_model":   config.get("embedding_model"),
                "chunking_strategy": config.get("chunking_strategy"),
                "chunking_params":   config.get("chunking_params"),
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

def ask_question(query: str, user_id: str) -> dict:
    user_index_path = os.path.join(VECTOR_STORE_PATH, f"user_{user_id}")

    if not os.path.exists(user_index_path):
        return {
            "status": "error",
            "answer": "No documents found. Please upload a document first."
        }

    try:
        # 1. Load user config
        config = get_user_config(user_id)

        # 2. Get LLM based on user config
        llm = get_llm(user_id=user_id)
        provider_info = get_current_provider_info(user_id=user_id)
        print(f"[RAG] User={user_id} | LLM={provider_info['provider']}/{provider_info['model']}")

        # 3. Input guardrails
        run_input_guardrails(query, llm)

        # 4. Load vector store with user's embedding model
        embeddings = get_embeddings(config.get("embedding_model", "bge-large"))
        vectorstore = FAISS.load_local(
            user_index_path, embeddings,
            allow_dangerous_deserialization=True
        )

        # 5. Preprocess query
        processed_query = preprocess_query(query=query, llm=llm, expand=True)

        # 6. Build retriever using user's retriever config
        retriever_config = config.get("retriever", {})
        retriever = build_retriever(vectorstore, llm, retriever_config)

        # 7. Prompts + memory
        condense_prompt = get_condense_question_prompt()
        answer_prompt   = get_answer_prompt()
        memory          = get_memory(user_id)

        # 8. Chain
        qa_chain = ConversationalRetrievalChain.from_llm(
            llm=llm,
            retriever=retriever,
            memory=memory,
            return_source_documents=True,
            condense_question_prompt=condense_prompt,
            combine_docs_chain_kwargs={"prompt": answer_prompt}
        )

        # 9. Run
        result           = qa_chain.invoke({"question": processed_query})
        raw_answer       = result["answer"]
        source_documents = result["source_documents"]

        # 10. Output guardrails
        safe_answer = run_output_guardrails(raw_answer, source_documents, llm)

        # 11. Sources
        sources = list(set([
            f"Page {doc.metadata.get('page', 'N/A')}"
            for doc in source_documents
        ]))

        return {
            "status":           "success",
            "answer":           safe_answer,
            "sources":          sources,
            "original_query":   query,
            "processed_query":  processed_query,
            "llm_provider":     provider_info
        }

    except GuardrailException as e:
        return {
            "status":           "blocked",
            "reason":           e.reason,
            "answer":           e.message,
            "sources":          [],
            "original_query":   query,
            "processed_query":  query
        }
    except RuntimeError as e:
        return {"status": "error", "answer": f"Service error: {str(e)}"}
    except Exception as e:
        return {"status": "error", "answer": f"An error occurred: {str(e)}"}


def reset_user_session(user_id: str) -> dict:
    clear_memory(user_id)
    return {"status": "success", "message": f"Session cleared for user {user_id}"}