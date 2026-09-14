from app.agents.state import AgentState, NutritionOutput


def nutrition_agent(state: AgentState) -> AgentState:
    """Generate daily nutrition and fueling recommendations."""
    ctx = state["athlete_context"]
    errors = state.get("errors", [])

    try:
        weight_kg = ctx.weight_kg or 70.0
        # Previously read today_workout_sport/duration_min/intensity from
        # garmin_data, fields the Garmin service never populates, so this
        # always silently fell through to "rest day" defaults regardless of
        # the athlete's actual plan. scheduled_workout is an explicit lookup
        # result from the router (None means "genuinely nothing scheduled",
        # not "field was missing").
        scheduled = state.get("scheduled_workout")
        has_scheduled_workout = scheduled is not None
        today_sport = scheduled["sport"] if scheduled else "none"
        today_duration_min = scheduled["duration_min"] if scheduled else 0
        today_intensity = scheduled["intensity"] if scheduled else "moderate"

        is_training_day = today_duration_min > 30
        is_high_intensity = today_intensity in ("high", "race_pace", "intervals")
        is_long_session = today_duration_min >= 90

        if is_high_intensity:
            protein_g = weight_kg * 1.8
            carbs_g = weight_kg * 6.5
            fat_g = weight_kg * 1.0
        elif is_training_day:
            protein_g = weight_kg * 1.6
            carbs_g = weight_kg * 5.0
            fat_g = weight_kg * 1.2
        else:
            protein_g = weight_kg * 1.4
            carbs_g = weight_kg * 3.5
            fat_g = weight_kg * 1.1

        # daily_calories is derived FROM the macro targets above, not from a
        # second, independent per-kg energy formula — the two previously
        # disagreed (e.g. 70kg rest day: 1,960 kcal from the flat formula vs
        # 2,065 kcal implied by summing the macros below).
        daily_calories = round(protein_g * 4 + carbs_g * 4 + fat_g * 9)

        pre_workout_carbs = 40.0 if is_training_day else None
        if is_long_session:
            if today_sport == "cycling":
                intra_carbs_per_hour = 90.0
            elif today_sport in ("running", "brick"):
                intra_carbs_per_hour = 60.0
            elif today_sport == "swimming":
                intra_carbs_per_hour = 30.0
            else:
                intra_carbs_per_hour = 60.0
        elif is_training_day and today_duration_min >= 60:
            intra_carbs_per_hour = 45.0
        else:
            intra_carbs_per_hour = 0.0

        hydration_ml = 500
        sodium_mg = 400
        if is_training_day:
            hydration_ml = 750
            sodium_mg = 700
        if is_long_session:
            hydration_ml = 900
            sodium_mg = 1000

        reasoning_parts = [
            f"Body weight {weight_kg}kg → base metabolic needs.",
        ]
        if is_training_day:
            reasoning_parts.append(
                f"Training session: {today_sport} {today_duration_min}min at {today_intensity} intensity."
            )
        if is_long_session:
            reasoning_parts.append("Session >90min → intra-workout carbohydrate fueling required.")

        output = NutritionOutput(
            has_scheduled_workout=has_scheduled_workout,
            daily_calories=daily_calories,
            protein_g=round(protein_g, 1),
            carbs_g=round(carbs_g, 1),
            fat_g=round(fat_g, 1),
            pre_workout_carbs_g=pre_workout_carbs,
            intra_carbs_g_per_hour=intra_carbs_per_hour if intra_carbs_per_hour > 0 else None,
            hydration_ml_per_hour=hydration_ml,
            sodium_mg_per_hour=sodium_mg,
            reasoning=" ".join(reasoning_parts),
        )

    except Exception as e:
        errors.append(f"NutritionAgent error: {str(e)}")
        weight_kg = ctx.weight_kg or 70.0
        fallback_protein_g = weight_kg * 1.6
        fallback_carbs_g = weight_kg * 4.0
        fallback_fat_g = weight_kg * 1.1
        output = NutritionOutput(
            daily_calories=round(fallback_protein_g * 4 + fallback_carbs_g * 4 + fallback_fat_g * 9),
            protein_g=fallback_protein_g,
            carbs_g=fallback_carbs_g,
            fat_g=fallback_fat_g,
            hydration_ml_per_hour=750,
            sodium_mg_per_hour=700,
            reasoning="Default recommendations based on body weight only (an error occurred computing the full assessment).",
        )

    return {**state, "nutrition_output": output, "errors": errors}
