import os
from .base_handler import BaseFileHandler
from .pdf_handler  import PDFHandler
from .txt_handler  import TXTHandler
from .docx_handler import DOCXHandler
from .csv_handler  import CSVHandler

# Registry — add new handlers here
_HANDLERS = [
    PDFHandler,
    TXTHandler,
    DOCXHandler,
    CSVHandler,
]

# Build extension → handler map
_EXTENSION_MAP: dict[str, BaseFileHandler] = {}
for handler_class in _HANDLERS:
    instance = handler_class()
    for ext in handler_class.supported_extensions:
        _EXTENSION_MAP[ext.lower()] = instance


class HandlerFactory:

    @staticmethod
    def get_handler(file_path: str) -> BaseFileHandler:
        """Returns the correct handler for a file based on its extension."""
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in _EXTENSION_MAP:
            raise ValueError(
                f"Unsupported file type '{ext}'. "
                f"Supported: {list(_EXTENSION_MAP.keys())}"
            )
        return _EXTENSION_MAP[ext]

    @staticmethod
    def supported_extensions() -> list:
        return list(_EXTENSION_MAP.keys())

    @staticmethod
    def is_supported(file_path: str) -> bool:
        ext = os.path.splitext(file_path)[1].lower()
        return ext in _EXTENSION_MAP