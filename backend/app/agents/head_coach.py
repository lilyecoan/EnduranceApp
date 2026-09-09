"""Head Coach orchestrator — LangGraph workflow that runs all sub-agents and synthesizes with Gemini."""
import asyncio
from datetime import date
from langgraph.graph import StateGraph, END

from app.agents.state import AgentState, CoachingPlan
from app.agents.recovery_agent import recovery_agent
from app.agents.training_load_agent import training_load_agent
from app.agents.performance_agent import performance_agent
from app.agents.nutrition_agent import nutrition_agent
from app.agents.diabetes_agent import diabetes_agent
from app.agents.weather_agent import weather_agent
from app.agents.race_strategy_agent import race_strategy_agent
from app.services.reference_service import get_hardcoded_context
from app.core.config import settings


def _gemini_synthesize(agent_summary: str, athlete_context: dict, reference_context: str) -> str:
    """Call Gemini to synthesize a unified coaching narrative."""
    if not settings.gemini_api_key:
        return ""
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.gemini_model)

        prompt = f"""You are IronMind AI, an expert endurance coach specializing in Ironman 70.3 triathlon.
You are coaching Lily Coan, a 22-year-old female athlete with the following medical conditions:
- Type 1 Diabetes (T1D)
- Celiac Disease (strict gluten-free)
- Hashimoto's Thyroiditis
- Rheumatoid Arthritis (RA)

Race goal: Ironman 70.3 Galveston (April 4, 2027) — approximately 34 weeks away.
Current FTP: 128W | Weight: 63.5kg | VO₂max: 45

--- COACHING REFERENCE KNOWLEDGE ---
{reference_context[:3000]}

--- TODAY'S AGENT ASSESSMENTS ---
{agent_summary}

--- ATHLETE CONTEXT ---
{athlete_context}

Provide a unified coaching message for today (3-4 sentences). Be specific, practical, and warm.
Address her medical conditions where relevant. All nutrition must be gluten-free.
Never give medical advice or recommend insulin adjustments.
End with one specific actionable priority for today."""

        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"[Gemini unavailable: {e}]"


def head_coach_synthesize(state: AgentState) -> AgentState:
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

    if recovery and recovery.is_low_readiness:
        recommendation = recovery.recommendation
        today_workout = {
            "type": "recovery",
            "name": "Easy Active Recovery",
            "sport": "run or walk",
            "duration_min": 25,
            "intensity": "Zone 1",
            "description": "Very easy movement only. HR below 118bpm. If RA flare — rest completely.",
        }
        key_messages.append(f"Recovery Alert: {recovery.status}")
    elif training_load and training_load.should_reduce:
        recommendation = training_load.recommendation
        today_workout = {
            "type": "endurance",
            "name": "Reduced Zone 2 Session",
            "sport": "bike or run",
            "duration_min": 30,
            "intensity": "Zone 2",
            "description": "Reduce planned session 20%. Zone 2 only. Protect joints (RA).",
        }
        key_messages.append(f"Load Advisory: {training_load.load_status}")

    if weather and weather.heat_stress:
        key_messages.append(f"Heat advisory: {weather.pacing_note or 'Add 150ml/hr fluid.'}")

    if nutrition:
        key_messages.append(
            f"Fueling: {nutrition.daily_calories} kcal | C: {nutrition.carbs_g}g P: {nutrition.protein_g}g F: {nutrition.fat_g}g — ALL GF"
        )

    if diabetes and diabetes.disclaimer:
        key_messages.append("T1D reminder: check glucose before/during/after training.")

    # Build agent summary for Gemini
    agent_summary_parts = []
    if recovery:
        agent_summary_parts.append(f"Recovery score: {recovery.score}/100 | Status: {recovery.status} | HRV: {recovery.hrv_rmssd}ms (baseline {state['garmin_data'].get('hrv_baseline')}ms)")
    if training_load:
        agent_summary_parts.append(f"Training Load: {training_load.load_status} | TSB: {training_load.tsb} | Phase: {training_load.training_phase} | Risk: {training_load.risk_level}")
    if nutrition:
        agent_summary_parts.append(f"Nutrition: {nutrition.daily_calories} kcal, {nutrition.carbs_g}g carbs, {nutrition.protein_g}g protein")

    agent_summary = "\n".join(agent_summary_parts)
    athlete_ctx_str = f"Weeks to race: {ctx.weeks_to_race} | FTP: {ctx.ftp_watts}W | Weight: {ctx.weight_kg}kg | T1D: {ctx.has_type1_diabetes}"

    # Get Gemini synthesis (sync call — LangGraph runs synchronously)
    reference_ctx = get_hardcoded_context()
    gemini_message = _gemini_synthesize(agent_summary, athlete_ctx_str, reference_ctx)
    if gemini_message and not gemini_message.startswith("[Gemini"):
        recommendation = gemini_message

    confidence_factors = []
    if recovery:
        confidence_factors.append(recovery.score / 100)
    if training_load:
        confidence_factors.append(0.85)
    confidence = sum(confidence_factors) / len(confidence_factors) if confidence_factors else 0.7

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
