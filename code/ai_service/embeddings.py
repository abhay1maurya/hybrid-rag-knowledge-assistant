from langchain_huggingface import HuggingFaceEmbeddings
from model_registry import EMBEDDING_MODELS
import os

# Cache: { model_key: embedding_instance }
_embeddings_cache: dict = {}

def get_embeddings(model_key: str = "bge-large") -> HuggingFaceEmbeddings:
    """
    Returns cached embedding model for the given model key.
    Loads only once per model — subsequent calls return cached instance.
    """
    if model_key in _embeddings_cache:
        return _embeddings_cache[model_key]

    if model_key not in EMBEDDING_MODELS:
        print(f"Unknown embedding model '{model_key}', falling back to bge-large.")
        model_key = "bge-large"

    model_info = EMBEDDING_MODELS[model_key]
    print(f"[Embeddings] Loading '{model_key}' ({model_info['model_name']})... (first time only)")

    instance = HuggingFaceEmbeddings(
        model_name=model_info["model_name"],
        model_kwargs={"device": "cuda"},
        encode_kwargs={"normalize_embeddings": model_info["normalize"]},
        cache_folder="./model_cache"
    )

    _embeddings_cache[model_key] = instance
    print(f"[Embeddings] '{model_key}' loaded and cached.")
    return instance