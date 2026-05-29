import re
from langchain_ollama import OllamaLLM
from config import OLLAMA_MODEL

# ─────────────────────────────────────────
# 1. OFF-TOPIC DETECTION
# ─────────────────────────────────────────

OFF_TOPIC_PROMPT = """You are a document relevance checker.
Given a user query, determine if it is asking about content that could be found in an uploaded document (like a syllabus, policy, manual, report, etc).

Answer ONLY with one word: RELEVANT or IRRELEVANT

Rules:
- RELEVANT: questions about facts, data, policies, procedures, schedules, names, rules found in documents
- IRRELEVANT: general knowledge, weather, jokes, coding help, math problems, personal questions, greetings

Query: {query}

Answer:"""

def is_query_relevant(query: str, llm: OllamaLLM) -> bool:
    """
    Uses LLM to check if the query is relevant to document content.
    Returns True if relevant, False if off-topic.
    """
    try:
        prompt = OFF_TOPIC_PROMPT.format(query=query)
        response = llm.invoke(prompt).strip().upper()
        print(f"  Relevance check: {response}")

        # ✅ Accept any response containing RELEVANT (handles extra text)
        return "IRRELEVANT" not in response

    except Exception as e:
        print(f"  Relevance check failed: {e}. Allowing query through.")
        return True  # fail open — better to answer than block


# ─────────────────────────────────────────
# 2. EMPTY RETRIEVAL DETECTION
# ─────────────────────────────────────────

def has_enough_context(source_documents: list, min_docs: int = 1) -> bool:
    """
    Checks if retrieval returned enough context to answer.
    """
    if not source_documents:
        return False

    # Check if retrieved docs have meaningful content
    meaningful_docs = [
        doc for doc in source_documents
        if len(doc.page_content.strip()) > 50
    ]
    return len(meaningful_docs) >= min_docs


# ─────────────────────────────────────────
# 3. HALLUCINATION DETECTION
# ─────────────────────────────────────────

HALLUCINATION_PROMPT = """You are a fact-checker. 
Given a context and an answer, determine if the answer is fully supported by the context.

Answer ONLY with one word: GROUNDED or HALLUCINATED

Rules:
- GROUNDED: every claim in the answer can be traced back to the context
- HALLUCINATED: the answer contains claims, numbers, or facts NOT present in the context

Context:
{context}

Answer:
{answer}

Verdict:"""

def is_answer_grounded(answer: str, source_documents: list, llm: OllamaLLM) -> bool:
    """
    Checks if the LLM answer is grounded in the retrieved context.
    Returns True if grounded, False if hallucinated.
    """
    if not source_documents:
        return False

    # Combine source docs into one context string
    context = "\n\n".join([
        doc.page_content for doc in source_documents[:3]  # check against top 3
    ])

    try:
        prompt = HALLUCINATION_PROMPT.format(context=context, answer=answer)
        response = llm.invoke(prompt).strip().upper()
        print(f"  Hallucination check: {response}")

        return "HALLUCINATED" not in response

    except Exception as e:
        print(f"  Hallucination check failed: {e}. Trusting answer.")
        return True  # fail open


# ─────────────────────────────────────────
# 4. HARMFUL CONTENT DETECTION
# ─────────────────────────────────────────

HARMFUL_PATTERNS = [
    r'\b(hack|exploit|malware|virus|bomb|weapon|kill|attack)\b',
    r'\b(password|credential|bypass|inject|sql injection)\b',
    r'\b(suicide|self.harm|drug|illegal)\b',
]

def is_query_harmful(query: str) -> bool:
    """
    Quick pattern-based check for obviously harmful queries.
    No LLM needed — fast regex check.
    """
    query_lower = query.lower()
    for pattern in HARMFUL_PATTERNS:
        if re.search(pattern, query_lower):
            print(f"  Harmful content detected in query.")
            return True
    return False


# ─────────────────────────────────────────
# 5. MASTER GUARDRAIL FUNCTION
# ─────────────────────────────────────────

class GuardrailException(Exception):
    """Raised when a guardrail blocks a query or answer."""
    def __init__(self, reason: str, message: str):
        self.reason = reason
        self.message = message
        super().__init__(message)


def run_input_guardrails(query: str, llm: OllamaLLM):
    """
    Runs all input guardrails before retrieval.
    Raises GuardrailException if query should be blocked.
    """
    print("[Guardrails - Input]")

    # Check 1: Harmful content — fast, no LLM needed
    if is_query_harmful(query):
        raise GuardrailException(
            reason="harmful_content",
            message="I'm sorry, I can't process this type of request."
        )

    # Check 2: Off-topic detection
    if not is_query_relevant(query, llm):
        raise GuardrailException(
            reason="off_topic",
            message="I can only answer questions related to your uploaded documents. "
                    "Please ask something relevant to the document content."
        )

    print("  Input guardrails passed.")


def run_output_guardrails(
    answer: str,
    source_documents: list,
    llm: OllamaLLM
) -> str:
    """
    Runs all output guardrails after LLM generates answer.
    Returns the answer if safe, or a fallback message.
    """
    print("[Guardrails - Output]")

    # Check 1: Empty retrieval
    if not has_enough_context(source_documents):
        print("  Empty retrieval detected.")
        return (
            "I couldn't find any relevant information in your documents "
            "to answer this question. Please try rephrasing or upload "
            "a more relevant document."
        )

    # Check 2: Hallucination detection
    if not is_answer_grounded(answer, source_documents, llm):
        print("  Hallucination detected — returning fallback.")
        return (
            "I found some related content in your documents but couldn't "
            "generate a reliable answer. Please try rephrasing your question "
            "or consult the source document directly."
        )

    print("  Output guardrails passed.")
    return answer  # ✅ answer is safe, return as-is