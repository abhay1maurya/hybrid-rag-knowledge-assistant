from langchain_classic.retrievers.multi_query import MultiQueryRetriever
from langchain_classic.retrievers import ContextualCompressionRetriever
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
from langchain_classic.retrievers.document_compressors import CrossEncoderReranker
from langchain_community.vectorstores import FAISS

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

def build_retriever(vectorstore: FAISS, llm):
    """
    Builds a retrieval pipeline:
    FAISS dense retriever → Multi-Query → Reranker
    """
    # Step 1: Dense retriever
    dense_retriever = vectorstore.as_retriever(search_kwargs={"k": 10})

    # Step 2: Multi-query
    multi_query_retriever = MultiQueryRetriever.from_llm(
        retriever=dense_retriever,
        llm=llm
    )

    # Step 3: Reranker — ✅ uses cached model
    compressor = CrossEncoderReranker(model=get_reranker(), top_n=3)

    retriever = ContextualCompressionRetriever(
        base_compressor=compressor,
        base_retriever=multi_query_retriever
    )

    return retriever