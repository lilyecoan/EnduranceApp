"""
Fetches and caches coaching reference material from trusted URLs.
Used by agents to ground recommendations in evidence-based training/nutrition guidelines.
"""
import asyncio
import httpx
import structlog
from datetime import datetime, timedelta
from typing import Optional

log = structlog.get_logger()

REFERENCE_URLS = {
    "ironman_beginner": "https://www.ironman.com/training/beginners",
    "t1d_ironman": "https://beyondtype1.org/my-race-to-the-finish-line-im-an-ironman-with-type-1/",
    "t1d_exercise_nutrition": "https://www.dietitianapproved.com/blog/exercise-with-type1-diabetes",
    "703_training_plan": "https://www.triathlete.com/training/20-week-training-plan-first-70-3-triathlon/",
}

# Hardcoded key excerpts from these references — used when live fetch fails
# These are summaries of the core coaching wisdom from each source
REFERENCE_KNOWLEDGE = {
    "ironman_beginner": """
Key Ironman Beginner Principles (ironman.com):
- Build aerobic base first: 80% of training should be Zone 2 (conversational pace)
- Consistency beats intensity: 3-4 sessions/sport/week beats occasional long sessions
- Long sessions increase 10% per week maximum (10% rule)
- Brick workouts (bike + run) are essential for race simulation
- Taper 2-3 weeks before race: reduce volume 30-40% while maintaining some intensity
- Race nutrition: practice in every long session, never try anything new on race day
- Swim: focus on technique and efficiency before speed
- Bike: 70-80% of athletes' race times are on the bike — invest here
""",
    "t1d_ironman": """
T1D Ironman Athlete Guidance (Beyond Type 1):
- Inform race medical team about T1D at athlete check-in; wear medical ID
- Carry glucose tabs in tri-suit pocket throughout ALL legs (swim, bike, run)
- Glucose target before race start: typically 150-180 mg/dL (may differ — consult endo)
- Extended aerobic exercise (>90min) increases insulin sensitivity and hypoglycemia risk
- Post-race monitoring is critical: glucose can drop 12-24 hours after long efforts
- Many T1D athletes reduce basal insulin 20-50% on long training days — discuss with endo
- Glucose tabs are easier to carry than gels during open water swim (in suit pocket or bike bag)
- T2 transition: excellent checkpoint for glucose reading
- Plan for race-day stress raising glucose (adrenaline effect) — don't over-correct before swim start
""",
    "t1d_exercise_nutrition": """
T1D Exercise Nutrition Guidelines (Dietitian Approved):
- Pre-exercise glucose target: 7-10 mmol/L (126-180 mg/dL) for aerobic exercise
- If glucose < 5 mmol/L (90 mg/dL) before exercise: delay and treat with 15-20g fast carbs
- Aerobic exercise (Zone 1-3): tends to lower blood glucose → may reduce insulin needs
- High-intensity/anaerobic exercise: can RAISE blood glucose due to adrenaline/catecholamine surge
- Intra-workout (>60min): 30-60g carbs/hour for aerobic work; monitor glucose response individually
- Post-exercise: higher insulin sensitivity for up to 24-48 hours — delayed hypoglycemia risk
- Celiac + T1D: all sports nutrition must be certified gluten-free; cross-contamination risk is real
- Recovery nutrition within 30min post-exercise: 1.2g/kg carbs + 0.3g/kg protein (GF sources)
""",
    "703_training_plan": """
Ironman 70.3 Training Principles (Triathlete Magazine 20-week plan):
Swim:
- 2-3x/week, focus on open-water technique at 10+ weeks out
- Intervals build threshold; long swims build aerobic base
- Open water practice mandatory in final 8 weeks

Bike:
- Long ride Saturday is most important session of week
- Sweet spot (88-93% FTP) builds power efficiently
- Endurance rides at 65-75% FTP build fat oxidation (important for 90km bike)
- Target bike power for 70.3: 70-76% of FTP

Run:
- Run off the bike (brick) every Sunday — CRITICAL for 70.3 performance
- Long run should not exceed 16km in training (race specificity)
- Zone 2 running builds aerobic economy

Weekly structure (typical):
- Mon: Rest or easy swim
- Tue: Run intervals or tempo
- Wed: Bike intervals or sweet spot
- Thu: Easy run
- Fri: Rest
- Sat: Long bike
- Sun: Brick (bike + run) or long run

Training phases:
- Base (weeks 1-8): Volume, Zone 2, technique
- Build (weeks 9-16): Add intensity, race-pace work
- Peak (weeks 17-18): Highest volume week
- Taper (weeks 19-20): 30-40% volume reduction
""",
}

_cache: dict[str, tuple[str, datetime]] = {}
CACHE_DURATION = timedelta(hours=12)


async def fetch_reference(key: str) -> str:
    """Fetch reference content, using cache or hardcoded knowledge as fallback."""
    if key not in REFERENCE_URLS:
        return ""

    now = datetime.now()
    if key in _cache:
        content, cached_at = _cache[key]
        if now - cached_at < CACHE_DURATION:
            return content

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            headers = {"User-Agent": "Mozilla/5.0 IronMind-AI/1.0 (endurance coaching research)"}
            resp = await client.get(REFERENCE_URLS[key], headers=headers)
            resp.raise_for_status()

            try:
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(resp.text, "html.parser")
                for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
                    tag.decompose()
                text = " ".join(soup.get_text(separator=" ").split())
                content = text[:8000]  # limit to ~8k chars
            except ImportError:
                content = resp.text[:8000]

            _cache[key] = (content, now)
            log.info("reference_fetched", key=key, chars=len(content))
            return content

    except Exception as e:
        log.warning("reference_fetch_failed", key=key, error=str(e), using_fallback=True)
        return REFERENCE_KNOWLEDGE.get(key, "")


async def get_all_coaching_context() -> str:
    """Return combined reference context for coaching prompts."""
    tasks = [fetch_reference(k) for k in REFERENCE_KNOWLEDGE]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    combined = []
    for key, result in zip(REFERENCE_KNOWLEDGE.keys(), results):
        if isinstance(result, str) and result:
            combined.append(f"\n### {key.upper()}\n{result[:2000]}")
        else:
            combined.append(f"\n### {key.upper()}\n{REFERENCE_KNOWLEDGE[key]}")

    return "\n".join(combined)


def get_hardcoded_context() -> str:
    """Synchronous fallback — returns all hardcoded reference knowledge."""
    return "\n\n".join(
        f"### {k.upper()}\n{v}" for k, v in REFERENCE_KNOWLEDGE.items()
    )
