from datetime import date

from app.services.plan_generator import MAX_RAMP, PlanInputs, build_week, phase_for

MONDAY = date(2026, 11, 23)


def week(**kw):
    return build_week(PlanInputs(week_start=MONDAY, **kw))


def test_phases_follow_weeks_to_race():
    assert phase_for(20, "half_iron")[0] == "base"
    assert phase_for(12, "half_iron")[0] == "build"
    assert phase_for(6, "half_iron")[0] == "peak"
    assert phase_for(2, "half_iron")[0] == "taper"
    assert phase_for(0, "half_iron")[0] == "race"
    assert phase_for(None, "gym")[0] == "base"


def test_load_ramps_at_most_8_percent_from_recent_training():
    p = week(goal="half_iron", race_date=date(2027, 5, 2), recent_weekly_load=400)
    cardio = sum(s["load"] for s in p.sessions if s["sport"] != "Strength")
    assert cardio <= 400 * MAX_RAMP + 40  # rounding + minimum durations
    assert any("up to 8% more" in r for r in p.reasons)


def test_sparse_history_starts_at_entry_level_not_tiny_sessions():
    p = week(goal="half_iron", race_date=date(2027, 5, 2), recent_weekly_load=60)
    assert all(s["duration_min"] >= 20 for s in p.sessions)
    assert any("entry level" in r for r in p.reasons)
    # Low volume drops optional sessions but keeps every sport.
    assert {s["sport"] for s in p.sessions} >= {"Swim", "Bike", "Run"}


def test_triathlon_week_has_all_three_sports_and_long_sessions_on_weekend():
    p = week(goal="olympic", race_date=date(2027, 5, 2), recent_weekly_load=350)
    sports = {s["sport"] for s in p.sessions}
    assert {"Swim", "Bike", "Run"} <= sports
    longest = max(p.sessions, key=lambda s: s["duration_min"])
    assert date.fromisoformat(longest["date"]).weekday() >= 5


def test_recovery_week_is_lighter():
    normal = week(goal="half_iron", race_date=date(2027, 4, 4), recent_weekly_load=400)   # 18 weeks out
    easy = build_week(PlanInputs(week_start=date(2026, 11, 16), goal="half_iron", race_date=date(2027, 4, 4),
                                 recent_weekly_load=400))  # 19 weeks out -> recovery week
    assert easy.recovery_week and not normal.recovery_week
    assert easy.target_load < normal.target_load


def test_poor_recovery_signals_trim_the_week():
    base = week(goal="marathon", race_date=date(2027, 4, 4), recent_weekly_load=300)
    tired = week(goal="marathon", race_date=date(2027, 4, 4), recent_weekly_load=300,
                 resting_hr_recent=62, resting_hr_baseline=54, worst_soreness=4)
    assert tired.readiness_factor < 1 and tired.target_load < base.target_load
    assert any("resting HR" in r for r in tired.reasons)


def test_injury_swaps_hard_running_for_low_impact():
    p = week(goal="half_iron", race_date=date(2027, 4, 4), recent_weekly_load=400, injuries="sprained ankle")
    runs = [s for s in p.sessions if s["sport"] == "Run"]
    assert runs and all(s["kind"] in ("recovery", "endurance") for s in runs)
    assert any("injury" in n for n in p.notes)


def test_race_week_includes_race_day_and_nothing_after():
    race = date(2026, 11, 28)
    p = week(goal="sprint", race_date=race, recent_weekly_load=250)
    assert p.phase == "race"
    assert p.sessions[-1]["sport"] == "Race" and p.sessions[-1]["date"] == race.isoformat()
    assert all(date.fromisoformat(s["date"]) <= race for s in p.sessions)


def test_targets_use_athlete_zones():
    p = week(goal="half_iron", race_date=date(2027, 5, 2), recent_weekly_load=400, ftp_watts=200, run_threshold_pace=300)
    text = " ".join(s["description"] for s in p.sessions)
    assert " W)" in text and "{pace_run:" in text


def test_gym_goal_is_strength_led():
    p = week(goal="gym")
    assert sum(1 for s in p.sessions if s["sport"] == "Strength") >= 3
