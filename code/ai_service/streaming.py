import json
import asyncio
from typing import AsyncGenerator
from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.outputs import LLMResult


class StreamingCallbackHandler(AsyncCallbackHandler):
    """
    Captures LLM tokens as they stream and puts them in an async queue.
    The queue is consumed by the SSE endpoint to send to the client.
    """

    def __init__(self):
        self.queue = asyncio.Queue()
        self.done  = False

    async def on_llm_new_token(self, token: str, **kwargs):
        """Called by LangChain for every new token generated."""
        await self.queue.put(token)

    async def on_llm_end(self, response: LLMResult, **kwargs):
        """Called when LLM finishes generating."""
        await self.queue.put(None)  # None = sentinel, signals stream is done
        self.done = True

    async def on_llm_error(self, error: Exception, **kwargs):
        """Called if LLM throws an error during generation."""
        await self.queue.put(f"[ERROR]: {str(error)}")
        await self.queue.put(None)
        self.done = True

    async def token_generator(self) -> AsyncGenerator[str, None]:
        """Yields tokens from the queue until stream is done."""
        while True:
            token = await self.queue.get()
            if token is None:
                break
            yield token


def format_sse_event(data: dict) -> str:
    """Formats a dict as a Server-Sent Event string."""
    return f"data: {json.dumps(data)}\n\n"