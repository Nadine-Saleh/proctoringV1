import json
from groq import Groq
from config import GROQ_API_KEY

# Initialize Groq client
client = Groq(api_key=GROQ_API_KEY)

# Qwen 3 32B on Groq
MODEL_NAME = "llama-3.3-70b-versatile"

def classify(transcript: str) -> tuple[str, float]:
    transcript = transcript.strip()

    if not transcript:
        return ("silence", 1.0)

    prompt = f"""
You are an AI exam proctor. Analyze the following transcript to determine if it indicates cheating.

SUSPICIOUS examples:
- Directly stating answers: "the answer is A", "it's option B", "answer number 3"
- Asking for help with specific questions
- Using external tools (Google, ChatGPT)
- Collaborating with another student

NORMAL examples:
- Reading questions aloud to oneself
- Thinking aloud about concepts
- Explaining reasoning steps

Return ONLY valid JSON. Do not include any other text or explanations.
Format:
{{
  "classification": "normal_speech" or "suspicious_speech",
  "confidence": 0.0 to 1.0
}}

Transcript:
{transcript}
"""

    try:
        # REMOVED response_format={"type": "json_object"} to prevent API crashes
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=100,
        )

        text = completion.choices[0].message.content.strip()
        
        # Clean up markdown formatting if the model adds it
        if text.startswith("```"):
            text = text.replace("```json", "")
            text = text.replace("```", "")
            text = text.strip()

        result = json.loads(text)

        classification = result.get("classification", "normal_speech")
        confidence = float(result.get("confidence", 0.5))

        if classification not in ["normal_speech", "suspicious_speech"]:
            classification = "normal_speech"

        confidence = max(0.0, min(confidence, 1.0))

        return (classification, confidence)

    except Exception as e:
        print("Groq/Qwen detector error:", e)
        # Fallback to normal speech on error so it doesn't crash the exam
        return ("normal_speech", 0.5)