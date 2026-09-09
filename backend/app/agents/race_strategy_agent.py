from app.agents.state import AgentState, RaceStrategyOutput


def race_strategy_agent(state: AgentState) -> AgentState:
    """Generate race pacing and fueling strategy. Activates when <= 8 weeks to race."""
    ctx = state["athlete_context"]
    garmin = state.get("garmin_data", {})
    errors = state.get("errors", [])

    weeks_to_race = ctx.weeks_to_race
    if weeks_to_race is None or weeks_to_race > 8:
        return {**state, "race_strategy_output": None, "errors": errors}

    try:
        ftp = garmin.get("ftp") or ctx.ftp_watts
        weight_kg = ctx.weight_kg or 70.0
        run_threshold_pace = garmin.get("run_threshold_pace")
        swim_pace = garmin.get("swim_pace_per_100m")

        target_bike_watts = round(ftp * 0.76, 0) if ftp else None
        target_run_pace = round(run_threshold_pace * 1.04, 0) if run_threshold_pace else None
        target_swim_pace = round((swim_pace or 100) * 1.03, 0)

        fueling_plan = [
            {"time": "T-2hr", "item": "Full meal: carbs + protein + moderate fat", "carbs_g": 80},
            {"time": "T-30min", "item": "Gel or banana + electrolytes", "carbs_g": 30},
            {"time": "Swim", "item": "Water at start (if hot)", "carbs_g": 0},
            {"time": "Bike 0-30min", "item": "Plain water — let stomach settle", "carbs_g": 0},
            {"time": "Bike 30min+", "item": "Start fueling: 60-90g carbs/hour", "carbs_g": 70},
            {"time": "Bike every 20min", "item": "Gel/chew + electrolytes + 500ml water", "carbs_g": 25},
            {"time": "T2", "item": "Quick gel + water", "carbs_g": 25},
            {"time": "Run every 20min", "item": "Gel + water at aid station", "carbs_g": 20},
            {"time": "Run final 5km", "item": "Cola or caffeinated gel if needed", "carbs_g": 20},
        ]

        taper_notes = None
        if weeks_to_race <= 2:
            taper_notes = (
                "You are in race taper. Reduce volume 40-50% while maintaining intensity. "
                "Trust the fitness you've built. Focus on sleep, nutrition, and mental preparation."
            )
        elif weeks_to_race <= 4:
            taper_notes = (
                "Begin gradual volume reduction. Maintain race-pace efforts 1-2x per week to stay sharp."
            )

        key_notes = [
            f"Target bike power: {target_bike_watts}W (~76% FTP for 70.3)",
            "Negative split strategy: first half of run conservatively",
            "Practice race nutrition in all long sessions NOW",
            "Heat: add 15-20% fluid per hour if temp >25°C",
        ]
        if ctx.has_type1_diabetes:
            key_notes.append("T1D: Agree race-day glucose strategy with your care team well in advance")

        swim_sec = int((1900 / 100) * target_swim_pace) if target_swim_pace else None
        bike_sec = int((90_000 / 1000) / ((target_bike_watts / weight_kg * 0.0278 * 50) or 1) * 3600) if target_bike_watts else None
        run_sec = int(21097 / 1000 * (target_run_pace or 360)) if target_run_pace else None
        predicted = None
        if swim_sec and bike_sec and run_sec:
            predicted = swim_sec + 180 + bike_sec + 120 + run_sec

        output = RaceStrategyOutput(
            swim_pace_per_100m=target_swim_pace,
            bike_watts_target=target_bike_watts,
            run_pace_target=target_run_pace,
            predicted_finish_seconds=predicted,
            fueling_plan=fueling_plan,
            taper_notes=taper_notes,
            key_race_notes=key_notes,
        )

    except Exception as e:
        errors.append(f"RaceStrategyAgent error: {str(e)}")
        output = RaceStrategyOutput(key_race_notes=["Race strategy data unavailable."])

    return {**state, "race_strategy_output": output, "errors": errors}
