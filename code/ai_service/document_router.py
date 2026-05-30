from fastapi import APIRouter, HTTPException
from document_manager import (
    list_documents, get_document_stats,
    delete_document, delete_all_documents,
    get_user_stats
)

router = APIRouter(prefix="/documents", tags=["Document Management"])


@router.get("/{user_id}")
def list_user_documents(user_id: str):
    """Lists all indexed documents for a user."""
    return list_documents(user_id)


@router.get("/{user_id}/stats")
def user_storage_stats(user_id: str):
    """Returns overall storage and usage stats for a user."""
    return get_user_stats(user_id)


@router.get("/{user_id}/{doc_id}")
def document_detail(user_id: str, doc_id: str):
    """Returns detailed stats for a single document."""
    result = get_document_stats(user_id, doc_id)
    if result["status"] == "error":
        raise HTTPException(status_code=404, detail=result["message"])
    return result


@router.delete("/{user_id}/{doc_id}")
def delete_single_document(user_id: str, doc_id: str):
    """
    Deletes a single document from the user's index.
    Removes only that document's chunks — other documents unaffected.
    """
    result = delete_document(user_id, doc_id)
    if result["status"] == "error":
        raise HTTPException(status_code=404, detail=result["message"])
    return result


@router.delete("/{user_id}")
def delete_all_user_documents(user_id: str):
    """Deletes ALL documents and the FAISS index for a user."""
    return delete_all_documents(user_id)