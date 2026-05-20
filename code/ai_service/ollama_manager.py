import subprocess
import time
import requests
from config import OLLAMA_BASE_URL, OLLAMA_MODEL

def is_ollama_running() -> bool:
    """Check if Ollama server is already running."""
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        return response.status_code == 200
    except requests.exceptions.ConnectionError:
        return False

def is_model_available(model_name: str) -> bool:
    """Check if the specified model is pulled and available."""
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        if response.status_code == 200:
            models = response.json().get("models", [])
            return any(model_name in m["name"] for m in models)
        return False
    except requests.exceptions.ConnectionError:
        return False

def pull_model(model_name: str):
    """Pull the model if not available."""
    print(f"Pulling model '{model_name}'... this may take a few minutes.")
    result = subprocess.run(
        ["ollama", "pull", model_name],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"Failed to pull model '{model_name}': {result.stderr}")
    print(f"Model '{model_name}' pulled successfully.")

def start_ollama() -> bool:
    """Auto-starts Ollama server if not running."""
    if is_ollama_running():
        print("Ollama is already running.")
        return True

    print("Ollama not running. Starting Ollama server...")
    try:
        subprocess.Popen(
            ["ollama", "serve"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW  # Windows only
        )
        for attempt in range(15):
            time.sleep(1)
            if is_ollama_running():
                print(f"Ollama started successfully (took {attempt + 1}s).")
                return True
            print(f"Waiting for Ollama... ({attempt + 1}/15)")

        print("Ollama failed to start within 15 seconds.")
        return False

    except FileNotFoundError:
        raise RuntimeError(
            "Ollama is not installed. Download it from https://ollama.com/download"
        )

def ensure_ollama_ready(model_name: str = OLLAMA_MODEL):
    """Master function — ensures Ollama is running and model is available."""
    if not start_ollama():
        raise RuntimeError(
            "Could not start Ollama. Please run 'ollama serve' manually."
        )
    if not is_model_available(model_name):
        print(f"Model '{model_name}' not found locally.")
        pull_model(model_name)
    else:
        print(f"Model '{model_name}' is ready.")