import pytest

from app.core.config import settings
from app.agents.head_coach import HeadCoachGraph
from app.agents.state import AthleteContext


@pytest.fixture(autouse=True)
def no_gemini(monkeypatch):
    # Never make a live network call in tests; also exercises the "AI
    # coaching narrative unavailable" honest-fallback path.
    monkeypatch.setattr(settings, "gemini_api_key", "")


async def _run(ctx: AthleteContext, garmin_data: dict, scheduled_workout=None):
    state = {
        "athlete_context": ctx,
        "garmin_data": garmin_data,
        "scheduled_workout": scheduled_workout,
        "recovery_output": None,
        "training_load_output": None,
        "performance_output": None,
        "nutrition_output": None,
        "diabetes_output": None,
        "weather_output": None,
        "race_strategy_output": None,
        "coaching_plan": None,
        "errors": [],
    }
    result = await HeadCoachGraph.ainvoke(state)
    return result["coaching_plan"], result["errors"]


async def test_recovery_and_training_load_messages_both_survive():
    # Craft garmin data that triggers both a low-readiness recovery alert
    # AND a should_reduce training-load advisory in the same run — the
    # previous if/elif silently dropped the training-load message whenever
    # the recovery branch also fired.
    garmin_data = {
        "hrv_rmssd": 30,
        "hrv_baseline": 50,  # -40% -> significantly suppressed -> low readiness
        "sleep_score": 40,
        "ctl": 40,
        "atl": 70,
        "tsb": -30,  # ctl - atl, computed upstream by garmin_service.py -> "High fatigue" -> should_reduce
        "source": "demo",
    }
    ctx = AthleteContext(user_id="u1", weight_kg=70)
    plan, errors = await _run(ctx, garmin_data)

    assert errors == []
    assert any("Recovery Alert" in m for m in plan.key_messages)
    assert any("Load Advisory" in m for m in plan.key_messages)


async def test_empty_recovery_does_not_trigger_fatigue_alert():
    ctx = AthleteContext(user_id="u1", weight_kg=70)
    plan, _ = await _run(ctx, {"source": "demo"})
    assert plan.recovery.score is None
    assert not any("Recovery Alert" in m for m in plan.key_messages)


async def test_nutrition_calories_consistent_with_macros():
    ctx = AthleteContext(user_id="u1", weight_kg=70)
    plan, _ = await _run(ctx, {"source": "demo"})
    n = plan.nutrition
    implied = round(n.protein_g * 4 + n.carbs_g * 4 + n.fat_g * 9)
    assert n.daily_calories == implied


async def test_no_gemini_and_no_rule_gives_honest_fallback():
    ctx = AthleteContext(user_id="u1", weight_kg=70)
    plan, _ = await _run(ctx, {"source": "demo"})
    assert plan.today_recommendation == "No new plan generated today."
