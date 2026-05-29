import os
import re
from langchain_community.document_loaders import PyPDFLoader
from langchain_experimental.text_splitter import SemanticChunker
from langchain_text_splitters import RecursiveCharacterTextSplitter, CharacterTextSplitter
from langchain_community.vectorstores import FAISS
from embeddings import get_embeddings
from config import VECTOR_STORE_PATH
from model_registry import CHUNKING_STRATEGIES

def clean_text(text: str) -> str:
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    text = re.sub(r'-\n', '', text)
    text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)
    return text.strip()

def _build_splitter(chunking_strategy: str, chunking_params: dict, embeddings=None):
    """Builds the appropriate text splitter based on user config."""

    if chunking_strategy == "recursive":
        return RecursiveCharacterTextSplitter(
            chunk_size=chunking_params.get("chunk_size", 600),
            chunk_overlap=chunking_params.get("chunk_overlap", 100),
            separators=["\n\n", "\n", ". ", "! ", "? ", " ", ""]
        )

    elif chunking_strategy == "semantic":
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

    else:
        print(f"Unknown chunking strategy '{chunking_strategy}', using recursive.")
        return RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=100)


def process_document(file_path: str, user_id: str, user_config: dict = None) -> int:
    """
    Loads a PDF, cleans, chunks with user config, embeds and saves to FAISS.
    """
    from user_config_manager import get_user_config
    config = user_config or get_user_config(user_id)

    embedding_model   = config.get("embedding_model", "bge-large")
    chunking_strategy = config.get("chunking_strategy", "recursive")
    chunking_params   = config.get("chunking_params", {})

    print(f"[DocProcessor] embedding={embedding_model}, chunking={chunking_strategy}")

    # 1. Load PDF
    print(f"[1/5] Loading PDF...")
    loader = PyPDFLoader(file_path)
    documents = loader.load()
    print(f"      {len(documents)} pages loaded.")

    # 2. Clean text
    print(f"[2/5] Cleaning text...")
    for doc in documents:
        doc.page_content = clean_text(doc.page_content)

    # 3. Get embeddings
    print(f"[3/5] Loading embedding model '{embedding_model}'...")
    embeddings = get_embeddings(embedding_model)

    # 4. Chunk
    print(f"[4/5] Chunking with strategy '{chunking_strategy}'...")
    splitter = _build_splitter(chunking_strategy, chunking_params, embeddings)

    # Fallback for oversized chunks
    fallback_splitter = RecursiveCharacterTextSplitter(
        chunk_size=800, chunk_overlap=100
    )

    docs = []
    if chunking_strategy == "semantic":
        # Semantic chunker uses create_documents
        for i, document in enumerate(documents):
            print(f"      Page {i+1}/{len(documents)}...", end="\r")
            if not document.page_content.strip() or len(document.page_content.strip()) < 100:
                docs.append(document)
                continue
            chunks = splitter.create_documents(
                texts=[document.page_content],
                metadatas=[document.metadata]
            )
            for chunk in chunks:
                if len(chunk.page_content) > 1200:
                    docs.extend(fallback_splitter.split_documents([chunk]))
                else:
                    docs.append(chunk)
    else:
        # Recursive and fixed use split_documents
        raw_chunks = splitter.split_documents(documents)
        for chunk in raw_chunks:
            if len(chunk.page_content) > 1200:
                docs.extend(fallback_splitter.split_documents([chunk]))
            else:
                docs.append(chunk)

    print(f"\n      {len(docs)} chunks created.")

    # 5. Add metadata and save
    for doc in docs:
        doc.metadata["user_id"]           = user_id
        doc.metadata["chunk_size"]        = len(doc.page_content)
        doc.metadata["embedding_model"]   = embedding_model
        doc.metadata["chunking_strategy"] = chunking_strategy

    print(f"[5/5] Saving to FAISS vector store...")
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