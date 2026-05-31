from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from model_registry import (
    EMBEDDING_MODELS, CHUNKING_STRATEGIES,
    LLM_PROVIDERS, RETRIEVER_OPTIONS, DEFAULT_USER_CONFIG
)
from user_config_manager import (
    get_user_config, update_user_config,
    validate_config, reset_user_config
)

router = APIRouter(prefix="/config", tags=["Configuration"])


# ── Pydantic Models ───────────────────────────────────────────────────────────
class RetrieverConfig(BaseModel):
    k_candidates: Optional[int] = None
    top_n_rerank: Optional[int] = None
    bm25_weight: Optional[float] = None
    use_multi_query: Optional[bool] = None
    use_reranker: Optional[bool] = None

class ChunkingParams(BaseModel):
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None
    breakpoint_threshold_type: Optional[str] = None
    breakpoint_threshold_amount: Optional[float] = None

class UserConfigUpdate(BaseModel):
    embedding_model: Optional[str] = None
    chunking_strategy: Optional[str] = None
    chunking_params: Optional[ChunkingParams] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    retriever: Optional[RetrieverConfig] = None


# ── GET /config/options — show all available options ─────────────────────────
@router.get("/options")
def get_all_options():
    """Returns all available models and configuration options."""
    return {
        "embedding_models": {
            key: {
                "model_name": val.get("model_name"),
                "description": val["description"],
                "dimensions": val["dimensions"],
                "normalize": val.get("normalize"),
                "speed": val["speed"],
                "accuracy": val["accuracy"],
                "size": val["size"]
            }
            for key, val in EMBEDDING_MODELS.items()
        },
        "chunking_strategies": {
            key: {
                "description": val["description"],
                "speed": val["speed"],
                "accuracy": val["accuracy"],
                "params": val["params"]
            }
            for key, val in CHUNKING_STRATEGIES.items()
        },
        "llm_providers": {
            key: {
                "description": val["description"],
                "requires_key": val["requires_key"],
                "get_key_url": val.get("get_key_url", "N/A"),
                "models": {
                    m: {
                        "description": info["description"],
                        "speed": info["speed"],
                        "accuracy": info["accuracy"]
                    }
                    for m, info in val["models"].items()
                }
            }
            for key, val in LLM_PROVIDERS.items()
        },
        "retriever_options": RETRIEVER_OPTIONS,
        "default_config": DEFAULT_USER_CONFIG
    }


# ── GET /config/{user_id} — get user's current config ────────────────────────
@router.get("/{user_id}")
def get_config(user_id: str):
    """Returns the current configuration for a user."""
    config = get_user_config(user_id)
    return {
        "status": "success",
        "user_id": user_id,
        "config": config
    }


# ── PATCH /config/{user_id} — update specific fields ─────────────────────────
@router.patch("/{user_id}")
def update_config(user_id: str, updates: UserConfigUpdate):
    """
    Update one or more config fields for a user.
    Only provided fields are updated — others stay unchanged.
    """
    # Convert to dict, remove None values
    update_dict = {
        k: v.model_dump(exclude_none=True) if hasattr(v, 'model_dump') else v
        for k, v in updates.model_dump(exclude_none=True).items()
    }

    if not update_dict:
        raise HTTPException(status_code=400, detail="No valid fields provided to update.")

    # Validate
    is_valid, error_msg = validate_config(update_dict)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # ⚠️ Warn if embedding model changed — old index is incompatible
    config = get_user_config(user_id)
    warnings = []
    if "embedding_model" in update_dict and update_dict["embedding_model"] != config.get("embedding_model"):
        warnings.append(
            "Embedding model changed — your existing vector store is incompatible. "
            "Please re-upload your documents to rebuild the index."
        )

    updated = update_user_config(user_id, update_dict)
    return {
        "status": "success",
        "user_id": user_id,
        "config": updated,
        "warnings": warnings
    }


# ── POST /config/{user_id}/reset — reset to defaults ─────────────────────────
@router.post("/{user_id}/reset")
def reset_config(user_id: str):
    """Resets user configuration to system defaults."""
    config = reset_user_config(user_id)
    return {
        "status": "success",
        "user_id": user_id,
        "message": "Configuration reset to defaults.",
        "config": config
    }


# ── GET /config/{user_id}/llm-models — models for selected provider ───────────
@router.get("/{user_id}/llm-models")
def get_available_models_for_provider(user_id: str):
    """Returns available LLM models for the user's currently selected provider."""
    config = get_user_config(user_id)
    provider = config.get("llm_provider", "groq")
    provider_info = LLM_PROVIDERS.get(provider, {})
    return {
        "provider": provider,
        "requires_key": provider_info.get("requires_key", False),
        "get_key_url": provider_info.get("get_key_url", "N/A"),
        "available_models": provider_info.get("models", {})
    }