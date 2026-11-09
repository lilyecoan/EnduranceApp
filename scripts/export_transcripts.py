"""Export this project's Claude Code session transcripts to redacted Markdown.

Reads every ~/.claude/projects/<project>/*.jsonl session log and writes
transcripts/session-<first-date>-<id8>.md, redacting API keys and tokens.
Runs automatically as a Claude Code Stop hook (.claude/settings.json); can
also be run by hand: python3 scripts/export_transcripts.py
"""
import json
import os
import re
from pathlib import Path

PROJECT_DIR = Path(os.environ.get("CLAUDE_PROJECT_DIR") or Path(__file__).resolve().parent.parent)
SESSIONS_DIR = Path.home() / ".claude" / "projects" / re.sub(r"[^A-Za-z0-9]", "-", str(PROJECT_DIR))
OUT_DIR = PROJECT_DIR / "transcripts"

SECRET = re.compile(
    r"(sk-[A-Za-z0-9_-]{20,}|sk_(?:test|live)_[A-Za-z0-9]{4,}|pk_(?:test|live)_[A-Za-z0-9]{4,}"
    r"|gh[opsu]_[A-Za-z0-9]{4,}|AKIA[0-9A-Z]{16}|postgres(?:ql)?(?:\+\w+)?://[^\s\"'\\]+"
    r"|npg_[A-Za-z0-9]{6,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----"
    r"|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]+)?"
    r"|(?i:(?:api[_-]?key|secret|password|token)\s*[=:]\s*)[^\s\"'`]{8,})"
)
MAX_TOOL_OUT = 2000


def redact(s):
    return SECRET.sub("[REDACTED]", s)


def render(content):
    if isinstance(content, str):
        return [content]
    parts = []
    for c in content or []:
        t = c.get("type")
        if t == "text":
            parts.append(c["text"])
        elif t == "tool_use":
            parts.append(f"**Tool call — {c.get('name')}**\n```json\n{json.dumps(c.get('input'), indent=2)[:MAX_TOOL_OUT]}\n```")
        elif t == "tool_result":
            out = c.get("content")
            if isinstance(out, list):
                out = "\n".join(x.get("text", "") for x in out if isinstance(x, dict))
            out = str(out or "")
            if len(out) > MAX_TOOL_OUT:
                out = out[:MAX_TOOL_OUT] + "\n… [truncated]"
            parts.append(f"<details><summary>Tool result</summary>\n\n```\n{out}\n```\n</details>")
    return parts


def export(src):
    lines, first_ts = [], None
    with open(src) as f:
        for raw in f:
            try:
                e = json.loads(raw)
            except ValueError:
                continue
            if e.get("type") not in ("user", "assistant") or e.get("isMeta"):
                continue
            parts = [p for p in render((e.get("message") or {}).get("content")) if p.strip()]
            if not parts:
                continue
            ts = e.get("timestamp", "")
            first_ts = first_ts or ts
            who = "User" if e["type"] == "user" else "Claude"
            if who == "User" and all(p.startswith("<details>") for p in parts):
                who = "Tool"
            lines.append(f"## {who} — {ts}\n\n" + "\n\n".join(parts) + "\n")
    if not lines:
        return
    header = f"# Claude Code session transcript\n\nSession: `{src.name}`\n"
    dst = OUT_DIR / f"session-{(first_ts or '')[:10] or 'undated'}-{src.stem[:8]}.md"
    dst.write_text(redact("\n".join([header] + lines)))


def main():
    OUT_DIR.mkdir(exist_ok=True)
    for src in sorted(SESSIONS_DIR.glob("*.jsonl")):
        export(src)


if __name__ == "__main__":
    main()
