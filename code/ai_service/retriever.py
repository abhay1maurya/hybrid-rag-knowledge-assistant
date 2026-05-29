from langchain_classic.retrievers.multi_query import MultiQueryRetriever
from langchain_classic.retrievers import ContextualCompressionRetriever, EnsembleRetriever
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
from langchain_classic.retrievers.document_compressors import CrossEncoderReranker
from langchain_community.retrievers import BM25Retriever
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from typing import List

# ✅ Cache reranker model — loaded once, reused for all requests
_reranker_instance = None

def get_reranker():
    """Returns cached reranker model — loads only once on first call."""
    global _reranker_instance
    if _reranker_instance is None:
        print("Loading reranker model... (only happens once)")
        _reranker_instance = HuggingFaceCrossEncoder(
            model_name="BAAI/bge-reranker-base"
        )
        print("Reranker model loaded and cached.")
    return _reranker_instance

def load_all_docs_from_faiss(vectorstore: FAISS) -> List[Document]:
    """
    Extracts all documents from FAISS index for BM25Retriever.
    BM25 needs raw docs — it can't read from FAISS directly.
    """
    docs = []
    # Access internal docstore to get all documents
    for doc_id in vectorstore.index_to_docstore_id.values():
        doc = vectorstore.docstore.search(doc_id)
        if doc:
            docs.append(doc)
    return docs

def build_retriever(vectorstore, llm, retriever_config: dict = {}):
    k            = retriever_config.get("k_candidates", 10)
    top_n        = retriever_config.get("top_n_rerank", 3)
    bm25_weight  = retriever_config.get("bm25_weight", 0.4)
    use_mq       = retriever_config.get("use_multi_query", True)
    use_reranker = retriever_config.get("use_reranker", True)

    print(f"[Retriever] k={k}, top_n={top_n}, bm25={bm25_weight}, mq={use_mq}, reranker={use_reranker}")

    all_docs = load_all_docs_from_faiss(vectorstore)

    if not all_docs:
        retriever = vectorstore.as_retriever(search_kwargs={"k": k})
    else:
        bm25_retriever  = BM25Retriever.from_documents(all_docs, k=k)
        faiss_retriever = vectorstore.as_retriever(search_kwargs={"k": k})
        retriever = EnsembleRetriever(
            retrievers=[bm25_retriever, faiss_retriever],
            weights=[bm25_weight, 1.0 - bm25_weight]
        )

    if use_mq:
        retriever = MultiQueryRetriever.from_llm(retriever=retriever, llm=llm)

    if use_reranker:
        compressor = CrossEncoderReranker(model=get_reranker(), top_n=top_n)
        retriever  = ContextualCompressionRetriever(
            base_compressor=compressor,
            base_retriever=retriever
        )

    return retriever