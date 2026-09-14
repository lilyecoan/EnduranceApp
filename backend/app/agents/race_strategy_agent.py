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
        run_threshold_pace = garmin.get("run_threshold_pace") or ctx.run_threshold_pace
        swim_pace = garmin.get("swim_pace_per_100m") or ctx.swim_pace_per_100m

        target_bike_watts = round(ftp * 0.76, 0) if ftp else None
        target_run_pace = round(run_threshold_pace * 1.04, 0) if run_threshold_pace else None
        # Previously defaulted to a fabricated 100 sec/100m when swim_pace
        # was unknown, silently returning a fake target (103) instead of
        # reporting that no swim pace input exists yet.
        target_swim_pace = round(swim_pace * 1.03, 0) if swim_pace else None

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

        # Predicted finish time removed: this used a second, different
        # ad-hoc bike-speed formula from performance_agent.py's (now also
        # removed) estimator, which would silently disagree with it for
        # identical inputs. No replacement until a validated,
        # event-specific model exists.
        predicted = None
        key_notes.append(
            "Race-time prediction requires a validated event-specific model — not available in this version."
        )

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
