from typing import TypedDict, Optional, List, Any
from pydantic import BaseModel
from datetime import date


class AthleteContext(BaseModel):
    user_id: str
    age: Optional[int] = None
    weight_kg: Optional[float] = None
    ftp_watts: Optional[float] = None
    vo2_max: Optional[float] = None
    lactate_threshold_hr: Optional[int] = None
    max_hr: Optional[int] = None
    has_type1_diabetes: bool = False
    race_date: Optional[date] = None
    race_distance: Optional[str] = None
    weeks_to_race: Optional[int] = None


class RecoveryOutput(BaseModel):
    score: int
    status: str
    hrv_rmssd: Optional[float] = None
    hrv_trend: Optional[str] = None
    sleep_score: Optional[int] = None
    body_battery: Optional[int] = None
    stress_level: Optional[int] = None
    recovery_time_hours: Optional[int] = None
    recommendation: str
    is_high_readiness: bool = False
    is_low_readiness: bool = False


class TrainingLoadOutput(BaseModel):
    ctl: Optional[float] = None
    atl: Optional[float] = None
    tsb: Optional[float] = None
    acute_load: Optional[float] = None
    load_status: str
    risk_level: str
    recommendation: str
    training_phase: str
    can_progress: bool = False
    should_reduce: bool = False


class PerformanceOutput(BaseModel):
    swim_level: str
    bike_level: str
    run_level: str
    primary_limiter: str
    ftp_trend: Optional[str] = None
    vo2_max_trend: Optional[str] = None
    fitness_trajectory: str
    predicted_race_finish: Optional[int] = None


class NutritionOutput(BaseModel):
    daily_calories: int
    protein_g: float
    carbs_g: float
    fat_g: float
    pre_workout_carbs_g: Optional[float] = None
    intra_carbs_g_per_hour: Optional[float] = None
    hydration_ml_per_hour: int
    sodium_mg_per_hour: int
    reasoning: str


class DiabetesOutput(BaseModel):
    fueling_suggestions: List[str]
    monitoring_suggestions: List[str]
    risk_notes: List[str]
    disclaimer: str = (
        "These are general training support suggestions only. "
        "Always consult your endocrinologist for medical decisions regarding "
        "insulin management and diabetes care."
    )


class WeatherOutput(BaseModel):
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    wind_kph: Optional[float] = None
    condition: Optional[str] = None
    heat_stress: bool = False
    hydration_adjustment_ml: int = 0
    sodium_adjustment_mg: int = 0
    pacing_note: Optional[str] = None


class RaceStrategyOutput(BaseModel):
    swim_pace_per_100m: Optional[float] = None
    bike_watts_target: Optional[float] = None
    run_pace_target: Optional[float] = None
    predicted_finish_seconds: Optional[int] = None
    fueling_plan: List[dict] = []
    taper_notes: Optional[str] = None
    key_race_notes: List[str] = []


class CoachingPlan(BaseModel):
    date: date
    recovery: Optional[RecoveryOutput] = None
    training_load: Optional[TrainingLoadOutput] = None
    performance: Optional[PerformanceOutput] = None
    nutrition: Optional[NutritionOutput] = None
    diabetes: Optional[DiabetesOutput] = None
    weather: Optional[WeatherOutput] = None
    race_strategy: Optional[RaceStrategyOutput] = None

    today_recommendation: str = ""
    today_workout: Optional[dict] = None
    weekly_plan: List[dict] = []
    key_messages: List[str] = []
    confidence: float = 0.0


class AgentState(TypedDict):
    athlete_context: AthleteContext
    garmin_data: dict
    recovery_output: Optional[RecoveryOutput]
    training_load_output: Optional[TrainingLoadOutput]
    performance_output: Optional[PerformanceOutput]
    nutrition_output: Optional[NutritionOutput]
    diabetes_output: Optional[DiabetesOutput]
    weather_output: Optional[WeatherOutput]
    race_strategy_output: Optional[RaceStrategyOutput]
    coaching_plan: Optional[CoachingPlan]
    errors: List[str]
