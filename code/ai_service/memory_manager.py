from typing import List, Tuple, Dict

# Per-user memory store using standard Python lists
# Format: user_id -> list of (user_query, ai_response) tuples
user_memories: Dict[str, List[Tuple[str, str]]] = {}

def get_chat_history(user_id: str) -> List[Tuple[str, str]]:
    """
    Returns existing chat history for a user in the format 
    expected by LangChain's ConversationalRetrievalChain.
    """
    return user_memories.get(user_id, [])

def add_exchange(user_id: str, human_query: str, ai_response: str, window_size: int = 5):
    """
    Appends a new conversation exchange to the user's history
    and strictly enforces the sliding window limit (k=5).
    """
    if user_id not in user_memories:
        user_memories[user_id] = []
        
    user_memories[user_id].append((human_query, ai_response))
    
    # Enforce sliding window (k=5)
    if len(user_memories[user_id]) > window_size:
        user_memories[user_id] = user_memories[user_id][-window_size:]

def clear_memory(user_id: str):
    """
    Clears conversation history for a user — call on new session.
    """
    if user_id in user_memories:
        del user_memories[user_id]
        print(f"Memory cleared for user: {user_id}")