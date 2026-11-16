"""Fetch a web page from a URL the athlete typed, without letting it reach
internal addresses (cloud metadata, localhost, private networks).

Every hop of a redirect is checked: the host must resolve only to public IP
addresses, the scheme must be http(s), and the body is capped in size.
"""
import asyncio
import ipaddress
import socket
from urllib.parse import urljoin, urlparse

import httpx

from app.services.sources import USER_AGENT

MAX_BYTES = 3_000_000
MAX_REDIRECTS = 5
TIMEOUT = httpx.Timeout(12.0, connect=6.0)
# Many race sites refuse requests that don't look like a browser; this keeps
# our identity visible while using the common "compatible" convention.
PAGE_USER_AGENT = f"Mozilla/5.0 (compatible; {USER_AGENT})"


class UnsafeURLError(ValueError):
    """The URL isn't a public web page we're willing to fetch."""


async def _check_public(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise UnsafeURLError("Enter a full web address starting with https://")
    if parsed.username or parsed.password:
        raise UnsafeURLError("Web addresses with a username or password aren't supported")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if port not in (80, 443):
        raise UnsafeURLError("Only standard web ports are supported")
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(parsed.hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise UnsafeURLError("That web address couldn't be found")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            raise UnsafeURLError("That web address points to a private network")


async def fetch_public_page(url: str) -> tuple[str, str]:
    """Return (final_url, html). Raises UnsafeURLError or httpx.HTTPError."""
    url = url.strip()
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=False) as client:
        for _ in range(MAX_REDIRECTS + 1):
            await _check_public(url)
            async with client.stream(
                "GET", url, headers={"User-Agent": PAGE_USER_AGENT, "Accept": "text/html,application/xhtml+xml"}
            ) as resp:
                if resp.is_redirect:
                    url = urljoin(url, resp.headers.get("location", ""))
                    continue
                resp.raise_for_status()
                content_type = resp.headers.get("content-type", "")
                if "html" not in content_type and "text" not in content_type:
                    raise UnsafeURLError("That address isn't a web page")
                body = bytearray()
                async for chunk in resp.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > MAX_BYTES:
                        break
                return url, body.decode(resp.encoding or "utf-8", errors="replace")
    raise UnsafeURLError("Too many redirects")


# User-triggered AI agents. If a site blocks these, its operator is saying it
# doesn't want an AI reading its pages on someone's behalf, so we don't send
# the page to the AI model either, even though our own crawler is allowed.
AI_AGENT_NAMES = ("Claude-User", "ChatGPT-User", "Perplexity-User", "Google-Agent", "Google-Extended", "GPTBot")
OUR_AGENT_NAME = "IronMindAI"


class SitePolicy:
    def __init__(self, may_fetch: bool, ai_allowed: bool):
        self.may_fetch = may_fetch
        self.ai_allowed = ai_allowed


def parse_site_policy(robots_txt: str, url: str) -> SitePolicy:
    """Read robots.txt rules and Content-Signal lines for ``url``."""
    from urllib.robotparser import RobotFileParser

    parser = RobotFileParser()
    parser.parse(robots_txt.splitlines())
    may_fetch = parser.can_fetch(OUR_AGENT_NAME, url)
    ai_allowed = may_fetch and all(parser.can_fetch(agent, url) for agent in AI_AGENT_NAMES)
    for line in robots_txt.splitlines():
        if line.lower().startswith("content-signal:") and "ai-input=no" in line.replace(" ", "").lower():
            ai_allowed = False
    return SitePolicy(may_fetch, ai_allowed)


async def site_policy(url: str) -> SitePolicy:
    """A missing or unreadable robots.txt allows everything, per the standard."""
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    try:
        _, text = await fetch_public_page(robots_url)
    except (UnsafeURLError, httpx.HTTPError):
        return SitePolicy(True, True)
    return parse_site_policy(text, url)
