import os
import re
from file_handlers import HandlerFactory
from langchain_experimental.text_splitter import SemanticChunker
from langchain_text_splitters import RecursiveCharacterTextSplitter, CharacterTextSplitter
from langchain_community.vectorstores import FAISS
from embeddings import get_embeddings
from config import VECTOR_STORE_PATH
from user_config_manager import get_user_config

def clean_text(text: str) -> str:
    """Removes excessive whitespace and broken newlines."""
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    text = re.sub(r'-\n', '', text)
    text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)
    return text.strip()

def _build_splitter(chunking_strategy: str, chunking_params: dict, embeddings=None):
    """Centralized text splitter initialization."""
    if chunking_strategy == "semantic":
        if embeddings is None:
            raise ValueError("Embeddings required for semantic chunking.")
        return SemanticChunker(
            embeddings,
            breakpoint_threshold_type=chunking_params.get("breakpoint_threshold_type", "standard_deviation"),
            breakpoint_threshold_amount=chunking_params.get("breakpoint_threshold_amount", 1.0)
        )

    elif chunking_strategy == "fixed":
        return CharacterTextSplitter(
            chunk_size=chunking_params.get("chunk_size", 500),
            chunk_overlap=chunking_params.get("chunk_overlap", 50),
            separator=" "
        )

    # Default to recursive
    return RecursiveCharacterTextSplitter(
        chunk_size=chunking_params.get("chunk_size", 600),
        chunk_overlap=chunking_params.get("chunk_overlap", 100),
        separators=["\n\n", "\n", ". ", "! ", "? ", " ", ""]
    )


def process_document(file_path: str, user_id: str, user_config: dict = None) -> int:
    config = user_config or get_user_config(user_id)

    embedding_model   = config.get("embedding_model", "bge-large")
    chunking_strategy = config.get("chunking_strategy", "recursive")
    chunking_params   = config.get("chunking_params", {})

    # 1. Validate file is supported
    if not HandlerFactory.is_supported(file_path):
        raise ValueError(
            f"Unsupported file type. Supported: {HandlerFactory.supported_extensions()}"
        )

    # 2. Load using correct handler
    print(f"[1/5] Loading file: {file_path}")
    handler   = HandlerFactory.get_handler(file_path)
    is_valid, err = handler.validate(file_path)
    if not is_valid:
        raise ValueError(err)

    documents = handler.load(file_path)
    if not documents:
        raise ValueError("No content extracted from file.")
    print(f"      Loaded {len(documents)} document sections.")

    # 3. Clean text
    print(f"[2/5] Cleaning text...")
    for doc in documents:
        doc.page_content = clean_text(doc.page_content)

    # 4. Get embeddings
    print(f"[3/5] Loading embedding model '{embedding_model}'...")
    embeddings = get_embeddings(embedding_model)

    # 5. Chunk (Using the centralized builder)
    print(f"[4/5] Chunking with strategy '{chunking_strategy}'...")
    splitter = _build_splitter(chunking_strategy, chunking_params, embeddings)
    
    docs = []
    
    if chunking_strategy == "semantic":
        # Semantic chunking requires isolated document processing to prevent memory spikes
        for i, document in enumerate(documents):
            print(f"      Section {i+1}/{len(documents)}...", end="\r")
            if not document.page_content.strip() or len(document.page_content.strip()) < 100:
                docs.append(document)
                continue
                
            chunks = splitter.create_documents(
                texts=[document.page_content],
                metadatas=[document.metadata]
            )
            docs.extend(chunks)
    else:
        # Standard chunking can process the array directly
        docs = splitter.split_documents(documents)

    print(f"\n      {len(docs)} chunks created.")

    # 6. Add metadata & Normalize
    filename = os.path.basename(file_path)
    for doc in docs:
        doc.metadata["user_id"]           = user_id
        doc.metadata["chunk_size"]        = len(doc.page_content)
        doc.metadata["embedding_model"]   = embedding_model
        doc.metadata["chunking_strategy"] = chunking_strategy
        doc.metadata["page"]              = doc.metadata.get("page", "General Document")
        
        # Hard override source to ensure exact match for deletion logic
        doc.metadata["source"] = filename

    # 7. Save to FAISS
    print(f"[5/5] Saving to FAISS...")
    user_index_path = os.path.join(VECTOR_STORE_PATH, f"user_{user_id}")
    
    if os.path.exists(user_index_path):
        vectorstore = FAISS.load_local(
            user_index_path, embeddings,
            allow_dangerous_deserialization=True
        )
        vectorstore.add_documents(docs)
    else:
        vectorstore = FAISS.from_documents(docs, embeddings)

    vectorstore.save_local(user_index_path)
    print(f"Done. {len(docs)} chunks indexed for user '{user_id}'.")
    
    return len(docs)