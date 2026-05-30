import asyncio
import os
from typing import AsyncGenerator
from langchain_community.vectorstores import FAISS
from langchain_classic.chains import ConversationalRetrievalChain

from config import VECTOR_STORE_PATH
from embeddings import get_embeddings
from memory_manager import get_memory
from retriever import build_retriever
from prompts import get_condense_question_prompt, get_answer_prompt
from query_processor import preprocess_query
from llm_manager import get_llm, get_current_provider_info
from user_config_manager import get_user_config
from guardrails import run_input_guardrails, run_output_guardrails, GuardrailException
from streaming import StreamingCallbackHandler, format_sse_event


def _get_streaming_llm(provider: str, model: str):
    """
    Creates a fresh streaming-enabled LLM instance.
    Streaming LLMs cannot be cached — each request needs its own handler.
    """
    if provider == "offline":
        from langchain_ollama import OllamaLLM
        from ollama_manager import ensure_ollama_ready
        ensure_ollama_ready(model)
        return OllamaLLM(model=model, streaming=True)

    elif provider == "groq":
        from langchain_groq import ChatGroq
        from config import GROQ_API_KEY
        return ChatGroq(
            model=model, api_key=GROQ_API_KEY,
            temperature=0, max_tokens=1024,
            streaming=True
        )

    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        from config import OPENAI_API_KEY
        return ChatOpenAI(
            model=model, api_key=OPENAI_API_KEY,
            temperature=0, max_tokens=1024,
            streaming=True
        )

    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        from config import ANTHROPIC_API_KEY
        return ChatAnthropic(
            model=model, api_key=ANTHROPIC_API_KEY,
            temperature=0, max_tokens=1024,
            streaming=True
        )

    else:
        raise ValueError(f"Unknown provider: {provider}")


async def ask_question_stream(
    query: str,
    user_id: str
) -> AsyncGenerator[str, None]:
    """
    Streaming version of ask_question.
    Yields SSE-formatted strings:
      - status events  (start, preprocessing, retrieving, generating, done, error)
      - token events   (each LLM token as it generates)
      - source events  (page citations at the end)
    """
    user_index_path = os.path.join(VECTOR_STORE_PATH, f"user_{user_id}")

    # ── Event: start ──────────────────────────────────────────────────────────
    yield format_sse_event({
        "event": "start",
        "message": "Processing your question..."
    })

    # ── Check vector store exists ─────────────────────────────────────────────
    if not os.path.exists(user_index_path):
        yield format_sse_event({
            "event": "error",
            "message": "No documents found. Please upload a document first."
        })
        return

    try:
        # ── Load user config ──────────────────────────────────────────────────
        config        = get_user_config(user_id)
        provider_info = get_current_provider_info(user_id=user_id)
        provider      = provider_info["provider"]
        model         = provider_info["model"]

        # ── Non-streaming LLM for guardrails + query preprocessing ────────────
        # Use cached LLM for fast operations (guardrails, query expansion)
        llm_cached = get_llm(user_id=user_id)

        # ── Input guardrails ──────────────────────────────────────────────────
        yield format_sse_event({
            "event": "status",
            "message": "Checking query..."
        })
        run_input_guardrails(query, llm_cached)

        # ── Query preprocessing ───────────────────────────────────────────────
        yield format_sse_event({
            "event": "status",
            "message": "Preprocessing query..."
        })
        processed_query = preprocess_query(query=query, llm=llm_cached, expand=True)

        yield format_sse_event({
            "event": "query_processed",
            "original": query,
            "processed": processed_query
        })

        # ── Load vector store + retriever ─────────────────────────────────────
        yield format_sse_event({
            "event": "status",
            "message": "Retrieving relevant context..."
        })

        embeddings  = get_embeddings(config.get("embedding_model", "bge-large"))
        vectorstore = FAISS.load_local(
            user_index_path, embeddings,
            allow_dangerous_deserialization=True
        )

        retriever_config = config.get("retriever", {})
        retriever = build_retriever(vectorstore, llm_cached, retriever_config)

        # Retrieve docs for source extraction + output guardrail
        source_documents = retriever.invoke(processed_query)

        yield format_sse_event({
            "event": "status",
            "message": f"Found {len(source_documents)} relevant chunks. Generating answer..."
        })

        # ── Streaming LLM setup ───────────────────────────────────────────────
        handler      = StreamingCallbackHandler()
        streaming_llm = _get_streaming_llm(provider, model)
        streaming_llm.callbacks = [handler]

        # ── Build prompt with context ─────────────────────────────────────────
        answer_prompt = get_answer_prompt()
        context       = "\n\n".join([doc.page_content for doc in source_documents])
        final_prompt  = answer_prompt.format(
            context=context,
            question=processed_query
        )

        # ── Run LLM in background thread (non-blocking) ───────────────────────
        async def run_llm():
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: streaming_llm.invoke(final_prompt)
            )

        llm_task = asyncio.create_task(run_llm())

        # ── Stream tokens to client ───────────────────────────────────────────
        yield format_sse_event({"event": "generating", "message": "Generating..."})

        full_answer = ""
        async for token in handler.token_generator():
            full_answer += token
            yield format_sse_event({
                "event": "token",
                "token": token
            })

        await llm_task  # ensure LLM task completes cleanly

        # ── Output guardrails on complete answer ──────────────────────────────
        safe_answer = run_output_guardrails(full_answer, source_documents, llm_cached)

        # If guardrail modified the answer, send a correction event
        if safe_answer != full_answer:
            yield format_sse_event({
                "event": "guardrail",
                "message": "Answer modified by output guardrail.",
                "answer": safe_answer
            })

        # ── Sources ───────────────────────────────────────────────────────────
        sources = list(set([
            f"Page {doc.metadata.get('page', 'N/A')}"
            for doc in source_documents
        ]))

        # ── Done ──────────────────────────────────────────────────────────────
        yield format_sse_event({
            "event": "done",
            "sources": sources,
            "llm_provider": provider_info,
            "original_query": query,
            "processed_query": processed_query
        })

    except GuardrailException as e:
        yield format_sse_event({
            "event": "blocked",
            "reason": e.reason,
            "message": e.message
        })

    except Exception as e:
        yield format_sse_event({
            "event": "error",
            "message": f"An error occurred: {str(e)}"
        })