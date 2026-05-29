import os
from dotenv import load_dotenv  # pip install python-dotenv

load_dotenv()

# ── Vector Store ──────────────────────────
VECTOR_STORE_PATH = "vector_store"
EMBEDDING_MODEL   = "BAAI/bge-large-en-v1.5"
DEVICE            = "cpu"
MODEL_CACHE_DIR   = "./model_cache"

# ── Ollama (Offline) ──────────────────────
OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "mistral")

# ── Provider Switch ───────────────────────
LLM_PROVIDER    = os.getenv("LLM_PROVIDER", "offline")   # "offline" | "online"
ONLINE_PROVIDER = os.getenv("ONLINE_PROVIDER", "groq")   # "groq" | "openai" | "anthropic"

# ── Online API Keys ───────────────────────
GROQ_API_KEY      = os.getenv("GROQ_API_KEY", "")
OPENAI_API_KEY    = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# ── Online Model Names ────────────────────
GROQ_MODEL      = "llama-3.3-70b-versatile"   # fast + free tier available
OPENAI_MODEL    = "gpt-4o-mini"               # cost-effective
ANTHROPIC_MODEL = "claude-sonnet-4-20250514"  # most accurate