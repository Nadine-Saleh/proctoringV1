import json
import time
from pathlib import Path

_BASE = Path("data") / "sessions"


def _session_dir(session_id: str) -> Path:
    d = _BASE / session_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def append_transcript(
    session_id: str,
    exam_id: str,
    chunk_index: int,
    transcript: str,
    classification: str,
    confidence: float,
) -> None:
    d = _session_dir(session_id)
    entry = {
        "ts": time.time(),
        "exam_id": exam_id,
        "chunk_index": chunk_index,
        "transcript": transcript,
        "classification": classification,
        "confidence": confidence,
    }
    with open(d / "transcripts.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def save_audio_evidence(
    session_id: str,
    chunk_index: int,
    wav_bytes: bytes,
) -> Path:
    d = _session_dir(session_id)
    path = d / f"chunk_{chunk_index:06d}.wav"
    path.write_bytes(wav_bytes)
    return path


def close_session(session_id: str, summary: dict) -> Path:
    d = _session_dir(session_id)
    summary_path = d / "summary.json"
    summary["closed_at"] = time.time()
    summary_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return summary_path
