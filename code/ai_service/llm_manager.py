from config import GROQ_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY
from model_registry import LLM_PROVIDERS

# Cache: { "provider__model": llm_instance }
_llm_cache: dict = {}

def get_llm(provider: str = None, model: str = None, user_id: str = None):
    """
    Returns cached LLM for provider+model combo.
    If user_id given, reads from their config.
    """
    # Load from user config if user_id provided
    if user_id and not (provider and model):
        from user_config_manager import get_user_config
        config = get_user_config(user_id)
        provider = config.get("llm_provider", "groq")
        model    = config.get("llm_model", "llama-3.3-70b-versatile")

    provider = provider or "groq"
    model    = model    or list(LLM_PROVIDERS[provider]["models"].keys())[0]

    cache_key = f"{provider}__{model}"
    if cache_key in _llm_cache:
        return _llm_cache[cache_key]

    print(f"[LLM Manager] Initializing: {provider} / {model}")
    llm = _create_llm(provider, model)
    _llm_cache[cache_key] = llm
    return llm


def _create_llm(provider: str, model: str):
    """Instantiates the correct LLM class for the provider."""

    if provider == "offline":
        from langchain_ollama import OllamaLLM
        from ollama_manager import ensure_ollama_ready
        ensure_ollama_ready(model)
        return OllamaLLM(model=model)

    elif provider == "groq":
        from langchain_groq import ChatGroq
        if not GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY not set in .env")
        return ChatGroq(model=model, api_key=GROQ_API_KEY, temperature=0, max_tokens=1024)

    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not set in .env")
        return ChatOpenAI(model=model, api_key=OPENAI_API_KEY, temperature=0, max_tokens=1024)

    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        if not ANTHROPIC_API_KEY:
            raise ValueError("ANTHROPIC_API_KEY not set in .env")
        return ChatAnthropic(model=model, api_key=ANTHROPIC_API_KEY, temperature=0, max_tokens=1024)

    else:
        raise ValueError(f"Unknown provider: '{provider}'")


def get_current_provider_info(user_id: str = None) -> dict:
    """Returns active provider info for a user."""
    if user_id:
        from user_config_manager import get_user_config
        config = get_user_config(user_id)
        provider = config.get("llm_provider", "groq")
        model    = config.get("llm_model", "llama-3.3-70b-versatile")
    else:
        from config import LLM_PROVIDER, ONLINE_PROVIDER
        provider = LLM_PROVIDER
        model    = list(LLM_PROVIDERS.get(provider, {}).get("models", {}).keys())[0]

    provider_meta = LLM_PROVIDERS.get(provider, {})
    model_meta    = provider_meta.get("models", {}).get(model, {})
    return {
        "provider": provider,
        "model": model,
        "speed": model_meta.get("speed", "N/A"),
        "accuracy": model_meta.get("accuracy", "N/A"),
        "requires_key": provider_meta.get("requires_key", False)
    }

def clear_llm_cache():
    global _llm_cache
    _llm_cache = {}
    print("[LLM Manager] Cache cleared.")