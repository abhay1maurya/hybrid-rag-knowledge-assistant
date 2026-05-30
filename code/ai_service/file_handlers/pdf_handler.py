from typing import List
from langchain_core.documents import Document
from langchain_community.document_loaders import PyPDFLoader
from .base_handler import BaseFileHandler


class PDFHandler(BaseFileHandler):
    supported_extensions = [".pdf"]

    def load(self, file_path: str) -> List[Document]:
        print(f"  [PDFHandler] Loading: {file_path}")
        loader = PyPDFLoader(file_path)
        documents = loader.load()

        # Enrich metadata
        for doc in documents:
            doc.metadata["file_type"] = "pdf"
            doc.metadata["source"]    = file_path

        print(f"  [PDFHandler] Loaded {len(documents)} pages.")
        return documents