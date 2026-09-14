"""Head Coach orchestrator — LangGraph workflow that runs all sub-agents and synthesizes with Gemini."""
from datetime import date
from typing import Optional

from langgraph.graph import StateGraph, END

from app.agents.state import AgentState, AthleteContext, CoachingPlan
from app.agents.recovery_agent import recovery_agent
from app.agents.training_load_agent import training_load_agent
from app.agents.performance_agent import performance_agent
from app.agents.nutrition_agent import nutrition_agent
from app.agents.diabetes_agent import diabetes_agent
from app.agents.weather_agent import weather_agent
from app.agents.race_strategy_agent import race_strategy_agent
from app.services.reference_service import get_hardcoded_context
from app.core.config import settings


def _build_persona(ctx: AthleteContext) -> str:
    """Describe the athlete being coached from their actual persisted context.

    Previously this was a fixed string naming a specific real person
    ("Lily Coan"), her age, and her medical conditions, regardless of which
    account's request was running — that content must never be attributed
    to another athlete.
    """
    lines = []
    if ctx.age is not None:
        lines.append(f"Age: {ctx.age}")
    if ctx.has_type1_diabetes:
        lines.append("Medical: Type 1 Diabetes (T1D) — never recommend insulin adjustments.")
    if ctx.race_date and ctx.race_distance:
        race_bit = f"Race goal: {ctx.race_distance} on {ctx.race_date}"
        if ctx.weeks_to_race is not None:
            race_bit += f" (~{ctx.weeks_to_race} weeks away)"
        lines.append(race_bit)
    stats = []
    if ctx.ftp_watts:
        stats.append(f"FTP {ctx.ftp_watts}W")
    if ctx.weight_kg:
        stats.append(f"Weight {ctx.weight_kg}kg")
    if ctx.vo2_max:
        stats.append(f"VO2max {ctx.vo2_max}")
    if stats:
        lines.append(" | ".join(stats))
    if not lines:
        lines.append("No profile details on file yet — coach generally and encourage completing onboarding.")
    return "\n".join(lines)


async def _gemini_synthesize(
    agent_summary: str, athlete_context: str, reference_context: str
) -> tuple[Optional[str], Optional[str]]:
    """Call Gemini to synthesize a unified coaching narrative.

    Returns (message, error) — exactly one is set. Callers must not infer
    an error from a string prefix.
    """
    if not settings.gemini_api_key:
        return None, "Gemini API key not configured"
    try:
        from google import genai

        client = genai.Client(api_key=settings.gemini_api_key)

        prompt = f"""You are IronMind AI, an expert endurance coach.
You are coaching the athlete described below. All advice must be grounded in their actual
data — never invent conditions, races, or stats not listed here.

--- ATHLETE ---
{athlete_context}

--- COACHING REFERENCE KNOWLEDGE ---
{reference_context[:3000]}

--- TODAY'S AGENT ASSESSMENTS ---
{agent_summary}

Provide a unified coaching message for today (3-4 sentences). Be specific, practical, and warm.
Address medical conditions only if listed above, and only as general training-support notes —
never give medical advice or recommend insulin/medication adjustments.
End with one specific actionable priority for today."""

        response = await client.aio.models.generate_content(
            model=settings.gemini_model, contents=prompt
        )
        text = (response.text or "").strip()
        if not text:
            return None, "Gemini returned an empty response"
        return text, None
    except Exception as e:
        return None, str(e)


async def head_coach_synthesize(state: AgentState) -> AgentState:
    """Combine all agent outputs into a unified daily coaching plan."""
    recovery = state.get("recovery_output")
    training_load = state.get("training_load_output")
    performance = state.get("performance_output")
    nutrition = state.get("nutrition_output")
    diabetes = state.get("diabetes_output")
    weather = state.get("weather_output")
    race_strategy = state.get("race_strategy_output")
    ctx = state["athlete_context"]

    key_messages = []
    today_workout = None
    recommendation = ""

    # Previously an if/elif — when both a recovery alert AND a training-load
    # reduce advisory fired, the load advisory's key_messages entry was
    # silently dropped. Recovery still takes priority for the recommended
    # workout, but both messages are now always surfaced.
    if recovery and recovery.is_low_readiness:
        recommendation = recovery.recommendation
        today_workout = {
            "type": "recovery",
            "name": "Easy Active Recovery",
            "sport": "run or walk",
            "duration_min": 25,
            "intensity": "Zone 1",
            "description": "Very easy movement only. Keep heart rate low. Stop if anything feels wrong.",
        }
        key_messages.append(f"Recovery Alert: {recovery.status}")

    if training_load and training_load.should_reduce:
        if not today_workout:
            recommendation = training_load.recommendation
            today_workout = {
                "type": "endurance",
                "name": "Reduced Zone 2 Session",
                "sport": "bike or run",
                "duration_min": 30,
                "intensity": "Zone 2",
                "description": "Reduce planned session 20%. Zone 2 only.",
            }
        key_messages.append(f"Load Advisory: {training_load.load_status}")

    if weather and weather.heat_stress:
        key_messages.append(f"Heat advisory: {weather.pacing_note or 'Add 150ml/hr fluid.'}")

    if nutrition:
        workout_note = "" if nutrition.has_scheduled_workout else " (no workout scheduled today — rest-day estimate)"
        key_messages.append(
            f"Fueling: {nutrition.daily_calories} kcal | C: {nutrition.carbs_g}g P: {nutrition.protein_g}g F: {nutrition.fat_g}g{workout_note}"
        )

    if diabetes:
        key_messages.append("T1D reminder: check glucose before/during/after training.")

    # Build agent summary for Gemini
    agent_summary_parts = []
    if recovery:
        score_str = f"{recovery.score}/100" if recovery.score is not None else "no data"
        agent_summary_parts.append(
            f"Recovery score: {score_str} | Status: {recovery.status} | HRV: {recovery.hrv_rmssd}ms (baseline {state['garmin_data'].get('hrv_baseline')}ms)"
        )
    if training_load:
        agent_summary_parts.append(f"Training Load: {training_load.load_status} | TSB: {training_load.tsb} | Phase: {training_load.training_phase} | Risk: {training_load.risk_level}")
    if nutrition:
        agent_summary_parts.append(f"Nutrition: {nutrition.daily_calories} kcal, {nutrition.carbs_g}g carbs, {nutrition.protein_g}g protein")

    agent_summary = "\n".join(agent_summary_parts)
    athlete_ctx_str = _build_persona(ctx)

    reference_ctx = get_hardcoded_context()
    gemini_message, gemini_error = await _gemini_synthesize(agent_summary, athlete_ctx_str, reference_ctx)
    if gemini_message:
        recommendation = gemini_message
    elif not recommendation:
        # No rule-based recommendation fired above and Gemini didn't return
        # one either — say so honestly instead of leaving an empty string
        # or silently reusing a stale value.
        recommendation = "No new plan generated today."
        if gemini_error:
            key_messages.append(f"AI coaching narrative unavailable: {gemini_error}")

    confidence_factors = []
    if recovery and recovery.score is not None:
        confidence_factors.append(recovery.score / 100)
    if training_load:
        # Scale by how much real signal actually backs this assessment,
        # rather than a flat, always-0.85 contribution regardless of data.
        signal_fields = [training_load.ctl, training_load.atl, training_load.tsb]
        completeness = sum(1 for f in signal_fields if f is not None) / len(signal_fields)
        confidence_factors.append(0.5 + 0.4 * completeness)
    confidence = sum(confidence_factors) / len(confidence_factors) if confidence_factors else 0.3

    plan = CoachingPlan(
        date=date.today(),
        recovery=recovery,
        training_load=training_load,
        performance=performance,
        nutrition=nutrition,
        diabetes=diabetes,
        weather=weather,
        race_strategy=race_strategy,
        today_recommendation=recommendation,
        today_workout=today_workout,
        key_messages=key_messages,
        confidence=round(confidence, 2),
    )

    return {**state, "coaching_plan": plan}


def build_head_coach_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("recovery", recovery_agent)
    graph.add_node("training_load", training_load_agent)
    graph.add_node("performance", performance_agent)
    graph.add_node("nutrition", nutrition_agent)
    graph.add_node("diabetes", diabetes_agent)
    graph.add_node("weather", weather_agent)
    graph.add_node("race_strategy", race_strategy_agent)
    graph.add_node("head_coach", head_coach_synthesize)

    graph.set_entry_point("recovery")
    graph.add_edge("recovery", "training_load")
    graph.add_edge("training_load", "performance")
    graph.add_edge("performance", "nutrition")
    graph.add_edge("nutrition", "diabetes")
    graph.add_edge("diabetes", "weather")
    graph.add_edge("weather", "race_strategy")
    graph.add_edge("race_strategy", "head_coach")
    graph.add_edge("head_coach", END)

    return graph.compile()


HeadCoachGraph = build_head_coach_graph()
