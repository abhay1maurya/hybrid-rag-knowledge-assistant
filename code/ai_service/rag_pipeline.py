import os
from langchain_community.document_loaders import PyPDFLoader 
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.llms import Ollama
from langchain_classic.chains import RetrievalQA
from langchain_ollama import OllamaLLM

# from langchain_text_splitters import NLTKTextSplitter
# import nltk
from langchain_experimental.text_splitter import SemanticChunker

VECTOR_STORE_PATH =" vector_store"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

def get_embeddings():
    """Initializes and returns the embedding model."""
    return HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
def process_document(file_path: str, user_id: str):
    """
    Loads a PDF, chunks it, generates embeddings, and saves to a user-specific FAISS index.
    """
    # 1. Load Document
    loader = PyPDFLoader(file_path)
    documents = loader.load()

    # 2. Initialize embeddings once (reused for both chunker and vector store)
    embeddings = get_embeddings()

    # 3. Split Text using Semantic Chunking
    splitter = SemanticChunker(
        embeddings,                              # ✅ pass the embeddings object, not the string
        breakpoint_threshold_type="percentile",
        breakpoint_threshold_amount=95
    )

    docs = []
    for document in documents:
        chunks = splitter.create_documents(
            texts=[document.page_content],
            metadatas=[document.metadata]        # preserves source, page number, etc.
        )
        docs.extend(chunks)

    # 4. Add user_id metadata for multi-tenant isolation
    for doc in docs:
        doc.metadata["user_id"] = user_id

    # 5. Create or Update Vector Store
    user_index_path = os.path.join(VECTOR_STORE_PATH, f"user_{user_id}")

    if os.path.exists(user_index_path):
        # Load existing index and add new docs
        vectorstore = FAISS.load_local(
            user_index_path,
            embeddings,
            allow_dangerous_deserialization=True
        )
        vectorstore.add_documents(docs)
    else:
        # Create a new index for this user
        vectorstore = FAISS.from_documents(docs, embeddings)

    vectorstore.save_local(user_index_path)
    return len(docs)

def ask_question(query: str, user_id: str):
    """
    Retrieves context from the user's FAISS index and generates an answer using Ollama.
    """
    user_index_path = os.path.join(VECTOR_STORE_PATH, f"user_{user_id}")
    
    if not os.path.exists(user_index_path):
        return "No documents found. Please upload a document first."

    # 1. Load User's Vector Store
    embeddings = get_embeddings()
    vectorstore = FAISS.load_local(
        user_index_path, 
        embeddings, 
        allow_dangerous_deserialization=True
    )

    # 2. Setup Retriever
    # Retrieve top 3 most relevant chunks
    retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

    # 3. Initialize Local LLM (Ollama)
    llm = OllamaLLM(model="mistral")

    # 4. Create RAG Chain
    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        retriever=retriever,
        return_source_documents=True # Helpful for source citations
    )

    # 5. Execute Query
    result = qa_chain.invoke({"query": query})
    
    # Optional: Extract source document info
    # sources = [doc.metadata.get('source') for doc in result['source_documents']]
    
    return result["result"]