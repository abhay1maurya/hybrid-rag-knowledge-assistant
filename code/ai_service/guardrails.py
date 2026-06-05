import re
from langchain_ollama import ChatOllama

# ---------------------------------------------------------
# 🚀 ULTRA-FAST DEDICATED MICRO-MODEL FOR GUARDRAILS
# This model initializes instantly, takes minimal VRAM, 
# and runs classification tasks in milliseconds.
# ---------------------------------------------------------
fast_guardrail_llm = ChatOllama(
    model="llama3.2",
    temperature=0,         # Deterministic responses
    max_tokens=10          # Cut off generation immediately after token verdict
)

def _extract_text_from_response(response) -> str:
    """Helper to cleanly extract string content from LangChain message objects."""
    content = getattr(response, "content", response)
    if content is None:
        return ""
    return str(content).strip()

# ─────────────────────────────────────────
# 1. RETRIEVAL CONTEXT VALIDATION
# ─────────────────────────────────────────

def has_enough_context(source_documents: list, min_docs: int = 1) -> bool:
    """Verifies if the vector store returned substantive context chunks."""
    if not source_documents:
        return False

    meaningful_docs = [
        doc for doc in source_documents
        if len(doc.page_content.strip()) > 50
    ]
    return len(meaningful_docs) >= min_docs

# ─────────────────────────────────────────
# 2. HALLUCINATION DETECTION (POST-PROCESSING)
# ─────────────────────────────────────────

HALLUCINATION_PROMPT = """You are a strict fact-checker. 
Given a context and an answer, determine if the answer is fully supported by the context.

Answer ONLY with one word: GROUNDED or HALLUCINATED

Rules:
- GROUNDED: every single claim in the answer can be traced directly back to the context
- HALLUCINATED: the answer introduces facts, conditions, or claims NOT explicitly present in the context

Context:
{context}

Answer:
{answer}

Verdict:"""

def is_answer_grounded(answer: str, source_documents: list, llm: ChatOllama) -> bool:
    """Evaluates if the generated response matches the context chunks accurately."""
    if not source_documents:
        return False

    # Extract top 3 chunks to prevent context window overflow in the micro-model
    context = "\n\n".join([
        doc.page_content for doc in source_documents[:3]
    ])

    try:
        prompt = HALLUCINATION_PROMPT.format(context=context, answer=answer)
        response = _extract_text_from_response(llm.invoke(prompt)).upper()
        print(f"  [Guardrails Log] Hallucination check result: {response}")

        return "HALLUCINATED" not in response

    except Exception as e:
        print(f"  [Guardrails Warning] Hallucination check failed: {e}. Defaulting to True.")
        return True 

# ─────────────────────────────────────────
# 3. FAST INPUT CONTENT FILTER (REGEX)
# ─────────────────────────────────────────

HARMFUL_PATTERNS = [
    r'\b(hack|exploit|malware|virus|bomb|weapon|kill|attack)\b',
    r'\b(password|credential|bypass|inject|sql injection)\b',
    r'\b(suicide|self\.harm|drug|illegal)\b',
]

def is_query_harmful(query: str) -> bool:
    """Performs an instantaneous regex scan to bypass LLM latency entirely for basic filters."""
    query_lower = query.lower()
    for pattern in HARMFUL_PATTERNS:
        if re.search(pattern, query_lower):
            print("  [Guardrails Log] Harmful content rule triggered.")
            return True
    return False

# ─────────────────────────────────────────
# 4. MASTER INTERFACES & CUSTOM EXCEPTIONS
# ─────────────────────────────────────────

class GuardrailException(Exception):
    """Custom exception routed directly to the FastAPI error handling middleware."""
    def __init__(self, reason: str, message: str):
        self.reason = reason
        self.message = message
        super().__init__(message)


def run_input_guardrails(query: str, llm: ChatOllama = fast_guardrail_llm):
    """
    Executes input-stage security scanning. 
    Defaults automatically to the fast_guardrail_llm micro-instance.
    """
    print("[Guardrails - Input]")

    if is_query_harmful(query):
        raise GuardrailException(
            reason="harmful_content",
            message="I'm sorry, I cannot process this type of request."
        )

    print("  Input guardrails passed.")


def run_output_guardrails(
    answer: str,
    source_documents: list,
    llm: ChatOllama = fast_guardrail_llm
) -> str:
    """
    Executes context and validation checking on generated answers.
    Bypasses the main heavy inference model completely.
    """
    print("[Guardrails - Output]")

    # Guardrail 1: Context Chunk Verification
    if not has_enough_context(source_documents):
        print("  Empty retrieval threshold triggered.")
        return (
            "I couldn't find any relevant information in your documents "
            "to answer this question. Please try rephrasing or upload "
            "a more relevant document."
        )

    # Guardrail 2: Hallucination Check via Micro-Model
    if not is_answer_grounded(answer, source_documents, llm=llm):
        print("  Hallucination detected — returning production fallback response.")
        return (
            "I found some related content in your documents but couldn't "
            "generate a reliable answer. Please try rephrasing your question "
            "or consult the source document directly."
        )

    print("  Output guardrails passed.")
    return answer