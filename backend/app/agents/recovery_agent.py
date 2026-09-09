from app.agents.state import AgentState, RecoveryOutput


def recovery_agent(state: AgentState) -> AgentState:
    """Analyze Garmin recovery data and produce a recovery score + recommendation."""
    garmin = state.get("garmin_data", {})
    errors = state.get("errors", [])

    try:
        hrv_rmssd = garmin.get("hrv_rmssd")
        hrv_baseline = garmin.get("hrv_baseline")
        sleep_score = garmin.get("sleep_score")
        body_battery = garmin.get("body_battery_morning")
        stress_avg = garmin.get("stress_avg")
        recovery_time = garmin.get("recovery_time_hours")
        readiness_score = garmin.get("training_readiness_score")

        score = 50
        hrv_trend = "stable"
        status = "Moderate"
        recommendation = "Proceed with planned training."

        if hrv_rmssd is not None and hrv_baseline is not None and hrv_baseline > 0:
            hrv_pct = (hrv_rmssd - hrv_baseline) / hrv_baseline * 100
            if hrv_pct <= -15:
                score -= 25
                hrv_trend = "significantly_suppressed"
            elif hrv_pct <= -8:
                score -= 12
                hrv_trend = "suppressed"
            elif hrv_pct >= 8:
                score += 15
                hrv_trend = "elevated"
            else:
                hrv_trend = "stable"
        elif readiness_score is not None:
            score = readiness_score

        if sleep_score is not None:
            if sleep_score >= 80:
                score += 15
            elif sleep_score >= 65:
                score += 5
            elif sleep_score < 50:
                score -= 20
            elif sleep_score < 65:
                score -= 10

        if body_battery is not None:
            if body_battery >= 75:
                score += 10
            elif body_battery >= 50:
                score += 5
            elif body_battery < 30:
                score -= 15

        if stress_avg is not None:
            if stress_avg > 60:
                score -= 10
            elif stress_avg < 25:
                score += 5

        score = max(0, min(100, score))

        if score >= 80:
            status = "Ready for quality session"
            recommendation = "HRV and sleep data indicate high readiness. Proceed with planned quality work or increase intensity if scheduled."
        elif score >= 65:
            status = "Ready for moderate training"
            recommendation = "Recovery metrics are adequate. Complete planned session at prescribed intensity."
        elif score >= 45:
            status = "Moderate fatigue — reduce intensity"
            recommendation = "Recovery is suboptimal. Reduce intensity by 10-15%. Replace intervals with Zone 2 endurance work."
        else:
            status = "Significant fatigue — prioritize recovery"
            recommendation = "Recovery data indicates significant accumulated fatigue. Replace workout with Zone 1 active recovery or full rest."

        output = RecoveryOutput(
            score=score,
            status=status,
            hrv_rmssd=hrv_rmssd,
            hrv_trend=hrv_trend,
            sleep_score=sleep_score,
            body_battery=body_battery,
            stress_level=stress_avg,
            recovery_time_hours=recovery_time,
            recommendation=recommendation,
            is_high_readiness=score >= 80,
            is_low_readiness=score < 45,
        )

    except Exception as e:
        errors.append(f"RecoveryAgent error: {str(e)}")
        output = RecoveryOutput(
            score=50,
            status="Data unavailable",
            recommendation="Unable to assess recovery. Proceed with caution.",
        )

    return {**state, "recovery_output": output, "errors": errors}
