"""Medical / sports-medicine reference material for the athlete's own health notes.

Two layers:
1. HEALTH_TOPICS — curated topics matched by keyword, each with vetted
   source pages (AAOS OrthoInfo, MedlinePlus/NIH) plus a short conservative
   fallback used when a page can't be fetched. To swap in better sources,
   edit this table only. URLs verified to load on 2026-11-09.
2. Anything the athlete wrote that matches no curated topic is looked up in
   MedlinePlus Health Topics search (NLM web service, no key):
   https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=...

Excerpts ground the AI coach; they're context, not advice shown verbatim.
"""
import asyncio
import html
import re
from dataclasses import dataclass, field
from xml.etree import ElementTree

import httpx
import structlog

from app.services.health_profile import detect_type1_diabetes, split_phrases
from app.services.reference_service import REFERENCE_KNOWLEDGE, fetch_page_text

log = structlog.get_logger()

MEDLINEPLUS_SEARCH = "https://wsearch.nlm.nih.gov/ws/query"
_EXCERPT_CHARS = 1500
_MAX_SEARCHES = 3


@dataclass(frozen=True)
class Topic:
    label: str
    keywords: tuple[str, ...]  # regex fragments, matched case-insensitively on word boundaries
    sources: tuple[tuple[str, str], ...]  # (name, url)
    fallback: str


HEALTH_TOPICS: dict[str, Topic] = {
    "ankle_injury": Topic(
        "Ankle injury / sprain",
        (r"ankle", r"sprain(?:ed)?\s+ankle", r"rolled\s+(?:my\s+)?ankle"),
        (("AAOS OrthoInfo: Sprained Ankle", "https://orthoinfo.aaos.org/en/diseases--conditions/sprained-ankle/"),
         ("MedlinePlus: Ankle Injuries and Disorders", "https://medlineplus.gov/ankleinjuriesanddisorders.html")),
        "Ankle sprains usually heal with protection, then progressive rehab (range of motion, strength, balance). "
        "Swimming (pull buoy if kicking hurts) and cycling are often tolerated before running. Return to running "
        "gradually once walking and single-leg balance are pain-free; follow a clinician's guidance.",
    ),
    "achilles": Topic(
        "Achilles tendon",
        (r"achilles",),
        (("AAOS OrthoInfo: Achilles Tendinitis", "https://orthoinfo.aaos.org/en/diseases--conditions/achilles-tendinitis/"),),
        "Achilles tendinopathy responds to load management and progressive calf strengthening. Reduce hills, "
        "speedwork and sudden mileage jumps; low-impact cycling and swimming are usually better tolerated.",
    ),
    "plantar_fasciitis": Topic(
        "Plantar fasciitis / heel pain",
        (r"plantar", r"heel\s+pain"),
        (("AAOS OrthoInfo: Plantar Fasciitis", "https://orthoinfo.aaos.org/en/diseases--conditions/plantar-fasciitis-and-bone-spurs/"),
         ("MedlinePlus: Heel Injuries and Disorders", "https://medlineplus.gov/heelinjuriesanddisorders.html")),
        "Plantar fasciitis is managed with reduced impact, calf/foot stretching and strengthening, and supportive "
        "footwear. Keep run volume conservative and favour bike and swim while symptoms settle.",
    ),
    "shin_splints": Topic(
        "Shin splints",
        (r"shin\s*splints?", r"shin\s+pain", r"mtss"),
        (("AAOS OrthoInfo: Shin Splints", "https://orthoinfo.aaos.org/en/diseases--conditions/shin-splints/"),),
        "Shin splints usually reflect too much running load too soon. Cut run volume and intensity, cross-train on "
        "the bike and in the pool, and rebuild gradually. Focal bone pain may be a stress fracture — get it checked.",
    ),
    "stress_fracture": Topic(
        "Stress fracture",
        (r"stress\s+(?:fracture|reaction)",),
        (("AAOS OrthoInfo: Stress Fractures", "https://orthoinfo.aaos.org/en/diseases--conditions/stress-fractures/"),),
        "Stress fractures need relief from impact for weeks; running resumes only with clinician clearance. Swimming "
        "and (if pain-free) cycling can maintain fitness. Recurrent bone stress warrants checking energy availability.",
    ),
    "knee": Topic(
        "Knee pain / injury",
        (r"knee", r"patell\w*", r"it\s*band", r"itb", r"iliotibial", r"runner'?s\s+knee", r"menisc\w*", r"acl"),
        (("AAOS OrthoInfo: Patellofemoral Pain Syndrome", "https://orthoinfo.aaos.org/en/diseases--conditions/patellofemoral-pain-syndrome/"),
         ("MedlinePlus: Knee Injuries and Disorders", "https://medlineplus.gov/kneeinjuriesanddisorders.html")),
        "Overuse knee pain improves with load management plus hip and quadriceps strengthening. Check bike fit "
        "(saddle height), limit downhill running, and keep intensity low until symptoms calm.",
    ),
    "hamstring": Topic(
        "Hamstring injury",
        (r"hamstring",),
        (("AAOS OrthoInfo: Hamstring Muscle Injuries", "https://orthoinfo.aaos.org/en/diseases--conditions/hamstring-muscle-injuries/"),),
        "Hamstring strains need graded return: avoid sprinting and hard hill efforts early, progress strength "
        "(including eccentric work), and reintroduce speed last.",
    ),
    "low_back": Topic(
        "Low back pain",
        (r"(?:low|lower)\s+back", r"back\s+pain", r"lumbar", r"sciatica", r"disc\s+(?:herniation|bulge)"),
        (("AAOS OrthoInfo: Low Back Pain", "https://orthoinfo.aaos.org/en/diseases--conditions/low-back-pain/"),
         ("MedlinePlus: Back Pain", "https://medlineplus.gov/backpain.html")),
        "Most low back pain improves with staying active. Review bike position (reach, saddle), build core and hip "
        "strength, and avoid long aggressive aero positions while symptomatic.",
    ),
    "shoulder": Topic(
        "Shoulder injury",
        (r"shoulder", r"rotator\s+cuff", r"impingement", r"swimmer'?s\s+shoulder"),
        (("AAOS OrthoInfo: Shoulder Impingement / Rotator Cuff Tendinitis",
          "https://orthoinfo.aaos.org/en/diseases--conditions/shoulder-impingementrotator-cuff-tendinitis/"),
         ("MedlinePlus: Shoulder Injuries and Disorders", "https://medlineplus.gov/shoulderinjuriesanddisorders.html")),
        "Swimmer's shoulder responds to reduced swim volume and paddles, technique work, and rotator cuff / "
        "scapular strengthening. Kick sets can maintain swim fitness while the shoulder settles.",
    ),
    "asthma": Topic(
        "Asthma",
        (r"asthma\w*", r"bronchoconstriction", r"\beib\b"),
        (("MedlinePlus: Asthma", "https://medlineplus.gov/asthma.html"),),
        "Athletes with asthma should follow their action plan, warm up gradually, carry their rescue inhaler, and "
        "take care in cold, dry air, high pollen, or poor air quality.",
    ),
    "celiac": Topic(
        "Celiac disease / gluten-free",
        (r"c[o]?eliac", r"gluten"),
        (("MedlinePlus: Celiac Disease", "https://medlineplus.gov/celiacdisease.html"),),
        "Celiac disease requires strictly gluten-free food, including gels, drinks and race-course nutrition — "
        "verify products are certified gluten-free and practise race fueling in training.",
    ),
    "food_allergy": Topic(
        "Food allergy",
        (r"allerg\w*",),
        (("MedlinePlus: Food Allergy", "https://medlineplus.gov/foodallergy.html"),),
        "With food allergies, check every sports-nutrition product and aid-station item against the allergen, and "
        "carry prescribed emergency medication on long sessions.",
    ),
    "hypothyroid": Topic(
        "Hypothyroidism / Hashimoto's",
        (r"hashimoto'?s?", r"hypothyroid\w*", r"thyroid"),
        (("MedlinePlus: Hypothyroidism", "https://medlineplus.gov/hypothyroidism.html"),),
        "Under-treated hypothyroidism can show up as unusual fatigue and poor recovery. Treat persistent fatigue "
        "as a reason to ease training and check in with the treating clinician.",
    ),
    "rheumatoid_arthritis": Topic(
        "Rheumatoid arthritis",
        (r"rheumatoid",),
        (("AAOS OrthoInfo: Rheumatoid Arthritis", "https://orthoinfo.aaos.org/en/diseases--conditions/rheumatoid-arthritis/"),
         ("MedlinePlus: Rheumatoid Arthritis", "https://medlineplus.gov/rheumatoidarthritis.html")),
        "With rheumatoid arthritis, regular low-impact exercise is beneficial; during flares, swap impact sessions "
        "for swimming or easy cycling and reduce intensity.",
    ),
    "pcos": Topic(
        "PCOS",
        (r"pcos", r"polycystic"),
        (("MedlinePlus: Polycystic Ovary Syndrome", "https://medlineplus.gov/polycysticovarysyndrome.html"),),
        "PCOS can affect insulin sensitivity; consistent training and balanced carbohydrate timing around sessions "
        "can help. Individual nutrition questions belong with a dietitian.",
    ),
    "type1_diabetes": Topic(
        "Type 1 diabetes",
        (),  # matched by detect_type1_diabetes, which handles negation
        (("MedlinePlus: Diabetes Type 1", "https://medlineplus.gov/diabetestype1.html"),),
        REFERENCE_KNOWLEDGE["t1d_exercise_nutrition"].strip(),
    ),
}

_TOPIC_PATTERNS = {
    key: re.compile(r"\b(?:" + "|".join(t.keywords) + r")\b", re.IGNORECASE)
    for key, t in HEALTH_TOPICS.items()
    if t.keywords
}


def match_topics(text: str) -> list[str]:
    keys = [key for key, pattern in _TOPIC_PATTERNS.items() if pattern.search(text)]
    if detect_type1_diabetes(text):
        keys.append("type1_diabetes")
    return keys


@dataclass
class HealthContext:
    notes: str = ""  # the athlete's own words, labelled
    references: str = ""  # source excerpts for the AI
    sources: list[dict] = field(default_factory=list)  # [{"topic","name","url"}] shown to the athlete
    # Conservative curated guidance per matched topic; shown if the AI is unavailable.
    general_guidance: list[str] = field(default_factory=list)

    @property
    def empty(self) -> bool:
        return not self.notes


def _strip_tags(text: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", text)).split())


def parse_medlineplus_search(xml_text: str) -> dict | None:
    """Top result of a MedlinePlus health-topics search: {name, url, summary}."""
    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError:
        return None
    doc = root.find(".//document")
    if doc is None:
        return None
    fields = {c.get("name"): c.text or "" for c in doc.findall("content")}
    title = _strip_tags(fields.get("title", ""))
    return {
        "name": f"MedlinePlus: {title}" if title else "MedlinePlus",
        "url": doc.get("url"),
        "summary": _strip_tags(fields.get("FullSummary", ""))[:_EXCERPT_CHARS],
    }


# Words that describe timing/severity rather than the condition itself;
# MedlinePlus search ANDs every term, so these would make it find nothing.
_FILLER = re.compile(
    r"\b(\d+|last|ago|since|years?|months?|weeks?|days?|yrs?|winter|summer|spring|fall|autumn|on|in|of|my|the|"
    r"a|an|left|right|mild|minor|severe|chronic|recurring|old|recent|past|history|currently|still|some)\b",
    re.IGNORECASE,
)


def search_terms(phrase: str) -> list[str]:
    """Query variants for one phrase, most specific first:
    "frostbite on toes last winter" -> ["frostbite toes", "frostbite"]."""
    words = _FILLER.sub(" ", phrase).split()
    variants = [" ".join(words[:n]) for n in (len(words), 2, 1) if 0 < n <= len(words)]
    return list(dict.fromkeys(v for v in variants if len(v) >= 3))


async def _search_medlineplus(phrase: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            for term in search_terms(phrase):
                res = await client.get(MEDLINEPLUS_SEARCH, params={"db": "healthTopics", "term": term, "retmax": 1})
                res.raise_for_status()
                hit = parse_medlineplus_search(res.text)
                if hit and hit["url"]:
                    return hit
    except httpx.HTTPError as exc:
        log.warning("medlineplus_search_failed", error=str(exc))
    return None


async def _topic_reference(key: str) -> tuple[str, list[dict]]:
    topic = HEALTH_TOPICS[key]
    texts = await asyncio.gather(*(fetch_page_text(url) for _, url in topic.sources))
    excerpt = next((t for t in texts if t), "")[:_EXCERPT_CHARS] or topic.fallback
    sources = [{"topic": topic.label, "name": name, "url": url} for name, url in topic.sources]
    return f"### {topic.label}\nGeneral guidance: {topic.fallback}\nSource excerpt: {excerpt}", sources


async def build_health_context(conditions: str | None, injuries: str | None, dietary: str | None) -> HealthContext:
    """Assemble the athlete's notes plus reference excerpts for the coach."""
    labelled = [(label, (text or "").strip()) for label, text in (
        ("Chronic conditions", conditions), ("Injuries", injuries), ("Dietary restrictions", dietary))]
    labelled = [(label, text) for label, text in labelled if text]
    if not labelled:
        return HealthContext()

    notes = "\n".join(f"{label}: {text}" for label, text in labelled)
    all_text = " \n".join(text for _, text in labelled)
    topic_keys = match_topics(all_text)

    unmatched = [p for p in split_phrases(conditions, injuries, dietary) if not match_topics(p)][:_MAX_SEARCHES]

    topic_results = await asyncio.gather(*(_topic_reference(k) for k in topic_keys))
    search_results = await asyncio.gather(*(_search_medlineplus(p) for p in unmatched))

    sections, sources = [], []
    for text, srcs in topic_results:
        sections.append(text)
        sources.extend(srcs)
    for phrase, hit in zip(unmatched, search_results):
        if hit and hit["url"]:
            sections.append(f"### {phrase} (MedlinePlus search)\nSource excerpt: {hit['summary']}")
            sources.append({"topic": phrase, "name": hit["name"], "url": hit["url"]})

    guidance = [f"{HEALTH_TOPICS[k].label}: {HEALTH_TOPICS[k].fallback}" for k in topic_keys]
    return HealthContext(notes=notes, references="\n\n".join(sections), sources=sources, general_guidance=guidance)
