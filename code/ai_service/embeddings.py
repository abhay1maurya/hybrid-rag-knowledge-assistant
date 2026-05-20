from langchain_huggingface import HuggingFaceEmbeddings
from config import EMBEDDING_MODEL, DEVICE
import os

# ✅ Module-level cache — loaded once, reused for all requests
_embeddings_instance = None

def get_embeddings() -> HuggingFaceEmbeddings:
    """Returns cached embedding model — loads only once on first call."""
    global _embeddings_instance

    if _embeddings_instance is None:
        print(f"Loading embedding model '{EMBEDDING_MODEL}'... (only happens once)")

        # ✅ Suppress the unauthenticated warning by setting HF_TOKEN env var
        # Get free token from https://huggingface.co/settings/tokens
        hf_token = os.getenv("HF_TOKEN", None)
        if hf_token:
            os.environ["HUGGINGFACE_TOKEN"] = hf_token

        _embeddings_instance = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL,
            model_kwargs={"device": DEVICE},
            encode_kwargs={"normalize_embeddings": True},
            cache_folder="./model_cache"  # ✅ cache model files locally
        )
        print("Embedding model loaded and cached.")

    return _embeddings_instance