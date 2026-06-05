import os
import torch
from dotenv import load_dotenv

load_dotenv()

# ── Hardware Auto-Detection ────────────────
# Forces the local embedding model to use GPU processing if available,
# regardless of whether the LLM is online or offline.
if torch.cuda.is_available():
    BEST_DEVICE = "cuda"
elif torch.backends.mps.is_available():
    BEST_DEVICE = "mps"
else:
    BEST_DEVICE = "cpu"


# ── Vector Store ──────────────────────────
VECTOR_STORE_PATH = "vector_store"
EMBEDDING_MODEL   = "BAAI/bge-large-en-v1.5"
DEVICE            = BEST_DEVICE
MODEL_CACHE_DIR   = "./model_cache"

# ── Ollama (Offline) ──────────────────────
OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "mistral")
OLLAMA_GUARDRAIL_MODEL = "llama3.2"  # Fast model for guardrails
OLLAMA_REQUEST_TIMEOUT = int(os.getenv("OLLAMA_REQUEST_TIMEOUT", "60"))
OLLAMA_NUM_GPU = int(os.getenv("OLLAMA_NUM_GPU", "99"))

# ── Provider Switch ───────────────────────
LLM_PROVIDER    = os.getenv("LLM_PROVIDER", "offline")   # "offline" | "online"
ONLINE_PROVIDER = os.getenv("ONLINE_PROVIDER", "groq")   # "groq" | "openai" | "anthropic"

# ── Online API Keys ───────────────────────
GROQ_API_KEY      = os.getenv("GROQ_API_KEY", "")
OPENAI_API_KEY    = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# ── Online Model Names ────────────────────
GROQ_MODEL      = "llama-3.3-70b-versatile"
OPENAI_MODEL    = "gpt-4o-mini"
ANTHROPIC_MODEL = "claude-sonnet-4-20250514"