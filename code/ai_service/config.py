import os

VECTOR_STORE_PATH = "vector_store"
EMBEDDING_MODEL = "BAAI/bge-large-en-v1.5"
OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "mistral"
DEVICE = "cpu"
MODEL_CACHE_DIR = "./model_cache"  # ✅ models cached here after first download

# ✅ Fix the HuggingFace unauthenticated warning
# Get a free token from https://huggingface.co/settings/tokens
HF_TOKEN = os.getenv("HF_TOKEN", None)
if HF_TOKEN:
    os.environ["HUGGINGFACE_TOKEN"] = HF_TOKEN