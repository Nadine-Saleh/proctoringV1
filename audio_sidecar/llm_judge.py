import os
import json
import google.generativeai as genai


# Load API key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

genai.configure(api_key=GEMINI_API_KEY)

# استخدم موديل سريع ورخيص
_model = genai.GenerativeModel("gemini-1.5-flash")


SYSTEM_PROMPT = """
You are an AI exam proctor.

Classify the student's speech transcript into ONE of the following categories:

1. normal_speech
2. thinking_aloud
3. technical_issue
4. cheating_attempt

Rules:
- Math explanations and solving steps = thinking_aloud
- Programming reasoning = thinking_aloud
- Asking for help or answers = cheating_attempt
- Talking about camera/mic issues = technical_issue
- Casual speech = normal_speech

IMPORTANT:
Return ONLY valid JSON in this format:
{
  "classification": "...",
  "confidence": 0.0-1.0
}
"""


def classify_with_llm(transcript: str) -> dict:
    if not transcript or not transcript.strip():
        return {
            "classification": "normal_speech",
            "confidence": 0.0,
        }

    prompt = f"""
{SYSTEM_PROMPT}

Transcript:
\"\"\"{transcript}\"\"\"
"""

    try:
        response = _model.generate_content(prompt)
        text = response.text.strip()

        # Try parsing JSON safely
        result = json.loads(text)

        return {
            "classification": result.get("classification", "normal_speech"),
            "confidence": float(result.get("confidence", 0.5)),
        }

    except Exception as e:
        # fallback safe mode (no crash)
        return {
            "classification": "normal_speech",
            "confidence": 0.0,
            "error": str(e),
        }