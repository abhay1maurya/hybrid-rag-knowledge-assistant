from abc import ABC, abstractmethod
from typing import List
from langchain_core.documents import Document


class BaseFileHandler(ABC):
    """
    Base class for all file handlers.
    Every handler must implement load() and return a list of Documents.
    """

    # Subclasses declare which extensions they handle
    supported_extensions: list[str] = []

    @abstractmethod
    def load(self, file_path: str) -> List[Document]:
        """
        Load a file and return a list of LangChain Documents.
        Each Document has page_content and metadata.
        """
        pass

    def validate(self, file_path: str) -> tuple[bool, str]:
        """
        Optional validation before loading.
        Returns (is_valid, error_message).
        """
        import os
        if not os.path.exists(file_path):
            return False, f"File not found: {file_path}"
        if os.path.getsize(file_path) == 0:
            return False, "File is empty."
        return True, ""