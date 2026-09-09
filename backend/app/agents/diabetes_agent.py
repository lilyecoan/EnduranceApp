from app.agents.state import AgentState, DiabetesOutput

DISCLAIMER = (
    "⚠️ MEDICAL DISCLAIMER: The following suggestions are general training support information only. "
    "They are NOT medical advice. Always consult your endocrinologist or diabetes care team "
    "for insulin management and all medical decisions related to your diabetes."
)


def diabetes_agent(state: AgentState) -> AgentState:
    """Generate diabetes-aware fueling and monitoring suggestions. No medication recommendations."""
    ctx = state["athlete_context"]
    errors = state.get("errors", [])

    if not ctx.has_type1_diabetes:
        return {**state, "diabetes_output": None, "errors": errors}

    try:
        garmin = state.get("garmin_data", {})
        today_sport = garmin.get("today_workout_sport", "none")
        duration_min = garmin.get("today_workout_duration_min", 0)
        intensity = garmin.get("today_workout_intensity", "moderate")

        fueling_suggestions = []
        monitoring_suggestions = []
        risk_notes = []

        monitoring_suggestions.append(
            "Check blood glucose 30 minutes before any training session."
        )
        monitoring_suggestions.append(
            "Target pre-exercise glucose between 120-180 mg/dL (6.7-10 mmol/L) for most training sessions."
        )

        if duration_min >= 30:
            monitoring_suggestions.append(
                f"For this {duration_min}-minute session, check glucose mid-workout if possible."
            )

        if duration_min >= 60:
            fueling_suggestions.append(
                "Plan carbohydrate intake during exercise. Glucose-fructose blends (maltodextrin + fructose) "
                "are well tolerated and oxidize efficiently."
            )
            fueling_suggestions.append(
                "Carry fast-acting glucose (gel, chews, or juice) at all times during training."
            )
            risk_notes.append(
                "Extended sessions increase hypoglycemia risk both during and for up to 12-24 hours post-exercise."
            )

        if intensity in ("high", "intervals", "race_pace"):
            risk_notes.append(
                "High-intensity intervals and sprint efforts can temporarily raise blood glucose "
                "due to catecholamine response. This is normal and does not necessarily require insulin correction."
            )
            fueling_suggestions.append(
                "For high-intensity sessions, be prepared for post-exercise glucose rise followed by delayed hypoglycemia."
            )

        if today_sport in ("cycling", "brick"):
            fueling_suggestions.append(
                "For cycling/brick sessions, a target of 60-90g carbs/hour is typical — "
                "adjust based on your personal glucose response and your care team's guidance."
            )
        elif today_sport == "running":
            fueling_suggestions.append(
                "Running tends to lower blood glucose more consistently than cycling. "
                "Monitor closely and adjust fueling accordingly."
            )
        elif today_sport == "swimming":
            monitoring_suggestions.append(
                "Swimming makes real-time glucose monitoring difficult. "
                "Test immediately before entering the water and immediately after."
            )

        monitoring_suggestions.append(
            "Check glucose immediately post-exercise and again 2 hours later to detect delayed hypoglycemia."
        )
        fueling_suggestions.append(
            "Post-workout: include both protein and carbohydrates in recovery nutrition within 30 minutes."
        )

        output = DiabetesOutput(
            fueling_suggestions=fueling_suggestions,
            monitoring_suggestions=monitoring_suggestions,
            risk_notes=risk_notes,
            disclaimer=DISCLAIMER,
        )

    except Exception as e:
        errors.append(f"DiabetesAgent error: {str(e)}")
        output = DiabetesOutput(
            fueling_suggestions=["Carry fast-acting glucose at all times."],
            monitoring_suggestions=["Check glucose before, during, and after exercise."],
            risk_notes=[],
            disclaimer=DISCLAIMER,
        )

    return {**state, "diabetes_output": output, "errors": errors}
