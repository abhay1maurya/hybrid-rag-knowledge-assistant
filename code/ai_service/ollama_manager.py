import subprocess
import time
import requests
import sys
import json
from config import OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_GUARDRAIL_MODEL

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
            # Handle matching variations like "mistral:latest"
            return any(model_name in m["name"] or m["name"].startswith(model_name) for m in models)
        return False
    except requests.exceptions.ConnectionError:
        return False

def pull_model(model_name: str):
    """Pulls the model via native Ollama API stream for real-time progress logging."""
    
    # 1. FIX: Do not attempt to pull if the server is dead
    if not is_ollama_running():
        # Try to auto-start it using your existing function
        if not start_ollama():
            print(f"\n[CRITICAL ERROR] Cannot pull '{model_name}'. Ollama is not running and could not be started.")
            return

    print(f"\n[Ollama] Model '{model_name}' not found. Starting automatic download...")
    try:
        url = f"{OLLAMA_BASE_URL}/api/pull"
        payload = {"name": model_name, "stream": True}
        
        with requests.post(url, json=payload, stream=True, timeout=600) as response:
            if response.status_code != 200:
                raise RuntimeError(f"Ollama pull API returned status code {response.status_code}")
                
            for line in response.iter_lines():
                if line:
                    data = json.loads(line.decode('utf-8'))
                    status = data.get("status", "downloading")
                    
                    if "completed" in data and "total" in data:
                        percent = (data["completed"] / data["total"]) * 100
                        sys.stdout.write(f"\r[Ollama Pull] {model_name}: {status} [{percent:.1f}%]          ")
                    else:
                        sys.stdout.write(f"\r[Ollama Pull] {model_name}: {status}                    ")
                    sys.stdout.flush()
                    
        print(f"\n[Ollama] Model '{model_name}' downloaded and synchronized successfully.")
        
    except Exception as e:
        print(f"\n[Ollama API Pull Failed: {e}]. Falling back to subprocess execution...")
        try:
            # 2. FIX: Added a timeout of 10 minutes so it NEVER hangs your server infinitely
            result = subprocess.run(
                ["ollama", "pull", model_name],
                capture_output=True,
                text=True,
                timeout=600 
            )
            if result.returncode != 0:
                print(f"[ERROR] Failed to pull model '{model_name}': {result.stderr}")
            else:
                print(f"[Ollama] Model '{model_name}' pulled successfully via CLI.")
        except subprocess.TimeoutExpired:
            print(f"[CRITICAL ERROR] Subprocess pull for '{model_name}' timed out after 10 minutes.")
            
def start_ollama() -> bool:
    """Auto-starts Ollama server if not running."""
    if is_ollama_running():
        return True

    print("[Ollama] Core server not running. Launching instance backend...")
    try:
        # Cross-platform startup command logic
        if sys.platform == "win32":
            subprocess.Popen(
                ["ollama", "serve"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
        else:
            subprocess.Popen(
                ["ollama", "serve"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            
        for attempt in range(15):
            time.sleep(1)
            if is_ollama_running():
                print(f"[Ollama] Connection established successfully (took {attempt + 1}s).")
                return True
            print(f"[Ollama] Awaiting daemon synchronization... ({attempt + 1}/15)")

        print("[Ollama] Daemon initialization timed out after 15 seconds.")
        return False

    except FileNotFoundError:
        raise RuntimeError(
            "Ollama binary not found on local execution path. Download it from https://ollama.com/download"
        )

def ensure_ollama_ready(model_name: str = None):
    """
    Master verification checkpoint. 
    Guarantees the system daemon is online and all pipeline models are ready.
    Accepts an optional model_name parameter to stay backward-compatible with older callers.
    """
    if not start_ollama():
        raise RuntimeError(
            "Could not verify Ollama runtime state. Please run 'ollama serve' manually."
        )
    
    # Base array of dependencies required by the system core
    required_models = [OLLAMA_MODEL, OLLAMA_GUARDRAIL_MODEL]
    
    # If the caller passed an explicit model string, make sure it gets verified too
    if model_name and model_name not in required_models:
        required_models.append(model_name)
    
    print(f"[Ollama Check] Beginning system health audit for dependencies: {required_models}")
    for model in required_models:
        if not is_model_available(model):
            pull_model(model)
        else:
            print(f"[Ollama Check] Dependency '{model}' is verified and ready.")