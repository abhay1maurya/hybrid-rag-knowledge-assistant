import json
import os

CONFIG_DIR = "user_configs"
os.makedirs(CONFIG_DIR, exist_ok=True)

from model_registry import (
    DEFAULT_USER_CONFIG, EMBEDDING_MODELS,
    CHUNKING_STRATEGIES, LLM_PROVIDERS, RETRIEVER_OPTIONS
)

def _config_path(user_id: str) -> str:
    return os.path.join(CONFIG_DIR, f"{user_id}.json")

def get_user_config(user_id: str) -> dict:
    """Returns user config — creates default if first time."""
    path = _config_path(user_id)
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    # First time — save and return default
    save_user_config(user_id, DEFAULT_USER_CONFIG.copy())
    return DEFAULT_USER_CONFIG.copy()

def save_user_config(user_id: str, config: dict):
    """Saves user config to disk."""
    with open(_config_path(user_id), "w") as f:
        json.dump(config, f, indent=2)

def update_user_config(user_id: str, updates: dict) -> dict:
    config = get_user_config(user_id)

    # 1. VALIDATE AGAINST CURRENT STATE BEFORE MERGING
    is_valid, error_msg = validate_config(updates, config)
    if not is_valid:
        # Hard stop. Do not save. 
        # In a real app, you should raise a specific exception here 
        # so your API layer can catch it and return a 400 Bad Request.
        raise ValueError(f"Configuration update failed: {error_msg}")

    # 2. Merge updates
    for key, value in updates.items():
        if isinstance(value, dict) and key in config and isinstance(config[key], dict):
            config[key].update(value)
        else:
            config[key] = value

    # 3. Save
    save_user_config(user_id, config)
    return config

def validate_config(updates: dict, current_config: dict) -> tuple[bool, str]:
    """
    Validates a config update dict.
    Returns (is_valid, error_message).
    """
    # Validate embedding model
    if "embedding_model" in updates:
        if updates["embedding_model"] not in EMBEDDING_MODELS:
            return False, f"Invalid embedding_model. Choose from: {list(EMBEDDING_MODELS.keys())}"

    # Validate chunking strategy
    if "chunking_strategy" in updates:
        if updates["chunking_strategy"] not in CHUNKING_STRATEGIES:
            return False, f"Invalid chunking_strategy. Choose from: {list(CHUNKING_STRATEGIES.keys())}"

    # Validate LLM provider
    if "llm_provider" in updates:
        if updates["llm_provider"] not in LLM_PROVIDERS:
            return False, f"Invalid llm_provider. Choose from: {list(LLM_PROVIDERS.keys())}"

    # Validate LLM model matches provider
    if "llm_model" in updates:
        # Resolve the effective provider: use the incoming update, or fallback to current state
        provider = updates.get("llm_provider", current_config.get("llm_provider"))
        model = updates["llm_model"]

        if not provider:
            return False, "Cannot set llm_model: No llm_provider found in updates or current config."

        # Safety check in case the fallback provider is somehow invalid
        if provider not in LLM_PROVIDERS:
            return False, f"Invalid provider '{provider}'."

        available_models = list(LLM_PROVIDERS[provider].get("models", {}).keys())
        if model not in available_models:
            return False, f"Model '{model}' not available for provider '{provider}'. Choose from: {available_models}"
    # Validate retriever params
    if "retriever" in updates:
        r = updates["retriever"]
        opts = RETRIEVER_OPTIONS
        if "k_candidates" in r:
            if not (opts["k_candidates"]["min"] <= r["k_candidates"] <= opts["k_candidates"]["max"]):
                return False, f"k_candidates must be between {opts['k_candidates']['min']} and {opts['k_candidates']['max']}"
        if "top_n_rerank" in r:
            if not (opts["top_n_rerank"]["min"] <= r["top_n_rerank"] <= opts["top_n_rerank"]["max"]):
                return False, f"top_n_rerank must be between {opts['top_n_rerank']['min']} and {opts['top_n_rerank']['max']}"
        if "bm25_weight" in r:
            if not (0.0 <= r["bm25_weight"] <= 1.0):
                return False, "bm25_weight must be between 0.0 and 1.0"

    return True, ""

def reset_user_config(user_id: str) -> dict:
    """Resets user config to defaults."""
    save_user_config(user_id, DEFAULT_USER_CONFIG.copy())
    return DEFAULT_USER_CONFIG.copy()