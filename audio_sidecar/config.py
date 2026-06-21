from dotenv import load_dotenv
import os

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Keep the rest of your config (like ALLOWED_ORIGINS, APP_VERSION) exactly the same!

ASSEMBLYAI_API_KEY = os.environ["ASSEMBLYAI_API_KEY"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]

APP_VERSION = "1.0.0"

ALLOWED_ORIGINS = [
    "http://localhost:5173",
]