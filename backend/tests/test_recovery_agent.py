from app.agents.recovery_agent import recovery_agent


def _run(garmin_data: dict):
    state = {"garmin_data": garmin_data, "errors": []}
    result = recovery_agent(state)
    return result["recovery_output"]


def test_empty_snapshot_reports_insufficient_data_not_fabricated_score():
    output = _run({})
    assert output.score is None
    assert output.status == "Insufficient data"
    assert output.is_low_readiness is False


def test_real_data_still_produces_a_score():
    output = _run({"hrv_rmssd": 60, "hrv_baseline": 50, "sleep_score": 80})
    assert output.score is not None
    assert output.status != "Insufficient data"
