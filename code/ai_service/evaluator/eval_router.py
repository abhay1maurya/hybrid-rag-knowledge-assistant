from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from evaluator import (
    run_evaluation, save_evaluation,
    add_question, get_test_set, delete_question,
    clear_test_set, auto_generate_questions,
    get_all_results, get_latest_result,
    get_summary, clear_results
)
from embeddings import get_embeddings
from llm_manager import get_llm
from user_config_manager import get_user_config

router = APIRouter(prefix="/eval", tags=["Evaluation"])


# ── Pydantic models ───────────────────────────────────────────────────────────
class AddQuestionRequest(BaseModel):
    question:     str
    ground_truth: Optional[str] = None  # optional expected answer


# ── Test Set Management ───────────────────────────────────────────────────────
@router.get("/{user_id}/test-set")
def get_user_test_set(user_id: str):
    """Returns all test questions for a user."""
    return get_test_set(user_id)


@router.post("/{user_id}/test-set/add")
def add_test_question(user_id: str, body: AddQuestionRequest):
    """
    Adds a question to the evaluation test set.
    ground_truth is optional but enables Context Recall + Answer Correctness scoring.
    """
    result = add_question(
        user_id=user_id,
        question=body.question,
        ground_truth=body.ground_truth
    )
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.delete("/{user_id}/test-set/{q_id}")
def delete_test_question(user_id: str, q_id: str):
    """Removes a specific question from the test set."""
    result = delete_question(user_id, q_id)
    if result["status"] == "error":
        raise HTTPException(status_code=404, detail=result["message"])
    return result


@router.delete("/{user_id}/test-set")
def clear_user_test_set(user_id: str):
    """Clears all test questions for a user."""
    return clear_test_set(user_id)


@router.post("/{user_id}/test-set/auto-generate")
def auto_generate_test_questions(user_id: str, n: int = 5):
    """
    Auto-generates n test questions from the user's indexed documents.
    Great for quick evaluation setup.
    """
    try:
        llm    = get_llm(user_id=user_id)
        result = auto_generate_questions(user_id, llm, n)
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Run Evaluation ────────────────────────────────────────────────────────────
@router.post("/{user_id}/run")
def run_user_evaluation(user_id: str):
    """
    Runs full evaluation on the user's test set.
    Returns per-question scores + overall averages + recommendations.
    """
    try:
        config     = get_user_config(user_id)
        llm        = get_llm(user_id=user_id)
        embeddings = get_embeddings(config.get("embedding_model", "bge-large"))

        result = run_evaluation(user_id, llm, embeddings)

        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])

        # Save result to history
        save_evaluation(user_id, result)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── View Results ──────────────────────────────────────────────────────────────
@router.get("/{user_id}/results")
def get_evaluation_results(user_id: str):
    """Returns all evaluation runs for a user."""
    return get_all_results(user_id)


@router.get("/{user_id}/results/latest")
def get_latest_evaluation(user_id: str):
    """Returns the most recent evaluation run."""
    result = get_latest_result(user_id)
    if result["status"] == "error":
        raise HTTPException(status_code=404, detail=result["message"])
    return result


@router.get("/{user_id}/summary")
def get_evaluation_summary(user_id: str):
    """
    Returns aggregated scores across all runs.
    Shows trends, best/worst scores, and improvement over time.
    """
    result = get_summary(user_id)
    if result["status"] == "error":
        raise HTTPException(status_code=404, detail=result["message"])
    return result


@router.delete("/{user_id}/results")
def clear_evaluation_history(user_id: str):
    """Clears all evaluation history for a user."""
    return clear_results(user_id)