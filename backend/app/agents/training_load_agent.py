from app.agents.state import AgentState, TrainingLoadOutput
from datetime import date


def _determine_phase(weeks_to_race: int | None) -> str:
    if weeks_to_race is None:
        return "base"
    if weeks_to_race <= 0:
        return "race"
    if weeks_to_race <= 2:
        return "taper"
    if weeks_to_race <= 6:
        return "peak"
    if weeks_to_race <= 14:
        return "build"
    return "base"


def training_load_agent(state: AgentState) -> AgentState:
    """Analyze CTL/ATL/TSB and weekly load to assess training status."""
    garmin = state.get("garmin_data", {})
    ctx = state["athlete_context"]
    errors = state.get("errors", [])

    try:
        ctl = garmin.get("ctl")
        atl = garmin.get("atl")
        tsb = garmin.get("tsb")
        acute_load = garmin.get("acute_load")
        weeks_to_race = ctx.weeks_to_race

        phase = _determine_phase(weeks_to_race)

        load_status = "Unknown"
        risk_level = "Low"
        recommendation = "Proceed with planned training."
        can_progress = False
        should_reduce = False

        if tsb is not None:
            if tsb > 25:
                load_status = "Very fresh — possible detraining"
                risk_level = "Low"
                recommendation = "Form is very high. Consider adding volume or intensity to maintain adaptation."
                can_progress = True
            elif tsb >= 5:
                load_status = "Fresh — good form"
                risk_level = "Low"
                recommendation = "Excellent training window. Proceed with quality sessions."
                can_progress = True
            elif tsb >= -10:
                load_status = "Optimal training load"
                risk_level = "Low"
                recommendation = "Training load is in the productive zone. Maintain current plan."
                can_progress = True
            elif tsb >= -25:
                load_status = "Moderate fatigue"
                risk_level = "Moderate"
                recommendation = "Training stress is accumulating. Monitor recovery metrics closely. Ensure adequate sleep and nutrition."
                should_reduce = False
            elif tsb >= -40:
                load_status = "High fatigue"
                risk_level = "High"
                recommendation = "Significant training stress detected. Consider reducing volume 10-20% and ensuring full recovery days."
                should_reduce = True
            else:
                load_status = "Overreaching risk"
                risk_level = "High"
                recommendation = "TSB indicates overreaching territory. Mandatory recovery week recommended. Reduce load 30-40%."
                should_reduce = True
        elif ctl is not None:
            if ctl < 40:
                load_status = "Low fitness base"
                risk_level = "Low"
                recommendation = "Build aerobic base progressively. Focus on consistency."
                can_progress = True
            elif ctl < 70:
                load_status = "Moderate fitness"
                risk_level = "Low"
                recommendation = "Solid aerobic base. Continue building toward race-specific fitness."
                can_progress = True
            elif ctl < 100:
                load_status = "High fitness"
                risk_level = "Moderate"
                recommendation = "High training load. Maintain quality over quantity."
            else:
                load_status = "Elite fitness load"
                risk_level = "Moderate"
                recommendation = "Very high CTL. Monitor fatigue carefully to avoid overtraining."

        output = TrainingLoadOutput(
            ctl=ctl,
            atl=atl,
            tsb=tsb,
            acute_load=acute_load,
            load_status=load_status,
            risk_level=risk_level,
            recommendation=recommendation,
            training_phase=phase,
            can_progress=can_progress,
            should_reduce=should_reduce,
        )

    except Exception as e:
        errors.append(f"TrainingLoadAgent error: {str(e)}")
        output = TrainingLoadOutput(
            load_status="Unknown",
            risk_level="Unknown",
            recommendation="Training load data unavailable.",
            training_phase="base",
        )

    return {**state, "training_load_output": output, "errors": errors}
