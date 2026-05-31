import re
from langchain_ollama import OllamaLLM
from config import OLLAMA_MODEL


def _extract_text_from_response(response) -> str:
    """
    Handles both string and AIMessage responses from LLM.
    AIMessage has .content attribute, plain strings don't.
    """
    if hasattr(response, 'content'):
        return response.content.strip()
    else:
        return str(response).strip()


def clean_query(query: str) -> str:
    """
    Basic text cleaning:
    - strips extra whitespace
    - removes special characters
    - normalizes to lowercase
    """
    # Strip leading/trailing whitespace
    query = query.strip()

    # Collapse multiple spaces
    query = re.sub(r'\s+', ' ', query)

    # Remove special characters except ? . , '
    query = re.sub(r'[^\w\s\?\.\,\']', '', query)

    return query


def remove_filler_words(query: str) -> str:
    """
    Removes common filler words that add noise to retrieval.
    """
    filler_words = [
        "um", "uh", "like", "you know", "i mean",
        "basically", "literally", "actually", "so",
        "tell me", "can you", "could you", "please",
        "i want to know", "i would like to know",
        "i need to know", "help me", "let me know",
        "i am asking", "just", "simply", "kindly"
    ]

    query_lower = query.lower()
    for filler in filler_words:
        # Remove filler only at start of query
        query_lower = re.sub(rf'^{re.escape(filler)}\s+', '', query_lower)

    return query_lower.strip()


def expand_query_with_llm(query: str, llm: OllamaLLM) -> str:
    """
    Uses LLM to rewrite and expand the query for better retrieval.
    Adds synonyms and related terms without changing the meaning.
    """
    expansion_prompt = f"""Rewrite the following question to improve document search.
Make it more specific and add relevant keywords or synonyms.
Return ONLY the rewritten question, nothing else. No explanation, no preamble.

Original Question: {query}

Rewritten Question:"""

    try:
        # ✅ FIX: Extract text from AIMessage response
        response = llm.invoke(expansion_prompt)
        expanded = _extract_text_from_response(response)

        # Safety check — if LLM returns something too long or weird, use original
        if len(expanded) > 300 or len(expanded) < 5:
            print(f"  Query expansion returned unexpected result, using original.")
            return query

        print(f"  Original query : {query}")
        print(f"  Expanded query : {expanded}")
        return expanded

    except Exception as e:
        print(f"  Query expansion failed: {e}. Using original query.")
        return query


def preprocess_query(query: str, llm: OllamaLLM, expand: bool = True) -> str:
    """
    Master function — runs full query preprocessing pipeline.

    Pipeline:
    1. Clean text (whitespace, special chars)
    2. Remove filler words
    3. LLM query expansion (optional)

    Args:
        query:  raw user query
        llm:    OllamaLLM instance (reused from rag_pipeline)
        expand: set False to skip LLM expansion (faster, good for short queries)
    """
    print(f"[Query Preprocessing]")

    # Step 1: Clean
    query = clean_query(query)
    print(f"  After cleaning    : {query}")

    # Step 2: Remove fillers
    query = remove_filler_words(query)
    print(f"  After filler removal: {query}")

    # Step 3: LLM Expansion — skip for very short queries
    if expand and len(query.split()) >= 3:
        query = expand_query_with_llm(query, llm)
    else:
        print(f"  Skipping expansion (query too short or expand=False)")

    print(f"  Final query       : {query}")
    return query