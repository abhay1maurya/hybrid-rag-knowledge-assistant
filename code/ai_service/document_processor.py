import os
import re
from langchain_community.document_loaders import PyPDFLoader
from langchain_experimental.text_splitter import SemanticChunker
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from embeddings import get_embeddings
from config import VECTOR_STORE_PATH

def clean_text(text: str) -> str:
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    text = re.sub(r'-\n', '', text)
    text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)
    return text.strip()

def process_document(file_path: str, user_id: str) -> int:
    print(f"[1/5] Loading PDF: {file_path}")
    loader = PyPDFLoader(file_path)
    documents = loader.load()
    print(f"      Loaded {len(documents)} pages.")

    print(f"[2/5] Cleaning text...")
    for doc in documents:
        doc.page_content = clean_text(doc.page_content)

    print(f"[3/5] Loading embeddings model...")
    embeddings = get_embeddings()

    # ✅ SemanticChunker is slow on CPU for large docs
    # Process page by page and log progress
    splitter = SemanticChunker(
        embeddings,
        breakpoint_threshold_type="standard_deviation",
        breakpoint_threshold_amount=1.0
    )

    fallback_splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100,
        separators=["\n\n", "\n", ". ", " ", ""]
    )

    print(f"[4/5] Chunking {len(documents)} pages semantically...")
    docs = []
    for i, document in enumerate(documents):
        print(f"      Chunking page {i + 1}/{len(documents)}...", end="\r")

        # ✅ Skip empty pages — SemanticChunker hangs on blank pages
        if not document.page_content.strip():
            continue

        # ✅ Skip pages that are too short — not worth semantic chunking
        if len(document.page_content.strip()) < 100:
            docs.append(document)
            continue

        chunks = splitter.create_documents(
            texts=[document.page_content],
            metadatas=[document.metadata]
        )
        for chunk in chunks:
            if len(chunk.page_content) > 1000:
                sub_chunks = fallback_splitter.split_documents([chunk])
                docs.extend(sub_chunks)
            else:
                docs.append(chunk)

    print(f"\n      Created {len(docs)} chunks total.")

    # Add metadata
    for doc in docs:
        doc.metadata["user_id"] = user_id
        doc.metadata["chunk_size"] = len(doc.page_content)

    print(f"[5/5] Saving to FAISS vector store...")
    user_index_path = os.path.join(VECTOR_STORE_PATH, f"user_{user_id}")

    if os.path.exists(user_index_path):
        vectorstore = FAISS.load_local(
            user_index_path,
            embeddings,
            allow_dangerous_deserialization=True
        )
        vectorstore.add_documents(docs)
    else:
        vectorstore = FAISS.from_documents(docs, embeddings)

    vectorstore.save_local(user_index_path)
    print(f"      Vector store saved to: {user_index_path}")
    print(f"Done! {len(docs)} chunks indexed for user '{user_id}'.")
    return len(docs)