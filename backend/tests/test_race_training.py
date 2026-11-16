from datetime import date, time

import pytest

from app.services import race_info
from app.services.race_conditions import RaceConditions, summarize
from app.services.race_info import RaceDetails, merge, parse_structured
from app.services.race_nutrition import RaceInputs, build_plan, carbs_per_hour, expected_finish
from app.services.safe_fetch import UnsafeURLError, _check_public, parse_site_policy
from app.services.workout_load import estimate_load, tss


# --- workout load -----------------------------------------------------------------

def test_longer_ride_than_planned_scales_load_by_distance():
    # Planned 42 mi (~67.6 km) at 78 load; rode 50 mi (~80.5 km).
    load = estimate_load(planned_load=78, planned_distance_m=67_592, actual_distance_m=80_467)
    assert load == round(78 * 80_467 / 67_592)


def test_time_is_preferred_over_distance_for_scaling():
    assert estimate_load(planned_load=60, planned_duration_min=60, actual_duration_min=90,
                         planned_distance_m=10_000, actual_distance_m=10_000) == 90


def test_effort_rating_with_time_uses_tss_formula():
    assert estimate_load(planned_load=30, actual_duration_min=60, rpe=8) == round(tss(60, 0.90))  # 81


def test_skipped_session_has_no_load():
    assert estimate_load(status="skipped", planned_load=50, actual_duration_min=60, rpe=5) == 0


def test_unplanned_session_without_effort_uses_moderate_default():
    assert estimate_load(actual_duration_min=60) == 49
    assert estimate_load() == 0


# --- race page parsing ----------------------------------------------------------------

EVENT_PAGE = """<html><head><title>IRONMAN 70.3 Example | IRONMAN</title>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},
{"@type":"SportsEvent","name":"IRONMAN 70.3 Example","startDate":"2027-04-04T07:00:00-05:00",
"location":{"@type":"Place","name":"Moody Gardens","address":{"addressLocality":"Galveston","addressRegion":"TX","addressCountry":"US"}}}]}
</script></head><body>Swim 1.2 miles</body></html>"""


def test_parse_structured_event():
    d = parse_structured(EVENT_PAGE)
    assert d.name == "IRONMAN 70.3 Example"
    assert d.date == date(2027, 4, 4)
    assert d.start_time == time(7, 0)
    assert d.location == "Galveston, TX, US"


def test_parse_structured_falls_back_to_title_without_time():
    d = parse_structured('<title>Big Sur Marathon - Official Site</title>'
                         '<script type="application/ld+json">{"@type":"Event","startDate":"2027-04-25"}</script>')
    assert d.name == "Big Sur Marathon" and d.date == date(2027, 4, 25) and d.start_time is None


def test_merge_keeps_structured_facts_and_fills_gaps():
    structured = RaceDetails(name="Official Name", date=date(2027, 4, 4))
    ai = RaceDetails(name="AI Name", date=date(2027, 5, 1), run_distance_km=21.1, aid_station_products=["Maurten"])
    m = merge(structured, ai)
    assert (m.name, m.date, m.run_distance_km, m.aid_station_products) == ("Official Name", date(2027, 4, 4), 21.1, ["Maurten"])


def test_unknown_race_type_from_ai_is_dropped():
    assert RaceDetails(race_type="triathlon-ish").race_type is None


# --- site policy & URL safety ------------------------------------------------------------

ROBOTS_BLOCKS_AI_AGENTS = """User-agent: *
Content-Signal: search=yes,ai-train=yes,use=reference
Allow: /

User-agent: Claude-User
Disallow: /
"""


def test_site_blocking_ai_agents_allows_fetch_but_not_ai():
    policy = parse_site_policy(ROBOTS_BLOCKS_AI_AGENTS, "https://example.com/races/x")
    assert policy.may_fetch and not policy.ai_allowed


def test_content_signal_ai_input_no_disables_ai():
    policy = parse_site_policy("User-agent: *\nContent-Signal: ai-input=no\nAllow: /\n", "https://example.com/")
    assert policy.may_fetch and not policy.ai_allowed


def test_disallow_all_blocks_fetch():
    policy = parse_site_policy("User-agent: *\nDisallow: /\n", "https://example.com/race")
    assert not policy.may_fetch and not policy.ai_allowed


def test_open_site_allows_ai():
    assert parse_site_policy("", "https://example.com/").ai_allowed


@pytest.mark.parametrize("url", [
    "http://127.0.0.1/", "http://localhost/admin", "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.5/", "file:///etc/passwd", "ftp://example.com/", "https://example.com:8443/",
    "https://user:pw@example.com/",
])
async def test_private_or_odd_urls_are_refused(url):
    with pytest.raises(UnsafeURLError):
        await _check_public(url)


async def test_import_respects_disallow(monkeypatch):
    async def policy(url):
        return parse_site_policy("User-agent: *\nDisallow: /\n", url)

    async def never_fetch(url):
        raise AssertionError("must not fetch a disallowed page")

    monkeypatch.setattr(race_info, "site_policy", policy)
    monkeypatch.setattr(race_info, "fetch_public_page", never_fetch)
    result = await race_info.import_race("https://example.com/race", None)
    assert result.details.name is None and "asks automated tools not to read" in result.notices[0]


async def test_import_without_ai_permission_keeps_page_away_from_ai(monkeypatch):
    sent = []

    async def policy(url):
        return parse_site_policy(ROBOTS_BLOCKS_AI_AGENTS, url)

    async def fetch(url):
        return url, EVENT_PAGE

    async def fake_ai(text):
        sent.append(text)
        return RaceDetails(aid_station_products=["Maurten"])

    monkeypatch.setattr(race_info, "site_policy", policy)
    monkeypatch.setattr(race_info, "fetch_public_page", fetch)
    monkeypatch.setattr(race_info, "ai_extract", fake_ai)
    result = await race_info.import_race("https://example.com/race", "Aid stations every 1.6 km with Maurten")
    assert result.details.name == "IRONMAN 70.3 Example"
    # Only the athlete's pasted text reached the AI, not the page.
    assert len(sent) == 1 and "Swim 1.2 miles" not in sent[0] and "Maurten" in sent[0]


# --- conditions ---------------------------------------------------------------------------

def test_summarize_averages_years():
    windows = [
        {"temperature_2m": [20, 25], "apparent_temperature": [21, 27], "relative_humidity_2m": [80, 60],
         "wind_speed_10m": [10, 20], "precipitation": [0, 1.0]},
        {"temperature_2m": [22, 29], "apparent_temperature": [23, 31], "relative_humidity_2m": [70, 50],
         "wind_speed_10m": [5, 5], "precipitation": [0, 0]},
    ]
    s = summarize(windows, ["2025-04-04T06:58"])
    assert s["start_temp_c"] == 21 and s["peak_temp_c"] == 27 and s["peak_feels_like_c"] == 29
    assert s["rain_chance_pct"] == 50 and s["sunrise"] == "06:58"


# --- nutrition plan ------------------------------------------------------------------------

def test_carb_bands_follow_event_duration():
    assert [carbs_per_hour(h) for h in (0.5, 1.5, 2.2, 6)] == [0, 30, 60, 75]


def test_goal_time_beats_pace_estimate():
    assert expected_finish(RaceInputs("marathon", time(7), finish_minutes=240, run_threshold_pace=300)) == (240, "goal")
    minutes, basis = expected_finish(RaceInputs("marathon", time(7), run_threshold_pace=300))
    assert basis == "pace" and minutes == round(42.2 * 300 * 1.14 / 60)


def _plan(**kw):
    defaults = dict(race_type="half_iron", start_time=time(7, 0), weight_kg=60)
    return build_plan(RaceInputs(**{**defaults, **kw}))


def test_clock_times_follow_start_time():
    plan = _plan(start_time=time(6, 30))
    breakfast = next(e for e in plan["timeline"] if e["title"] == "Breakfast")
    assert breakfast["clock"] == "03:30" and breakfast["carbs_g"] == 120  # 2 g/kg, 3 h before


def test_heat_raises_fluid_and_sodium():
    cool = _plan(conditions=RaceConditions(basis="historical", peak_feels_like_c=18))
    hot = _plan(conditions=RaceConditions(basis="historical", peak_feels_like_c=33))
    assert hot["rates"]["fluid_ml_per_hr"] > cool["rates"]["fluid_ml_per_hr"]
    assert hot["rates"]["sodium_mg_per_hr"] == 800
    assert any("Very hot" in a for a in hot["adjustments"])


def test_altitude_adds_fluid_note():
    plan = _plan(venue_elevation_m=3000)
    assert any("{m:3000" in a for a in plan["adjustments"])


def test_no_fueling_during_swim_and_bike_carries_most():
    plan = _plan()
    swim = next(leg for leg in plan["legs"] if leg["name"] == "Swim")
    bike = next(leg for leg in plan["legs"] if leg["name"] == "Bike")
    run = next(leg for leg in plan["legs"] if leg["name"] == "Run")
    assert swim["carbs_g_per_hr"] == 0 and bike["carbs_g_per_hr"] > run["carbs_g_per_hr"]


def test_health_notes_turn_off_caffeine_and_add_t1d_safety():
    plan = _plan(health_text="atrial fibrillation", has_type1_diabetes=True)
    assert plan["totals_during"]["caffeine_mg"] == 0
    assert not any(e["caffeine_mg"] for e in plan["timeline"])
    assert any(a.startswith("T1D") and "insulin" in a for a in plan["adjustments"])


def test_short_run_has_no_during_race_fueling():
    plan = build_plan(RaceInputs("five_k", time(8, 0), weight_kg=60))
    assert plan["totals_during"]["carbs_g"] == 0 and plan["totals_during"]["fluid_ml"] == 0
