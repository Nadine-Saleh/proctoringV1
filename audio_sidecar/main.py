import uuid
import numpy as np
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

import config
import transcriber as transcriber_mod
import llm_detector
import session_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up AssemblyAI transcriber
   # _ = transcriber_mod._transcriber
    yield


app = FastAPI(
    title="Audio Proctoring Sidecar",
    version=config.APP_VERSION,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,  # Set in config/env, e.g. ["http://localhost:5173"]
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- HEALTH ----------------
@app.get("/health")
def health():
    return {"status": "ok", "version": config.APP_VERSION}


# ---------------- ANALYZE ----------------
@app.post("/analyze")
async def analyze(request: Request):
    session_id = request.headers.get("X-Session-Id", "unknown")
    exam_id = request.headers.get("X-Exam-Id", "unknown")
    sample_rate_str = request.headers.get("X-Sample-Rate", "16000")
    chunk_index_str = request.headers.get("X-Chunk-Index", "0")

    try:
        sample_rate = int(sample_rate_str)
        chunk_index = int(chunk_index_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid headers")

    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="Empty audio body")

    try:
        pcm_f32 = np.frombuffer(body, dtype=np.float32)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"PCM decode error: {exc}")

    try:
        transcript = transcriber_mod.transcribe(pcm_f32, sample_rate)
    except Exception as exc:
        print("\nTRANSCRIBER ERROR:")
        print(repr(exc))
        raise


    classification, confidence = llm_detector.classify(transcript)
    flag_id = str(uuid.uuid4())

    print("\n")
    print("=" * 50)
    print("TRANSCRIPT:", transcript)
    print("CLASSIFICATION:", classification)
    print("CONFIDENCE:", confidence)
    print("=" * 50)
    print("\n")

    session_manager.append_transcript(
        session_id=session_id,
        exam_id=exam_id,
        chunk_index=chunk_index,
        transcript=transcript,
        classification=classification,
        confidence=confidence,
    )

    return {
        "flag_id": flag_id,
        "classification": classification,
        "confidence": confidence,
        "transcript": transcript,
    }


# ---------------- CLOSE SESSION ----------------
class ClosePayload(BaseModel):
    session_id: str
    exam_id: str
    flag_count: int = 0
    notes: str = ""


@app.post("/session/close")
def close_session(payload: ClosePayload):
    path = session_manager.close_session(
        session_id=payload.session_id,
        summary={
            "exam_id": payload.exam_id,
            "flag_count": payload.flag_count,
            "notes": payload.notes,
        },
    )

    return {
        "status": "closed",
        "summary_path": str(path),
    }