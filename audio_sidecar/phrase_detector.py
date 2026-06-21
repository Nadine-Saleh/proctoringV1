import re

# Each pattern: (name, compiled_regex, weight)
# Covers English and Egyptian Arabic transliteration
_PATTERNS: list[tuple[str, re.Pattern, float]] = [
    (
    "direct_answer",
    re.compile(
        r"\b(the answer is\s+[a-d]|it'?s\s+[a-d]|answer\s+(is\s+)?[a-d]|option\s+[a-d])\b",
        re.IGNORECASE,
    ),
    0.95,
 ),
    (
        "help_seeking",
        re.compile(
            r"\b(help me|ساعدني|مساعدة|sa3edni|help|عاوز مساعدة)\b",
            re.IGNORECASE,
        ),
        0.85,
    ),
    (
        "answer_confirmation",
        re.compile(
            r"\b(is the answer|الإجابة هي|el egaba|هو صح|correct answer|الصواب)\b",
            re.IGNORECASE,
        ),
        0.90,
    ),
    (
        "external_tool",
        re.compile(
            r"\b(google|search|chatgpt|gpt|bing|calculator|chat bot|chatbot)\b",
            re.IGNORECASE,
        ),
        0.80,
    ),
    (
        "collaborative_work",
        re.compile(
            r"\b(what did you write|إنت كتبت إيه|you got|tell me yours|show me)\b",
            re.IGNORECASE,
        ),
        0.88,
    ),
    (
        "question_reference",
        re.compile(
            r"\b(question \d+|سؤال \d+|so2al|number \d+|part [a-d])\b",
            re.IGNORECASE,
        ),
        0.75,
    ),
    (
        "help_request",
        re.compile(
            r"\b(can you tell me|قولي|2olly|tell me the|give me the answer)\b",
            re.IGNORECASE,
        ),
        0.87,
    ),
    (
        "acknowledgment",
        re.compile(
            r"\b(got it|تمام|tamam|okay thanks|شكرا|شكراً|thank you so much)\b",
            re.IGNORECASE,
        ),
        0.75,
    ),
    (
        "choice_leakage",
        re.compile(
            r"\b(option [a-d]|choice [a-d]|letter [a-d]|الخيار|الإجابة [أ-ي])\b",
            re.IGNORECASE,
        ),
        0.82,
    ),
    (
        "formula_recitation",
        re.compile(
            r"\b(the formula is|القانون|el qanon|equals|يساوي|derivative of|integral)\b",
            re.IGNORECASE,
        ),
        0.70,
    ),
    (
        "monitoring_awareness",
        re.compile(
            r"\b(is anyone watching|في حد شايفني|camera|مراقبة|proctoring|they can hear)\b",
            re.IGNORECASE,
        ),
        0.92,
    ),
]


def classify(text: str) -> tuple[str, float]:
    if not text.strip():
        return ("normal_speech", 0.0)

    best_weight = 0.0
    for _name, pattern, weight in _PATTERNS:
        if pattern.search(text):
            if weight > best_weight:
                best_weight = weight

    if best_weight >= 0.60:
        return ("suspicious_speech", best_weight)
    return ("normal_speech", 1.0 - best_weight)
