import os
from langchain_community.document_loaders import PyPDFLoader 
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.llms import Ollama
from langchain_classic.chains import RetrievalQA
from langchain_ollama import OllamaLLM
from langchain_core.prompts import PromptTemplate
from langchain_classic.retrievers.multi_query import MultiQueryRetriever
from langchain_experimental.text_splitter import SemanticChunker
from langchain_text_splitters import RecursiveCharacterTextSplitter

from langchain_classic.retrievers import  ContextualCompressionRetriever, EnsembleRetriever
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
from langchain_classic.retrievers.document_compressors import CrossEncoderReranker
from langchain_community.retrievers import BM25Retriever
import re

VECTOR_STORE_PATH =" vector_store"
EMBEDDING_MODEL = "BAAI/bge-large-en-v1.5"

def clean_text(text: str) -> str:
    text = re.sub(r'\n{3,}', '\n\n', text)       # collapse excess newlines
    text = re.sub(r'[ \t]{2,}', ' ', text)        # collapse extra spaces
    text = re.sub(r'-\n', '', text)                # fix hyphenated line breaks
    text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)  # join soft-wrapped lines
    return text.strip()

def get_embeddings():
    return HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
        model_kwargs={"device": "cpu"},           # change to "cuda" if you have a GPU
        encode_kwargs={"normalize_embeddings": True}  # ⚠️ required for BGE models to work correctly
    )


def process_document(file_path: str, user_id: str):
    loader = PyPDFLoader(file_path)
    documents = loader.load()

    # Clean text before chunking
    for doc in documents:
        doc.page_content = clean_text(doc.page_content)

    embeddings = get_embeddings()

    # ✅ Primary splitter — semantic chunking
    splitter = SemanticChunker(
        embeddings,
        breakpoint_threshold_type="standard_deviation",
        breakpoint_threshold_amount=1.0
    )

    # ✅ Fallback splitter — handles oversized semantic chunks
    fallback_splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100,
        separators=["\n\n", "\n", ". ", " ", ""]
    )

    docs = []
    for document in documents:
        chunks = splitter.create_documents(
            texts=[document.page_content],
            metadatas=[document.metadata]
        )
        for chunk in chunks:
            # If a semantic chunk is too large, split it further
            if len(chunk.page_content) > 1000:
                sub_chunks = fallback_splitter.split_documents([chunk])
                docs.extend(sub_chunks)
            else:
                docs.append(chunk)

    # Add user_id metadata
    for doc in docs:
        doc.metadata["user_id"] = user_id
        doc.metadata["chunk_size"] = len(doc.page_content)  # helpful for debugging

    # Create or Update Vector Store
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

    # 2. Initialize LLM early (needed for MultiQueryRetriever)
    llm = OllamaLLM(model="mistral")

    # 3. Dense FAISS Retriever — fetch more candidates for reranking
    dense_retriever = vectorstore.as_retriever(search_kwargs={"k": 10})

    # 4. Multi-Query Retriever — generates 3 phrasings of your query
    #    catches relevant chunks that a single query might miss
    multi_query_retriever = MultiQueryRetriever.from_llm(
        retriever=dense_retriever,
        llm=llm
    )

    # 5. Reranker — re-scores retrieved chunks, keeps only top 3
    #    much more accurate than raw vector similarity scoring
    reranker_model = HuggingFaceCrossEncoder(model_name="BAAI/bge-reranker-base")
    compressor = CrossEncoderReranker(model=reranker_model, top_n=3)

    retriever = ContextualCompressionRetriever(
        base_compressor=compressor,
        base_retriever=multi_query_retriever   # reranks multi-query results
    )

    # 6. Custom Prompt
    prompt_template = """You are a precise and helpful assistant.
    Answer the question using ONLY the context provided below.
    If the answer is not found in the context, respond with: "I don't have enough information in the provided documents to answer this."
    Do NOT use any prior knowledge or make assumptions beyond what is in the context.
    Cite the page number after your answer like: [Source: page X]

    Context:
    {context}

    Question: {question}

    Answer:"""

    prompt = PromptTemplate(
        template=prompt_template,
        input_variables=["context", "question"]
    )

    # 7. RAG Chain
    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=retriever,
        return_source_documents=True,
        chain_type_kwargs={"prompt": prompt}
    )

    # 8. Execute Query
    result = qa_chain.invoke({"query": query})

    # Extract sources for transparency
    sources = list(set([
        f"Page {doc.metadata.get('page', 'N/A')}"
        for doc in result['source_documents']
    ]))
    print(f"Sources used: {', '.join(sources)}")  # helpful for debugging

    return result["result"]