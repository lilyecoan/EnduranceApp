"""Interpret the athlete's free-text health answers.

Pure functions (no I/O): type 1 diabetes detection and splitting free text
into phrases / known topics, so the coaching pipeline can look up sources.
"""
import re

_T1D = re.compile(
    r"\b(type[\s-]*(?:1|one|i)\s*diabet\w*|t1dm?|insulin[\s-]*dependent\s+diabet\w*|juvenile\s+diabet\w*)\b",
    re.IGNORECASE,
)
# Words that, earlier in the same clause, mean the athlete does NOT have it
# ("no type 1 diabetes", "mom has T1D", "family history of type 1").
_NEGATION = re.compile(
    r"\b(no|not|never|without|don'?t|doesn'?t|negative|family|history|mother|father|mom|dad|sister|"
    r"brother|parent|grand\w*|aunt|uncle|cousin|risk)\b",
    re.IGNORECASE,
)
_CLAUSE_BREAK = re.compile(r"[.;,\n]|\bbut\b", re.IGNORECASE)


def detect_type1_diabetes(text: str | None) -> bool:
    """True when the athlete's conditions text says they have type 1 diabetes."""
    if not text:
        return False
    for match in _T1D.finditer(text):
        clause = _CLAUSE_BREAK.split(text[: match.start()])[-1]
        if not _NEGATION.search(clause):
            return True
    return False


_NONE_ANSWERS = {"none", "no", "n/a", "na", "nothing", "-", "nope"}


def split_phrases(*texts: str | None, limit: int = 8) -> list[str]:
    """Split answers like "ankle sprain (2024), asthma; celiac" into phrases."""
    phrases: list[str] = []
    for text in texts:
        for part in re.split(r"[,;\n]|\band\b", text or "", flags=re.IGNORECASE):
            phrase = re.sub(r"\(.*?\)", "", part).strip(" .-*•\t")[:80]
            if phrase and phrase.lower() not in _NONE_ANSWERS and re.search(r"[a-zA-Z]{3,}", phrase):
                phrases.append(phrase)
    return phrases[:limit]
