import re
from langchain_ollama import ChatOllama

# ---------------------------------------------------------
# 🚀 MICRO-MODEL FOR PREPROCESSING
# ---------------------------------------------------------
fast_processor_llm = ChatOllama(
    model="llama3.2",     # MUST MATCH THE MODEL YOU PULLED
    temperature=0.0,      # ABSOLUTE ZERO: No creativity allowed
    max_tokens=50
)

# FIX: Replaced loose instructions with strict boundary rules.
EXPANSION_PROMPT = """You are an expert search query formulator for a banking RAG system. 
Your ONLY job is to take a user's raw input and format it for semantic vector search.

CRITICAL RULES:
1. NEVER alter the core intent, direction, or polarity of the user's query.
2. NEVER change the entities (e.g., if the user says "UPI", keep it "UPI").
3. NEVER invert actions (e.g., "forget" must remain "forget", NEVER "remember").
4. Fix spelling, expand acronyms, and remove conversational filler.
5. Do NOT inject synonyms or guess at technical architecture (e.g., APIs).
6. If the query is already clear, output it exactly as is.

Output ONLY the formatted query. Do not include introductory text, explanations, or quotes.

Raw Input: {query}
Formatted Query:"""

def clean_text(text: str) -> str:
    """Removes basic punctuation and normalizes spacing."""
    text = re.sub(r'[^\w\s\?]', '', text)
    return " ".join(text.split())

def remove_filler_words(text: str) -> str:
    """Strips common conversational filler phrases to expose the core intent."""
    fillers = [
        r"\bplease tell me\b", r"\bcan you help me with\b", 
        r"\bi want to know\b", r"\bdo you know if\b",
        r"\bcould you explain\b", r"\bhey gemini\b", r"\bhey assistant\b"
    ]
    processed = text.lower()
    for filler in fillers:
        processed = re.sub(filler, "", processed)
    return " ".join(processed.split())

def expand_query_with_llm(query: str, llm: ChatOllama) -> str:
    """Invokes the local model to rewrite complex queries strictly."""
    try:
        prompt = EXPANSION_PROMPT.format(query=query)
        response = llm.invoke(prompt)
        content = getattr(response, "content", response)
        
        if content:
            optimized = str(content).strip().strip('"').strip("'")
            return optimized if optimized else query
        return query
    except Exception as e:
        print(f"  [Query Processor Warning] Expansion failed: {e}. Falling back to clean query.")
        return query

def preprocess_query(query: str, llm: ChatOllama = fast_processor_llm, expand: bool = True) -> str:
    """
    Master preprocessing coordinator.
    Evaluates word metrics and conditionally bypasses LLM expansion to minimize latency.
    """
    print("[Query Preprocessing]")
    
    # 1. Clean formatting and strip metadata noise
    cleaned = clean_text(query)
    print(f"  After cleaning      : {cleaned}")
    
    # 2. Extract core keywords for heuristic evaluation
    core_text = remove_filler_words(cleaned)
    print(f"  After filler removal: {core_text}")
    
    word_count = len(core_text.split())
    
    # ─── THE CRITICAL LATENCY FIX ──────────────────────────────────────────
    # If the user asks a brief question (under 7 words), query expansion is 
    # completely unnecessary. We bypass the LLM entirely and save a full network/inference hop.
    # ────────────────────────────────────────────────────────────────────────
    if not expand or word_count < 15:
        print(f"  [Bypass Triggered] Word count ({word_count}) below threshold. Skipping LLM expansion.")
        return core_text

    # 3. If query is long or complex, use the hyper-fast micro-model to expand it
    print(f"  [Expansion Triggered] Word count ({word_count}) requires synthesis. Invoking local model...")
    expanded = expand_query_with_llm(core_text, llm=llm)
    print(f"  Final expanded query: {expanded}")
    
    return expanded