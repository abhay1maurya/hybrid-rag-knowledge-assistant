# All available models and options for user selection

EMBEDDING_MODELS = {
    "bge-large": {
        "model_name": "BAAI/bge-large-en-v1.5",
        "dimensions": 1024,
        "normalize": True,
        "speed": "slow",
        "accuracy": "very high",
        "size": "1.3GB",
        "description": "Best accuracy, recommended for production"
    },
    "bge-base": {
        "model_name": "BAAI/bge-base-en-v1.5",
        "dimensions": 768,
        "normalize": True,
        "speed": "medium",
        "accuracy": "high",
        "size": "430MB",
        "description": "Good balance of speed and accuracy"
    },
    "bge-small": {
        "model_name": "BAAI/bge-small-en-v1.5",
        "dimensions": 384,
        "normalize": True,
        "speed": "fast",
        "accuracy": "medium",
        "size": "130MB",
        "description": "Fastest, good for development and testing"
    },
    "minilm": {
        "model_name": "sentence-transformers/all-MiniLM-L6-v2",
        "dimensions": 384,
        "normalize": False,
        "speed": "very fast",
        "accuracy": "medium",
        "size": "90MB",
        "description": "Lightest model, best for low-resource environments"
    },
    "mpnet": {
        "model_name": "sentence-transformers/all-mpnet-base-v2",
        "dimensions": 768,
        "normalize": False,
        "speed": "medium",
        "accuracy": "high",
        "size": "420MB",
        "description": "Strong general-purpose embedding model"
    }
}

CHUNKING_STRATEGIES = {
    "recursive": {
        "description": "Fast rule-based chunking — best for most documents",
        "speed": "very fast",
        "accuracy": "good",
        "params": {
            "chunk_size": {
                "default": 600,
                "min": 100,
                "max": 2000,
                "description": "Max characters per chunk"
            },
            "chunk_overlap": {
                "default": 100,
                "min": 0,
                "max": 500,
                "description": "Overlap between consecutive chunks"
            }
        }
    },
    "semantic": {
        "description": "ML-based chunking — splits on semantic boundaries (slow on CPU)",
        "speed": "slow",
        "accuracy": "very good",
        "params": {
            "breakpoint_threshold_type": {
                "default": "standard_deviation",
                "options": ["percentile", "standard_deviation", "interquartile"],
                "description": "Method to detect semantic breaks"
            },
            "breakpoint_threshold_amount": {
                "default": 1.0,
                "min": 0.5,
                "max": 2.0,
                "description": "Sensitivity of semantic break detection"
            }
        }
    },
    "fixed": {
        "description": "Simple fixed-size chunking — fastest, least context-aware",
        "speed": "very fast",
        "accuracy": "basic",
        "params": {
            "chunk_size": {
                "default": 500,
                "min": 100,
                "max": 2000,
                "description": "Fixed characters per chunk"
            },
            "chunk_overlap": {
                "default": 50,
                "min": 0,
                "max": 300,
                "description": "Overlap between consecutive chunks"
            }
        }
    }
}

LLM_PROVIDERS = {
    "offline": {
        "description": "Fully local — no internet or API key required",
        "requires_key": False,
        "models": {
            "mistral": {
                "description": "Fast, capable 7B model — best for offline use",
                "speed": "medium",
                "accuracy": "good"
            },
            "llama3": {
                "description": "Meta LLaMA 3 — strong reasoning",
                "speed": "medium",
                "accuracy": "very good"
            },
            "phi3": {
                "description": "Microsoft Phi-3 — lightweight and fast",
                "speed": "fast",
                "accuracy": "good"
            },
            "gemma2": {
                "description": "Google Gemma 2 — efficient and capable",
                "speed": "medium",
                "accuracy": "good"
            }
        }
    },
    "groq": {
        "description": "Ultra-fast cloud inference — free tier available",
        "requires_key": True,
        "key_env": "GROQ_API_KEY",
        "get_key_url": "https://console.groq.com",
        "models": {
            "llama-3.3-70b-versatile": {
                "description": "Best Groq model — strong reasoning and speed",
                "speed": "very fast",
                "accuracy": "very high"
            },
            "llama-3.1-8b-instant": {
                "description": "Fastest Groq model — great for quick answers",
                "speed": "ultra fast",
                "accuracy": "good"
            },
            "mixtral-8x7b-32768": {
                "description": "Large context window — good for long documents",
                "speed": "fast",
                "accuracy": "high"
            },
            "gemma2-9b-it": {
                "description": "Google Gemma 2 via Groq — fast and reliable",
                "speed": "very fast",
                "accuracy": "good"
            }
        }
    },
    "openai": {
        "description": "OpenAI cloud models — reliable and widely used",
        "requires_key": True,
        "key_env": "OPENAI_API_KEY",
        "get_key_url": "https://platform.openai.com",
        "models": {
            "gpt-4o": {
                "description": "Most capable OpenAI model",
                "speed": "fast",
                "accuracy": "very high"
            },
            "gpt-4o-mini": {
                "description": "Cost-effective, strong accuracy",
                "speed": "fast",
                "accuracy": "high"
            },
            "gpt-3.5-turbo": {
                "description": "Fastest and cheapest OpenAI model",
                "speed": "very fast",
                "accuracy": "medium"
            }
        }
    },
    "anthropic": {
        "description": "Anthropic Claude — best for document QA accuracy",
        "requires_key": True,
        "key_env": "ANTHROPIC_API_KEY",
        "get_key_url": "https://console.anthropic.com",
        "models": {
            "claude-sonnet-4-20250514": {
                "description": "Best accuracy for document QA tasks",
                "speed": "fast",
                "accuracy": "very high"
            },
            "claude-haiku-4-5-20251001": {
                "description": "Fastest Claude model — great for quick answers",
                "speed": "very fast",
                "accuracy": "high"
            }
        }
    }
}

RETRIEVER_OPTIONS = {
    "k_candidates": {
        "default": 10,
        "min": 3,
        "max": 30,
        "description": "Number of chunks to fetch before reranking"
    },
    "top_n_rerank": {
        "default": 3,
        "min": 1,
        "max": 10,
        "description": "Number of chunks to keep after reranking"
    },
    "bm25_weight": {
        "default": 0.4,
        "min": 0.0,
        "max": 1.0,
        "description": "Weight for BM25 keyword search (FAISS weight = 1 - this)"
    },
    "use_multi_query": {
        "default": True,
        "description": "Generate multiple query variants for better recall"
    },
    "use_reranker": {
        "default": True,
        "description": "Use cross-encoder reranker for more accurate ranking"
    }
}

# Default config applied to every new user
DEFAULT_USER_CONFIG = {
    "embedding_model": "bge-large",
    "chunking_strategy": "recursive",
    "chunking_params": {
        "chunk_size": 600,
        "chunk_overlap": 100
    },
    "llm_provider": "groq",
    "llm_model": "llama-3.3-70b-versatile",
    "retriever": {
        "k_candidates": 10,
        "top_n_rerank": 3,
        "bm25_weight": 0.4,
        "use_multi_query": True,
        "use_reranker": True
    }
}