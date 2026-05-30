import os
from typing import List
from langchain_core.documents import Document
from .base_handler import BaseFileHandler


class TXTHandler(BaseFileHandler):
    supported_extensions = [".txt", ".md", ".rst", ".log"]

    def load(self, file_path: str) -> List[Document]:
        print(f"  [TXTHandler] Loading: {file_path}")

        # Detect encoding — handle UTF-8, Latin-1, etc.
        encoding = self._detect_encoding(file_path)

        with open(file_path, "r", encoding=encoding, errors="replace") as f:
            content = f.read()

        if not content.strip():
            print(f"  [TXTHandler] Warning: file is empty.")
            return []

        # Split into logical pages by double newline sections
        # (keeps large files manageable)
        sections = self._split_into_sections(content)

        documents = []
        for i, section in enumerate(sections):
            if section.strip():
                documents.append(Document(
                    page_content=section,
                    metadata={
                        "source":    file_path,
                        "file_type": "txt",
                        "filename":  os.path.basename(file_path),
                        "section":   i + 1,
                        "page":      i + 1,  # use section as page for citation
                    }
                ))

        print(f"  [TXTHandler] Loaded {len(documents)} sections.")
        return documents

    def _detect_encoding(self, file_path: str) -> str:
        """Try UTF-8 first, fall back to Latin-1."""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                f.read(1024)
            return "utf-8"
        except UnicodeDecodeError:
            return "latin-1"

    def _split_into_sections(self, content: str, max_section_size: int = 3000) -> list:
        """
        Splits text into logical sections.
        Splits on double newlines first, then merges small sections,
        and splits oversized ones.
        """
        # Split on double newline (paragraph boundary)
        raw_sections = content.split("\n\n")

        sections  = []
        current   = ""

        for block in raw_sections:
            block = block.strip()
            if not block:
                continue

            # If adding this block exceeds limit, save current and start new
            if len(current) + len(block) > max_section_size and current:
                sections.append(current)
                current = block
            else:
                current = f"{current}\n\n{block}" if current else block

        if current:
            sections.append(current)

        return sections