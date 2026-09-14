from app.agents.state import AgentState, PerformanceOutput


def _classify_level(value: float, thresholds: tuple) -> str:
    """Classify a metric where a HIGHER value is better (e.g. watts/kg)."""
    beginner, intermediate, advanced = thresholds
    if value < beginner:
        return "beginner"
    if value < intermediate:
        return "intermediate"
    if value < advanced:
        return "advanced"
    return "elite"


def _classify_pace(value: float, elite_max: float, advanced_max: float, intermediate_max: float) -> str:
    """Classify a pace metric where a LOWER value is better (e.g. seconds per km/100m)."""
    if value <= elite_max:
        return "elite"
    if value <= advanced_max:
        return "advanced"
    if value <= intermediate_max:
        return "intermediate"
    return "beginner"


def performance_agent(state: AgentState) -> AgentState:
    """Analyze FTP, VO2max, threshold pace and classify performance profile."""
    garmin = state.get("garmin_data", {})
    ctx = state["athlete_context"]
    errors = state.get("errors", [])

    try:
        ftp = garmin.get("ftp") or ctx.ftp_watts
        vo2_max = garmin.get("vo2_max") or ctx.vo2_max
        swim_pace = garmin.get("swim_pace_per_100m") or ctx.swim_pace_per_100m
        run_threshold_pace = garmin.get("run_threshold_pace") or ctx.run_threshold_pace
        ftp_trend = garmin.get("ftp_trend", "stable")
        vo2_trend = garmin.get("vo2_max_trend", "stable")

        weight_kg = ctx.weight_kg or 70.0
        watts_per_kg = ftp / weight_kg if ftp else None

        if watts_per_kg is not None:
            bike_level = _classify_level(watts_per_kg, (2.5, 3.2, 4.0))
        else:
            bike_level = "unknown"

        # Pace is lower-is-better (a faster/smaller number means a stronger
        # athlete) — using the higher-is-better classifier here previously
        # inverted the ranking (fast athletes were labeled "beginner").
        if run_threshold_pace is not None:
            run_level = _classify_pace(run_threshold_pace, 300, 360, 420)
        else:
            run_level = "unknown"

        if swim_pace is not None:
            swim_level = _classify_pace(swim_pace, 90, 110, 130)
        else:
            swim_level = "unknown"

        levels = {"swim": swim_level, "bike": bike_level, "run": run_level}
        order = ["elite", "advanced", "intermediate", "beginner", "unknown"]
        limiter = min(levels.items(), key=lambda x: order.index(x[1]) if x[1] in order else 99)
        primary_limiter = f"{limiter[0].title()} ({limiter[1]})"

        # Race-time prediction removed: the previous bike-split formula used
        # an unvalidated, dimensionally-unjustified constant and produced
        # implausible results (e.g. an ~835-hour predicted finish in
        # testing). No replacement is implemented until a validated,
        # event-specific model exists.
        predicted_finish = None

        if ftp_trend in ("increasing",) or vo2_trend in ("improving",):
            fitness_trajectory = "improving"
        elif ftp_trend in ("decreasing",) or vo2_trend in ("declining",):
            fitness_trajectory = "declining"
        else:
            fitness_trajectory = "stable"

        output = PerformanceOutput(
            swim_level=swim_level,
            bike_level=bike_level,
            run_level=run_level,
            primary_limiter=primary_limiter,
            ftp_trend=ftp_trend,
            vo2_max_trend=vo2_trend,
            fitness_trajectory=fitness_trajectory,
            predicted_race_finish=predicted_finish,
        )

    except Exception as e:
        errors.append(f"PerformanceAgent error: {str(e)}")
        output = PerformanceOutput(
            swim_level="unknown",
            bike_level="unknown",
            run_level="unknown",
            primary_limiter="unknown",
            fitness_trajectory="stable",
        )

    return {**state, "performance_output": output, "errors": errors}
