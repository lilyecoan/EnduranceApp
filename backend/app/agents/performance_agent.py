from app.agents.state import AgentState, PerformanceOutput


def _classify_level(value: float, thresholds: tuple) -> str:
    beginner, intermediate, advanced = thresholds
    if value < beginner:
        return "beginner"
    if value < intermediate:
        return "intermediate"
    if value < advanced:
        return "advanced"
    return "elite"


def performance_agent(state: AgentState) -> AgentState:
    """Analyze FTP, VO2max, threshold pace and classify performance profile."""
    garmin = state.get("garmin_data", {})
    ctx = state["athlete_context"]
    errors = state.get("errors", [])

    try:
        ftp = garmin.get("ftp") or ctx.ftp_watts
        vo2_max = garmin.get("vo2_max") or ctx.vo2_max
        swim_pace = garmin.get("swim_pace_per_100m") or getattr(ctx, "swim_pace_per_100m", None)
        run_threshold_pace = garmin.get("run_threshold_pace") or getattr(ctx, "run_threshold_pace", None)
        ftp_trend = garmin.get("ftp_trend", "stable")
        vo2_trend = garmin.get("vo2_max_trend", "stable")

        weight_kg = ctx.weight_kg or 70.0
        watts_per_kg = ftp / weight_kg if ftp else None

        if watts_per_kg is not None:
            bike_level = _classify_level(watts_per_kg, (2.5, 3.2, 4.0))
        else:
            bike_level = "unknown"

        if run_threshold_pace is not None:
            pace_min_per_km = run_threshold_pace / 60.0
            run_level = _classify_level(pace_min_per_km, (4.0, 5.0, 6.5), )
            run_level = _classify_level(run_threshold_pace, (300, 360, 420))
        else:
            run_level = "unknown"

        if swim_pace is not None:
            swim_level = _classify_level(swim_pace, (90, 110, 130))
        else:
            swim_level = "unknown"

        levels = {"swim": swim_level, "bike": bike_level, "run": run_level}
        order = ["elite", "advanced", "intermediate", "beginner", "unknown"]
        limiter = min(levels.items(), key=lambda x: order.index(x[1]) if x[1] in order else 99)
        primary_limiter = f"{limiter[0].title()} ({limiter[1]})"

        predicted_finish = None
        if ftp is not None and run_threshold_pace is not None:
            swim_min = 35
            t1 = 3
            bike_min = (90 / (ftp / weight_kg * 0.75 * 3.6 / 100)) * 60 if ftp else 160
            t2 = 2
            run_min = run_threshold_pace / 60 * 21.1 * 1.05 if run_threshold_pace else 120
            predicted_finish = int((swim_min + t1 + bike_min + t2 + run_min) * 60)

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
