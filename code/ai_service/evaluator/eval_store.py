import os
import json
from datetime import datetime
import shutil

EVAL_DIR = "eval_results"
os.makedirs(EVAL_DIR, exist_ok=True)

PASS_THRESHOLD = 0.7  # score >= 0.7 = passed


def _results_path(user_id: str) -> str:
    return os.path.join(EVAL_DIR, f"{user_id}_results.json")


def _load_results(user_id: str) -> dict:
    """
    Loads results defensively. If the JSON file is corrupted (e.g., from an
    interrupted write), it catches the error, backs up the bad file, and 
    returns a clean state so the system doesn't crash.
    """
    path = _results_path(user_id)
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            print(f"[EvalStore] ERROR: Corrupted JSON for user {user_id}: {e}")
            
            # Back up the corrupted file instead of crashing or overwriting it blindly
            corrupt_path = f"{path}.corrupted"
            shutil.copy(path, corrupt_path)
            print(f"[EvalStore] Backed up corrupted file to {corrupt_path}. Starting fresh.")
            
            return {"evaluations": []}
            
    return {"evaluations": []}


def _save_results(user_id: str, data: dict):
    with open(_results_path(user_id), "w") as f:
        json.dump(data, f, indent=2)


def save_evaluation(user_id: str, eval_result: dict):
    """Saves one evaluation run to disk."""
    data = _load_results(user_id)
    data["evaluations"].append({
        "eval_id":      f"eval_{len(data['evaluations']) + 1}",
        "evaluated_at": datetime.now().isoformat(),
        **eval_result
    })
    _save_results(user_id, data)
    print(f"[EvalStore] Saved evaluation for user '{user_id}'.")


def get_all_results(user_id: str) -> dict:
    """Returns all evaluation runs for a user."""
    data        = _load_results(user_id)
    evaluations = data.get("evaluations", [])
    return {
        "status":      "success",
        "user_id":     user_id,
        "total_runs":  len(evaluations),
        "evaluations": evaluations
    }


def get_latest_result(user_id: str) -> dict:
    """Returns the most recent evaluation run."""
    data        = _load_results(user_id)
    evaluations = data.get("evaluations", [])
    if not evaluations:
        return {"status": "error", "message": "No evaluations found."}
    return {"status": "success", "evaluation": evaluations[-1]}


def get_summary(user_id: str) -> dict:
    """
    Aggregates all evaluation runs into a trend summary.
    Shows average scores, best/worst runs, and improvement over time.
    """
    data        = _load_results(user_id)
    evaluations = data.get("evaluations", [])

    if not evaluations:
        return {
            "status":  "error",
            "message": "No evaluations found. Run an evaluation first."
        }

    # Collect scores across all runs
    metrics = ["faithfulness", "answer_relevancy", "context_precision", "context_recall"]
    metric_history = {m: [] for m in metrics}

    for ev in evaluations:
        overall = ev.get("overall_scores", {})
        for m in metrics:
            if m in overall and overall[m] is not None:
                metric_history[m].append(overall[m])

    # Compute averages, min, max
    aggregated = {}
    for m, scores in metric_history.items():
        if scores:
            aggregated[m] = {
                "average": round(sum(scores) / len(scores), 4),
                "best":    round(max(scores), 4),
                "worst":   round(min(scores), 4),
                "trend":   _compute_trend(scores)
            }

    # Latest vs first comparison
    first_scores  = evaluations[0].get("overall_scores",  {}) if len(evaluations) > 1 else {}
    latest_scores = evaluations[-1].get("overall_scores", {})

    improvement = {}
    for m in metrics:
        if m in first_scores and m in latest_scores:
            diff = round(latest_scores[m] - first_scores[m], 4)
            improvement[m] = f"+{diff}" if diff >= 0 else str(diff)

    return {
        "status":         "success",
        "user_id":        user_id,
        "total_runs":     len(evaluations),
        "latest_scores":  latest_scores,
        "aggregated":     aggregated,
        "improvement_since_first_run": improvement,
        "pass_threshold": PASS_THRESHOLD,
        "evaluation_dates": [ev["evaluated_at"] for ev in evaluations]
    }


def clear_results(user_id: str) -> dict:
    """Clears all evaluation history for a user."""
    _save_results(user_id, {"evaluations": []})
    return {"status": "success", "message": "Evaluation history cleared."}


def _compute_trend(scores: list) -> str:
    """Returns improving / declining / stable based on last 3 scores."""
    if len(scores) < 2:
        return "insufficient_data"
    recent = scores[-3:] if len(scores) >= 3 else scores
    if recent[-1] > recent[0] + 0.02:
        return "improving"
    elif recent[-1] < recent[0] - 0.02:
        return "declining"
    return "stable"