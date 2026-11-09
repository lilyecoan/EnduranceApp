from datetime import date

import pytest

from app.agents.head_coach import head_coach_synthesize
from app.agents.state import AthleteContext
from app.core.config import settings
from app.services import health_references
from app.services.health_profile import detect_type1_diabetes, split_phrases
from app.services.health_references import (
    build_health_context,
    match_topics,
    parse_medlineplus_search,
    search_terms,
)


@pytest.mark.parametrize(
    "text",
    ["Type 1 diabetes", "T1D since age 9", "type one diabetic", "insulin-dependent diabetes",
     "Hashimoto's, type 1 diabetes and asthma", "celiac; T1DM"],
)
def test_detects_type1_diabetes(text):
    assert detect_type1_diabetes(text)


@pytest.mark.parametrize(
    "text",
    ["", None, "type 2 diabetes", "no type 1 diabetes", "my mom has T1D", "family history of type 1 diabetes",
     "not diabetic", "pre-diabetes"],
)
def test_does_not_detect_type1_diabetes(text):
    assert not detect_type1_diabetes(text)


def test_negation_is_scoped_to_its_clause():
    assert detect_type1_diabetes("No asthma, but type 1 diabetes")
    assert detect_type1_diabetes("No injuries. T1D.")


def test_split_phrases():
    assert split_phrases("ankle sprain (2024), asthma; celiac", "None", None) == ["ankle sprain", "asthma", "celiac"]


def test_match_topics():
    assert match_topics("rolled my ankle last month") == ["ankle_injury"]
    assert set(match_topics("IT band syndrome and swimmer's shoulder")) == {"knee", "shoulder"}
    assert "type1_diabetes" in match_topics("T1D")
    assert "type1_diabetes" not in match_topics("no type 1 diabetes")
    assert match_topics("frostbite on toes") == []


def test_search_terms_drop_timing_words():
    assert search_terms("frostbite on toes last winter") == ["frostbite toes", "frostbite"]
    assert search_terms("broken collarbone 2 years ago") == ["broken collarbone", "broken"]
    assert search_terms("last winter") == []


MEDLINE_XML = """<?xml version="1.0"?><nlmSearchResult><list>
<document rank="0" url="https://medlineplus.gov/frostbite.html">
<content name="title">&lt;span class="qt0"&gt;Frostbite&lt;/span&gt;</content>
<content name="FullSummary">&lt;p&gt;Frostbite is an injury caused by freezing.&lt;/p&gt;</content>
</document></list></nlmSearchResult>"""


def test_parse_medlineplus_search():
    hit = parse_medlineplus_search(MEDLINE_XML)
    assert hit == {
        "name": "MedlinePlus: Frostbite",
        "url": "https://medlineplus.gov/frostbite.html",
        "summary": "Frostbite is an injury caused by freezing.",
    }
    assert parse_medlineplus_search("<nlmSearchResult/>") is None
    assert parse_medlineplus_search("not xml") is None


@pytest.fixture
def offline(monkeypatch):
    """No network: page fetches fail (fallback text is used); search returns a canned hit."""
    searched = []

    async def fake_fetch(url):
        return ""

    async def fake_search(phrase):
        searched.append(phrase)
        return parse_medlineplus_search(MEDLINE_XML)

    monkeypatch.setattr(health_references, "fetch_page_text", fake_fetch)
    monkeypatch.setattr(health_references, "_search_medlineplus", fake_search)
    return searched


async def test_health_context_combines_curated_and_searched_sources(offline):
    ctx = await build_health_context("asthma", "sprained ankle, frostbite on toes", "gluten-free")
    assert "Injuries: sprained ankle, frostbite on toes" in ctx.notes
    topics = {s["topic"] for s in ctx.sources}
    assert {"Ankle injury / sprain", "Asthma", "Celiac disease / gluten-free", "frostbite on toes"} <= topics
    # Only the phrase no curated topic covers is sent to the search service.
    assert offline == ["frostbite on toes"]
    assert "Frostbite is an injury caused by freezing." in ctx.references
    assert any(g.startswith("Ankle injury") for g in ctx.general_guidance)


async def test_health_context_empty_without_notes(offline):
    ctx = await build_health_context(None, "  ", "")
    assert ctx.empty and ctx.sources == [] and offline == []


async def test_plan_carries_health_guidance_when_ai_unavailable(offline, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    ctx = AthleteContext(user_id="u1", injuries="ankle sprain")
    state = {
        "athlete_context": ctx, "garmin_data": {}, "scheduled_workout": None,
        "recovery_output": None, "training_load_output": None, "performance_output": None,
        "nutrition_output": None, "diabetes_output": None, "weather_output": None,
        "race_strategy_output": None, "coaching_plan": None, "errors": [],
    }
    plan = (await head_coach_synthesize(state))["coaching_plan"]
    assert plan.date == date.today()
    assert plan.health_adjustments and plan.health_adjustments[0].startswith("Ankle injury")
    assert any("orthoinfo.aaos.org" in s["url"] for s in plan.health_sources)
