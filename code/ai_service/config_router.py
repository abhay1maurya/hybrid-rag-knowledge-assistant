
from ollama_manager import is_model_available, pull_model
from fastapi import APIRouter, Form, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any

from model_registry import (
    EMBEDDING_MODELS, CHUNKING_STRATEGIES,
    LLM_PROVIDERS, RETRIEVER_OPTIONS, DEFAULT_USER_CONFIG
)
from user_config_manager import (
    get_user_config, update_user_config,
    validate_config, reset_user_config
)

router = APIRouter(prefix="/config", tags=["Configuration"])


# ── Pydantic Input Schemas ───────────────────────────────────────────────────
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


# ── Helper Utilities ──────────────────────────────────────────────────────────
def deep_merge(base: Dict[str, Any], update: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively merges update values into a base dictionary to preserve sub-configs."""
    merged = base.copy()
    for key, value in update.items():
        if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


# ── GET /config/options ──────────────────────────────────────────────────────
@router.get("/options")
def get_all_options():
    """Returns all dynamically available models, providers, and default fallback schemas."""
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


# ── GET /config/{user_id} ────────────────────────────────────────────────────
@router.get("/{user_id}")
def get_config(user_id: str):
    """Returns the current state configuration for a specified user context."""
    config = get_user_config(user_id)
    return {
        "status": "success",
        "user_id": user_id,
        "config": config
    }


# ── PATCH /config/{user_id} ──────────────────────────────────────────────────
@router.patch("/{user_id}")
def update_config(user_id: str, updates: UserConfigUpdate, background_tasks: BackgroundTasks):
    """
    Partially update user configuration variables. 
    Handles deep object mutation safety for nested parameters and auto-downloads missing offline models.
    """
    # 1. Extract structural patch inputs discarding explicitly unassigned parameters
    patch_dict = updates.model_dump(exclude_none=True)

    if not patch_dict:
        raise HTTPException(status_code=400, detail="No valid fields provided to update.")

    # 2. Retrieve current active user layout state (Do this EXACTLY ONCE)
    current_config = get_user_config(user_id)

    # 3. Compile the complete target state structure
    target_config = deep_merge(current_config, patch_dict)

    # 4. Validate the entire combined matrix state contextually
    is_valid, error_msg = validate_config(target_config, current_config)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # 5. Background Task: Auto-download missing offline models
    provider = target_config.get("llm_provider")
    model_name = target_config.get("llm_model")
    
    if provider == "offline" and model_name:
        if not is_model_available(model_name):
            print(f"[Config] User {user_id} requested missing model '{model_name}'. Queuing download...")
            background_tasks.add_task(pull_model, model_name)
    # 6. Structural checks: Warn if changes to embeddings alter structural index compatibility
    warnings = []
    if "embedding_model" in patch_dict and patch_dict["embedding_model"] != current_config.get("embedding_model"):
        warnings.append(
            "Embedding engine changed. Your existing local vector store collections are now incompatible. "
            "Please drop your collection indices and re-upload source documents to preserve query routing stability."
        )

    # 7. Commit the fully updated merge tree state configuration
    # Ensure this function name does not conflict with your router function name
    updated = update_user_config(user_id, target_config) 
    
    return {
        "status": "success",
        "user_id": user_id,
        "config": updated,
        "warnings": warnings,
        "message": f"Configuration saved. If '{model_name}' is new, it is downloading in the background." if (provider == "offline" and model_name and not is_model_available(model_name)) else "Configuration saved."
    }
# ── POST /config/{user_id}/reset ─────────────────────────────────────────────
@router.post("/{user_id}/reset")
def reset_config(user_id: str):
    """Resets user configuration tracking back to default factory profiles."""
    config = reset_user_config(user_id)
    return {
        "status": "success",
        "user_id": user_id,
        "message": "Configuration state successfully reset to system defaults.",
        "config": config
    }


# ── GET /config/{user_id}/llm-models ─────────────────────────────────────────
@router.get("/{user_id}/llm-models")
def get_available_models_for_provider(user_id: str):
    """Extracts available generation options specifically relevant to the user's active engine."""
    config = get_user_config(user_id)
    
    # Fallback checks looking at regional defaults if user records aren't set
    provider = config.get("llm_provider", DEFAULT_USER_CONFIG.get("llm_provider", "offline"))
    provider_info = LLM_PROVIDERS.get(provider, {})
    
    return {
        "provider": provider,
        "requires_key": provider_info.get("requires_key", False),
        "get_key_url": provider_info.get("get_key_url", "N/A"),
        "available_models": provider_info.get("models", {})
    }