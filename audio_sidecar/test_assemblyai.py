"""
test_assemblyai.py
------------------
Smoke-test for the AssemblyAI integration:
  1. Loads ASSEMBLYAI_API_KEY from .env
  2. Generates a 3-second 440 Hz sine-wave WAV in memory
  3. Uploads it to AssemblyAI and requests a transcript
  4. Polls until complete, then prints the result (or any error)

Dependencies (pip install):
  python-dotenv  requests
"""

import io
import math
import struct
import time
import wave
import os

import requests
from dotenv import load_dotenv

# ── 1. Load API key ────────────────────────────────────────────────────────────
load_dotenv()                              # reads .env in cwd (audio_sidecar/)
API_KEY = os.getenv("ASSEMBLYAI_API_KEY", "").strip()

if not API_KEY or API_KEY == "your_api_key_here":
    raise SystemExit(
        "ERROR: ASSEMBLYAI_API_KEY is not set.\n"
        "Edit audio_sidecar/.env and replace 'your_api_key_here' with your real key."
    )

HEADERS = {"authorization": API_KEY}
BASE_URL = "https://api.assemblyai.com/v2"

# ── 2. Build a 3-second 440 Hz sine-wave WAV in memory ────────────────────────
def make_sine_wav(duration_s: float = 3.0, freq_hz: float = 440.0,
                  sample_rate: int = 16_000) -> bytes:
    """Returns raw bytes of a mono 16-bit PCM WAV file."""
    n_samples = int(sample_rate * duration_s)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)          # mono
        wf.setsampwidth(2)          # 16-bit
        wf.setframerate(sample_rate)
        for i in range(n_samples):
            sample = int(32767 * math.sin(2 * math.pi * freq_hz * i / sample_rate))
            wf.writeframes(struct.pack("<h", sample))
    return buf.getvalue()

print("Generating 3-second sine-wave WAV … ", end="", flush=True)
audio_bytes = make_sine_wav()
print(f"done ({len(audio_bytes):,} bytes)")

# ── 3. Upload audio ────────────────────────────────────────────────────────────
print("Uploading audio to AssemblyAI … ", end="", flush=True)
upload_resp = requests.post(
    f"{BASE_URL}/upload",
    headers={**HEADERS, "content-type": "application/octet-stream"},
    data=audio_bytes,
    timeout=30,
)
upload_resp.raise_for_status()
upload_url = upload_resp.json()["upload_url"]
print("done")

# ── 4. Request transcription ───────────────────────────────────────────────────
print("Requesting transcript … ", end="", flush=True)
tx_resp = requests.post(
    f"{BASE_URL}/transcript",
    headers=HEADERS,
    json={"audio_url": upload_url, "speech_models": ["universal-2"]},
    timeout=30,
)
if not tx_resp.ok:
    raise SystemExit(
        f"❌  Transcript request failed {tx_resp.status_code}:\n{tx_resp.text}"
    )
tx_id = tx_resp.json()["id"]
print(f"job id = {tx_id}")

# ── 5. Poll until complete ─────────────────────────────────────────────────────
print("Polling for result", end="", flush=True)
while True:
    poll_resp = requests.get(
        f"{BASE_URL}/transcript/{tx_id}",
        headers=HEADERS,
        timeout=30,
    )
    poll_resp.raise_for_status()
    data = poll_resp.json()
    status = data["status"]

    if status == "completed":
        print()  # newline after dots
        text = data.get("text") or ""
        print("\n--- Transcript ------------------------------------------")
        print("(empty — sine wave contains no speech)" if text == "" else text)
        print("---------------------------------------------------------")
        print("\n[OK] AssemblyAI round-trip succeeded.")
        break

    elif status == "error":
        print()
        raise SystemExit(f"[ERROR] AssemblyAI returned an error: {data.get('error')}")

    else:  # queued / processing
        print(".", end="", flush=True)
        time.sleep(3)
