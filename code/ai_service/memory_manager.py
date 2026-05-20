from langchain_classic.memory import ConversationBufferWindowMemory

# Per-user memory store
user_memories: dict = {}

def get_memory(user_id: str) -> ConversationBufferWindowMemory:
    """Returns existing memory for user or creates a new one."""
    if user_id not in user_memories:
        user_memories[user_id] = ConversationBufferWindowMemory(
            k=5,
            memory_key="chat_history",
            return_messages=True,
            output_key="answer"
        )
    return user_memories[user_id]

def clear_memory(user_id: str):
    """Clears conversation history for a user — call on new session."""
    if user_id in user_memories:
        del user_memories[user_id]
        print(f"Memory cleared for user: {user_id}")