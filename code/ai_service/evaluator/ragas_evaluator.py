import os
from typing import List
from datetime import datetime

PASS_THRESHOLD = 0.7


def _safe_score(value) -> float:
    """Safely converts a RAGAS score to float."""
    try:
        if value is None:
            return None
        return round(float(value), 4)
    except Exception:
        return None


def _extract_text_from_response(response) -> str:
    """
    Handles both string and AIMessage responses from LLM.
    AIMessage has .content attribute, plain strings don't.
    """
    if hasattr(response, 'content'):
        return response.content.strip()
    else:
        return str(response).strip()


def _score_with_llm(
    question: str,
    answer: str,
    contexts: List[str],
    ground_truth: str,
    llm,
    embeddings
) -> dict:
    """
    Scores a single QA pair using LLM-based evaluation.
    Falls back to manual scoring if RAGAS fails.
    """
    scores = {}

    # ── Faithfulness ─────────────────────────────────────────────────────────
    # Does the answer only use information from the context?
    try:
        faithfulness_prompt = f"""You are an evaluator. Given a context and an answer,
score how faithful the answer is to the context on a scale of 0.0 to 1.0.

1.0 = Every claim in the answer is supported by the context
0.0 = The answer contains claims not in the context at all

Context:
{chr(10).join(contexts[:3])}

Answer: {answer}

Return ONLY a decimal number between 0.0 and 1.0. Nothing else."""

        response = llm.invoke(faithfulness_prompt)
        response_text = _extract_text_from_response(response)
        
        # Extract first number found
        import re
        nums = re.findall(r'\d+\.?\d*', response_text)
        scores["faithfulness"] = _safe_score(float(nums[0])) if nums else 0.5
        scores["faithfulness"] = min(1.0, max(0.0, scores["faithfulness"]))
    except Exception as e:
        print(f"  Faithfulness scoring failed: {e}")
        scores["faithfulness"] = None

    # ── Answer Relevancy ──────────────────────────────────────────────────────
    # Does the answer actually address the question?
    try:
        relevancy_prompt = f"""You are an evaluator. Score how relevant the answer is
to the question on a scale of 0.0 to 1.0.

1.0 = Answer directly and completely addresses the question
0.0 = Answer is completely irrelevant to the question

Question: {question}
Answer: {answer}

Return ONLY a decimal number between 0.0 and 1.0. Nothing else."""

        response = llm.invoke(relevancy_prompt)
        response_text = _extract_text_from_response(response)
        
        import re
        nums = re.findall(r'\d+\.?\d*', response_text)
        scores["answer_relevancy"] = _safe_score(float(nums[0])) if nums else 0.5
        scores["answer_relevancy"] = min(1.0, max(0.0, scores["answer_relevancy"]))
    except Exception as e:
        print(f"  Answer relevancy scoring failed: {e}")
        scores["answer_relevancy"] = None

    # ── Context Precision ─────────────────────────────────────────────────────
    # Are the retrieved chunks actually useful?
    try:
        precision_prompt = f"""You are an evaluator. Given a question and retrieved context chunks,
score what fraction of the context is actually relevant to answering the question (0.0 to 1.0).

1.0 = All context chunks are directly relevant
0.0 = None of the context chunks are relevant

Question: {question}
Context chunks:
{chr(10).join([f'Chunk {i+1}: {c[:300]}' for i, c in enumerate(contexts)])}

Return ONLY a decimal number between 0.0 and 1.0. Nothing else."""

        response = llm.invoke(precision_prompt)
        response_text = _extract_text_from_response(response)
        
        import re
        nums = re.findall(r'\d+\.?\d*', response_text)
        scores["context_precision"] = _safe_score(float(nums[0])) if nums else 0.5
        scores["context_precision"] = min(1.0, max(0.0, scores["context_precision"]))
    except Exception as e:
        print(f"  Context precision scoring failed: {e}")
        scores["context_precision"] = None

    # ── Context Recall ────────────────────────────────────────────────────────
    # Does context contain all info needed to answer? (needs ground truth)
    if ground_truth:
        try:
            recall_prompt = f"""You are an evaluator. Given a ground truth answer and retrieved context,
score how much of the ground truth information is covered by the context (0.0 to 1.0).

1.0 = All information in the ground truth can be found in the context
0.0 = None of the ground truth information is in the context

Ground truth answer: {ground_truth}
Context:
{chr(10).join(contexts[:3])}

Return ONLY a decimal number between 0.0 and 1.0. Nothing else."""

            response = llm.invoke(recall_prompt)
            response_text = _extract_text_from_response(response)
            
            import re
            nums = re.findall(r'\d+\.?\d*', response_text)
            scores["context_recall"] = _safe_score(float(nums[0])) if nums else 0.5
            scores["context_recall"] = min(1.0, max(0.0, scores["context_recall"]))
        except Exception as e:
            print(f"  Context recall scoring failed: {e}")
            scores["context_recall"] = None
    else:
        scores["context_recall"] = None  # requires ground truth

    # ── Answer Correctness ────────────────────────────────────────────────────
    # Is the answer factually correct vs ground truth?
    if ground_truth:
        try:
            correctness_prompt = f"""You are an evaluator. Compare the generated answer 
to the ground truth and score correctness from 0.0 to 1.0.

1.0 = Answer is completely correct and matches ground truth
0.0 = Answer is completely wrong or contradicts ground truth

Ground truth: {ground_truth}
Generated answer: {answer}

Return ONLY a decimal number between 0.0 and 1.0. Nothing else."""

            response = llm.invoke(correctness_prompt)
            response_text = _extract_text_from_response(response)
            
            import re
            nums = re.findall(r'\d+\.?\d*', response_text)
            scores["answer_correctness"] = _safe_score(float(nums[0])) if nums else 0.5
            scores["answer_correctness"] = min(1.0, max(0.0, scores["answer_correctness"]))
        except Exception as e:
            print(f"  Answer correctness scoring failed: {e}")
            scores["answer_correctness"] = None
    else:
        scores["answer_correctness"] = None

    return scores


def run_evaluation(user_id: str, llm, embeddings) -> dict:
    """
    Runs the full evaluation pipeline for a user's test set.
    Returns detailed per-question scores + overall averages.
    """
    from evaluator.test_set_manager import get_test_set
    from config import VECTOR_STORE_PATH
    from langchain_community.vectorstores import FAISS
    from user_config_manager import get_user_config

    # 1. Load test set
    test_set  = get_test_set(user_id)
    questions = test_set.get("questions", [])

    if len(questions) < 1:
        return {
            "status":  "error",
            "message": "Test set is empty. Add at least 1 question first."
        }

    print(f"[Evaluator] Running evaluation for user '{user_id}' "
          f"({len(questions)} questions)...")

    # 2. Load vector store for retrieval
    index_path = os.path.join(VECTOR_STORE_PATH, f"user_{user_id}")
    if not os.path.exists(index_path):
        return {
            "status":  "error",
            "message": "No documents indexed. Upload a document first."
        }

    config      = get_user_config(user_id)
    vectorstore = FAISS.load_local(
        index_path, embeddings,
        allow_dangerous_deserialization=True
    )

    retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

    # 3. Score each question
    per_question_results = []

    for i, q in enumerate(questions):
        question     = q["question"]
        ground_truth = q.get("ground_truth")

        print(f"  [{i+1}/{len(questions)}] Evaluating: {question[:60]}...")

        try:
            # Retrieve context
            docs     = retriever.invoke(question)
            contexts = [doc.page_content for doc in docs]

            # Generate answer via LLM
            context_text = "\n\n".join(contexts[:3])
            answer_prompt = f"""Answer the question using ONLY the context below.
If the answer is not in the context, say "I don't have enough information."

Context:
{context_text}

Question: {question}

Answer:"""
            
            answer_response = llm.invoke(answer_prompt)
            answer = _extract_text_from_response(answer_response)

            # Score
            scores = _score_with_llm(
                question=question,
                answer=answer,
                contexts=contexts,
                ground_truth=ground_truth,
                llm=llm,
                embeddings=embeddings
            )

            # Determine pass/fail (only on non-None scores)
            scored_values = [v for v in scores.values() if v is not None]
            avg_score     = sum(scored_values) / len(scored_values) if scored_values else 0
            passed        = avg_score >= PASS_THRESHOLD

            per_question_results.append({
                "q_id":         q["q_id"],
                "question":     question,
                "answer":       answer,
                "ground_truth": ground_truth,
                "contexts_used": len(contexts),
                "scores":       scores,
                "average_score": round(avg_score, 4),
                "passed":       passed
            })

        except Exception as e:
            print(f"  Error evaluating question '{question[:40]}': {e}")
            per_question_results.append({
                "q_id":    q["q_id"],
                "question": question,
                "error":   str(e),
                "passed":  False
            })

    # 4. Compute overall scores
    metrics = ["faithfulness", "answer_relevancy", "context_precision",
               "context_recall", "answer_correctness"]

    overall_scores = {}
    for m in metrics:
        values = [
            r["scores"][m]
            for r in per_question_results
            if "scores" in r and r["scores"].get(m) is not None
        ]
        overall_scores[m] = round(sum(values) / len(values), 4) if values else None

    # 5. Summary stats
    total_passed = sum(1 for r in per_question_results if r.get("passed"))
    total_failed = len(per_question_results) - total_passed

    result = {
        "status":            "success",
        "user_id":           user_id,
        "evaluated_at":      datetime.now().isoformat(),
        "total_questions":   len(per_question_results),
        "passed":            total_passed,
        "failed":            total_failed,
        "pass_rate":         round(total_passed / len(per_question_results), 4),
        "pass_threshold":    PASS_THRESHOLD,
        "overall_scores":    overall_scores,
        "per_question":      per_question_results,
        "recommendations":   _generate_recommendations(overall_scores)
    }

    return result


def _generate_recommendations(scores: dict) -> list:
    """
    Generates actionable improvement recommendations based on scores.
    """
    recommendations = []

    faith = scores.get("faithfulness")
    relev = scores.get("answer_relevancy")
    prec  = scores.get("context_precision")
    recal = scores.get("context_recall")

    if faith is not None and faith < PASS_THRESHOLD:
        recommendations.append({
            "metric":  "faithfulness",
            "score":   faith,
            "issue":   "LLM is hallucinating — adding information not in context.",
            "fixes": [
                "Make prompt stricter: 'Answer ONLY from context, never use prior knowledge'",
                "Reduce LLM temperature to 0",
                "Increase top_n_rerank to provide more context"
            ]
        })

    if relev is not None and relev < PASS_THRESHOLD:
        recommendations.append({
            "metric":  "answer_relevancy",
            "score":   relev,
            "issue":   "Answers are not directly addressing questions.",
            "fixes": [
                "Improve query preprocessing — better filler removal",
                "Enable query expansion in query_processor.py",
                "Tune the answer prompt to be more focused"
            ]
        })

    if prec is not None and prec < PASS_THRESHOLD:
        recommendations.append({
            "metric":  "context_precision",
            "score":   prec,
            "issue":   "Retriever is returning too many irrelevant chunks.",
            "fixes": [
                "Decrease k_candidates in retriever config (try 5-7)",
                "Increase bm25_weight for keyword-heavy documents",
                "Enable reranker if not already on"
            ]
        })

    if recal is not None and recal < PASS_THRESHOLD:
        recommendations.append({
            "metric":  "context_recall",
            "score":   recal,
            "issue":   "Retriever is missing relevant chunks.",
            "fixes": [
                "Increase k_candidates in retriever config (try 15-20)",
                "Enable multi-query retrieval",
                "Try smaller chunk_size (400-500) for more granular retrieval",
                "Switch embedding model to bge-large for better semantic search"
            ]
        })

    if not recommendations:
        recommendations.append({
            "metric":  "overall",
            "issue":   "All metrics passing!",
            "fixes":   ["Keep monitoring with live queries to maintain quality."]
        })

    return recommendations