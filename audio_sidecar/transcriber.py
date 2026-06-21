import io
import wave
import numpy as np
from groq import Groq
from config import GROQ_API_KEY

# Use the same Groq client you created for Qwen
client = Groq(api_key=GROQ_API_KEY)

def transcribe(pcm_f32: np.ndarray, sample_rate: int) -> str:
    if len(pcm_f32) == 0:
        return ""

    # Convert float32 [-1.0, 1.0] to int16 for WAV format
    pcm_i16 = (pcm_f32 * 32767).clip(-32768, 32767).astype(np.int16)
    
    # Create an in-memory WAV file (no need to save to disk!)
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_i16.tobytes())
    
    # Reset buffer position to the beginning before sending
    wav_buffer.seek(0)

    try:
        # Call Groq's Whisper API (Blazing fast!)
        transcription = client.audio.transcriptions.create(
            file=("audio.wav", wav_buffer, "audio/wav"),
            model="whisper-large-v3-turbo", # Groq's fastest Whisper model
            response_format="text",
        )
        return transcription.strip()
    
    except Exception as e:
        print("Groq Whisper transcription error:", e)
        return ""