from app.agents.performance_agent import performance_agent
from app.agents.state import AthleteContext


def _run(ctx: AthleteContext, garmin_data: dict | None = None):
    state = {
        "athlete_context": ctx,
        "garmin_data": garmin_data or {},
        "errors": [],
    }
    result = performance_agent(state)
    return result["performance_output"]


def test_fast_pace_classifies_elite_not_beginner():
    ctx = AthleteContext(user_id="u1", weight_kg=70, run_threshold_pace=240, swim_pace_per_100m=80)
    output = _run(ctx)
    assert output.run_level == "elite"
    assert output.swim_level == "elite"


def test_slow_pace_classifies_beginner_not_elite():
    ctx = AthleteContext(user_id="u1", weight_kg=70, run_threshold_pace=450, swim_pace_per_100m=150)
    output = _run(ctx)
    assert output.run_level == "beginner"
    assert output.swim_level == "beginner"


def test_race_time_prediction_removed():
    ctx = AthleteContext(user_id="u1", weight_kg=70, ftp_watts=280, run_threshold_pace=240)
    output = _run(ctx)
    assert output.predicted_race_finish is None


def test_missing_pace_stays_unknown():
    ctx = AthleteContext(user_id="u1", weight_kg=70)
    output = _run(ctx)
    assert output.run_level == "unknown"
    assert output.swim_level == "unknown"
