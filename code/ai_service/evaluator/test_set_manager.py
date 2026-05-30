import os
import json
from datetime import datetime

TEST_SET_DIR = "eval_test_sets"
os.makedirs(TEST_SET_DIR, exist_ok=True)


def _test_set_path(user_id: str) -> str:
    return os.path.join(TEST_SET_DIR, f"{user_id}_testset.json")


def _load_test_set(user_id: str) -> dict:
    path = _test_set_path(user_id)
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return {"questions": []}


def _save_test_set(user_id: str, data: dict):
    with open(_test_set_path(user_id), "w") as f:
        json.dump(data, f, indent=2)


def add_question(
    user_id: str,
    question: str,
    ground_truth: str = None  # optional expected answer
) -> dict:
    """
    Adds a test question to the user's evaluation set.
    ground_truth is optional but enables Context Recall scoring.
    """
    data      = _load_test_set(user_id)
    questions = data["questions"]

    # Check for duplicate
    existing = [q["question"].lower() for q in questions]
    if question.lower() in existing:
        return {
            "status":  "error",
            "message": "Question already exists in test set."
        }

    q_id = f"q_{len(questions) + 1}"
    questions.append({
        "q_id":         q_id,
        "question":     question,
        "ground_truth": ground_truth,
        "added_at":     datetime.now().isoformat()
    })

    _save_test_set(user_id, data)
    return {
        "status":       "success",
        "message":      f"Question added to test set.",
        "q_id":         q_id,
        "total_questions": len(questions),
        "has_ground_truth": ground_truth is not None
    }


def get_test_set(user_id: str) -> dict:
    """Returns all test questions for a user."""
    data      = _load_test_set(user_id)
    questions = data.get("questions", [])
    return {
        "status":         "success",
        "user_id":        user_id,
        "total_questions": len(questions),
        "questions_with_ground_truth": sum(
            1 for q in questions if q.get("ground_truth")
        ),
        "questions": questions
    }


def delete_question(user_id: str, q_id: str) -> dict:
    """Removes a specific question from the test set."""
    data      = _load_test_set(user_id)
    questions = data["questions"]
    original  = len(questions)

    data["questions"] = [q for q in questions if q["q_id"] != q_id]

    if len(data["questions"]) == original:
        return {"status": "error", "message": f"Question '{q_id}' not found."}

    _save_test_set(user_id, data)
    return {"status": "success", "message": f"Question '{q_id}' deleted."}


def clear_test_set(user_id: str) -> dict:
    """Clears all test questions for a user."""
    _save_test_set(user_id, {"questions": []})
    return {"status": "success", "message": "Test set cleared."}


def auto_generate_questions(user_id: str, llm, n: int = 5) -> dict:
    """
    Uses the LLM to auto-generate test questions from the user's indexed docs.
    Great for quick evaluation setup without manual question writing.
    """
    from config import VECTOR_STORE_PATH
    from embeddings import get_embeddings
    from user_config_manager import get_user_config
    from langchain_community.vectorstores import FAISS

    index_path = os.path.join(VECTOR_STORE_PATH, f"user_{user_id}")
    if not os.path.exists(index_path):
        return {
            "status":  "error",
            "message": "No documents indexed. Upload a document first."
        }

    try:
        # Load a sample of chunks from the vector store
        config     = get_user_config(user_id)
        embeddings = get_embeddings(config.get("embedding_model", "bge-large"))
        vectorstore = FAISS.load_local(
            index_path, embeddings,
            allow_dangerous_deserialization=True
        )

        # Get sample chunks
        sample_docs = []
        for doc_id in list(vectorstore.index_to_docstore_id.values())[:10]:
            doc = vectorstore.docstore.search(doc_id)
            if doc:
                sample_docs.append(doc.page_content[:500])

        context = "\n\n---\n\n".join(sample_docs)

        # Ask LLM to generate questions
        prompt = f"""Based on the following document content, generate exactly {n} diverse 
evaluation questions that test different aspects of the content.

Rules:
- Each question should be answerable from the content
- Cover different topics in the content
- Mix factual and conceptual questions
- Return ONLY the questions, one per line, numbered like: 1. Question here

Content:
{context}

Questions:"""

        response = llm.invoke(prompt)

        # Parse numbered questions
        lines     = response.strip().split("\n")
        questions = []
        for line in lines:
            line = line.strip()
            if line and line[0].isdigit() and "." in line:
                q_text = line.split(".", 1)[1].strip()
                if q_text and len(q_text) > 10:
                    questions.append(q_text)

        # Add to test set
        added = []
        for q in questions[:n]:
            result = add_question(user_id, q)
            if result["status"] == "success":
                added.append(q)

        return {
            "status":            "success",
            "message":           f"Auto-generated {len(added)} questions.",
            "questions_added":   added,
            "total_in_test_set": len(_load_test_set(user_id)["questions"])
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}